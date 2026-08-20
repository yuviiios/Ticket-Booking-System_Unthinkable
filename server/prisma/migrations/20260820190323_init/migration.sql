-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ORGANISER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ShowType" AS ENUM ('MOVIE', 'CONCERT');

-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShowSeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED', 'OFFERED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SeatHoldStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'CONVERTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatCategory" (
    "id" SERIAL NOT NULL,
    "venueId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" SERIAL NOT NULL,
    "venueId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "seatNumber" INTEGER NOT NULL,
    "gridRow" INTEGER NOT NULL,
    "gridCol" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Show" (
    "id" SERIAL NOT NULL,
    "venueId" INTEGER NOT NULL,
    "organiserId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ShowType" NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" "ShowStatus" NOT NULL DEFAULT 'DRAFT',
    "holdTtlSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Show_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowPrice" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowSeat" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "seatId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "status" "ShowSeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "heldUntil" TIMESTAMP(3),
    "holdId" INTEGER,
    "bookingId" INTEGER,
    "waitlistOfferId" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatHold" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" "SeatHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "bookingRef" TEXT NOT NULL,
    "showId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "totalCents" INTEGER NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSeat" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "showSeatId" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "seatsWanted" INTEGER NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistOffer" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "bookingId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" SERIAL NOT NULL,
    "to" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "MailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SeatCategory_venueId_name_key" ON "SeatCategory"("venueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_venueId_rowLabel_seatNumber_key" ON "Seat"("venueId", "rowLabel", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShowPrice_showId_categoryId_key" ON "ShowPrice"("showId", "categoryId");

-- CreateIndex
CREATE INDEX "ShowSeat_showId_status_idx" ON "ShowSeat"("showId", "status");

-- CreateIndex
CREATE INDEX "ShowSeat_status_heldUntil_idx" ON "ShowSeat"("status", "heldUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ShowSeat_showId_seatId_key" ON "ShowSeat"("showId", "seatId");

-- CreateIndex
CREATE INDEX "SeatHold_status_expiresAt_idx" ON "SeatHold"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_bookingRef_key" ON "Booking"("bookingRef");

-- CreateIndex
CREATE INDEX "BookingSeat_bookingId_idx" ON "BookingSeat"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSeat_showSeatId_key" ON "BookingSeat"("showSeatId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_showId_categoryId_status_createdAt_idx" ON "WaitlistEntry"("showId", "categoryId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistOffer_token_key" ON "WaitlistOffer"("token");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "SeatCategory" ADD CONSTRAINT "SeatCategory_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SeatCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowPrice" ADD CONSTRAINT "ShowPrice_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowPrice" ADD CONSTRAINT "ShowPrice_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SeatCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SeatCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowSeat" ADD CONSTRAINT "ShowSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_showSeatId_fkey" FOREIGN KEY ("showSeatId") REFERENCES "ShowSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SeatCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WaitlistEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
