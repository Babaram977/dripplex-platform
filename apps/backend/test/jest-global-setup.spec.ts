import { databaseIsRequired } from './jest-global-setup';

/**
 * When the test run refuses to proceed without a database.
 *
 * This one predicate is the whole fix. The guard around it was already
 * thorough — it just never armed in the situation that actually caused harm:
 * a developer running `DATABASE_URL=… pnpm jest` against a database that was
 * down, and being told every DB-backed spec passed.
 *
 * Twice in two days that produced a run of green ticks asserting nothing, once
 * for a test of cross-hotel isolation on booking check-in codes — which
 * "passed" identically whether the guard it tested existed or had been deleted.
 *
 * So the cases below are the ways a person actually invokes the suite, not an
 * abstract truth table.
 */
describe('databaseIsRequired', () => {
  describe('arms when a database is plainly expected', () => {
    /** The case that was missing, and the reason this change exists. Nothing
     *  defaults DATABASE_URL — setting it is a statement of intent. */
    it('arms on an explicit DATABASE_URL', () => {
      expect(databaseIsRequired({ DATABASE_URL: 'postgresql://localhost/dripplex' })).toBe(true);
    });

    it('still arms in CI', () => {
      expect(databaseIsRequired({ CI: 'true' })).toBe(true);
    });

    it('still arms on DATABASE_REQUIRED=true', () => {
      expect(databaseIsRequired({ DATABASE_REQUIRED: 'true' })).toBe(true);
    });
  });

  describe('stays out of the way when no database is expected', () => {
    /** A contributor with no database can still run the suite. */
    it('does not arm on a bare environment', () => {
      expect(databaseIsRequired({})).toBe(false);
    });

    /** An empty value is not a URL. Treating it as one would fail a run for a
     *  variable somebody exported blank. */
    it('treats an empty DATABASE_URL as absent', () => {
      expect(databaseIsRequired({ DATABASE_URL: '' })).toBe(false);
    });

    /** REDIS_URL is defaulted for every worker by jest-setup-env, so its
     *  presence says nothing about intent and must not arm anything. */
    it('is not armed by REDIS_URL alone', () => {
      expect(databaseIsRequired({ REDIS_URL: 'redis://localhost:6379' })).toBe(false);
    });
  });

  describe('the opt-out', () => {
    /** The real case: a machine whose .env points at a database that is down,
     *  and someone who wants to run the specs that need none. */
    it('DATABASE_REQUIRED=false overrides every reason to arm', () => {
      expect(
        databaseIsRequired({
          DATABASE_REQUIRED: 'false',
          DATABASE_URL: 'postgresql://localhost/dripplex',
          CI: 'true',
        }),
      ).toBe(false);
    });

    /**
     * Only the exact string disables it. The failure this guard prevents is a
     * run that looks fine and is not, so a near-miss spelling must fail closed
     * — `DATABASE_REQUIRED=no` silently disarming would rebuild the original
     * hazard with extra steps.
     */
    it.each(['no', 'FALSE', 'False', '0', 'off', ''])(
      'does not disarm on DATABASE_REQUIRED=%p',
      (value) => {
        expect(
          databaseIsRequired({
            DATABASE_REQUIRED: value,
            DATABASE_URL: 'postgresql://localhost/dripplex',
          }),
        ).toBe(true);
      },
    );
  });
});
