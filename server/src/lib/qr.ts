import QRCode from 'qrcode';
import crypto from 'crypto';
import { env } from '../config/env.js';

export async function generateQRCode(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: 'png', width: 300 });
}

export function generateBookingToken(bookingRef: string, showId: number): string {
  const payload = `${bookingRef}|${showId}`;
  const hmac = crypto.createHmac('sha256', env.QR_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}|${hmac}`).toString('base64url');
  return token;
}

export function verifyBookingToken(token: string): { bookingRef: string; showId: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = decoded.split('|');
    if (parts.length !== 3) return null;

    const [bookingRef, showIdStr, receivedHmac] = parts;
    const showId = parseInt(showIdStr);

    const payload = `${bookingRef}|${showId}`;
    const expectedHmac = crypto.createHmac('sha256', env.QR_SECRET).update(payload).digest('hex');

    if (receivedHmac !== expectedHmac) return null;

    return { bookingRef, showId };
  } catch {
    return null;
  }
}
