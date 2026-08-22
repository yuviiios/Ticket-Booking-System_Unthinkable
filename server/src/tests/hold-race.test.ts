import { test } from 'node:test';
import assert from 'node:assert';

const API_URL = process.env.API_URL || 'http://localhost:3001';

// Login helper
async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.token;
}

// Hold helper
async function createHold(token: string, showId: number, seatIds: number[]) {
  const res = await fetch(`${API_URL}/api/holds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ showId, seatIds }),
  });
  return { status: res.status, data: await res.json() };
}

// Pick the first PUBLISHED show. IDs are autoincrement and reseeding does not
// reset the sequences, so they must be discovered rather than hardcoded.
async function getPublishedShow() {
  const res = await fetch(`${API_URL}/api/shows`);
  const shows = await res.json();
  assert.ok(Array.isArray(shows) && shows.length > 0, 'No published shows — run `npm run db:seed`');
  return shows[0];
}

// Available seat ids for a show, in grid order.
async function getAvailableSeatIds(showId: number) {
  const res = await fetch(`${API_URL}/api/shows/${showId}`);
  const show = await res.json();
  return show.seats.filter((s: any) => s.status === 'AVAILABLE').map((s: any) => s.seatId);
}

test('Concurrent hold requests - exactly one wins', async () => {
  // Login as two customers
  const token1 = await login('customer1@test.com', 'cust123');
  const token2 = await login('customer2@test.com', 'cust123');

  assert.ok(token1, 'Customer1 login failed');
  assert.ok(token2, 'Customer2 login failed');

  const show = await getPublishedShow();
  const available = await getAvailableSeatIds(show.id);
  assert.ok(available.length > 0, 'No available seats — reseed the database');

  // Target same seat
  const seatIds = [available[0]];

  // Fire parallel requests
  const [result1, result2] = await Promise.all([
    createHold(token1, show.id, seatIds),
    createHold(token2, show.id, seatIds),
  ]);

  console.log('Result1:', result1.status, result1.data);
  console.log('Result2:', result2.status, result2.data);

  // Exactly one should succeed (201), one should fail (409)
  const success = [result1, result2].filter((r) => r.status === 201);
  const conflict = [result1, result2].filter((r) => r.status === 409);

  assert.strictEqual(success.length, 1, 'Exactly one request should succeed');
  assert.strictEqual(conflict.length, 1, 'Exactly one request should conflict');
  assert.ok(conflict[0].data.error.includes('unavailable'), 'Conflict error message');
});

test('Expired hold is reclaimed by next request', async (t) => {
  const token = await login('customer1@test.com', 'cust123');

  const show = await getPublishedShow();
  const ttl = show.holdTtlSeconds ?? 600;

  // Production TTL is 10 minutes — too long to wait for in a test run. Lower the
  // show's holdTtlSeconds (or set SEAT_HOLD_TTL_SECONDS) to exercise this path.
  if (ttl > 30) {
    t.skip(`Show TTL is ${ttl}s; set holdTtlSeconds <= 30 on the show to run this test`);
    return;
  }

  const available = await getAvailableSeatIds(show.id);
  assert.ok(available.length > 0, 'No available seats — reseed the database');
  const seatIds = [available[0]];

  // Create hold
  const hold1 = await createHold(token, show.id, seatIds);
  assert.strictEqual(hold1.status, 201, 'First hold should succeed');

  console.log('Hold created, expires at:', hold1.data.expiresAt);
  console.log(`Waiting ${ttl + 5} seconds for TTL expiry...`);

  // Wait for TTL + sweeper cycle
  await new Promise((resolve) => setTimeout(resolve, (ttl + 5) * 1000));

  // Try to hold same seat - should succeed (reclaim expired hold)
  const hold2 = await createHold(token, show.id, seatIds);
  assert.strictEqual(hold2.status, 201, 'Second hold should reclaim expired seat');
});
