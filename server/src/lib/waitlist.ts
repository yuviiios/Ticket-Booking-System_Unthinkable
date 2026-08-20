import prisma from './db.js';
import { env } from '../config/env.js';
import crypto from 'crypto';

export async function tryAssignWaitlist(showId: number, categoryId: number) {
  // Find available seats in category
  const available = await prisma.showSeat.findMany({
    where: {
      showId,
      categoryId,
      status: 'AVAILABLE',
    },
    take: 10,
    orderBy: { id: 'asc' },
  });

  if (available.length === 0) return;

  // Get waitlist entries with SKIP LOCKED
  const entries = await prisma.$queryRaw<
    Array<{ id: number; customerId: number; seatsWanted: number }>
  >`
    SELECT id, "customerId", "seatsWanted"
    FROM "WaitlistEntry"
    WHERE "showId" = ${showId}
      AND "categoryId" = ${categoryId}
      AND status = 'WAITING'::"WaitlistStatus"
    ORDER BY "createdAt" ASC
    LIMIT 10
    FOR UPDATE SKIP LOCKED
  `;

  for (const entry of entries) {
    const needed = Math.min(entry.seatsWanted, available.length);
    if (needed === 0) break;

    const seatsToOffer = available.splice(0, needed);
    if (seatsToOffer.length === 0) break;

    try {
      await createWaitlistOffer(entry.id, seatsToOffer.map((s) => s.id));
    } catch (err) {
      console.error(`Failed to create offer for entry ${entry.id}:`, err);
    }

    if (available.length === 0) break;
  }
}

async function createWaitlistOffer(entryId: number, showSeatIds: number[]) {
  const offerTtl = env.WAITLIST_OFFER_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + offerTtl * 1000);
  const token = crypto.randomBytes(16).toString('base64url');

  await prisma.$transaction(async (tx) => {
    // Update seats to OFFERED
    await tx.$executeRaw`
      UPDATE "ShowSeat"
      SET status = 'OFFERED'::"ShowSeatStatus",
          "heldUntil" = ${expiresAt},
          version = version + 1
      WHERE id = ANY(${showSeatIds}::int[])
        AND status = 'AVAILABLE'::"ShowSeatStatus"
    `;

    // Create offer
    const offer = await tx.waitlistOffer.create({
      data: {
        entryId,
        token,
        expiresAt,
        status: 'WAITING',
      },
    });

    // Mark entry as OFFERED
    await tx.waitlistEntry.update({
      where: { id: entryId },
      data: { status: 'OFFERED' },
    });

    // Link seats to offer
    await tx.$executeRaw`
      UPDATE "ShowSeat"
      SET "waitlistOfferId" = ${offer.id}
      WHERE id = ANY(${showSeatIds}::int[])
    `;
  });

  // TODO Phase 6: send offer email
  const entry = await prisma.waitlistEntry.findUnique({
    where: { id: entryId },
    include: {
      customer: true,
      show: true,
      category: true,
    },
  });

  if (entry) {
    console.log(`Waitlist offer created for ${entry.customer.email}`);
    console.log(`Token: ${token}, expires: ${expiresAt}`);
    console.log(`Accept at: ${process.env.CLIENT_URL}/waitlist/accept/${token}`);
  }
}
