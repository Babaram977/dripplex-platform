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

  describe('DPX-STORAGE-001 — object storage URL validation', () => {
    it('defaults object storage to empty (safe-until-configured) and region to auto', () => {
      const env = validateEnv(base);
      expect(env.OBJECT_STORAGE_ENDPOINT).toBe('');
      expect(env.OBJECT_STORAGE_PUBLIC_BASE_URL).toBe('');
      expect(env.OBJECT_STORAGE_REGION).toBe('auto');
    });

    it('accepts well-formed storage URLs when configured', () => {
      const env = validateEnv({
        ...base,
        OBJECT_STORAGE_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
        OBJECT_STORAGE_PUBLIC_BASE_URL: 'https://cdn.dripplex.com',
      });
      expect(env.OBJECT_STORAGE_ENDPOINT).toBe('https://account.r2.cloudflarestorage.com');
      expect(env.OBJECT_STORAGE_PUBLIC_BASE_URL).toBe('https://cdn.dripplex.com');
    });

    it('rejects a malformed OBJECT_STORAGE_ENDPOINT (fails fast at boot)', () => {
      expect(() => validateEnv({ ...base, OBJECT_STORAGE_ENDPOINT: 'not-a-url' })).toThrow(
        /Invalid environment configuration/,
      );
    });

    it('rejects a malformed OBJECT_STORAGE_PUBLIC_BASE_URL', () => {
      expect(() =>
        validateEnv({ ...base, OBJECT_STORAGE_PUBLIC_BASE_URL: 'cdn.dripplex.com' }),
      ).toThrow(/Invalid environment configuration/);
    });
  });

  describe('MERCHANT_MODULE_ENABLED (staged activation flag)', () => {
    it('defaults to false (deployed-but-disabled)', () => {
      expect(validateEnv(base).MERCHANT_MODULE_ENABLED).toBe(false);
    });

    it("coerces the string 'true' to a boolean true", () => {
      expect(
        validateEnv({ ...base, MERCHANT_MODULE_ENABLED: 'true' }).MERCHANT_MODULE_ENABLED,
      ).toBe(true);
    });

    it("coerces the string 'false' to a boolean false", () => {
      expect(
        validateEnv({ ...base, MERCHANT_MODULE_ENABLED: 'false' }).MERCHANT_MODULE_ENABLED,
      ).toBe(false);
    });

    it('rejects a non-boolean flag value (fails fast at boot)', () => {
      expect(() => validateEnv({ ...base, MERCHANT_MODULE_ENABLED: 'yes' })).toThrow(
        /Invalid environment configuration/,
      );
    });
  });
});
