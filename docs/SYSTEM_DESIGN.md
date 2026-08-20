# System Design: Ticket Booking System

## Overview

High-concurrency ticket booking platform handling simultaneous seat selection, automatic hold expiry, waitlist management with time-limited offers, and QR-coded email delivery. Designed for correctness under concurrent access without sacrificing performance.

## Core Design Decisions

### 1. Seat Hold & Concurrency Protection

**Problem:** Multiple customers selecting the same seat simultaneously must not both succeed.

**Solution:** Compare-and-set (CAS) engine with PostgreSQL row locks.

```sql
-- Deterministic lock order prevents deadlocks
SELECT id FROM show_seats 
WHERE show_id = $1 AND seat_id = ANY($2::int[])
ORDER BY id 
FOR UPDATE;

-- CAS: only seats still AVAILABLE (or expired HELD) transition to HELD
UPDATE show_seats
SET status='HELD', hold_id=$1, held_until=$2, version=version+1
WHERE id = ANY($3::int[])
  AND (status='AVAILABLE' 
       OR (status='HELD' AND held_until <= now()))
RETURNING id;

-- Client: if rowCount < requested, rollback and return 409 conflict
```

**Why:** 
- `FOR UPDATE` blocks concurrent writes on those rows until commit.
- When a transaction commits, Postgres re-evaluates blocked txns' WHERE clauses against new row state (EvalPlanQual).
- Under READ COMMITTED (default), txn B re-enters after A commits; seat is now HELD with future held_until, so txn B's predicate fails, it skips the row, rowCount drops, app knows exactly which seats failed.
- No advisory locks or SERIALIZABLE needed. Simple, proven, scalable.

**Race Test:**
```bash
npm run test:race
```
Two customers attempt hold on same seat → one gets 201, one gets 409. Deterministic outcome.

### 2. TTL & Auto-Release

**Problem:** Abandoned holds must not permanently block seats.

**Solution:** Dual-layer expiry.

1. **Lazy (correctness).** Every seat-map read projects expired holds as AVAILABLE:
   ```sql
   CASE WHEN status='HELD' AND held_until <= now() THEN 'AVAILABLE' ELSE status END
   ```
   Kill the sweeper and seats still free themselves. Holds never permanently stuck.

2. **Sweeper (timeliness).** Every 5s, under `pg_try_advisory_lock`:
   - Find ACTIVE holds with `expiresAt <= now()`
   - Batch expire them
   - Release seats → AVAILABLE
   - Emit real-time updates
   
   Advisory lock ensures only one instance runs even if scaled horizontally.

### 3. Waitlist & Automatic Cascading

**Problem:** When a booking is cancelled, multiple waitlisted customers compete for the freed seats. No single pool or queue per seat—queues are per *category*.

**Solution:** SKIP LOCKED queue + time-limited offers.

```sql
SELECT id, "customerId", "seatsWanted"
FROM waitlist_entries
WHERE show_id=$1 AND category_id=$2 AND status='WAITING'
ORDER BY created_at ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

**Why SKIP LOCKED:**
- Concurrent cancellations don't block each other at the queue head.
- Each txn locks a non-overlapping set of entries.
- No convoy, no tail latency.

**Offer Flow:**
1. On cancel, seats freed → AVAILABLE.
2. `tryAssignWaitlist(showId, categoryId)` runs.
3. Query WAITING entries with SKIP LOCKED.
4. For each: create timed offer (30min TTL by default), mark entry OFFERED, email customer.
5. Seats transition AVAILABLE → OFFERED (shown as unavailable to new browsers).
6. If customer accepts within TTL: convert to booking, transition to BOOKED.
7. If TTL expires: sweeper marks offer EXPIRED, seats → AVAILABLE, cascades to next in line.

**Correctness:** Double-unique constraints prevent duplicate offers:
```sql
CREATE UNIQUE INDEX one_live_waitlist_per_customer
ON waitlist_entries(show_id, category_id, customer_id)
WHERE status IN ('WAITING','OFFERED');
```

### 4. Real-Time Seat Map

**Socket.IO rooms per show.** After every hold/book/release, emit `seat:update`:
```js
io.to(`show:${showId}`).emit('seat:update', { 
  showId, 
  seats: [{seatId, status, heldUntil}, ...] 
});
```

Frontend patches state immediately. No refetch.

**Trade-off:** Socket.IO cannot survive Vercel serverless. API runs on Render (persistent process), client on Vercel.

### 5. QR Tickets & Email

**QR encodes signed token:**
```
base64url(bookingRef|showId|hmacSha256(bookingRef|showId))
```

Organiser gate endpoint validates:
```
GET /api/bookings/verify/token/:token
```
Token tampering (if someone modifies bookingRef) invalidates the HMAC—no access without the secret.

**Email:** Resend (free tier 100/day) with QR as CID attachment. Dev mode writes HTML to disk.

## Data Model Highlights

- **ShowSeat** materialised on publish (no runtime joins on millions of rows).
- **SeatHold** tracks temporary locks, indexed on (status, expiresAt) for sweeper.
- **WaitlistEntry** one per customer per category (unique constraint).
- **WaitlistOffer** time-limited, token-based.
- **Booking** immutable once CONFIRMED; cancel marks old seats as released, does not delete.

## Deployment Architecture

- **Client:** Vercel (static + React SPA). `VITE_API_URL` → Render, `VITE_SOCKET_URL` → Render.
- **Server:** Render free web service (cold start ≤15min idle; OK for demo). Node.js runs sweeper + Socket.IO.
- **Database:** Neon (free 0.5 GB, auto-suspend on idle). Prisma pooler recommended for connection reuse.

Cold start is acceptable; sweeper will catch up on wake.

## Testing & Verification

- **Concurrency:** `npm run test:race` proves no two concurrent holds on same seat both succeed.
- **Expiry:** Manual: create hold, wait 11s (TTL=10s), verify seat released.
- **Waitlist:** Create show, book all seats, cancel one, verify next in waitlist gets offer email within 5s.
- **QR:** Generate QR, scan in a QR reader, verify URL structure and HMAC validity.

## Known Limitations

1. **Email:** Resend free tier is 100/day. For production load, upgrade tier.
2. **Socket.IO:** Vercel serverless can't hold connections. Single-instance Render OK for demo; scale to multiple instances requires Redis adapter.
3. **Sweeper:** setInterval in single process. For HA, use cron service or upgrade to a job queue (Bull, Temporal).

## Scaling Path

- Sweeper → external cron (EasyCron, AWS EventBridge).
- Socket.IO → Redis Adapter for multi-instance broadcasting.
- Queries → read replicas via Prisma Accelerate.
- Email queue → Bull on Redis for retries + batch sending.
