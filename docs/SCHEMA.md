# Database Schema

## Overview

PostgreSQL database designed for high concurrency with explicit locking, dual-layer TTL expiry, and waitlist cascade.

## Tables

### User
```
id (PK)
email (UNIQUE)
passwordHash
name
role ENUM: ADMIN, ORGANISER, CUSTOMER
createdAt
```

### Venue
```
id (PK)
name
city
address
createdAt
```

### SeatCategory
```
id (PK)
venueId (FK → Venue)
name
colorHex
sortOrder
createdAt

UNIQUE(venueId, name)
```

### Seat
```
id (PK)
venueId (FK → Venue)
categoryId (FK → SeatCategory)
rowLabel (A–Z)
seatNumber (1–50)
gridRow
gridCol
createdAt

UNIQUE(venueId, rowLabel, seatNumber)
```

### Show
```
id (PK)
venueId (FK → Venue)
organiserId (FK → User)
title
type ENUM: MOVIE, CONCERT
description
startsAt
status ENUM: DRAFT, PUBLISHED, CANCELLED
holdTtlSeconds (default 600)
createdAt
```

### ShowPrice
```
id (PK)
showId (FK → Show)
categoryId (FK → SeatCategory)
priceCents

UNIQUE(showId, categoryId)
```

### ShowSeat (materialised per show)
```
id (PK)
showId (FK → Show)
seatId (FK → Seat)
categoryId (FK → SeatCategory)
status ENUM: AVAILABLE, HELD, BOOKED, OFFERED, BLOCKED
heldUntil NULLABLE (expiry timestamp)
holdId (FK → SeatHold)
bookingId (FK → Booking)
waitlistOfferId (FK → WaitlistOffer)
version (optimistic lock counter)
createdAt

UNIQUE(showId, seatId)
INDEX(showId, status)
INDEX(status, heldUntil) -- for sweeper
```

### SeatHold (temporary seat locks)
```
id (PK)
showId (FK → Show)
customerId (FK → User)
status ENUM: ACTIVE, CONVERTED, RELEASED, EXPIRED
expiresAt
createdAt

INDEX(status, expiresAt) -- for sweeper
```

### Booking (immutable after creation)
```
id (PK)
bookingRef (UNIQUE)
showId (FK → Show)
customerId (FK → User)
status ENUM: CONFIRMED, CANCELLED
totalCents
cancelledAt NULLABLE
createdAt
```

### BookingSeat
```
id (PK)
bookingId (FK → Booking)
showSeatId (FK → ShowSeat)
priceCents
releasedAt NULLABLE
createdAt

UNIQUE(showSeatId) -- one booking per seat
INDEX(bookingId)
```

### WaitlistEntry (one per customer per category per show)
```
id (PK)
showId (FK → Show)
categoryId (FK → SeatCategory)
customerId (FK → User)
seatsWanted
status ENUM: WAITING, OFFERED, CONVERTED, EXPIRED, CANCELLED
createdAt

UNIQUE(showId, categoryId, customerId) WHERE status IN ('WAITING', 'OFFERED')
INDEX(showId, categoryId, status, createdAt) -- for SKIP LOCKED queue
```

### WaitlistOffer (time-limited offer to customer)
```
id (PK)
entryId (FK → WaitlistEntry)
token (UNIQUE, base64url random)
expiresAt
status ENUM: WAITING, ACCEPTED, EXPIRED
bookingId (FK → Booking) NULLABLE
createdAt
```

### EmailOutbox (batch send queue)
```
id (PK)
to (email address)
template (e.g., "booking_confirmation")
payload (JSON)
status ENUM: PENDING, SENT, FAILED
attempts
nextAttemptAt
lastError TEXT
createdAt

INDEX(status, nextAttemptAt) -- for sweeper/drainer
```

## Indexes Summary

### Performance-critical
- `ShowSeat(showId, status)` — rapid availability checks during booking.
- `ShowSeat(status, heldUntil)` — sweeper finds expired holds efficiently.
- `SeatHold(status, expiresAt)` — sweeper bulk-expire holds.
- `WaitlistEntry(showId, categoryId, status, createdAt)` — SKIP LOCKED queue head.
- `EmailOutbox(status, nextAttemptAt)` — batched email sends.

### Data integrity
- `UNIQUE(showId, seatId)` — one ShowSeat per seat per show.
- `UNIQUE(showSeatId)` on BookingSeat — one booking per physical seat.
- `UNIQUE(showId, categoryId, customerId)` on WaitlistEntry — one active entry per category.
- `UNIQUE(token)` on WaitlistOffer — token is the lookup key.

## Concurrency Guarantees

1. **Seat hold:** Row locks (`FOR UPDATE`) + CAS predicate prevent double-booking.
2. **Waitlist queue:** `FOR UPDATE SKIP LOCKED` allows parallel cancellations.
3. **Cascading offers:** Single-customer constraint prevents duplicate offers to same person for same category.
4. **Sweep lock:** `pg_try_advisory_lock(9876543210)` ensures only one sweeper instance.

## Migration & Seed

```bash
npm run db:migrate  # Run Prisma migrations
npm run db:seed    # Load test data
```

Seed creates: 2 venues, 4 categories, 1 organiser, 2 customers, 1 show with 50 seats.
