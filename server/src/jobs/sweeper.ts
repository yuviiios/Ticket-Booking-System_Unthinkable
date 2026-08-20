import prisma from '../lib/db.js';
import { env } from '../config/env.js';
import { emitSeatUpdate } from '../realtime/socket.js';
import { tryAssignWaitlist } from '../lib/waitlist.js';

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
        // TODO: await drainEmailOutbox();
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
