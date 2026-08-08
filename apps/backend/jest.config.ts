import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // Fails the run in CI (or with DATABASE_REQUIRED=true) if the database is
  // unreachable, so DB-backed integration specs cannot silently skip and pass.
  globalSetup: '<rootDir>/test/jest-global-setup.ts',
  // Run suites serially. Most backend specs are real-Postgres integration tests
  // that share one database and reset global/singleton tables with unscoped
  // deleteMany({}) between tests (e.g. commercial_credit_settings — unique on
  // owner_type — and the commission ledger/account tables). Jest's default
  // parallel workers let two such suites run against that single database at
  // once, so one suite's global wipe or singleton insert collides with
  // another's in flight — a nondeterministic, worker-count-dependent failure
  // that only surfaced once CI gained a real database. Serial execution makes
  // the shared-database suites deterministic. (Latent app-side concurrency of
  // getEffective's check-then-create is tracked separately for D7 hardening.)
  maxWorkers: 1,
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};

export default config;
