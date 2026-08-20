import { Resend } from 'resend';
import { env } from '../config/env.js';
import fs from 'fs/promises';
import path from 'path';

const resend = env.MAIL_DRIVER === 'resend' ? new Resend(env.RESEND_API_KEY) : null;

interface EmailData {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    cid?: string;
  }>;
}

export async function sendEmail(data: EmailData): Promise<boolean> {
  if (env.MAIL_DRIVER === 'console') {
    console.log('=== EMAIL (console driver) ===');
    console.log('To:', data.to);
    console.log('Subject:', data.subject);
    console.log('HTML:', data.html.substring(0, 200) + '...');
    console.log('Attachments:', data.attachments?.length || 0);

    // Write to disk for preview
    const previewDir = path.join(process.cwd(), '.mail-preview');
    await fs.mkdir(previewDir, { recursive: true });
    const filename = `${Date.now()}-${data.to.replace(/[^a-z0-9]/gi, '_')}.html`;
    await fs.writeFile(path.join(previewDir, filename), data.html);
    console.log('Preview saved to:', filename);
    console.log('==============================');
    return true;
  }

  if (env.MAIL_DRIVER === 'resend' && resend) {
    try {
      await resend.emails.send({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: data.subject,
        html: data.html,
        attachments: data.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
        })),
      });
      return true;
    } catch (err) {
      console.error('Resend error:', err);
      return false;
    }
  }

  return false;
}

export function renderBookingEmail(data: {
  customerName: string;
  showTitle: string;
  showDate: string;
  bookingRef: string;
  seats: Array<{ rowLabel: string; seatNumber: number }>;
  totalAmount: string;
  qrCid: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .ticket { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .seats { display: inline-block; background: #e5e7eb; padding: 10px 15px; border-radius: 4px; margin: 5px; font-weight: bold; }
    .qr { text-align: center; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎟️ Booking Confirmed!</h1>
  </div>
  <div class="content">
    <p>Hi <strong>${data.customerName}</strong>,</p>
    <p>Your booking for <strong>${data.showTitle}</strong> is confirmed!</p>

    <div class="ticket">
      <h3>Booking Details</h3>
      <p><strong>Booking Reference:</strong> ${data.bookingRef}</p>
      <p><strong>Show:</strong> ${data.showTitle}</p>
      <p><strong>Date:</strong> ${data.showDate}</p>
      <p><strong>Total:</strong> ${data.totalAmount}</p>

      <h4>Your Seats</h4>
      ${data.seats.map((s) => `<span class="seats">${s.rowLabel}${s.seatNumber}</span>`).join('')}

      <div class="qr">
        <h4>Your Ticket QR Code</h4>
        <img src="cid:${data.qrCid}" alt="QR Code" width="250" />
        <p style="font-size: 12px; color: #6b7280;">Show this QR code at the venue</p>
      </div>
    </div>

    <p>See you at the show!</p>
  </div>
  <div class="footer">
    <p>Ticket Booking System</p>
  </div>
</body>
</html>
  `.trim();
}
