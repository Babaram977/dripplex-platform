// One-off backfill: pay riders for deliveries that were completed BEFORE
// rider settlement existed (DPX-RIDER-006).
//
// Until that change, `deliver()` marked a job DELIVERED and emitted
// DELIVERY_COMPLETED, but nothing ever credited the rider — the delivery fee
// was collected and attributed to nobody. Jobs finished before the deploy have
// no settlement event to replay, so this script settles them.
//
// It does NOT contain any money rules of its own. It boots the real API and
// calls RiderSettlementService.settleDelivery(), so a backfilled delivery is
// split exactly like a live one: the rider earns the fee minus the effective
// platform commission rate, prepaid earnings are credited to the rider wallet,
// and cash deliveries accrue what the rider owes instead. settleDelivery() is
// idempotent, so re-running this can never pay a rider twice.
//
// Usage (run from apps/backend, e.g. in a Railway shell, after `pnpm build`):
//
//   node prisma/settle-unpaid-deliveries.cjs
//        → dry run: lists every unsettled delivered job and the split it would
//          apply. Changes nothing.
//
//   node prisma/settle-unpaid-deliveries.cjs --apply
//        → actually settles them.
//
//   node prisma/settle-unpaid-deliveries.cjs --job <deliveryJobId> --apply
//        → settle one specific job (repeatable).
//
/* eslint-disable @typescript-eslint/no-require-imports, no-console -- plain
   CommonJS maintenance script run directly via `node` (not compiled TS); its
   console output is the operator's record of what changed. */
const { NestFactory } = require('@nestjs/core');
const { PrismaClient } = require('@prisma/client');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const jobIds = argv.reduce((acc, arg, index) => {
  if (arg === '--job' && typeof argv[index + 1] === 'string') {
    acc.push(argv[index + 1]);
  }
  return acc;
}, []);

const money = (value) => `NGN ${Number(value).toLocaleString('en-NG')}`;

async function main() {
  const prisma = new PrismaClient();

  const jobs = await prisma.deliveryJob.findMany({
    where: {
      status: 'DELIVERED',
      settledAt: null,
      riderId: { not: null },
      ...(jobIds.length > 0 ? { id: { in: jobIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: {
      rider: { select: { firstName: true, lastName: true, email: true } },
      order: { select: { orderNumber: true, paymentMethod: true } },
    },
  });

  if (jobs.length === 0) {
    console.log('Nothing to settle — every delivered job already has a settlement.');
    await prisma.$disconnect();
    return;
  }

  // Boot the API so the split comes from the same service the live path uses.
  const { AppModule } = require('../dist/app.module');
  const { RiderSettlementService } = require('../dist/delivery/rider-settlement.service');
  const {
    PlatformCommissionSettingsService,
  } = require('../dist/commercial/platform-commission-settings.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const settlement = app.get(RiderSettlementService);
  const rate = await app.get(PlatformCommissionSettingsService).getEffectiveRate();

  console.log(
    `${apply ? 'Settling' : 'DRY RUN —'} ${String(jobs.length)} delivered job(s) at a ${String(
      rate * 100,
    )}% platform commission.\n`,
  );

  let settled = 0;
  for (const job of jobs) {
    const fee = Number(job.deliveryFee);
    const commission = Math.round(fee * rate * 100) / 100;
    const earning = Math.round((fee - commission) * 100) / 100;
    const riderName = [job.rider?.firstName, job.rider?.lastName].filter(Boolean).join(' ');
    const isCash = job.order?.paymentMethod === 'CASH';

    console.log(
      `  ${job.order?.orderNumber ?? job.id}  ${riderName || job.riderId}  fee ${money(
        fee,
      )} → rider ${money(earning)} / platform ${money(commission)}  [${
        isCash ? 'cash: accrues what they owe' : 'prepaid: credited to wallet'
      }]`,
    );

    if (apply) {
      const done = await settlement.settleDelivery(job.id);
      if (done) {
        settled += 1;
      } else {
        console.log('    → skipped (already settled, or nothing to pay)');
      }
    }
  }

  console.log(
    apply
      ? `\nSettled ${String(settled)} of ${String(jobs.length)} job(s).`
      : '\nDry run only — nothing changed. Re-run with --apply to settle these.',
  );

  await app.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
