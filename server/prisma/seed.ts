import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.emailOutbox.deleteMany();
  await prisma.waitlistOffer.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.bookingSeat.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.seatHold.deleteMany();
  await prisma.showSeat.deleteMany();
  await prisma.showPrice.deleteMany();
  await prisma.show.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.seatCategory.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const adminHash = bcryptjs.hashSync('admin123', 10);
  const organiserHash = bcryptjs.hashSync('org123', 10);
  const customerHash = bcryptjs.hashSync('cust123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      passwordHash: adminHash,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const organiser = await prisma.user.create({
    data: {
      email: 'organiser@test.com',
      passwordHash: organiserHash,
      name: 'Event Organiser',
      role: 'ORGANISER',
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      email: 'customer1@test.com',
      passwordHash: customerHash,
      name: 'Customer One',
      role: 'CUSTOMER',
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'customer2@test.com',
      passwordHash: customerHash,
      name: 'Customer Two',
      role: 'CUSTOMER',
    },
  });

  // Venues
  const venue1 = await prisma.venue.create({
    data: {
      name: 'Grand Cinema',
      city: 'New York',
      address: '123 Main St',
    },
  });

  const venue2 = await prisma.venue.create({
    data: {
      name: 'Concert Hall',
      city: 'Los Angeles',
      address: '456 Music Ave',
    },
  });

  // Seat Categories
  const premiumCat = await prisma.seatCategory.create({
    data: {
      venueId: venue1.id,
      name: 'Premium',
      colorHex: '#FFD700',
      sortOrder: 1,
    },
  });

  const standardCat = await prisma.seatCategory.create({
    data: {
      venueId: venue1.id,
      name: 'Standard',
      colorHex: '#C0C0C0',
      sortOrder: 2,
    },
  });

  // Generate seats for venue1 (5 rows × 10 cols)
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const catId = row < 2 ? premiumCat.id : standardCat.id;
      await prisma.seat.create({
        data: {
          venueId: venue1.id,
          categoryId: catId,
          rowLabel: String.fromCharCode(65 + row), // A, B, C, ...
          seatNumber: col + 1,
          gridRow: row,
          gridCol: col,
        },
      });
    }
  }

  // Movie show
  const movieShow = await prisma.show.create({
    data: {
      venueId: venue1.id,
      organiserId: organiser.id,
      title: 'The Great Adventure',
      type: 'MOVIE',
      description: 'A thrilling adventure film',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
      status: 'PUBLISHED',
      holdTtlSeconds: 600,
    },
  });

  // Pricing
  await prisma.showPrice.create({
    data: {
      showId: movieShow.id,
      categoryId: premiumCat.id,
      priceCents: 1500, // $15
    },
  });

  await prisma.showPrice.create({
    data: {
      showId: movieShow.id,
      categoryId: standardCat.id,
      priceCents: 1000, // $10
    },
  });

  // Materialize seats for show
  const allSeats = await prisma.seat.findMany({ where: { venueId: venue1.id } });
  for (const seat of allSeats) {
    const price = await prisma.showPrice.findUnique({
      where: { showId_categoryId: { showId: movieShow.id, categoryId: seat.categoryId } },
    });
    await prisma.showSeat.create({
      data: {
        showId: movieShow.id,
        seatId: seat.id,
        categoryId: seat.categoryId,
        status: 'AVAILABLE',
      },
    });
  }

  console.log('Seed data created successfully');
  console.log(`Admin: admin@test.com / admin123`);
  console.log(`Organiser: organiser@test.com / org123`);
  console.log(`Customer: customer1@test.com / cust123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
