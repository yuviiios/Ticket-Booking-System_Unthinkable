import { Router } from 'express';
import prisma from '../lib/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

// ORGANISER: get dashboard stats
router.get('/organiser', authMiddleware, requireRole('ORGANISER'), async (req: AuthRequest, res) => {
  const organiserId = req.userId!;

  try {
    // Get organiser shows with booking data
    const shows = await prisma.show.findMany({
      where: { organiserId },
      include: {
        venue: { select: { name: true, city: true } },
        seats: { select: { id: true, status: true, categoryId: true } },
        bookings: {
          where: { status: 'CONFIRMED' },
          include: {
            seats: { select: { priceCents: true, showSeat: { select: { categoryId: true } } } },
          },
        },
        prices: { include: { category: true } },
      },
      orderBy: { startsAt: 'desc' },
    });

    const stats = shows.map((show) => {
      const totalSeats = show.seats.length;
      const bookedSeats = show.seats.filter((s) => s.status === 'BOOKED').length;
      const availableSeats = show.seats.filter((s) => s.status === 'AVAILABLE').length;
      const occupancyRate = totalSeats > 0 ? (bookedSeats / totalSeats) * 100 : 0;

      // Revenue total
      const totalRevenue = show.bookings.reduce((sum, booking) => {
        return sum + booking.seats.reduce((s, bs) => s + bs.priceCents, 0);
      }, 0);

      // Revenue by category
      const categoryRevenue = new Map<number, { name: string; revenue: number; seats: number }>();
      show.prices.forEach((p) => {
        categoryRevenue.set(p.categoryId, {
          name: p.category.name,
          revenue: 0,
          seats: 0,
        });
      });

      show.bookings.forEach((booking) => {
        booking.seats.forEach((bs) => {
          const catId = bs.showSeat.categoryId;
          const existing = categoryRevenue.get(catId);
          if (existing) {
            existing.revenue += bs.priceCents;
            existing.seats += 1;
          }
        });
      });

      return {
        showId: show.id,
        title: show.title,
        type: show.type,
        venue: show.venue.name,
        city: show.venue.city,
        startsAt: show.startsAt,
        status: show.status,
        totalSeats,
        bookedSeats,
        availableSeats,
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        totalRevenue,
        bookingCount: show.bookings.length,
        categoryBreakdown: Array.from(categoryRevenue.values()),
      };
    });

    // Aggregate totals
    const totalRevenue = stats.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalBookings = stats.reduce((sum, s) => sum + s.bookingCount, 0);
    const totalSeats = stats.reduce((sum, s) => sum + s.totalSeats, 0);
    const totalBooked = stats.reduce((sum, s) => sum + s.bookedSeats, 0);
    const avgOccupancy = totalSeats > 0 ? Math.round((totalBooked / totalSeats) * 1000) / 10 : 0;

    res.json({
      summary: {
        totalRevenue,
        totalBookings,
        totalShows: shows.length,
        avgOccupancy,
      },
      shows: stats,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Fetch dashboard failed' });
  }
});

export default router;
