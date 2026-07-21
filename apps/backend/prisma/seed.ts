import { PrismaClient } from '@prisma/client';

import { PERMISSION_SEEDS } from './seed-data/permissions';
import { ROLE_PERMISSION_GRANTS } from './seed-data/role-permissions';
import { ROLE_SEEDS } from './seed-data/roles';

const prisma = new PrismaClient();

async function seedPermissions(): Promise<Map<string, string>> {
  const permissionIds = new Map<string, string>();

  for (const permission of PERMISSION_SEEDS) {
    const record = await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        description: permission.description,
        deletedAt: null,
      },
      create: {
        code: permission.code,
        description: permission.description,
      },
    });

    permissionIds.set(record.code, record.id);
  }

  return permissionIds;
}

async function seedRoles(): Promise<Map<string, string>> {
  const roleIds = new Map<string, string>();

  for (const role of ROLE_SEEDS) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
        isSystem: true,
        deletedAt: null,
      },
      create: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    });

    roleIds.set(record.name, record.id);
  }

  return roleIds;
}

async function seedRolePermissions(
  roleIds: Map<string, string>,
  permissionIds: Map<string, string>,
): Promise<void> {
  for (const [roleName, permissionCodes] of Object.entries(ROLE_PERMISSION_GRANTS)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) {
      throw new Error(`Missing seeded role: ${roleName}`);
    }

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionIds.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Missing seeded permission: ${permissionCode}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }
}

async function main(): Promise<void> {
  const permissionIds = await seedPermissions();
  const roleIds = await seedRoles();
  await seedRolePermissions(roleIds, permissionIds);

  process.stdout.write(
    `Seeded ${String(permissionIds.size)} permissions, ${String(roleIds.size)} roles, and role-permission grants.\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
