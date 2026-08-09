// DrippleX demo-cast seed — production-safe, additive, and fully idempotent.
//
// Seeds a fixed "demo cast" of four loginable accounts (customer, driver,
// rider, merchant) so a founder can log into a live environment and see a
// working Super App: a funded customer wallet, a driver who can go online, an
// online rider, and a merchant storefront with a real food menu.
//
// Written as plain CommonJS (not TypeScript), self-contained (fixture data is
// inlined, no .ts imports), for the same reason as prisma/seed-rbac.cjs: the
// production Docker image copies prisma/ as raw source and strips ts-node /
// typescript in `pnpm prune --prod`, so nothing here can run through ts-node.
// @prisma/client and bcrypt are production dependencies and are present.
//
// SAFETY (this may run in Railway's preDeployCommand):
//   - Self-guarded: does nothing unless DEMO_SEED_ENABLED === 'true'.
//   - Non-fatal: NEVER exits non-zero. Any error is logged and the process
//     exits 0 so a demo-seed problem can never break the backend deploy.
//   - Idempotent: every write is an upsert on a natural key (user email,
//     business registrationNumber, product merchantId+slug, wallet
//     owner+currency, ledger walletId+referenceType+referenceId, vehicle
//     plateNumber, availability by driver/rider id) or a deterministic
//     delete-then-recreate. Re-running never duplicates rows or trips a
//     unique constraint.
//   - Reuses the RBAC roles seeded by seed-rbac.cjs (customer/merchant/rider/
//     driver) — looks them up by name, never recreates them.
//
// Run via:  DEMO_SEED_ENABLED=true node prisma/seed-demo.cjs

/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS
   script run directly via `node`, not compiled TS source; see header. */

// ── Self-guard ──────────────────────────────────────────────────────────────
if (process.env.DEMO_SEED_ENABLED !== 'true') {
  console.warn('[seed-demo] DEMO_SEED_ENABLED not true; skipping');
  process.exit(0);
}

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Same default as BCRYPT_SALT_ROUNDS (env.validation.ts) used by the auth
// registration flow. The bcrypt hash format is portable across rounds, so
// login works regardless, but we mirror production intent.
const BCRYPT_SALT_ROUNDS = 12;

// Single shared password for every demo account.
const DEMO_PASSWORD = 'Dripplex#Demo1';

// Lagos, Nigeria — Victoria Island / Lekki axis.
const LAGOS = { latitude: 6.4281, longitude: 3.4219 };

const DEMO_CUSTOMER = {
  email: 'mrd@dripplex.demo',
  phone: '+2349000000101',
  firstName: 'Mr',
  lastName: 'D',
};
const DEMO_DRIVER = {
  email: 'drip@dripplex.demo',
  phone: '+2349000000102',
  firstName: 'Drip',
  lastName: 'Driver',
};
const DEMO_RIDER = {
  email: 'drippo@dripplex.demo',
  phone: '+2349000000103',
  firstName: 'Drippo',
  lastName: 'Rider',
};
const DEMO_MERCHANT = {
  email: 'dxresto@dripplex.demo',
  phone: '+2349000000104',
  firstName: 'Dx',
  lastName: 'Resto',
};

// Customer starting wallet balance, in NGN (major units).
const DEMO_CUSTOMER_WALLET_NGN = 50000;

const DEMO_BUSINESS = {
  businessName: 'Dx Resto',
  registrationNumber: 'RC-DEMO-DXRESTO-0001',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  address: '1A Adeola Odeku Street, Victoria Island',
  latitude: LAGOS.latitude,
  longitude: LAGOS.longitude,
};

const DEMO_FOOD_CATEGORY = { name: 'Food', slug: 'demo-food' };

const DEMO_PRODUCTS = [
  {
    slug: 'demo-jollof-rice',
    name: 'Jollof Rice',
    description:
      'Smoky party-style jollof rice cooked in a rich tomato and pepper base, served with fried plantain.',
    basePrice: 3500,
    sku: 'DXR-JOLLOF-001',
    isFeatured: true,
    imageUrl: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800',
    quantity: 100,
  },
  {
    slug: 'demo-fried-rice-and-chicken',
    name: 'Fried Rice & Chicken',
    description: 'Nigerian fried rice with mixed vegetables and a grilled chicken lap on the side.',
    basePrice: 4500,
    sku: 'DXR-FRIEDRICE-002',
    isFeatured: true,
    imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800',
    quantity: 100,
  },
  {
    slug: 'demo-pounded-yam-and-egusi',
    name: 'Pounded Yam & Egusi',
    description:
      'Freshly pounded yam served with a hearty egusi (melon-seed) soup rich with assorted meat.',
    basePrice: 5000,
    sku: 'DXR-EGUSI-003',
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
    quantity: 100,
  },
  {
    slug: 'demo-suya',
    name: 'Suya',
    description:
      'Spicy skewered beef suya coated in ground peanut yaji spice, served with onions and tomatoes.',
    basePrice: 3000,
    sku: 'DXR-SUYA-004',
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
    quantity: 100,
  },
  {
    slug: 'demo-chapman',
    name: 'Chapman',
    description:
      'Classic Nigerian Chapman mocktail — a refreshing blend of fizzy drinks, grenadine, and citrus.',
    basePrice: 1500,
    sku: 'DXR-CHAPMAN-005',
    isFeatured: false,
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800',
    quantity: 100,
  },
];

const now = () => new Date();

// Look up a role seeded by seed-rbac.cjs. Never creates roles here.
async function requireRoleId(name) {
  const role = await prisma.role.findUnique({ where: { name } });
  if (!role) {
    throw new Error(
      `Missing RBAC role "${name}". Run the RBAC bootstrap (node prisma/seed-rbac.cjs) first — seed-demo reuses roles, it does not create them.`,
    );
  }
  return role.id;
}

// Upsert a demo user (idempotent by email) and assign the given role. Keeps the
// password hash, verification timestamps, and status current on every re-run so
// the account always logs in with DEMO_PASSWORD.
async function upsertDemoUser(user, passwordHash, roleId) {
  const record = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      phone: user.phone,
      passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      status: 'ACTIVE',
      emailVerifiedAt: now(),
      phoneVerifiedAt: now(),
      deletedAt: null,
    },
    create: {
      email: user.email,
      phone: user.phone,
      passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      status: 'ACTIVE',
      registrationChannel: 'SEED',
      emailVerifiedAt: now(),
      phoneVerifiedAt: now(),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: record.id, roleId } },
    update: {},
    create: { userId: record.id, roleId },
  });

  return record.id;
}

// Ensure a wallet exists for an owner and, when a target balance is given, that
// a single matching ledger entry records the funding.
async function ensureWallet(ownerType, ownerId, balanceNgn) {
  const wallet = await prisma.wallet.upsert({
    where: { ownerType_ownerId_currency: { ownerType, ownerId, currency: 'NGN' } },
    update: { availableBalance: balanceNgn },
    create: { ownerType, ownerId, currency: 'NGN', availableBalance: balanceNgn },
  });

  if (balanceNgn > 0) {
    // Deterministic natural key: the wallet's own id as referenceId under a
    // fixed referenceType, so re-runs update rather than duplicate.
    await prisma.walletLedgerEntry.upsert({
      where: {
        walletId_referenceType_referenceId: {
          walletId: wallet.id,
          referenceType: 'DEMO_SEED_FUNDING',
          referenceId: wallet.id,
        },
      },
      update: { amount: balanceNgn, balanceAfter: balanceNgn },
      create: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount: balanceNgn,
        direction: 'CREDIT',
        balanceAfter: balanceNgn,
        referenceType: 'DEMO_SEED_FUNDING',
        referenceId: wallet.id,
        description: 'Demo wallet funding',
      },
    });
  }
}

async function seedCustomer(passwordHash) {
  const roleId = await requireRoleId('customer');
  const userId = await upsertDemoUser(DEMO_CUSTOMER, passwordHash, roleId);

  await prisma.customerProfile.upsert({
    where: { userId },
    update: { deletedAt: null },
    create: { userId },
  });

  await ensureWallet('CUSTOMER', userId, DEMO_CUSTOMER_WALLET_NGN);
}

async function seedDriver(passwordHash) {
  const roleId = await requireRoleId('driver');
  const userId = await upsertDemoUser(DEMO_DRIVER, passwordHash, roleId);

  // Fully-cleared driver: approved + identity-verified + agreement-accepted so
  // no verification gate blocks going online.
  await prisma.driverProfile.upsert({
    where: { userId },
    update: {
      status: 'APPROVED',
      isApproved: true,
      approvedAt: now(),
      lastIdentityVerifiedAt: now(),
      identityVerificationRequiredReason: null,
      failedVerificationAttempts: 0,
      identityVerificationLockedAt: null,
      agreementAcceptedAt: now(),
      agreementVersion: 'demo-v1',
      deletedAt: null,
    },
    create: {
      userId,
      status: 'APPROVED',
      isApproved: true,
      approvedAt: now(),
      lastIdentityVerifiedAt: now(),
      agreementAcceptedAt: now(),
      agreementVersion: 'demo-v1',
    },
  });

  // Verified/approved vehicle (unique by plateNumber).
  await prisma.vehicle.upsert({
    where: { plateNumber: 'LAG-DEMO-01' },
    update: {
      driverId: userId,
      make: 'Toyota',
      model: 'Corolla',
      color: 'Silver',
      year: 2020,
      rideCategory: 'ECONOMY',
      seats: 4,
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedAt: now(),
    },
    create: {
      driverId: userId,
      plateNumber: 'LAG-DEMO-01',
      make: 'Toyota',
      model: 'Corolla',
      color: 'Silver',
      year: 2020,
      rideCategory: 'ECONOMY',
      seats: 4,
      isActive: true,
      approvalStatus: 'APPROVED',
      approvedAt: now(),
    },
  });

  // DriverKyc has no natural unique key — clear the demo doc and recreate so a
  // re-run stays at exactly one VERIFIED record.
  await prisma.driverKyc.deleteMany({ where: { driverId: userId } });
  await prisma.driverKyc.create({
    data: {
      driverId: userId,
      documentType: 'DRIVER_LICENSE',
      documentNumber: 'DEMO-DL-0001',
      frontImage: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800',
      verificationStatus: 'VERIFIED',
      reviewedAt: now(),
    },
  });

  await prisma.driverAvailability.upsert({
    where: { driverId: userId },
    update: {
      online: true,
      acceptingRides: true,
      vehicleType: 'ECONOMY',
      latitude: DEMO_BUSINESS.latitude,
      longitude: DEMO_BUSINESS.longitude,
    },
    create: {
      driverId: userId,
      online: true,
      acceptingRides: true,
      vehicleType: 'ECONOMY',
      latitude: DEMO_BUSINESS.latitude,
      longitude: DEMO_BUSINESS.longitude,
    },
  });

  await ensureWallet('DRIVER', userId, 0);
}

async function seedRider(passwordHash) {
  const roleId = await requireRoleId('rider');
  const userId = await upsertDemoUser(DEMO_RIDER, passwordHash, roleId);

  await prisma.riderProfile.upsert({
    where: { userId },
    update: { isApproved: true, approvedAt: now(), deletedAt: null },
    create: { userId, isApproved: true, approvedAt: now() },
  });

  await prisma.riderAvailability.upsert({
    where: { riderId: userId },
    update: {
      online: true,
      acceptingOrders: true,
      latitude: DEMO_BUSINESS.latitude,
      longitude: DEMO_BUSINESS.longitude,
    },
    create: {
      riderId: userId,
      online: true,
      acceptingOrders: true,
      latitude: DEMO_BUSINESS.latitude,
      longitude: DEMO_BUSINESS.longitude,
    },
  });

  await ensureWallet('RIDER', userId, 0);
}

async function seedMerchant(passwordHash) {
  const roleId = await requireRoleId('merchant');
  const userId = await upsertDemoUser(DEMO_MERCHANT, passwordHash, roleId);

  const merchantProfile = await prisma.merchantProfile.upsert({
    where: { userId },
    update: { status: 'APPROVED', isApproved: true, approvedAt: now(), deletedAt: null },
    create: { userId, status: 'APPROVED', isApproved: true, approvedAt: now() },
  });

  await prisma.business.upsert({
    where: { registrationNumber: DEMO_BUSINESS.registrationNumber },
    update: {
      merchantId: userId,
      businessName: DEMO_BUSINESS.businessName,
      businessType: 'SOLE_PROPRIETORSHIP',
      email: DEMO_MERCHANT.email,
      phone: DEMO_MERCHANT.phone,
      country: DEMO_BUSINESS.country,
      state: DEMO_BUSINESS.state,
      city: DEMO_BUSINESS.city,
      address: DEMO_BUSINESS.address,
      latitude: DEMO_BUSINESS.latitude,
      longitude: DEMO_BUSINESS.longitude,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      approvedAt: now(),
    },
    create: {
      merchantId: userId,
      businessName: DEMO_BUSINESS.businessName,
      businessType: 'SOLE_PROPRIETORSHIP',
      registrationNumber: DEMO_BUSINESS.registrationNumber,
      email: DEMO_MERCHANT.email,
      phone: DEMO_MERCHANT.phone,
      country: DEMO_BUSINESS.country,
      state: DEMO_BUSINESS.state,
      city: DEMO_BUSINESS.city,
      address: DEMO_BUSINESS.address,
      latitude: DEMO_BUSINESS.latitude,
      longitude: DEMO_BUSINESS.longitude,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      approvedAt: now(),
    },
  });

  const category = await prisma.category.upsert({
    where: { slug: DEMO_FOOD_CATEGORY.slug },
    update: { name: DEMO_FOOD_CATEGORY.name, isActive: true },
    create: { name: DEMO_FOOD_CATEGORY.name, slug: DEMO_FOOD_CATEGORY.slug },
  });

  for (const seedProduct of DEMO_PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { merchantId_slug: { merchantId: merchantProfile.id, slug: seedProduct.slug } },
      update: {
        categoryId: category.id,
        name: seedProduct.name,
        description: seedProduct.description,
        basePrice: seedProduct.basePrice,
        currency: 'NGN',
        sku: seedProduct.sku,
        status: 'PUBLISHED',
        isFeatured: seedProduct.isFeatured,
        isDeleted: false,
        publishedAt: now(),
      },
      create: {
        merchantId: merchantProfile.id,
        categoryId: category.id,
        name: seedProduct.name,
        slug: seedProduct.slug,
        description: seedProduct.description,
        basePrice: seedProduct.basePrice,
        currency: 'NGN',
        sku: seedProduct.sku,
        status: 'PUBLISHED',
        isFeatured: seedProduct.isFeatured,
        publishedAt: now(),
      },
    });

    // No compound-unique key on images — re-derive deterministically each run.
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: seedProduct.imageUrl,
        position: 0,
        altText: seedProduct.name,
      },
    });

    await prisma.productInventory.upsert({
      where: { productId: product.id },
      update: { quantity: seedProduct.quantity, trackInventory: true },
      create: { productId: product.id, quantity: seedProduct.quantity, trackInventory: true },
    });
  }

  await ensureWallet('MERCHANT', userId, 0);
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

  await seedCustomer(passwordHash);
  await seedDriver(passwordHash);
  await seedRider(passwordHash);
  await seedMerchant(passwordHash);

  process.stdout.write(
    `[seed-demo] Seeded demo cast: customer ${DEMO_CUSTOMER.email}, driver ${DEMO_DRIVER.email}, ` +
      `rider ${DEMO_RIDER.email}, merchant ${DEMO_MERCHANT.email} ` +
      `(${String(DEMO_PRODUCTS.length)} products). Shared password set.\n`,
  );
}

async function run() {
  try {
    await main();
  } catch (error) {
    // NON-FATAL: never break a deploy that chains this in preDeployCommand.
    console.error('[seed-demo] failed (non-fatal, continuing):', error);
  } finally {
    await prisma.$disconnect();
  }
  // Always succeed: a demo-seed problem must never fail the backend deploy.
  process.exit(0);
}

run();
