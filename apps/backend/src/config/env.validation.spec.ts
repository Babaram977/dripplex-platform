import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-chars!!',
    JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-chars!',
  };

  it('accepts a valid configuration and applies defaults', () => {
    const env = validateEnv(base);
    expect(env.API_PORT).toBe(3000);
    expect(env.API_GLOBAL_PREFIX).toBe('api/v1');
    expect(env.OTP_LENGTH).toBe(6);
    expect(env.BCRYPT_SALT_ROUNDS).toBe(12);
    expect(env.PAYMENT_DEFAULT_PROVIDER).toBe('PAYSTACK');
    expect(env.PAYSTACK_SECRET_KEY).toBe('');
    expect(env.FIREBASE_PROJECT_ID).toBe('');
  });

  it('rejects short JWT secrets', () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_ACCESS_SECRET: 'too-short',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('rejects invalid duration formats', () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_ACCESS_TTL: '15minutes',
      }),
    ).toThrow(/Invalid environment configuration/);
  });
});
