import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  SARVAM_API_KEY: z.string().min(20).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ServerEnv = z.infer<typeof envSchema>;
let cached: ServerEnv | undefined;
export function getServerEnv(): ServerEnv {
  if (!cached) cached = envSchema.parse(process.env);
  return cached;
}

