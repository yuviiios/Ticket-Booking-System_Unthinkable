# Ticket Booking System

High-concurrency event ticket booking platform for movies and concerts. Handles simultaneous seat selection with automatic hold expiry, sold-out waitlist management with time-limited offers, and email tickets with QR codes.

## Features

- **Real-time Seat Map:** Live availability with Socket.IO + countdown timers
- **Concurrency-Safe Hold Engine:** CAS with row locks prevents double-booking
- **TTL Auto-Release:** Dual-layer expiry (lazy + sweeper) frees abandoned holds
- **Waitlist with Auto-Assign:** SKIP LOCKED queue, time-limited offers, cascade on expiry
- **QR Tickets:** HMAC-signed tokens, email delivery with PNG attachment
- **Role-Based Access:** Admin (venues), Organiser (shows + dashboard), Customer (booking + waitlist)
- **Revenue Dashboard:** Per-show breakdown, occupancy, category revenue

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (local dev)
- PostgreSQL 14+ (or Docker)

### Local Development

```bash
# Install dependencies
npm install

# Start Postgres (Docker)
docker-compose up -d

# Setup database
cd server && npx prisma migrate dev && npm run db:seed
cd ..

# Start dev servers
npm run dev
```

Client: http://localhost:5173
Server: http://localhost:3001
Health check: http://localhost:3001/health

### Test Data

Auto-seeded logins:
- **Admin:** admin@test.com / admin123
- **Organiser:** organiser@test.com / org123
- **Customer:** customer1@test.com / cust123

### Concurrency Test

```bash
cd server
npm run test:race
```

Requires the server to be running (`npm run dev`) and the database seeded. Spawns two parallel hold requests on the same seat and verifies exactly one succeeds (201), one fails (409). The TTL-reclaim test is skipped unless the show's `holdTtlSeconds` is 30 or less.

## Project Structure

```
server/              Express + TypeScript + Socket.IO
  ├─ src/
  │  ├─ routes/     Endpoints (auth, venues, shows, holds, bookings, waitlist, dashboard)
  │  ├─ lib/        Database client, QR generation, mailer, waitlist helpers
  │  ├─ jobs/       Sweeper (TTL expiry, cascade, email drain)
  │  ├─ realtime/   Socket.IO server
  │  └─ middleware/ Auth, RBAC
  ├─ prisma/        Schema + migrations
  └─ tests/         Race condition verification

client/              Vite + React + TypeScript + Tailwind
  ├─ src/
  │  ├─ pages/      Browse, ShowDetail, MyBookings, MyWaitlist, AcceptOffer, Dashboard
  │  ├─ components/ SeatMap (interactive), GridBuilder
  │  ├─ hooks/      useShows, useVenues, useSocket
  │  └─ context/    Auth state + token persistence

docs/
  ├─ SYSTEM_DESIGN.md  Core mechanisms (CAS, TTL, waitlist, cascade)
  ├─ API.md            Endpoint reference
  └─ SCHEMA.md         Database tables + indexes
```

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **DB** | PostgreSQL | Row locks, partial indexes, concurrent CAS |
| **ORM** | Prisma (schema) + raw SQL (hot path) | Generated migrations, explicit locks where needed |
| **Backend** | Express + TypeScript | Simple, explicit, easy to audit |
| **Real-time** | Socket.IO (persistent WS) | Live seat updates without polling |
| **Auth** | JWT + bcryptjs | Stateless, role-based middleware |
| **Frontend** | React + Tailwind | SPA, context for state |
| **QR** | qrcode (Node) | Generate PNG, embed in email as CID |
| **Email** | Resend (prod) + console (dev) | Free tier 100/day, HTML preview writes to disk |

## Core Design Patterns

### Seat Hold (Concurrency)
Compare-and-set with row locks: SELECT ... FOR UPDATE, validate predicate (status=AVAILABLE or expired), UPDATE with version increment. Losing txn sees predicate fail, rolls back, returns 409.

**Why no optimistic locking alone?** Without row-level locks, two txns could both see AVAILABLE, both attempt UPDATE, both succeed (conflict lost). Row locks + CAS atomic check ensures exactly one winner.

### TTL & Auto-Release
**Lazy expiry** in every query: `CASE WHEN held_until <= now() THEN 'AVAILABLE'`. Sweeper runs every 5s for timeliness (emit socket updates, process side effects like emails).

**Why two layers?** Lazy expiry = correctness (seats never permanently stuck). Sweeper = performance + UX (real-time updates without waiting for next query).

### Waitlist & Cascade
Queue per category. On cancel, `FOR UPDATE SKIP LOCKED` prevents convoy; concurrent cancellations each lock a different portion of the queue. Offers expire via sweeper, which auto-cascades to next customer without manual retry.

### Real-Time Updates
Socket.IO rooms per show. After every commit (hold, book, release, offer), emit `seat:update` with delta. Frontend patches state instantly, no page reload.

## Deployment

### Hosted (Recommended for Demo)

1. **Database:** Neon PostgreSQL
   - Create free tier project
   - Copy connection string → `DATABASE_URL`

2. **Backend:** Render
   - Connect GitHub repo
   - Set `NODE_ENV=production`, `DATABASE_URL`, secrets
   - Deploy from `server/` directory
   - Note: free tier cold-starts after 15min idle (acceptable for demo)

3. **Frontend:** Vercel
   - Connect GitHub repo
   - Set `VITE_API_URL=https://your-render-url.onrender.com`
   - Deploy from `client/` directory

### Local Production Build

```bash
# Build
npm run build

# Server dist
cd server && npm run build
# Run: node dist/index.js

# Client dist
cd client && npm run build
# Serve via nginx or `npm run preview`
```

### Environment Variables

**Server (.env)**
```
DATABASE_URL=postgresql://...
PORT=3001
NODE_ENV=production
CLIENT_URL=https://your-vercel-url.vercel.app
JWT_SECRET=<random 32+ chars>
QR_SECRET=<random 32+ chars>
MAIL_DRIVER=resend
RESEND_API_KEY=re_<key>
EMAIL_FROM=onboarding@resend.dev
```

**Client (.env)**
```
VITE_API_URL=https://your-render-url.onrender.com
VITE_SOCKET_URL=https://your-render-url.onrender.com
```

## Documentation

- **[System Design](./docs/SYSTEM_DESIGN.md)** — 800-word deep dive: CAS engine, TTL mechanism, waitlist cascade, SKIP LOCKED queue, concurrency guarantees
- **[API Reference](./docs/API.md)** — All endpoints, request/response schemas
- **[Database Schema](./docs/SCHEMA.md)** — Tables, indexes, constraints, concurrency strategy

## Testing

### Race Condition Test
Two customers simultaneously hold same seat → one succeeds, one fails (409).
```bash
npm run test:race
```

### Manual Testing Checklist
- [ ] Hold seat → countdown timer starts
- [ ] Hold expires after TTL (seeded shows use 600s; lower `holdTtlSeconds` on the show to test faster) → seat auto-releases
- [ ] Two browser tabs attempt hold on same seat → one blocked with 409
- [ ] Cancel booking → seat offered to next in waitlist
- [ ] Accept offer → booking created with email + QR
- [ ] Verify QR token with gate endpoint → booking details returned
- [ ] Dashboard shows revenue breakdown by category

## Performance Notes

- Sweeper runs every 5s under advisory lock (single instance safe).
- Socket.IO polling fallback if WS unavailable (no loss of functionality).
- Prisma pooler recommended for connection reuse at scale.
- Neon auto-suspend after 30min idle (acceptable for demo).
- Render cold-start ≤15min (demos only; production needs HA setup).

## Known Limitations

1. **Email tier:** Resend free = 100/day. Production requires upgrade.
2. **Socket.IO:** Vercel serverless can't hold connections. Single Render instance works; scale horizontally requires Redis adapter.
3. **Sweeper:** Single setInterval per process. For HA, use external job queue (Bull, Temporal, AWS EventBridge).

## License

MIT
