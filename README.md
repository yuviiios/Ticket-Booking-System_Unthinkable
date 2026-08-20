# Ticket Booking System

High-demand event ticket booking platform with real-time seat selection, automatic waitlist management, and QR-coded email tickets.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (for local Postgres)

### Setup

```bash
# Clone and install
npm install

# Start Postgres
docker-compose up -d

# Setup database (Phase 1)
cd server && npx prisma migrate dev

# Start dev servers
npm run dev
```

Client runs at http://localhost:5173  
Server at http://localhost:3001  
API: http://localhost:3001/health

## Project Structure

```
server/          Express + TypeScript, real-time Socket.IO, JWT auth
client/          Vite + React + Tailwind, role-based UI
docs/            System design, API reference, schema
docker-compose   Local Postgres for development
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Database | PostgreSQL + Prisma + raw SQL (hot path) |
| Backend | Express + TypeScript + Socket.IO |
| Frontend | Vite + React + Tailwind + React Router |
| Real-time | Socket.IO rooms per show |
| Auth | JWT + bcryptjs, role-based middleware |
| QR Codes | `qrcode` package → base64 CID attachment |
| Email | Resend or console driver for dev |
| Hosting | Vercel (client) + Render (server) + Neon (database) |

## Environment Variables

Copy `.env.example` to `.env` in both `server/` and `client/`.

### Server

```
DATABASE_URL          PostgreSQL connection string
PORT                  3001 (default)
NODE_ENV              development | production
CLIENT_URL            Frontend URL for CORS
JWT_SECRET            Random string, 32+ chars
JWT_EXPIRES_IN        24h (default)
QR_SECRET             Random string, 32+ chars
SEAT_HOLD_TTL_SECONDS 600 (10 minutes, default)
WAITLIST_OFFER_TTL_SECONDS 1800 (30 minutes, default)
SWEEP_INTERVAL_MS     5000 (5 seconds, default)
MAIL_DRIVER           console (dev) | resend (prod)
RESEND_API_KEY        Your Resend key (if prod)
EMAIL_FROM            Sender email (Resend subdomain)
```

### Client

```
VITE_API_URL          http://localhost:3001 (dev)
VITE_SOCKET_URL       http://localhost:3001 (dev)
```

## Build & Deploy

```bash
npm run build

# Server deploys to Render, client to Vercel
# Set environment variables in each platform's dashboard
```

---

**Status:** Scaffold phase complete. Phases 1–8 follow incrementally.
