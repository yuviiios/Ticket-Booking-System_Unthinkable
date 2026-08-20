# API Reference

Base URL: `http://localhost:3001/api`

## Auth

### POST /auth/register
Register customer or organiser.
```json
{
  "email": "user@example.com",
  "password": "minLength6",
  "name": "User Name",
  "role": "CUSTOMER" | "ORGANISER"
}
```
Response: `{ token, user: { id, email, name, role } }`

### POST /auth/login
```json
{ "email", "password" }
```
Response: `{ token, user }`

### GET /auth/me
Protected. Return current user.

## Venues (Admin)

### POST /venues
Admin only. Create venue.
```json
{ "name", "city", "address" }
```

### GET /venues
List all venues with categories.

### GET /venues/:id
Get venue detail with all seats.

### POST /venues/:venueId/categories
Admin only. Add seat category.
```json
{ "name", "colorHex": "#FFD700", "sortOrder": 0 }
```

### POST /venues/:venueId/seats/bulk
Admin only. Generate seats in bulk.
```json
{
  "rows": 5,
  "cols": 10,
  "categoryRows": [
    { "endRow": 1, "categoryId": 1 },
    { "endRow": 4, "categoryId": 2 }
  ]
}
```
Rows 0–1 get category 1, rows 2–4 get category 2.

## Shows

### POST /shows
Organiser only. Create show (DRAFT).
```json
{
  "venueId": 1,
  "title": "Movie Name",
  "type": "MOVIE" | "CONCERT",
  "description": "...",
  "startsAt": "2026-09-20T19:00:00Z",
  "prices": [
    { "categoryId": 1, "priceCents": 1500 }
  ]
}
```

### POST /shows/:id/publish
Organiser only. Materialise ShowSeats and publish.

### GET /shows
List published shows with optional filters.
Query: `?type=MOVIE&city=NewYork&status=PUBLISHED`

### GET /shows/:id
Get show detail with seat map.

### GET /shows/my/list
Organiser. Get my shows.

## Holds (TTL-based seat locks)

### POST /holds
Customer only. Hold seats (creates ACTIVE hold).
```json
{
  "showId": 1,
  "seatIds": [1, 2, 3]
}
```
Response: `{ holdId, expiresAt, seats: [{id, seatId, rowLabel, seatNumber}] }`
Returns **409** if any seat unavailable (already held or booked).

### DELETE /holds/:id
Customer. Release hold (frees seats immediately).

### GET /holds/:id
Customer. Check hold status.

## Bookings

### POST /bookings
Customer only. Convert active hold to booking.
```json
{ "holdId": 123 }
```
Response: `{ bookingRef, totalCents, seats }`
Email sent with QR ticket.

### GET /bookings/my
Customer. Get my bookings.

### GET /bookings/:ref
Customer. Get booking detail (checks ownership).

### POST /bookings/:ref/cancel
Customer. Cancel booking, release seats to waitlist.

### GET /bookings/verify/token/:token
Organiser gate check. Verify QR token, return booking details.
Validates HMAC signature.

## Waitlist

### POST /waitlist
Customer only. Join waitlist for a category.
```json
{
  "showId": 1,
  "categoryId": 2,
  "seatsWanted": 2
}
```

### GET /waitlist/my
Customer. Get my waitlist entries with pending offers.

### DELETE /waitlist/:id
Customer. Leave waitlist.

### POST /waitlist/offers/:token/accept
Customer only. Accept time-limited offer and convert to booking.

### GET /waitlist/offers/:token
Public. Get offer details (no auth, check auth on accept).

## Dashboard

### GET /dashboard/organiser
Organiser only. Revenue summary + per-show breakdown.
Response: 
```json
{
  "summary": {
    "totalRevenue": 50000,
    "totalBookings": 25,
    "totalShows": 3,
    "avgOccupancy": 78.5
  },
  "shows": [
    {
      "showId": 1,
      "title": "...",
      "totalRevenue": 20000,
      "bookingCount": 10,
      "occupancyRate": 85.5,
      "categoryBreakdown": [
        { "name": "Premium", "revenue": 15000, "seats": 6 }
      ]
    }
  ]
}
```

## Error Responses

Standard error format:
```json
{ "error": "descriptive message" }
```

Common status codes:
- **201:** Created
- **400:** Validation error (includes `errors` array from Zod)
- **401:** Unauthorized (missing/invalid token)
- **403:** Forbidden (insufficient role)
- **404:** Not found
- **409:** Conflict (seat unavailable, already in waitlist, etc.)
- **500:** Server error
