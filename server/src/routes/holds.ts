import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { emitSeatUpdate } from '../realtime/socket.js';

const router = Router();

const createHoldSchema = z.object({
  showId: z.number().int(),
  seatIds: z.array(z.number().int()).min(1).max(10),
});

// Create hold (CAS engine)
router.post('/', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  const customerId = req.userId!;

  try {
    const { showId, seatIds } = createHoldSchema.parse(req.body);

    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show || show.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Show not available' });
    }

    const ttl = show.holdTtlSeconds || env.SEAT_HOLD_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // CAS transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock in deterministic order to prevent deadlocks
      const showSeats = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "ShowSeat"
        WHERE "showId" = ${showId}
          AND "seatId" = ANY(${seatIds}::int[])
        ORDER BY id
        FOR UPDATE
      `;

      if (showSeats.length !== seatIds.length) {
        throw new Error('SEATS_NOT_FOUND');
      }

      const showSeatIds = showSeats.map((s) => s.id);

      // 2. Create hold record
      const hold = await tx.seatHold.create({
        data: {
          showId,
          customerId,
          status: 'ACTIVE',
          expiresAt,
        },
      });

      // 3. CAS update - reclaim expired holds inline
      const updated = await tx.$executeRaw`
        UPDATE "ShowSeat"
        SET status = 'HELD'::"ShowSeatStatus",
            "holdId" = ${hold.id},
            "heldUntil" = ${expiresAt},
            version = version + 1
        WHERE id = ANY(${showSeatIds}::int[])
          AND (status = 'AVAILABLE'::"ShowSeatStatus"
               OR (status = 'HELD'::"ShowSeatStatus" AND "heldUntil" <= NOW()))
      `;

      if (updated !== seatIds.length) {
        throw new Error('SEATS_UNAVAILABLE');
      }

      // Fetch updated seats for socket emit
      const updatedSeats = await tx.showSeat.findMany({
        where: { id: { in: showSeatIds } },
        include: { seat: true },
      });

      return { hold, updatedSeats };
    });

    // Emit after commit
    emitSeatUpdate(
      showId,
      result.updatedSeats.map((ss) => ({
        seatId: ss.seatId,
        status: ss.status,
        heldUntil: ss.heldUntil,
      }))
    );

    res.status(201).json({
      holdId: result.hold.id,
      expiresAt: result.hold.expiresAt,
      seats: result.updatedSeats.map((ss) => ({
        id: ss.id,
        seatId: ss.seatId,
        rowLabel: ss.seat.rowLabel,
        seatNumber: ss.seat.seatNumber,
      })),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ errors: err.errors });
    }
    if (err.message === 'SEATS_NOT_FOUND') {
      return res.status(404).json({ error: 'Seats not found' });
    }
    if (err.message === 'SEATS_UNAVAILABLE') {
      return res.status(409).json({ error: 'Seats unavailable' });
    }
    console.error('Hold error:', err);
    res.status(500).json({ error: 'Hold failed' });
  }
});

// Release hold
router.delete('/:id', authMiddleware, requireRole('CUSTOMER'), async (req: AuthRequest, res) => {
  try {
    const holdId = parseInt(req.params.id);
    const customerId = req.userId!;

    const hold = await prisma.seatHold.findUnique({ where: { id: holdId } });
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    if (hold.customerId !== customerId) return res.status(403).json({ error: 'Not your hold' });
    if (hold.status !== 'ACTIVE') return res.status(409).json({ error: 'Hold not active' });

    await prisma.$transaction(async (tx) => {
      await tx.seatHold.update({
        where: { id: holdId },
        data: { status: 'RELEASED' },
      });

      await tx.$executeRaw`
        UPDATE "ShowSeat"
        SET status = 'AVAILABLE'::"ShowSeatStatus",
            "holdId" = NULL,
            "heldUntil" = NULL,
            version = version + 1
        WHERE "holdId" = ${holdId}
      `;
    });

    const updatedSeats = await prisma.showSeat.findMany({
      where: { showId: hold.showId, holdId: null, status: 'AVAILABLE' },
    });

    emitSeatUpdate(
      hold.showId,
      updatedSeats.map((ss) => ({
        seatId: ss.seatId,
        status: ss.status,
        heldUntil: null,
      }))
    );

    res.json({ message: 'Released' });
  } catch {
    res.status(500).json({ error: 'Release failed' });
  }
});

// Get hold status
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const hold = await prisma.seatHold.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        show: { select: { title: true, startsAt: true } },
      },
    });

    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    if (hold.customerId !== req.userId) return res.status(403).json({ error: 'Not your hold' });

    res.json(hold);
  } catch {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

export default router;
