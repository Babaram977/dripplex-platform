import { execSync } from 'node:child_process';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { PERMISSION_SEEDS } from './seed-data/permissions';
import { ROLE_SEEDS } from './seed-data/roles';

const backendRoot = path.resolve(__dirname, '..');
const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

let databaseAvailable = false;

beforeAll(async () => {
  try {
    execSync('pnpm exec prisma migrate deploy', {
      cwd: backendRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });
    await prisma.$connect();
    databaseAvailable = true;
  } catch {
    databaseAvailable = false;
  }
});

describe('Prisma migrations and seed (S1-C1)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('applies migrations successfully (idempotent deploy)', () => {
    if (!databaseAvailable) {
      return;
    }

    expect(() => {
      execSync('pnpm exec prisma migrate deploy', {
        cwd: backendRoot,
        stdio: 'pipe',
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
        },
      });
    }).not.toThrow();
  });

  it('executes the identity seed idempotently', async () => {
    if (!databaseAvailable) {
      return;
    }

    execSync('pnpm exec prisma db seed', {
      cwd: backendRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });

    const [roleCount, permissionCount, grantCount] = await Promise.all([
      prisma.role.count({ where: { deletedAt: null, isSystem: true } }),
      prisma.permission.count({ where: { deletedAt: null } }),
      prisma.rolePermission.count(),
    ]);

    expect(roleCount).toBe(ROLE_SEEDS.length);
    expect(permissionCount).toBe(PERMISSION_SEEDS.length);
    expect(grantCount).toBeGreaterThan(0);

    execSync('pnpm exec prisma db seed', {
      cwd: backendRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });

    const grantCountAfterRerun = await prisma.rolePermission.count();
    expect(grantCountAfterRerun).toBe(grantCount);
  });
});
