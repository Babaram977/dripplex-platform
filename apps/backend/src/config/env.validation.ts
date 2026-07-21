import { z } from 'zod';

const durationSchema = z.string().regex(/^\d+[smhd]$/, 'Duration must look like 15m, 7d, 3600s');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_GLOBAL_PREFIX: z.string().default('api/v1'),
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: durationSchema.default('15m'),
  JWT_REFRESH_TTL: durationSchema.default('7d'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
