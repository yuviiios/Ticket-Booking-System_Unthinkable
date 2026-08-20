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

test('Concurrent hold requests - exactly one wins', async () => {
  // Login as two customers
  const token1 = await login('customer1@test.com', 'cust123');
  const token2 = await login('customer2@test.com', 'cust123');

  assert.ok(token1, 'Customer1 login failed');
  assert.ok(token2, 'Customer2 login failed');

  // Target same seat
  const showId = 1;
  const seatIds = [1]; // Seat A1 (assuming seed data exists)

  // Fire parallel requests
  const [result1, result2] = await Promise.all([
    createHold(token1, showId, seatIds),
    createHold(token2, showId, seatIds),
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
  const showId = 1;
  const seatIds = [2]; // Seat A2

  // Create hold
  const hold1 = await createHold(token, showId, seatIds);
  assert.strictEqual(hold1.status, 201, 'First hold should succeed');

  console.log('Hold created, expires at:', hold1.data.expiresAt);
  console.log('Waiting 12 seconds for TTL expiry (if TTL=10s)...');

  // Wait for TTL + sweeper cycle (default 10s + 5s buffer)
  await new Promise((resolve) => setTimeout(resolve, 15000));

  // Try to hold same seat - should succeed (reclaim expired hold)
  const hold2 = await createHold(token, showId, seatIds);
  assert.strictEqual(hold2.status, 201, 'Second hold should reclaim expired seat');
});
