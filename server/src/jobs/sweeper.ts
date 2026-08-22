import prisma from '../lib/db.js';
import { env } from '../config/env.js';
import { emitSeatUpdate } from '../realtime/socket.js';
import { tryAssignWaitlist } from '../lib/waitlist.js';
import { sendEmail, renderBookingEmail } from '../lib/mailer.js';

const LOCK_KEY = 9876543210; // Arbitrary unique key

export function startSweeper() {
  const interval = env.SWEEP_INTERVAL_MS;

  console.log(`Sweeper started, running every ${interval}ms`);

  setInterval(async () => {
    try {
      // Advisory lock - only one instance runs at a time
      const lock = await prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
        SELECT pg_try_advisory_lock(${LOCK_KEY})
      `;

      if (!lock[0]?.pg_try_advisory_lock) {
        return; // Another instance is running
      }

      try {
        await sweepExpiredHolds();
        await sweepExpiredOffers();
        await drainEmailOutbox();
      } finally {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_KEY})`;
      }
    } catch (err) {
      console.error('Sweeper error:', err);
    }
  }, interval);
}

async function sweepExpiredHolds() {
  const now = new Date();

  const expired = await prisma.seatHold.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lte: now },
    },
    take: 100,
  });

  if (expired.length === 0) return;

  console.log(`Sweeping ${expired.length} expired holds`);

  for (const hold of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.seatHold.update({
          where: { id: hold.id },
          data: { status: 'EXPIRED' },
        });

        const released = await tx.$executeRaw`
          UPDATE "ShowSeat"
          SET status = 'AVAILABLE'::"ShowSeatStatus",
              "holdId" = NULL,
              "heldUntil" = NULL,
              version = version + 1
          WHERE "holdId" = ${hold.id}
            AND status = 'HELD'::"ShowSeatStatus"
        `;

        if (released > 0) {
          const updatedSeats = await tx.showSeat.findMany({
            where: { showId: hold.showId, status: 'AVAILABLE', holdId: null },
          });

          // Emit after commit - will happen after transaction completes
          setImmediate(() => {
            emitSeatUpdate(
              hold.showId,
              updatedSeats.map((ss) => ({
                seatId: ss.seatId,
                status: ss.status,
                heldUntil: null,
              }))
            );
          });
        }
      });
    } catch (err) {
      console.error(`Failed to sweep hold ${hold.id}:`, err);
    }
  }
}

async function sweepExpiredOffers() {
  const now = new Date();

  const expired = await prisma.waitlistOffer.findMany({
    where: {
      status: 'WAITING',
      expiresAt: { lte: now },
    },
    include: { entry: true },
    take: 100,
  });

  if (expired.length === 0) return;

  console.log(`Sweeping ${expired.length} expired offers`);

  for (const offer of expired) {
    try {
      await prisma.$transaction(async (tx) => {
        // Mark offer as expired
        await tx.waitlistOffer.update({
          where: { id: offer.id },
          data: { status: 'EXPIRED' },
        });

        // Mark entry back to waiting
        await tx.waitlistEntry.update({
          where: { id: offer.entryId },
          data: { status: 'WAITING' },
        });

        // Release offered seats
        const released = await tx.$executeRaw`
          UPDATE "ShowSeat"
          SET status = 'AVAILABLE'::"ShowSeatStatus",
              "waitlistOfferId" = NULL,
              "heldUntil" = NULL,
              version = version + 1
          WHERE "waitlistOfferId" = ${offer.id}
            AND status = 'OFFERED'::"ShowSeatStatus"
        `;

        if (released > 0) {
          // Cascade to next in line
          setImmediate(() => {
            tryAssignWaitlist(offer.entry.showId, offer.entry.categoryId).catch((err) => {
              console.error(`Cascade waitlist failed for show ${offer.entry.showId}:`, err);
            });
          });
        }
      });
    } catch (err) {
      console.error(`Failed to sweep offer ${offer.id}:`, err);
    }
  }
}

async function drainEmailOutbox() {
  const pending = await prisma.emailOutbox.findMany({
    where: {
      status: 'PENDING',
      nextAttemptAt: { lte: new Date() },
    },
    take: 50,
  });

  if (pending.length === 0) return;

  console.log(`Draining ${pending.length} pending emails`);

  for (const email of pending) {
    try {
      const payload = email.payload as any;

      if (email.template === 'booking_confirmation') {
        const customer = await prisma.user.findUnique({
          where: { id: payload.customerId },
        });

        if (!customer) {
          await prisma.emailOutbox.update({
            where: { id: email.id },
            data: { status: 'FAILED', lastError: 'Customer not found' },
          });
          continue;
        }

        const qrCid = `qr-${payload.bookingRef}`;
        const qrDataUri = `data:image/png;base64,${payload.qrBuffer}`;

        const html = renderBookingEmail({
          customerName: customer.name,
          showTitle: payload.showTitle,
          showDate: payload.showDate,
          bookingRef: payload.bookingRef,
          seats: payload.seats,
          totalAmount: payload.totalAmount,
          qrCid,
          qrDataUri,
        });

        await sendEmail({
          to: customer.email,
          subject: `Booking Confirmed - ${payload.showTitle}`,
          html,
          attachments: [
            {
              filename: 'ticket-qr.png',
              content: Buffer.from(payload.qrBuffer, 'base64'),
              cid: qrCid,
            },
          ],
        });
      } else if (email.template === 'waitlist_offer') {
        const html = `
          <h2>Your Waitlist Offer - ${payload.showTitle}</h2>
          <p>Hi ${payload.customerName},</p>
          <p>A seat has become available for the ${payload.categoryName} category of ${payload.showTitle}.</p>
          <p><strong>Seats available:</strong> ${payload.seatsWanted}</p>
          <p><strong>Offer expires in:</strong> ${new Date(payload.expiresAt).toLocaleString()}</p>
          <p><a href="${payload.acceptUrl}">Accept Offer</a></p>
          <p>If you don't accept within the time limit, the seat will be offered to the next person on the waitlist.</p>
        `;

        await sendEmail({
          to: email.to,
          subject: `Seat Available - ${payload.showTitle}`,
          html,
        });
      }

      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { status: 'SENT', attempts: email.attempts + 1 },
      });
    } catch (err) {
      const nextAttempt = new Date(Date.now() + 60000); // Retry in 1 min
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: {
          attempts: email.attempts + 1,
          lastError: String(err),
          nextAttemptAt: email.attempts < 5 ? nextAttempt : undefined,
          status: email.attempts >= 5 ? 'FAILED' : 'PENDING',
        },
      });
      console.error(`Email send failed (attempt ${email.attempts + 1}):`, err);
    }
  }
}
