// Production RBAC bootstrap — idempotent (upsert-only), safe to run on every
// deploy. Separate from prisma/seed.ts's `main()` on purpose: seed.ts also
// seeds marketplace fixture data (fake merchants/products/reviews), which
// must never touch a real production database. This script seeds ONLY
// Permission, Role, and RolePermission rows — the RBAC bootstrap every
// portal's registration flow depends on (PrismaRegistrationRepository looks
// up `Role.findFirst({ where: { name: roleName } })` and throws "Role X is
// not configured" if it's missing).
//
// Written as plain CommonJS (not TypeScript) because apps/backend/prisma/ is
// copied into the production Docker image as raw source (see Dockerfile),
// but ts-node/typescript are devDependencies stripped by `pnpm prune --prod`
// in the build stage — so nothing in prisma/ can be run through ts-node in
// production. @prisma/client is a production dependency and is present.
//
// This script also runs `prisma migrate deploy` itself (via child_process)
// before seeding, rather than relying on Railway's preDeployCommand to chain
// two commands with `&&`. Railway spawns preDeployCommand directly (not
// through a shell) — `&&` isn't interpreted as a shell operator, it's passed
// as a literal extra argument, which Prisma's CLI silently ignores. The
// practical effect: "prisma migrate deploy && node prisma/seed-rbac.cjs" ran
// only the migrate step and exited 0, so the seed half never executed. See
// the incident writeup in docs/ops/DPX-LAUNCH-004-PRODUCTION-VERIFICATION.md.
//
// Run via the backend service's preDeployCommand, as the ONLY command:
// node prisma/seed-rbac.cjs
//
// Keep this file's data in sync with prisma/seed-data/{permissions,roles,
// role-permissions}.ts by hand — there is currently no shared build step
// between the two (the dev seed runs via ts-node against source; this one
// runs pre-compiled in production). If you add a permission/role/grant,
// update both places.

/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS
   script run directly via `node`, not compiled TS source; see header. */
const { execFileSync } = require('child_process');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PERMISSION_SEEDS = [
  { code: 'profile:read', description: 'Read own profile' },
  { code: 'profile:write', description: 'Update own profile' },
  { code: 'auth:sessions:read', description: 'List own auth sessions' },
  { code: 'auth:sessions:revoke', description: 'Revoke own auth sessions' },
  { code: 'customer:addresses:manage', description: 'Manage customer addresses' },
  { code: 'admin:addresses:read', description: 'Read customer addresses (admin)' },
  { code: 'customer:cart:manage', description: 'Manage own shopping cart' },
  { code: 'customer:ride:manage', description: 'Request, view, and cancel own rides' },
  { code: 'driver:ride:manage', description: 'View and respond to own ride offers' },
  { code: 'admin:cart:read', description: 'Read shopping carts (admin)' },
  { code: 'customer:checkout', description: 'Create orders from shopping cart' },
  { code: 'customer:orders', description: 'View and cancel own orders' },
  { code: 'admin:orders:read', description: 'Read orders (admin)' },
  { code: 'admin:orders:manage', description: 'Manage and refund orders (admin)' },
  { code: 'merchant:orders:manage', description: 'Accept, prepare, and fulfill own orders' },
  { code: 'customer:delivery:read', description: 'Read own delivery jobs and tracking' },
  { code: 'rider:delivery:manage', description: 'Manage assigned delivery jobs' },
  { code: 'admin:delivery:manage', description: 'Manage delivery jobs (admin)' },
  { code: 'customer:loyalty:read', description: 'Read own loyalty account' },
  { code: 'customer:loyalty:redeem', description: 'Redeem own loyalty points' },
  { code: 'admin:loyalty:manage', description: 'Manage loyalty accounts and achievements' },
  { code: 'customer:wallet:read', description: 'Read own wallet' },
  { code: 'customer:wallet:transfer', description: 'Transfer funds from own wallet' },
  { code: 'customer:wallet:fund', description: 'Top up own wallet via a payment gateway' },
  {
    code: 'customer:wallet:withdraw',
    description: 'Withdraw funds from own wallet to a bank account',
  },
  { code: 'merchant:wallet:read', description: 'Read merchant wallet' },
  { code: 'rider:wallet:read', description: 'Read rider wallet' },
  { code: 'driver:wallet:read', description: 'Read driver wallet' },
  { code: 'admin:wallet:manage', description: 'Manage wallets and reconciliation' },
  {
    code: 'admin:wallet:withdrawals:manage',
    description: 'Review and complete/fail customer withdrawal requests',
  },
  { code: 'merchant:analytics:read', description: 'Read merchant analytics dashboards' },
  { code: 'admin:analytics:read', description: 'Read platform analytics dashboards' },
  { code: 'customer:notifications:read', description: 'Read own notifications' },
  { code: 'customer:notifications:manage', description: 'Manage own notification preferences' },
  { code: 'admin:notifications:manage', description: 'Manage notification templates and delivery' },
  { code: 'customer:search:use', description: 'Use customer search' },
  { code: 'admin:search:manage', description: 'Manage search documents and ranking' },
  { code: 'customer:reviews:manage', description: 'Create and manage own reviews' },
  { code: 'merchant:reviews:reply', description: 'Reply to merchant reviews' },
  { code: 'admin:reviews:moderate', description: 'Moderate customer reviews' },
  { code: 'customer:wishlist:manage', description: 'Manage own wishlists' },
  { code: 'customer:promotions:use', description: 'Use platform promotions' },
  { code: 'admin:promotions:manage', description: 'Manage platform promotions' },
  { code: 'customer:referrals:use', description: 'Read own referral code and stats' },
  { code: 'admin:referrals:manage', description: 'View referral redemptions (admin)' },
  {
    code: 'driver:referral_campaign:use',
    description: 'Use the driver growth referral campaign',
  },
  {
    code: 'admin:referral_campaigns:manage',
    description: 'Manage driver growth referral campaigns',
  },
  { code: 'admin:cms:manage', description: 'Manage CMS content' },
  { code: 'customer:cms:read', description: 'Read published CMS content' },
  { code: 'customer:kyc:manage', description: 'Manage own customer identity verification (KYC)' },
  {
    code: 'admin:customer-kyc:review',
    description: 'Review customer identity verification submissions',
  },
  { code: 'admin:fraud:manage', description: 'Manage fraud signals and lists' },
  { code: 'support:fraud:review', description: 'Review fraud signals' },
  { code: 'admin:fraud:configure', description: 'Configure fraud thresholds' },
  { code: 'merchant:onboarding:submit', description: 'Submit merchant onboarding' },
  { code: 'merchant:onboarding:approve', description: 'Approve merchant onboarding' },
  { code: 'merchant:products:manage', description: 'Manage own merchant product catalog' },
  { code: 'merchant:business:manage', description: 'Manage own merchant business profile' },
  { code: 'merchant:kyc:manage', description: 'Manage own merchant KYC documents' },
  { code: 'merchant:bank:manage', description: 'Manage own merchant bank accounts' },
  { code: 'admin:merchants:review', description: 'Review merchant onboarding applications' },
  { code: 'admin:merchants:approve', description: 'Approve merchants' },
  { code: 'admin:merchants:reject', description: 'Reject merchants' },
  { code: 'admin:merchants:suspend', description: 'Suspend merchants' },
  { code: 'admin:merchants:reactivate', description: 'Reactivate suspended merchants' },
  { code: 'rider:onboarding:submit', description: 'Submit rider onboarding' },
  { code: 'rider:onboarding:approve', description: 'Approve rider onboarding' },
  { code: 'driver:onboarding:submit', description: 'Submit driver onboarding' },
  { code: 'driver:onboarding:approve', description: 'Approve driver onboarding' },
  { code: 'driver:kyc:manage', description: 'Manage own driver KYC documents' },
  {
    code: 'driver:identity-verification:manage',
    description: 'Submit own facial/identity verification',
  },
  { code: 'admin:drivers:review', description: 'Review driver applications' },
  { code: 'admin:drivers:approve', description: 'Approve drivers' },
  { code: 'admin:drivers:reject', description: 'Reject drivers' },
  { code: 'admin:drivers:suspend', description: 'Suspend drivers' },
  { code: 'admin:drivers:reactivate', description: 'Reactivate suspended drivers' },
  // DPX-RIDER-001 — delivery-rider approval desk (mirrors admin:drivers:*).
  { code: 'admin:riders:review', description: 'Review rider applications' },
  { code: 'admin:riders:approve', description: 'Approve riders' },
  { code: 'admin:riders:reject', description: 'Reject riders' },
  { code: 'admin:riders:suspend', description: 'Suspend riders' },
  { code: 'admin:riders:reactivate', description: 'Reactivate suspended riders' },
  {
    code: 'admin:drivers:identity-verification:manage',
    description: 'Manually require or unlock a driver identity verification',
  },
  {
    code: 'admin:drivers:security-settings:manage',
    description: 'View and edit the Driver-001 Security Standard risk-engine settings',
  },
  {
    code: 'admin:merchant-settlement:commission:manage',
    description: 'View and edit the DPX-MERCHANT-002 Marketplace merchant commission rate',
  },
  {
    code: 'admin:commercial:credit-settings:manage',
    description: 'View and edit the DPX-COMMERCIAL-001 commission credit-limit policy',
  },
  {
    code: 'admin:commercial:commission-settings:manage',
    description: 'View and edit the Ops-configurable platform (ride) commission rate',
  },
  {
    code: 'admin:commercial:account:manage',
    description: 'View a commission account/ledger and record manual external payments against it',
  },
  { code: 'merchant:commercial:read', description: 'Read own commission account and ledger' },
  { code: 'driver:commercial:read', description: 'Read own commission account and ledger' },
  { code: 'driver:vehicle:manage', description: 'Manage own registered vehicles' },
  {
    code: 'admin:drivers:vehicles:manage',
    description: 'Approve or reject driver-submitted vehicles',
  },
  {
    code: 'driver:inspection:manage',
    description: 'Book and view own vehicle/driver inspection appointments',
  },
  {
    code: 'admin:inspection-centres:manage',
    description: 'Create and manage DrippleX inspection centres',
  },
  {
    code: 'inspection:checklist:manage',
    description: 'Record an inspection checklist, photos, and defects (Inspection Officer)',
  },
  {
    code: 'inspection:approve',
    description:
      'Approve/reject inspections, schedule re-inspections, view full inspection history (Inspection Supervisor)',
  },
  {
    code: 'driver:support-ticket:manage',
    description: 'Submit and view own driver support tickets',
  },
  {
    code: 'admin:drivers:support-ticket:manage',
    description: 'View and resolve the driver support ticket queue',
  },
  {
    code: 'driver:incident-report:manage',
    description: 'Submit and view own driver incident reports',
  },
  {
    code: 'admin:drivers:incident-report:manage',
    description: 'View and acknowledge/resolve the driver incident report queue',
  },
  { code: 'driver:sos-alert:manage', description: 'Trigger and view own SOS/emergency alerts' },
  {
    code: 'admin:drivers:sos-alert:manage',
    description: 'View and acknowledge/resolve the driver SOS/emergency alert queue',
  },
  {
    code: 'driver:shift:manage',
    description: 'Start/end own shifts, manage own break mode and planned availability',
  },
  {
    code: 'admin:drivers:shifts:manage',
    description: 'View driver shift/planned-availability queues and force-end abandoned shifts',
  },
  {
    code: 'driver:help:read',
    description: 'Browse the driver Help Centre (FAQ/articles) — authoring uses admin:cms:manage',
  },
  {
    code: 'driver:profile:manage',
    description:
      'Update own profile (name, photo, languages, service areas, driving experience) and view own performance stats',
  },
  { code: 'admin:rides:support', description: 'Review and resolve ride problem reports' },
  {
    code: 'operations:live:read',
    description:
      'View the Operations Console Live Operations Dashboard — fleet snapshot and live ride queue',
  },
  {
    code: 'operations:queues:read',
    description:
      'View the Operations Console work queues (SOS, Incidents, Support) and dashboard counters/activity feed',
  },
  {
    code: 'operations:queues:manage',
    description:
      'Assign, prioritize, change status, and add notes on Operations Console work-queue cases',
  },
  {
    code: 'operations:analytics:read',
    description:
      'View the Operations Console analytics dashboard — driver utilization, shift, ride, dispatch, response-time, and geographic-demand analytics',
  },
  { code: 'users:read', description: 'Read user records' },
  { code: 'users:write', description: 'Update user records' },
  { code: 'users:delete', description: 'Soft-delete user records' },
  { code: 'users:roles:assign', description: 'Assign or remove user roles' },
  { code: 'roles:read', description: 'Read roles' },
  { code: 'roles:write', description: 'Create and update roles' },
  { code: 'permissions:read', description: 'Read permissions catalog' },
  { code: 'audit:read', description: 'Read audit logs' },
  { code: 'platform:settings:write', description: 'Update platform settings' },
];

const ROLE_SEEDS = [
  { name: 'customer', description: 'Marketplace consumer with access to customer-web' },
  { name: 'merchant', description: 'Store owner or operator with access to merchant-portal' },
  { name: 'rider', description: 'Parcel and food delivery courier with access to rider-portal' },
  { name: 'driver', description: 'Ride-hailing driver with access to driver-portal' },
  { name: 'operations_staff', description: 'Internal operations console user' },
  { name: 'administrator', description: 'Platform administrator' },
  {
    name: 'super_administrator',
    description: 'Full platform control including role and settings management',
  },
  {
    name: 'inspection_officer',
    description:
      'DPX-DRIVER-002 — records driver/vehicle inspection checklists in operations-console',
  },
  {
    name: 'inspection_supervisor',
    description:
      'DPX-DRIVER-002 — approves/rejects inspections and manages inspection centres in operations-console',
  },
];

const ROLE_PERMISSION_GRANTS = {
  customer: [
    'customer:kyc:manage',
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'customer:addresses:manage',
    'customer:cart:manage',
    'customer:checkout',
    'customer:orders',
    'customer:delivery:read',
    'customer:ride:manage',
    'customer:loyalty:read',
    'customer:loyalty:redeem',
    'customer:wallet:read',
    'customer:wallet:transfer',
    'customer:wallet:fund',
    'customer:wallet:withdraw',
    'customer:notifications:read',
    'customer:notifications:manage',
    'customer:search:use',
    'customer:reviews:manage',
    'customer:wishlist:manage',
    'customer:promotions:use',
    'customer:referrals:use',
    'customer:cms:read',
  ],
  merchant: [
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'merchant:onboarding:submit',
    'merchant:products:manage',
    'merchant:business:manage',
    'merchant:kyc:manage',
    'merchant:bank:manage',
    'merchant:wallet:read',
    'merchant:commercial:read',
    'merchant:analytics:read',
    'merchant:reviews:reply',
    'merchant:orders:manage',
    'customer:notifications:read',
    'customer:notifications:manage',
  ],
  rider: [
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'rider:onboarding:submit',
    'rider:delivery:manage',
    'rider:wallet:read',
    'customer:notifications:read',
    'customer:notifications:manage',
  ],
  driver: [
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'driver:onboarding:submit',
    'driver:kyc:manage',
    'driver:identity-verification:manage',
    'driver:vehicle:manage',
    'driver:inspection:manage',
    'driver:ride:manage',
    'driver:support-ticket:manage',
    'driver:incident-report:manage',
    'driver:sos-alert:manage',
    'driver:shift:manage',
    'driver:help:read',
    'driver:profile:manage',
    'driver:wallet:read',
    'driver:commercial:read',
    'driver:referral_campaign:use',
    'customer:notifications:read',
    'customer:notifications:manage',
  ],
  operations_staff: [
    'admin:customer-kyc:review',
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'merchant:onboarding:approve',
    'admin:merchants:review',
    'admin:merchants:approve',
    'admin:merchants:reject',
    'admin:merchants:suspend',
    'admin:merchants:reactivate',
    'admin:addresses:read',
    'admin:cart:read',
    'admin:orders:read',
    'admin:orders:manage',
    'admin:delivery:manage',
    'admin:loyalty:manage',
    'admin:wallet:manage',
    'admin:wallet:withdrawals:manage',
    'admin:analytics:read',
    'admin:notifications:manage',
    'admin:search:manage',
    'admin:reviews:moderate',
    'admin:promotions:manage',
    'admin:referrals:manage',
    'admin:referral_campaigns:manage',
    'support:fraud:review',
    'rider:onboarding:approve',
    'driver:onboarding:approve',
    'admin:drivers:review',
    'admin:drivers:approve',
    'admin:drivers:reject',
    'admin:drivers:suspend',
    'admin:drivers:reactivate',
    'admin:riders:review',
    'admin:riders:approve',
    'admin:riders:reject',
    'admin:riders:suspend',
    'admin:riders:reactivate',
    'admin:drivers:identity-verification:manage',
    'admin:drivers:vehicles:manage',
    'admin:drivers:support-ticket:manage',
    'admin:drivers:incident-report:manage',
    'admin:drivers:sos-alert:manage',
    'admin:drivers:shifts:manage',
    'admin:inspection-centres:manage',
    'inspection:checklist:manage',
    'inspection:approve',
    'admin:rides:support',
    'operations:live:read',
    'operations:queues:read',
    'operations:queues:manage',
    'operations:analytics:read',
    'users:read',
    'audit:read',
  ],
  administrator: [
    'admin:customer-kyc:review',
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'merchant:onboarding:approve',
    'admin:merchants:review',
    'admin:merchants:approve',
    'admin:merchants:reject',
    'admin:merchants:suspend',
    'admin:merchants:reactivate',
    'admin:addresses:read',
    'admin:cart:read',
    'admin:orders:read',
    'admin:orders:manage',
    'admin:delivery:manage',
    'admin:loyalty:manage',
    'admin:wallet:manage',
    'admin:wallet:withdrawals:manage',
    'admin:analytics:read',
    'admin:notifications:manage',
    'admin:search:manage',
    'admin:reviews:moderate',
    'admin:promotions:manage',
    'admin:referrals:manage',
    'admin:referral_campaigns:manage',
    'admin:cms:manage',
    'support:fraud:review',
    'admin:fraud:manage',
    'admin:fraud:configure',
    'rider:onboarding:approve',
    'driver:onboarding:approve',
    'admin:drivers:review',
    'admin:drivers:approve',
    'admin:drivers:reject',
    'admin:drivers:suspend',
    'admin:drivers:reactivate',
    'admin:riders:review',
    'admin:riders:approve',
    'admin:riders:reject',
    'admin:riders:suspend',
    'admin:riders:reactivate',
    'admin:drivers:identity-verification:manage',
    'admin:drivers:security-settings:manage',
    'admin:merchant-settlement:commission:manage',
    'admin:commercial:credit-settings:manage',
    'admin:commercial:commission-settings:manage',
    'admin:commercial:account:manage',
    'admin:drivers:vehicles:manage',
    'admin:drivers:support-ticket:manage',
    'admin:drivers:incident-report:manage',
    'admin:drivers:sos-alert:manage',
    'admin:drivers:shifts:manage',
    'admin:inspection-centres:manage',
    'inspection:checklist:manage',
    'inspection:approve',
    'admin:rides:support',
    'operations:live:read',
    'operations:queues:read',
    'operations:queues:manage',
    'operations:analytics:read',
    'users:read',
    'users:write',
    'users:delete',
    'users:roles:assign',
    'roles:read',
    'permissions:read',
    'audit:read',
  ],
  super_administrator: [
    'admin:customer-kyc:review',
    'profile:read',
    'profile:write',
    'auth:sessions:read',
    'auth:sessions:revoke',
    'customer:addresses:manage',
    'admin:addresses:read',
    'customer:cart:manage',
    'admin:cart:read',
    'customer:checkout',
    'customer:orders',
    'admin:orders:read',
    'admin:orders:manage',
    'customer:delivery:read',
    'customer:ride:manage',
    'driver:ride:manage',
    'rider:delivery:manage',
    'admin:delivery:manage',
    'customer:loyalty:read',
    'customer:loyalty:redeem',
    'admin:loyalty:manage',
    'customer:wallet:read',
    'customer:wallet:transfer',
    'customer:wallet:fund',
    'customer:wallet:withdraw',
    'merchant:wallet:read',
    'rider:wallet:read',
    'driver:wallet:read',
    'merchant:commercial:read',
    'driver:commercial:read',
    'admin:wallet:manage',
    'admin:wallet:withdrawals:manage',
    'merchant:analytics:read',
    'admin:analytics:read',
    'customer:notifications:read',
    'customer:notifications:manage',
    'admin:notifications:manage',
    'customer:search:use',
    'admin:search:manage',
    'customer:reviews:manage',
    'merchant:reviews:reply',
    'admin:reviews:moderate',
    'customer:wishlist:manage',
    'customer:promotions:use',
    'admin:promotions:manage',
    'customer:referrals:use',
    'admin:referrals:manage',
    'driver:referral_campaign:use',
    'admin:referral_campaigns:manage',
    'admin:cms:manage',
    'customer:cms:read',
    'admin:fraud:manage',
    'support:fraud:review',
    'admin:fraud:configure',
    'merchant:onboarding:submit',
    'merchant:onboarding:approve',
    'merchant:products:manage',
    'merchant:business:manage',
    'merchant:kyc:manage',
    'merchant:bank:manage',
    'admin:merchants:review',
    'admin:merchants:approve',
    'admin:merchants:reject',
    'admin:merchants:suspend',
    'admin:merchants:reactivate',
    'rider:onboarding:submit',
    'rider:onboarding:approve',
    'driver:onboarding:submit',
    'driver:onboarding:approve',
    'driver:kyc:manage',
    'driver:identity-verification:manage',
    'admin:drivers:review',
    'admin:drivers:approve',
    'admin:drivers:reject',
    'admin:drivers:suspend',
    'admin:drivers:reactivate',
    'admin:riders:review',
    'admin:riders:approve',
    'admin:riders:reject',
    'admin:riders:suspend',
    'admin:riders:reactivate',
    'admin:drivers:identity-verification:manage',
    'admin:drivers:security-settings:manage',
    'admin:merchant-settlement:commission:manage',
    'admin:commercial:credit-settings:manage',
    'admin:commercial:commission-settings:manage',
    'admin:commercial:account:manage',
    'admin:drivers:vehicles:manage',
    'admin:drivers:support-ticket:manage',
    'admin:drivers:incident-report:manage',
    'admin:drivers:sos-alert:manage',
    'admin:drivers:shifts:manage',
    'admin:inspection-centres:manage',
    'inspection:checklist:manage',
    'inspection:approve',
    'admin:rides:support',
    'operations:live:read',
    'operations:queues:read',
    'operations:queues:manage',
    'operations:analytics:read',
    'users:read',
    'users:write',
    'users:delete',
    'users:roles:assign',
    'roles:read',
    'roles:write',
    'permissions:read',
    'audit:read',
    'platform:settings:write',
  ],
  inspection_officer: ['profile:read', 'profile:write', 'inspection:checklist:manage'],
  inspection_supervisor: [
    'profile:read',
    'profile:write',
    'inspection:checklist:manage',
    'inspection:approve',
    'admin:inspection-centres:manage',
  ],
};

async function seedPermissions() {
  const permissionIds = new Map();
  for (const permission of PERMISSION_SEEDS) {
    const record = await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description, deletedAt: null },
      create: { code: permission.code, description: permission.description },
    });
    permissionIds.set(record.code, record.id);
  }
  return permissionIds;
}

async function seedRoles() {
  const roleIds = new Map();
  for (const role of ROLE_SEEDS) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: true, deletedAt: null },
      create: { name: role.name, description: role.description, isSystem: true },
    });
    roleIds.set(record.name, record.id);
  }
  return roleIds;
}

async function seedRolePermissions(roleIds, permissionIds) {
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
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
}

function runMigrations() {
  execFileSync('node_modules/.bin/prisma', ['migrate', 'deploy'], { stdio: 'inherit' });
}

async function main() {
  runMigrations();
  const permissionIds = await seedPermissions();
  const roleIds = await seedRoles();
  await seedRolePermissions(roleIds, permissionIds);
  process.stdout.write(
    `RBAC bootstrap: seeded ${String(permissionIds.size)} permissions, ${String(roleIds.size)} roles, and role-permission grants.\n`,
  );
}

main()
  .catch((error) => {
    console.error('RBAC bootstrap failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
