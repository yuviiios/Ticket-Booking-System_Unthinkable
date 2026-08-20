import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { generateBookingToken, generateQRCode, verifyBookingToken } from '../lib/qr.js';
import { sendEmail, renderBookingEmail } from '../lib/mailer.js';
import crypto from 'crypto';

const router = Router();

const createBookingSchema = z.object({
  holdId: z.number().int(),
});

// Generate unique booking ref
function generateBookingRef(): string {
  return `BK${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

// CUSTOMER: create booking from hold
router.post('/', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  const customerId = req.userId!;

  try {
    const { holdId } = createBookingSchema.parse(req.body);

    const hold = await prisma.seatHold.findUnique({
      where: { id: holdId },
      include: { show: { include: { venue: true, prices: true } } },
    });

    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    if (hold.customerId !== customerId) return res.status(403).json({ error: 'Not your hold' });
    if (hold.status !== 'ACTIVE') return res.status(409).json({ error: 'Hold not active' });
    if (hold.expiresAt < new Date()) return res.status(409).json({ error: 'Hold expired' });

    const bookingRef = generateBookingRef();

    const result = await prisma.$transaction(async (tx) => {
      // Lock seats
      const showSeats = await tx.showSeat.findMany({
        where: { holdId, status: 'HELD' },
        include: { seat: true },
        orderBy: { id: 'asc' },
      });

      if (showSeats.length === 0) {
        throw new Error('NO_SEATS');
      }

      // Calculate total
      const priceMap = new Map(hold.show.prices.map((p) => [p.categoryId, p.priceCents]));
      let totalCents = 0;
      const bookingSeatData = showSeats.map((ss) => {
        const price = priceMap.get(ss.categoryId) || 0;
        totalCents += price;
        return { showSeatId: ss.id, priceCents: price };
      });

      // Create booking
      const booking = await tx.booking.create({
        data: {
          bookingRef,
          showId: hold.showId,
          customerId,
          status: 'CONFIRMED',
          totalCents,
          seats: { create: bookingSeatData },
        },
        include: { seats: { include: { showSeat: { include: { seat: true } } } } },
      });

      // Update seats to BOOKED
      await tx.$executeRaw`
        UPDATE "ShowSeat"
        SET status = 'BOOKED'::"ShowSeatStatus",
            "bookingId" = ${booking.id},
            "holdId" = NULL,
            "heldUntil" = NULL,
            version = version + 1
        WHERE "holdId" = ${holdId}
      `;

      // Mark hold as CONVERTED
      await tx.seatHold.update({
        where: { id: holdId },
        data: { status: 'CONVERTED' },
      });

      return { booking, showSeats };
    });

    // Generate QR
    const token = generateBookingToken(bookingRef, hold.showId);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const qrData = `${clientUrl}/tickets/${token}`;
    const qrBuffer = await generateQRCode(qrData);

    // Fetch customer
    const customer = await prisma.user.findUnique({ where: { id: customerId } });

    // Send email
    const qrCid = `qr-${bookingRef}`;
    const emailHtml = renderBookingEmail({
      customerName: customer?.name || 'Customer',
      showTitle: hold.show.title,
      showDate: new Date(hold.show.startsAt).toLocaleString(),
      bookingRef,
      seats: result.showSeats.map((ss) => ({
        rowLabel: ss.seat.rowLabel,
        seatNumber: ss.seat.seatNumber,
      })),
      totalAmount: `$${(result.booking.totalCents / 100).toFixed(2)}`,
      qrCid,
    });

    await sendEmail({
      to: customer?.email || '',
      subject: `Booking Confirmed - ${hold.show.title}`,
      html: emailHtml,
      attachments: [
        {
          filename: 'ticket-qr.png',
          content: qrBuffer,
          cid: qrCid,
        },
      ],
    });

    res.status(201).json({
      bookingRef: result.booking.bookingRef,
      totalCents: result.booking.totalCents,
      seats: result.showSeats.map((ss) => ({
        rowLabel: ss.seat.rowLabel,
        seatNumber: ss.seat.seatNumber,
      })),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ errors: err.errors });
    }
    if (err.message === 'NO_SEATS') {
      return res.status(409).json({ error: 'Hold seats not available' });
    }
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Booking failed' });
  }
});

// CUSTOMER: get my bookings
router.get('/my', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { customerId: req.userId },
      include: {
        show: { select: { title: true, startsAt: true, venue: { select: { name: true } } } },
        seats: { include: { showSeat: { include: { seat: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(bookings);
  } catch {
    res.status(500).json({ error: 'Fetch bookings failed' });
  }
});

// Get booking by ref
router.get('/:ref', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingRef: req.params.ref },
      include: {
        show: { include: { venue: true } },
        customer: { select: { name: true, email: true } },
        seats: { include: { showSeat: { include: { seat: true } } } },
      },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.customerId !== req.userId) {
      return res.status(403).json({ error: 'Not your booking' });
    }

    res.json(booking);
  } catch {
    res.status(500).json({ error: 'Fetch booking failed' });
  }
});

// Verify QR token (organiser gate check)
router.get('/verify/token/:token', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const verified = verifyBookingToken(req.params.token);
    if (!verified) return res.status(400).json({ error: 'Invalid token' });

    const booking = await prisma.booking.findUnique({
      where: { bookingRef: verified.bookingRef },
      include: {
        show: { select: { id: true, title: true, startsAt: true, venue: { select: { name: true } } } },
        customer: { select: { name: true } },
        seats: { include: { showSeat: { include: { seat: true } } } },
      },
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.show.id !== verified.showId) {
      return res.status(400).json({ error: 'Token show mismatch' });
    }

    res.json({
      valid: true,
      booking: {
        ref: booking.bookingRef,
        status: booking.status,
        customer: booking.customer.name,
        show: booking.show.title,
        venue: booking.show.venue.name,
        startsAt: booking.show.startsAt,
        seats: booking.seats.map((bs) => ({
          rowLabel: bs.showSeat.seat.rowLabel,
          seatNumber: bs.showSeat.seat.seatNumber,
        })),
      },
    });
  } catch {
    res.status(500).json({ error: 'Verify failed' });
  }
});

export default router;
