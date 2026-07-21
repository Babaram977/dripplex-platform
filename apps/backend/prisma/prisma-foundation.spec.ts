import { execSync } from 'node:child_process';
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
    expect(Prisma.ModelName.CustomerProfile).toBe('CustomerProfile');
    expect(Prisma.ModelName.MerchantProfile).toBe('MerchantProfile');
    expect(Prisma.ModelName.RiderProfile).toBe('RiderProfile');
    expect(Prisma.ModelName.DriverProfile).toBe('DriverProfile');
  });

  it('defines the DPX-013 Sprint 1 role and permission catalog sizes', () => {
    expect(ROLE_SEEDS).toHaveLength(7);
    expect(PERMISSION_SEEDS).toHaveLength(20);
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
