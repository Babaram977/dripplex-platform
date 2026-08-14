// Commercial campaign bootstrap — idempotent (matched by name), safe to re-run.
//
// Creates the two founder-approved launch campaigns in DRAFT so nothing spends
// money until they are explicitly activated in the Ops Console (Promotions →
// Resume/Activate). Activating is a deliberate, audited action — this script
// never sets ACTIVE.
//
// Founder decisions encoded here (do not change without a new founder decision):
//   Free First Ride     100% off ONE ride per customer, DrippleX pays up to
//                       ₦1,500 of the fare; the rider pays any excess. The
//                       driver is always paid in full — platform-funded.
//   40% Off Marketplace 40% off a marketplace order, platform-funded (merchants
//                       are paid in full), capped at ₦2,000 saved per order.
//
// Both are deliberately CODELESS (code: null). The promotions engine only
// matches a promotion that HAS a code when the customer types that exact code
// (see findActivePromotions: `couponCode === null ? [{ code: null }] : ...`).
// These are advertised, automatic campaigns — a rider must not have to know a
// secret word to get their free first ride — so they carry no code and are
// identified here by name.
//
// Guardrails on both: maxDiscount caps the per-redemption cost, usageLimit caps
// the TOTAL number of redemptions (i.e. the campaign budget), and perUserLimit
// stops one customer draining the campaign. Budget math:
//   Free First Ride:     1,000 × ₦1,500 = ₦1,500,000 maximum total exposure
//   40% Off Marketplace: 1,000 × ₦2,000 = ₦2,000,000 maximum total exposure
//
// Written as plain CommonJS for the same reason as seed-rbac.cjs: prisma/ is
// copied into the production image as raw source and ts-node is stripped.
//
// Run:  node prisma/seed-promotions.cjs

/* eslint-disable @typescript-eslint/no-require-imports, no-console -- plain
   CommonJS bootstrap run directly via `node` (not compiled TS), and its console
   output is the deploy-log record of what each campaign was set to. */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CAMPAIGNS = [
  {
    name: 'Free First Ride',
    type: 'PERCENTAGE',
    domains: ['RIDE'],
    percentOff: 100,
    // DrippleX covers up to ₦1,500 of the fare; the rider pays any excess.
    maxDiscount: 1500,
    // "First" ride: one redemption per customer, ever.
    perUserLimit: 1,
    perDeviceLimit: 1,
    // Campaign budget: stop automatically after 1,000 free rides.
    usageLimit: 1000,
    priority: 100,
    stackable: false,
  },
  {
    name: '40% Off Marketplace',
    type: 'PERCENTAGE',
    domains: ['MARKETPLACE'],
    percentOff: 40,
    // Caps the platform's cost per order at ₦2,000 saved.
    maxDiscount: 2000,
    // Not a first-order-only offer, but one customer cannot drain the budget.
    perUserLimit: 3,
    usageLimit: 1000,
    priority: 50,
    stackable: false,
  },
];

async function main() {
  for (const c of CAMPAIGNS) {
    const existing = await prisma.promotion.findFirst({
      where: { name: c.name, deletedAt: null },
    });

    if (existing) {
      // Never silently re-arm or re-budget a campaign that is already live or
      // already spent — an operator may have paused/expired it deliberately, and
      // resetting usageCount would let it overspend its approved budget.
      if (existing.status !== 'DRAFT') {
        console.log(
          `• ${c.name}: exists with status ${existing.status} — left untouched ` +
            `(${existing.usageCount} redemption(s) so far).`,
        );
        continue;
      }
      await prisma.promotion.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          type: c.type,
          domains: c.domains,
          percentOff: c.percentOff,
          maxDiscount: c.maxDiscount,
          perUserLimit: c.perUserLimit,
          perDeviceLimit: c.perDeviceLimit ?? null,
          usageLimit: c.usageLimit,
          priority: c.priority,
          stackable: c.stackable,
        },
      });
      console.log(`• ${c.name}: DRAFT refreshed.`);
      continue;
    }

    await prisma.promotion.create({
      data: {
        // Codeless → applies automatically, no coupon to type.
        code: null,
        name: c.name,
        type: c.type,
        // DRAFT: inert until a human activates it in the Ops Console.
        status: 'DRAFT',
        domains: c.domains,
        percentOff: c.percentOff,
        maxDiscount: c.maxDiscount,
        perUserLimit: c.perUserLimit,
        perDeviceLimit: c.perDeviceLimit ?? null,
        usageLimit: c.usageLimit,
        priority: c.priority,
        stackable: c.stackable,
      },
    });
    console.log(`• ${c.name}: created as DRAFT.`);
  }

  const summary = await prisma.promotion.findMany({
    where: { name: { in: CAMPAIGNS.map((c) => c.name) }, deletedAt: null },
    select: {
      name: true,
      status: true,
      percentOff: true,
      maxDiscount: true,
      perUserLimit: true,
      usageLimit: true,
      usageCount: true,
    },
  });
  console.log('\nCampaigns:');
  for (const p of summary) {
    console.log(
      `  ${p.name.padEnd(22)} ${p.status.padEnd(8)} ${String(p.percentOff)}% ` +
        `cap ₦${String(p.maxDiscount)}  per-user ${String(p.perUserLimit)}  ` +
        `used ${String(p.usageCount)}/${String(p.usageLimit)}`,
    );
  }
  console.log('\nBoth are DRAFT — activate in Ops Console → Promotions when ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
