// One-off bootstrap: give every PRE-ACTIVATION stalled order a proper recovery
// case file, before the 24-hour automatic backstop is ever enabled.
// DPX-ORDER-8D-RECOVERY Increment 4, founder ruling 2026-09-16.
//
// WHY THIS EXISTS. `predatesRecoveryImplementation` is an attribute of a
// recovery CASE, not of an order. An order that has never been given a case
// cannot carry it, so excluding on that flag alone protects nothing — the sweep
// would open a fresh case with the flag defaulting to false and treat a
// long-stalled order as ordinary work. Two independent protections close that:
//
//   1. RECOVERY_ACTIVATION_AT — exceptions detected before it are structurally
//      ineligible for automatic recovery, case or no case. That protection
//      holds whether or not this script is ever run.
//   2. This script — so a pre-existing case is not merely INVISIBLE to the
//      sweep but has a documented recovery record saying what it is.
//
// IT NEVER CANCELS AN ORDER AND NEVER MOVES MONEY. It creates case files and a
// FINDING_RECORDED entry, nothing else. Recovery of these orders remains a
// governed, explicitly authorised decision.
//
// It records trigger = HISTORICAL, automatic = true and no actor, because a
// person did not decide to open these and the migration process is not an
// operator. Increment 1 recorded such cases as OPERATOR; that was a defect and
// migration 20260916180000 corrects it.
//
// Idempotent through UNIQUE(order_recoveries.order_id): re-running creates
// nothing a second time and reports the existing cases instead.
//
// Usage (run from apps/backend, in the Railway shell, after `pnpm build`):
//
//   node prisma/recognize-historical-recovery-cases.cjs
//        → DRY RUN: reports exactly how many cases it would create and how many
//          already exist. Changes nothing.
//
//   node prisma/recognize-historical-recovery-cases.cjs --apply
//        → actually creates the case files.
//
/* eslint-disable @typescript-eslint/no-require-imports, no-console -- plain
   CommonJS maintenance script run directly via `node` (not compiled TS); its
   console output is the operator's record of what changed. */
const { PrismaClient } = require('@prisma/client');

const { resolveRecoveryActivationAt } = require('../dist/src/orders/order.constants');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

async function main() {
  // REFUSE WITHOUT A VALID BOUNDARY. Without it there is no definition of
  // "pre-activation", so there is no defensible set to recognise. Guessing one
  // here would invent the very policy this script exists to honour.
  const activationAt = resolveRecoveryActivationAt();
  if (activationAt === null) {
    console.error(
      'RECOVERY_ACTIVATION_AT is not set or is not a valid timestamp.\n' +
        'Without the activation boundary there is no definition of a pre-activation\n' +
        'exception, so this script refuses to run. Set the constant in\n' +
        'src/orders/order.constants.ts, rebuild, and re-run.',
    );
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    console.log(
      `Activation boundary: ${activationAt.toISOString()}\n` +
        `Mode: ${APPLY ? 'APPLY — case files will be created' : 'DRY RUN — nothing will change'}\n`,
    );

    // Qualifying = an OPEN stalled exception detected BEFORE the boundary, on an
    // order still sitting in CONFIRMED. Deliberately the mirror image of the
    // sweep's eligibility predicate: what the sweep may never touch is exactly
    // what this recognises.
    const orders = await prisma.order.findMany({
      where: {
        status: 'CONFIRMED',
        exceptions: {
          some: {
            type: 'STALLED_CONFIRMED',
            status: 'OPEN',
            detectedAt: { lt: activationAt },
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        paymentMethod: true,
        paymentStatus: true,
        confirmedAt: true,
        recovery: { select: { id: true, predatesRecoveryImplementation: true } },
        exceptions: {
          where: { type: 'STALLED_CONFIRMED', status: 'OPEN', detectedAt: { lt: activationAt } },
          select: { id: true, detectedAt: true },
          take: 1,
        },
      },
      orderBy: { confirmedAt: 'asc' },
    });

    const toCreate = orders.filter((order) => order.recovery === null);
    const existing = orders.filter((order) => order.recovery !== null);

    for (const order of orders) {
      const exception = order.exceptions[0];
      const state = order.recovery === null ? 'would create' : 'already has a case';
      console.log(
        `  ${order.orderNumber}  ${String(order.paymentMethod)}/${String(order.paymentStatus)}  ` +
          `stalled since ${exception ? exception.detectedAt.toISOString() : 'unknown'}  → ${state}`,
      );
    }

    console.log(
      `\nQualifying pre-activation stalled orders: ${orders.length}\n` +
        `  would create: ${toCreate.length}\n` +
        `  already exist: ${existing.length}`,
    );

    if (!APPLY) {
      console.log('\nDry run only — nothing changed. Re-run with --apply to create these cases.');
      return;
    }

    let created = 0;
    let raced = 0;
    for (const order of toCreate) {
      const exception = order.exceptions[0];
      try {
        const recovery = await prisma.orderRecovery.create({
          data: {
            orderId: order.id,
            ...(exception ? { orderExceptionId: exception.id } : {}),
            status: 'PENDING',
            trigger: 'HISTORICAL',
            paymentMethodAtOpen: order.paymentMethod,
            paymentStatusAtOpen: order.paymentStatus,
            predatesRecoveryImplementation: true,
          },
        });
        await prisma.orderRecoveryAction.create({
          data: {
            recoveryId: recovery.id,
            type: 'FINDING_RECORDED',
            outcome: 'SUCCEEDED',
            // No actor. The recognition process is not a person.
            automatic: true,
            detail:
              'Historical policy recognition: this order was already stalled before automatic ' +
              'recovery was activated. Recorded so the case is documented rather than merely ' +
              'invisible to the sweep. No order, payment or wallet state was changed.',
          },
        });
        created += 1;
      } catch (error) {
        // UNIQUE(order_id) — somebody else recognised or claimed it between the
        // read and the write. Not an error.
        if (error && error.code === 'P2002') {
          raced += 1;
          continue;
        }
        throw error;
      }
    }

    console.log(
      `\nCreated: ${created}` +
        (raced > 0 ? `\nAlready claimed by a concurrent run: ${raced}` : '') +
        '\nNo order was cancelled and no money moved.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
