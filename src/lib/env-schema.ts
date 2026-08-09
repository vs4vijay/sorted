import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  APP_URL: z.url().default('http://localhost:7070'),
  SARVAM_API_KEY: z.string().min(20).optional(),
  SARVAM_ENABLED: z.enum(['true', 'false']).default('false'),
  EMAIL_DELIVERY_ENABLED: z.enum(['true', 'false']).default('false'),
  MALWARE_SCANNER_ENABLED: z.enum(['true', 'false']).default('false'),
  MALWARE_SCANNER_URL: z.url().optional(),
  MALWARE_SCANNER_TOKEN: z.string().min(12).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOCAL_AUTH_BYPASS: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
}).superRefine((env, context) => {
  if (env.LOCAL_AUTH_BYPASS && env.APP_ENV !== 'development') {
    context.addIssue({
      code: 'custom',
      path: ['LOCAL_AUTH_BYPASS'],
      message: 'LOCAL_AUTH_BYPASS can only be enabled when APP_ENV=development.',
    });
  }
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseServerEnv(input: Partial<NodeJS.ProcessEnv>): ServerEnv {
  return envSchema.parse(input);
}
