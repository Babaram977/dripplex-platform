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
    expect(ROLE_SEEDS).toHaveLength(9);
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
    expect(PERMISSION_SEEDS).toHaveLength(132);
    expect(PERMISSION_SEEDS.map((permission) => permission.code)).toEqual(
      expect.arrayContaining([
        'admin:rides:pricing:manage',
        'customer:utilities:read',
        'customer:utilities:purchase',
        'admin:utilities:manage',
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
