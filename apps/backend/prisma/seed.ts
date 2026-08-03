import { PrismaClient } from '@prisma/client';

import { SEED_MERCHANTS, SEED_REVIEWER_USERS } from './seed-data/marketplace';
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

/**
 * Phase 1 testing substrate (per founder direction): realistic marketplace
 * fixture data — merchant, products, variants, reviews — so every
 * Marketplace screen (Store, Product Detail, Cart, Checkout, Tracking) can
 * be verified against the real backend and real UI rather than frontend
 * mocks. Fully idempotent (upserts / delete-then-recreate by natural
 * keys) so `pnpm seed` is safe to re-run. Phase 2: once each backend
 * module is fully live and this fixture data is no longer needed for
 * verification, remove the call to `seedMarketplace()` below — the UI
 * components themselves never depend on this data existing.
 */
async function seedMarketplace(): Promise<void> {
  const reviewerIds = new Map<string, string>();
  for (const reviewer of SEED_REVIEWER_USERS) {
    const user = await prisma.user.upsert({
      where: { email: reviewer.email },
      update: {},
      create: {
        email: reviewer.email,
        // Seed-only fixture accounts are never expected to authenticate.
        passwordHash: 'seed-fixture-not-a-real-hash',
        firstName: reviewer.firstName,
        lastName: reviewer.lastName,
        status: 'ACTIVE',
      },
    });
    reviewerIds.set(reviewer.email, user.id);
  }

  for (const merchant of SEED_MERCHANTS) {
    const merchantUser = await prisma.user.upsert({
      where: { email: merchant.user.email },
      update: {},
      create: {
        email: merchant.user.email,
        passwordHash: 'seed-fixture-not-a-real-hash',
        firstName: merchant.user.firstName,
        lastName: merchant.user.lastName,
        status: 'ACTIVE',
      },
    });

    const merchantProfile = await prisma.merchantProfile.upsert({
      where: { userId: merchantUser.id },
      update: { status: 'APPROVED', isApproved: true },
      create: { userId: merchantUser.id, status: 'APPROVED', isApproved: true },
    });

    await prisma.business.upsert({
      where: { registrationNumber: merchant.business.registrationNumber },
      update: {
        businessName: merchant.business.businessName,
        city: merchant.business.city,
        state: merchant.business.state,
      },
      create: {
        merchantId: merchantUser.id,
        businessName: merchant.business.businessName,
        businessType: 'SOLE_PROPRIETORSHIP',
        registrationNumber: merchant.business.registrationNumber,
        email: merchant.user.email,
        phone: '+2348010000000',
        country: 'Nigeria',
        state: merchant.business.state,
        city: merchant.business.city,
        address: merchant.business.address,
        latitude: merchant.business.latitude,
        longitude: merchant.business.longitude,
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
      },
    });

    const category = await prisma.category.upsert({
      where: { slug: merchant.category.slug },
      update: {},
      create: { name: merchant.category.name, slug: merchant.category.slug },
    });

    for (const seedProduct of merchant.products) {
      const product = await prisma.product.upsert({
        where: { merchantId_slug: { merchantId: merchantProfile.id, slug: seedProduct.slug } },
        update: {
          name: seedProduct.name,
          description: seedProduct.description,
          basePrice: seedProduct.basePrice,
          isFeatured: seedProduct.isFeatured,
        },
        create: {
          merchantId: merchantProfile.id,
          categoryId: category.id,
          name: seedProduct.name,
          slug: seedProduct.slug,
          description: seedProduct.description,
          basePrice: seedProduct.basePrice,
          sku: seedProduct.sku,
          status: 'PUBLISHED',
          isFeatured: seedProduct.isFeatured,
          publishedAt: new Date(),
        },
      });

      // No compound-unique key on images/variants — re-derive deterministically each run.
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      await prisma.productImage.createMany({
        data: seedProduct.images.map((image) => ({
          productId: product.id,
          url: image.url,
          position: image.position,
        })),
      });

      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      if (seedProduct.variants.length > 0) {
        await prisma.productVariant.createMany({
          data: seedProduct.variants.map((variant) => ({
            productId: product.id,
            name: variant.name,
            priceOverride: variant.priceOverride,
            isActive: true,
          })),
        });
      }

      await prisma.productInventory.upsert({
        where: { productId: product.id },
        update: { quantity: seedProduct.quantity },
        create: { productId: product.id, quantity: seedProduct.quantity, trackInventory: true },
      });

      await prisma.review.deleteMany({ where: { targetType: 'PRODUCT', targetId: product.id } });
      for (const review of seedProduct.reviews) {
        const authorId = reviewerIds.get(review.authorEmail);
        if (!authorId) {
          throw new Error(`Missing seeded reviewer: ${review.authorEmail}`);
        }
        await prisma.review.create({
          data: {
            authorId,
            targetType: 'PRODUCT',
            targetId: product.id,
            rating: review.rating,
            comment: review.comment,
            verifiedPurchase: true,
            status: 'APPROVED',
            ...(review.merchantReply
              ? { merchantReply: review.merchantReply, merchantRepliedAt: new Date() }
              : {}),
          },
        });
      }

      if (seedProduct.reviews.length > 0) {
        const ratings = seedProduct.reviews.map((r) => r.rating);
        const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
        const bucket = (star: number): number => ratings.filter((r) => r === star).length;
        await prisma.reviewAggregate.upsert({
          where: { targetType_targetId: { targetType: 'PRODUCT', targetId: product.id } },
          update: {
            averageRating: average,
            reviewCount: ratings.length,
            rating1: bucket(1),
            rating2: bucket(2),
            rating3: bucket(3),
            rating4: bucket(4),
            rating5: bucket(5),
          },
          create: {
            targetType: 'PRODUCT',
            targetId: product.id,
            averageRating: average,
            reviewCount: ratings.length,
            rating1: bucket(1),
            rating2: bucket(2),
            rating3: bucket(3),
            rating4: bucket(4),
            rating5: bucket(5),
          },
        });
      }
    }
  }

  process.stdout.write(
    `Seeded ${String(SEED_MERCHANTS.length)} marketplace merchant(s) with products/reviews.\n`,
  );
}

async function main(): Promise<void> {
  const permissionIds = await seedPermissions();
  const roleIds = await seedRoles();
  await seedRolePermissions(roleIds, permissionIds);
  await seedMarketplace();

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
