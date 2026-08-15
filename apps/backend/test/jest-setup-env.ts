/**
 * Test-only environment floor.
 *
 * `ConfigModule.forRoot()` validates the environment at **import** time, so any
 * spec that imports AppModule (app.module.spec.ts, rider-settlement.service.spec.ts)
 * throws "Invalid environment configuration" before a single test runs unless
 * REDIS_URL and the JWT secrets are present.
 *
 * On a developer machine those come from apps/backend/.env, which is gitignored
 * — so those specs passed locally and failed in CI, where no .env exists. That
 * made the suite's result depend on an untracked file: exactly the kind of
 * "green locally, red in CI" gap the DB-integrity guard in jest-global-setup.ts
 * was written to close.
 *
 * These values are placeholders for module wiring only. Nothing here reaches a
 * real service: Redis is constructed with `lazyConnect` and only dials in
 * onModuleInit, which `compile()` does not run, and the JWT secrets are
 * length-validated dummies. Every assignment is conditional, so a real
 * DATABASE_URL / REDIS_URL from CI or a developer .env always wins.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-chars',
  JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-chars',
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}
