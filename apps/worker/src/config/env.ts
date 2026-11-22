import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z
    .string()
    .default('postgresql://pulsestack:pulsestack@localhost:5432/pulsestack'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CONCURRENCY: z.coerce.number().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables for Worker:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
