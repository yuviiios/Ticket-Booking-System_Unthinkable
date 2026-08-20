import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

const createShowSchema = z.object({
  venueId: z.number().int(),
  title: z.string().min(1),
  type: z.enum(['MOVIE', 'CONCERT']),
  description: z.string().optional(),
  startsAt: z.string().datetime(),
  holdTtlSeconds: z.number().int().default(600),
  prices: z.array(
    z.object({
      categoryId: z.number().int(),
      priceCents: z.number().int().min(0),
    })
  ),
});

const updateShowSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED']).optional(),
});

// ORGANISER: create show (DRAFT)
router.post('/', authMiddleware, requireRole('ORGANISER'), async (req: AuthRequest, res) => {
  try {
    const { venueId, title, type, description, startsAt, holdTtlSeconds, prices } =
      createShowSchema.parse(req.body);

    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      include: { categories: true },
    });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    const show = await prisma.show.create({
      data: {
        venueId,
        organiserId: req.userId!,
        title,
        type,
        description,
        startsAt: new Date(startsAt),
        holdTtlSeconds,
        status: 'DRAFT',
        prices: {
          create: prices.map((p) => ({
            categoryId: p.categoryId,
            priceCents: p.priceCents,
          })),
        },
      },
      include: { prices: true },
    });

    res.status(201).json(show);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    res.status(500).json({ error: 'Create show failed' });
  }
});

// ORGANISER: publish show (materialize seats)
router.post('/:id/publish', authMiddleware, requireRole('ORGANISER'), async (req: AuthRequest, res) => {
  try {
    const showId = parseInt(req.params.id);

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: { venue: { include: { seats: true } }, prices: true },
    });

    if (!show) return res.status(404).json({ error: 'Show not found' });
    if (show.organiserId !== req.userId) return res.status(403).json({ error: 'Not your show' });
    if (show.status === 'PUBLISHED') return res.status(409).json({ error: 'Already published' });

    // Materialize ShowSeats
    const seats = show.venue.seats;
    await prisma.showSeat.createMany({
      data: seats.map((seat) => ({
        showId: show.id,
        seatId: seat.id,
        categoryId: seat.categoryId,
        status: 'AVAILABLE',
      })),
    });

    await prisma.show.update({
      where: { id: showId },
      data: { status: 'PUBLISHED' },
    });

    res.json({ message: 'Published', seatsCreated: seats.length });
  } catch {
    res.status(500).json({ error: 'Publish failed' });
  }
});

// ORGANISER: update show
router.patch('/:id', authMiddleware, requireRole('ORGANISER'), async (req: AuthRequest, res) => {
  try {
    const showId = parseInt(req.params.id);
    const updates = updateShowSchema.parse(req.body);

    const show = await prisma.show.findUnique({ where: { id: showId } });
    if (!show) return res.status(404).json({ error: 'Show not found' });
    if (show.organiserId !== req.userId) return res.status(403).json({ error: 'Not your show' });

    const updated = await prisma.show.update({
      where: { id: showId },
      data: {
        ...updates,
        startsAt: updates.startsAt ? new Date(updates.startsAt) : undefined,
      },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    res.status(500).json({ error: 'Update failed' });
  }
});

// List shows (with filters)
router.get('/', async (req, res) => {
  try {
    const { type, city, status = 'PUBLISHED' } = req.query;

    const shows = await prisma.show.findMany({
      where: {
        status: status as any,
        type: type ? (type as any) : undefined,
        venue: city ? { city: city as string } : undefined,
      },
      include: {
        venue: { select: { name: true, city: true } },
        organiser: { select: { name: true } },
        prices: { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
      },
      orderBy: { startsAt: 'asc' },
    });

    res.json(shows);
  } catch {
    res.status(500).json({ error: 'Fetch shows failed' });
  }
});

// Get show detail
router.get('/:id', async (req, res) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        venue: { include: { categories: true } },
        organiser: { select: { name: true } },
        prices: { include: { category: true }, orderBy: { category: { sortOrder: 'asc' } } },
        seats: {
          include: { seat: true },
          orderBy: [{ seat: { gridRow: 'asc' } }, { seat: { gridCol: 'asc' } }],
        },
      },
    });

    if (!show) return res.status(404).json({ error: 'Show not found' });
    res.json(show);
  } catch {
    res.status(500).json({ error: 'Fetch show failed' });
  }
});

// ORGANISER: get my shows
router.get('/my/list', authMiddleware, requireRole('ORGANISER'), async (req: AuthRequest, res) => {
  try {
    const shows = await prisma.show.findMany({
      where: { organiserId: req.userId },
      include: {
        venue: { select: { name: true, city: true } },
        prices: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(shows);
  } catch {
    res.status(500).json({ error: 'Fetch shows failed' });
  }
});

export default router;
