import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  CLIENT_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  QR_SECRET: z.string().min(32),
  SEAT_HOLD_TTL_SECONDS: z.coerce.number().default(600),
  WAITLIST_OFFER_TTL_SECONDS: z.coerce.number().default(1800),
  SWEEP_INTERVAL_MS: z.coerce.number().default(5000),
  MAIL_DRIVER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('onboarding@resend.dev'),
});

export const env = envSchema.parse(process.env);
