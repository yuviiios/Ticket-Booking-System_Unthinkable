import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

const createVenueSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  colorHex: z.string().regex(/^#[0-9A-F]{6}$/i),
  sortOrder: z.number().int().default(0),
});

const bulkSeatsSchema = z.object({
  rows: z.number().int().min(1).max(26),
  cols: z.number().int().min(1).max(50),
  categoryRows: z.array(z.object({
    endRow: z.number().int(),
    categoryId: z.number().int(),
  })),
});

// ADMIN: create venue
router.post('/', authMiddleware, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { name, city, address } = createVenueSchema.parse(req.body);
    const venue = await prisma.venue.create({
      data: { name, city, address },
    });
    res.status(201).json(venue);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    res.status(500).json({ error: 'Create venue failed' });
  }
});

// List venues
router.get('/', async (req, res) => {
  try {
    const venues = await prisma.venue.findMany({
      include: { categories: { orderBy: { sortOrder: 'asc' } } },
    });
    res.json(venues);
  } catch {
    res.status(500).json({ error: 'Fetch venues failed' });
  }
});

// Get venue + seats
router.get('/:id', async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        categories: { orderBy: { sortOrder: 'asc' } },
        seats: {
          orderBy: [{ gridRow: 'asc' }, { gridCol: 'asc' }],
        },
      },
    });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });
    res.json(venue);
  } catch {
    res.status(500).json({ error: 'Fetch venue failed' });
  }
});

// ADMIN: create category
router.post('/:venueId/categories', authMiddleware, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const { name, colorHex, sortOrder } = createCategorySchema.parse(req.body);
    const venueId = parseInt(req.params.venueId);

    const existing = await prisma.seatCategory.findFirst({
      where: { venueId, name },
    });
    if (existing) return res.status(409).json({ error: 'Category exists' });

    const category = await prisma.seatCategory.create({
      data: { venueId, name, colorHex, sortOrder },
    });
    res.status(201).json(category);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    res.status(500).json({ error: 'Create category failed' });
  }
});

// ADMIN: bulk generate seats
router.post('/:venueId/seats/bulk', authMiddleware, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const venueId = parseInt(req.params.venueId);
    const { rows, cols, categoryRows } = bulkSeatsSchema.parse(req.body);

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) return res.status(404).json({ error: 'Venue not found' });

    // Delete existing seats
    await prisma.seat.deleteMany({ where: { venueId } });

    // Ensure categories exist
    const categories = await prisma.seatCategory.findMany({
      where: { venueId },
      orderBy: { sortOrder: 'asc' },
    });

    const categoryMap = new Map(categories.map(c => [c.id, c]));

    // Create seats in bulk
    const seats = [];
    for (let row = 0; row < rows; row++) {
      const rowLabel = String.fromCharCode(65 + row);
      let categoryId: number | null = null;

      for (const { endRow, categoryId: catId } of categoryRows) {
        if (row <= endRow) {
          categoryId = catId;
          break;
        }
      }

      if (!categoryId) categoryId = categories[0]?.id;
      if (!categoryId) continue;

      for (let col = 0; col < cols; col++) {
        seats.push({
          venueId,
          categoryId,
          rowLabel,
          seatNumber: col + 1,
          gridRow: row,
          gridCol: col,
        });
      }
    }

    await prisma.seat.createMany({ data: seats });

    res.status(201).json({ created: seats.length });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ errors: err.errors });
    res.status(500).json({ error: 'Bulk create seats failed' });
  }
});

export default router;
