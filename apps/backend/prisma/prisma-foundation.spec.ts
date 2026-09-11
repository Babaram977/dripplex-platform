import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Prisma } from '@prisma/client';

import { PERMISSION_SEEDS } from './seed-data/permissions';
import { ROLE_SEEDS } from './seed-data/roles';

import type { RoleSeed } from './seed-data/roles';

const backendRoot = path.resolve(__dirname, '..');

describe('Prisma schema foundation (S1-C1)', () => {
  it('validates the Prisma schema', () => {
    execSync('pnpm exec prisma validate', {
      cwd: backendRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env['DATABASE_URL'] ??
          'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public',
      },
    });
  });

  it('generates the Prisma client without errors', () => {
    execSync('pnpm exec prisma generate', {
      cwd: backendRoot,
      stdio: 'pipe',
    });

    expect(Prisma.ModelName.User).toBe('User');
    expect(Prisma.ModelName.AuthSession).toBe('AuthSession');
    expect(Prisma.ModelName.PasswordResetToken).toBe('PasswordResetToken');
    expect(Prisma.ModelName.IdentityVerification).toBe('IdentityVerification');
    expect(Prisma.ModelName.CustomerProfile).toBe('CustomerProfile');
    expect(Prisma.ModelName.CustomerAddress).toBe('CustomerAddress');
    expect(Prisma.ModelName.Cart).toBe('Cart');
    expect(Prisma.ModelName.CartItem).toBe('CartItem');
    expect(Prisma.ModelName.MerchantProfile).toBe('MerchantProfile');
    expect(Prisma.ModelName.Business).toBe('Business');
    expect(Prisma.ModelName.MerchantKyc).toBe('MerchantKyc');
    expect(Prisma.ModelName.BankAccount).toBe('BankAccount');
    expect(Prisma.ModelName.RiderProfile).toBe('RiderProfile');
    expect(Prisma.ModelName.DriverProfile).toBe('DriverProfile');
    expect(Prisma.ModelName.Ride).toBe('Ride');
    expect(Prisma.ModelName.RideTracking).toBe('RideTracking');
    expect(Prisma.ModelName.DriverAvailability).toBe('DriverAvailability');
    expect(Prisma.ModelName.DriverKyc).toBe('DriverKyc');
    expect(Prisma.ModelName.RideOffer).toBe('RideOffer');
    expect(Prisma.ModelName.RidePaymentTransaction).toBe('RidePaymentTransaction');
    expect(Prisma.ModelName.RideRating).toBe('RideRating');
    expect(Prisma.ModelName.RideProblemReport).toBe('RideProblemReport');
    expect(Prisma.ModelName.Vehicle).toBe('Vehicle');
    expect(Prisma.ModelName.InspectionCentre).toBe('InspectionCentre');
    expect(Prisma.ModelName.Inspection).toBe('Inspection');
    expect(Prisma.ModelName.DriverOnboarding).toBe('DriverOnboarding');
  });

  it('defines the DPX-013 Sprint 1 role and permission catalog sizes', () => {
    // 10 as of 2026-08-30. The one added is `fleet_owner` (DPX-FLEET) — a
    // company supplying riders and drivers, which is a genuinely new persona
    // rather than a variation on an existing one: it reads only its own
    // console, manages only its own people, and holds no permission any other
    // role does.
    expect(ROLE_SEEDS).toHaveLength(10);
    expect(PERMISSION_SEEDS.length).toBeGreaterThanOrEqual(37);
    // 128 as of 2026-08-18. Three are the Utilities tab —
    // `customer:utilities:read` and `customer:utilities:purchase` are split so
    // a restricted customer can still see what a bundle costs without being
    // able to spend, and `admin:utilities:manage` gates the float balance and
    // the manual resolution of purchases Peyflex never answered for. The other
    // three (`messaging:use`, `rider:wallet:withdraw`, `driver:wallet:withdraw`)
    // were already live in production's own catalogue but had never been added
    // here — see rbac-seed-parity.spec.ts, which now stops the two lists
    // drifting at all. Bump this only alongside a permission you meant to add;
    // an unexplained bump is a permission that arrived without review.
    // 132 as of 2026-08-21. The four added are hotel booking (DPX-HOTEL-001):
    // `customer:bookings:read` and `customer:bookings:book` are split for the
    // same reason the utilities pair is — a restricted customer should still be
    // able to see what a room costs without being able to hold money against
    // it. `merchant:bookings:manage` is a hotel's own rooms, calendar and book,
    // and `admin:bookings:manage` is the read-only Ops list.
    // 133 as of 2026-08-26. The one added is `driver:referrals:use`, a
    // driver's own standing referral code. Deliberately not the customer
    // permission: `Referral.ownerType` is fixed when a code is created and
    // decides which wallet the reward is paid into, so a driver issued a code
    // under the customer permission would have their ₦350 filed as a
    // customer's.
    // 134 as of 2026-08-26. The one added is `calls:use` (DPX-MOBILE-002),
    // granted to exactly the roles that already hold `messaging:use`. Like
    // that one it only says "this kind of account may call at all" — reaching
    // a specific person is decided by JobParticipantsService from the job's
    // own two parties, so holding it never lets anyone call a stranger.
    // 135 as of 2026-08-29. The one added is `operations:history:read`, the
    // completed record of rides, deliveries, orders and utility purchases —
    // the founder's audit / dispute / security-enquiry requirement. Its own
    // grant rather than folding into `operations:live:read`, because the live
    // queue is the handful of jobs in flight while this is the entire history
    // of every customer, driver and merchant, names and phone numbers
    // included. Revoking it must not blind an operator to live work, and
    // granting live work must not hand over the archive.
    // 139 as of 2026-08-30. The four added are DPX-FLEET. `fleet:own:read` and
    // `fleet:own:manage` are the owner's own console, split for the same
    // reason the utilities pair is — reading your riders is not the same
    // authority as deactivating one. `admin:fleets:manage` is Operations
    // issuing Fleet DX numbers and attaching people, and
    // `admin:fleets:commission:manage` is separate again because editing the
    // volume bands changes what every fleet is charged, which is a different
    // level of authority from attaching one rider to one fleet.
    // 139 -> 141: MKT-INT-001 adds integrations:read and integrations:write.
    // 141 -> 142: `rider:referrals:use`, a rider's own standing referral code.
    // Riders were the one earning persona without one. Its own permission
    // rather than the driver's for the reason that split already exists:
    // `Referral.ownerType` is fixed at creation and decides which wallet the
    // reward is paid into, so a rider issued a code under the driver
    // permission would have their reward filed as a driver's.
    // 142 -> 143: `merchant:wallet:withdraw`. Merchants are paid by automatic
    // settlement when an online order completes, which continues, but they were
    // the only earning persona who could not ask for a payout of their own
    // balance. Split from :read for the reason every persona splits them —
    // seeing a balance and moving it are different authorities.
    // 143 -> 145: `admin:commission-campaign:read` / `:manage`
    // (DPX-COMMISSION-001). Split from each other because Operations staff need
    // to see which rate is running to answer a partner's question, without
    // being able to change what the platform charges; split from
    // `admin:commercial:commission-settings:manage` because that is the
    // standing rate and this is a temporary override, and the two are edited
    // by the same people but read by different ones.
    // 145 -> 147: `loyalty:redemption-code:create` and
    // `merchant:loyalty:redeem` (DPX-LOYALTY-002). The first is held by
    // customers, drivers and riders alike, because a DX point balance is keyed
    // on the user rather than the persona and all three can spend theirs in a
    // shop; the second is the merchant side of the same transaction, and the
    // two are deliberately not one permission — generating an authorisation
    // over your own points and taking somebody else's are opposite ends of it.
    // 147 -> 148: `operations:finance:read` (DPX-OPS). Its own permission
    // rather than reusing ANALYTICS_READ, which is aggregate operating data —
    // this names individual partners, what they are owed and what they have
    // earned. Read-only: approving a payout stays on the withdrawal and
    // fleet-settlement endpoints, so an operator can be given the queue
    // without being given the ability to pay anybody.
    expect(PERMISSION_SEEDS).toHaveLength(148);
    expect(PERMISSION_SEEDS.map((permission) => permission.code)).toEqual(
      expect.arrayContaining([
        'admin:rides:pricing:manage',
        'customer:utilities:read',
        'customer:utilities:purchase',
        'admin:utilities:manage',
        'admin:commission-campaign:read',
        'admin:commission-campaign:manage',
        'loyalty:redemption-code:create',
        'merchant:loyalty:redeem',
        'operations:finance:read',
      ]),
    );
    expect(ROLE_SEEDS.map((role: RoleSeed) => role.name)).toEqual(
      expect.arrayContaining([
        'customer',
        'merchant',
        'rider',
        'driver',
        'operations_staff',
        'administrator',
        'super_administrator',
      ]),
    );
  });
});

describe('Production deploy path seeds RBAC (P0-1)', () => {
  // A fresh production deployment must run the idempotent RBAC bootstrap, not a
  // bare `prisma migrate deploy` — otherwise the roles/permissions registration
  // depends on are absent and every portal's registration/login breaks. This
  // static check guards against the deploy script regressing back to migrate-only.
  const deployScript = readFileSync(
    path.resolve(backendRoot, '../../scripts/backend/deploy-api.sh'),
    'utf8',
  );

  it('deploy-api.sh runs the RBAC bootstrap (seed-rbac.cjs), which itself migrates', () => {
    expect(deployScript).toContain('node prisma/seed-rbac.cjs');
  });

  it('deploy-api.sh does not run a bare migrate-only step that would skip RBAC seeding', () => {
    // The RBAC bootstrap runs migrate deploy internally; the deploy script must
    // not invoke `prisma migrate deploy` directly as its DB bring-up command.
    expect(deployScript).not.toMatch(/(npx|pnpm exec) prisma migrate deploy/);
  });
});

// seed-rbac.cjs reconciles a migration that an earlier deploy left failed, by
// marking it rolled back so `migrate deploy` re-runs it. That is only sound
// while every statement in the named migrations is guarded — an unguarded
// CREATE/ALTER would fail a second time on a database that already has the
// object, and the deploy would be stuck again with no way forward. These
// checks are the standing proof of that precondition: adding a name to the
// allowlist without making its SQL replay-safe fails here rather than in
// production's pre-deploy step.
describe('seed-rbac.cjs failed-migration reconciliation', () => {
  const bootstrap = readFileSync(path.resolve(backendRoot, 'prisma/seed-rbac.cjs'), 'utf8');

  const allowlist = (() => {
    const block = /REPLAY_SAFE_FAILED_MIGRATIONS = new Set\(\[([\s\S]*?)\]\)/.exec(bootstrap);
    if (!block?.[1]) {
      throw new Error('seed-rbac.cjs no longer declares REPLAY_SAFE_FAILED_MIGRATIONS');
    }
    return [...block[1].matchAll(/'([^']+)'/g)].flatMap((match) => match[1] ?? []);
  })();

  it('reconciles only against an explicit allowlist, never "whatever is failed"', () => {
    expect(allowlist.length).toBeGreaterThan(0);
    // The unknown-migration branch is what makes this fail closed.
    expect(bootstrap).toContain('Refusing to reconcile unrecognised failed migration');
  });

  it('marks migrations rolled back (re-run), never applied (skip)', () => {
    // --applied would tell Prisma the migration succeeded and move on, which
    // assumes production's schema already matches. --rolled-back re-executes
    // it, so no assumption about the live schema is needed.
    expect(bootstrap).toContain("'--rolled-back'");
    expect(bootstrap).not.toContain("'--applied'");
  });

  it.each(allowlist)('%s exists and every statement in it is replay-safe', (name) => {
    const sql = readFileSync(
      path.resolve(backendRoot, 'prisma/migrations', name, 'migration.sql'),
      'utf8',
    );

    const statements = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      // DO $$ ... END $$ blocks carry their own existence checks (pg_constraint
      // lookups, exception handlers), so they are excluded from the line scan.
      .replace(/DO \$\$[\s\S]*?END \$\$;/g, '');

    const unguarded = statements
      .split(';')
      .map((statement) => statement.trim().replace(/\s+/g, ' '))
      .filter(
        (statement) =>
          /^(CREATE (TABLE|INDEX|UNIQUE INDEX|TYPE)|ALTER TABLE \S+ ADD COLUMN|ALTER TYPE)/i.test(
            statement,
          ) && !/IF NOT EXISTS/i.test(statement),
      );

    expect(unguarded).toEqual([]);
  });
});
