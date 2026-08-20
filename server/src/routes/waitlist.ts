import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../lib/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { tryAssignWaitlist } from '../lib/waitlist.js';

const router = Router();

const joinWaitlistSchema = z.object({
  showId: z.number().int(),
  categoryId: z.number().int(),
  seatsWanted: z.number().int().min(1).max(10),
});

// CUSTOMER: join waitlist
router.post('/', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  const customerId = req.userId!;

  try {
    const { showId, categoryId, seatsWanted } = joinWaitlistSchema.parse(req.body);

    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show || show.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Show not available' });
    }

    // Check if already in waitlist
    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        showId,
        categoryId,
        customerId,
        status: { in: ['WAITING', 'OFFERED'] },
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Already in waitlist' });
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        showId,
        categoryId,
        customerId,
        seatsWanted,
        status: 'WAITING',
      },
    });

    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    res.status(500).json({ error: 'Join waitlist failed' });
  }
});

// CUSTOMER: get my waitlist entries
router.get('/my', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  try {
    const entries = await prisma.waitlistEntry.findMany({
      where: { customerId: req.userId },
      include: {
        show: { select: { title: true, startsAt: true, venue: { select: { name: true } } } },
        category: { select: { name: true } },
        offers: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(entries);
  } catch {
    res.status(500).json({ error: 'Fetch waitlist failed' });
  }
});

// CUSTOMER: leave waitlist
router.delete('/:id', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  try {
    const entryId = parseInt(req.params.id);
    const customerId = req.userId!;

    const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    if (entry.customerId !== customerId) return res.status(403).json({ error: 'Not your entry' });
    if (entry.status === 'CONVERTED') {
      return res.status(409).json({ error: 'Already converted' });
    }

    await prisma.waitlistEntry.update({
      where: { id: entryId },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Left waitlist' });
  } catch {
    res.status(500).json({ error: 'Leave failed' });
  }
});

// Accept waitlist offer
router.post('/offers/:token/accept', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  const customerId = req.userId!;

  try {
    const token = req.params.token;

    const offer = await prisma.waitlistOffer.findUnique({
      where: { token },
      include: {
        entry: {
          include: {
            show: { include: { prices: true } },
            customer: true,
          },
        },
      },
    });

    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.entry.customerId !== customerId) {
      return res.status(403).json({ error: 'Not your offer' });
    }
    if (offer.status !== 'WAITING') {
      return res.status(409).json({ error: 'Offer not available' });
    }
    if (offer.expiresAt < new Date()) {
      return res.status(409).json({ error: 'Offer expired' });
    }

    // Convert offer to booking
    const result = await prisma.$transaction(async (tx) => {
      // Lock offered seats
      const showSeats = await tx.showSeat.findMany({
        where: { waitlistOfferId: offer.id, status: 'OFFERED' },
        include: { seat: true },
        orderBy: { id: 'asc' },
      });

      if (showSeats.length === 0) throw new Error('NO_SEATS');

      // Calculate total
      const priceMap = new Map(offer.entry.show.prices.map((p) => [p.categoryId, p.priceCents]));
      let totalCents = 0;
      const bookingSeatData = showSeats.map((ss) => {
        const price = priceMap.get(ss.categoryId) || 0;
        totalCents += price;
        return { showSeatId: ss.id, priceCents: price };
      });

      // Generate booking ref
      const bookingRef = `BK${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const booking = await tx.booking.create({
        data: {
          bookingRef,
          showId: offer.entry.showId,
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
            "waitlistOfferId" = NULL,
            "heldUntil" = NULL,
            version = version + 1
        WHERE "waitlistOfferId" = ${offer.id}
      `;

      // Update offer
      await tx.waitlistOffer.update({
        where: { id: offer.id },
        data: { status: 'WAITING', bookingId: booking.id },
      });

      // Update entry
      await tx.waitlistEntry.update({
        where: { id: offer.entryId },
        data: { status: 'CONVERTED' },
      });

      return { booking, showSeats };
    });

    // TODO: Send booking confirmation email with QR

    res.status(201).json({
      bookingRef: result.booking.bookingRef,
      totalCents: result.booking.totalCents,
      seats: result.showSeats.map((ss) => ({
        rowLabel: ss.seat.rowLabel,
        seatNumber: ss.seat.seatNumber,
      })),
    });
  } catch (err: any) {
    if (err.message === 'NO_SEATS') {
      return res.status(409).json({ error: 'Seats no longer available' });
    }
    console.error('Accept offer error:', err);
    res.status(500).json({ error: 'Accept failed' });
  }
});

// Get offer details (for accept page)
router.get('/offers/:token', async (req, res) => {
  try {
    const offer = await prisma.waitlistOffer.findUnique({
      where: { token: req.params.token },
      include: {
        entry: {
          include: {
            show: { include: { venue: true, prices: true } },
            category: true,
          },
        },
      },
    });

    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const seats = await prisma.showSeat.findMany({
      where: { waitlistOfferId: offer.id },
      include: { seat: true },
    });

    res.json({
      offer: {
        id: offer.id,
        expiresAt: offer.expiresAt,
        status: offer.status,
      },
      show: {
        title: offer.entry.show.title,
        startsAt: offer.entry.show.startsAt,
        venue: offer.entry.show.venue.name,
      },
      category: offer.entry.category.name,
      seats: seats.map((ss) => ({
        rowLabel: ss.seat.rowLabel,
        seatNumber: ss.seat.seatNumber,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Fetch offer failed' });
  }
});

export default router;
