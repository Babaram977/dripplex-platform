// One-off cleanup: retire test/demo MERCHANT accounts so they stop cluttering
// the Operations Console approvals desk.
//
// This touches production data, so it is deliberately conservative:
//
//   • SOFT delete only. It sets MerchantProfile.deletedAt — it never issues a
//     hard DELETE, so nothing is destroyed and any mistake is reversible by
//     clearing deletedAt again. The admin merchant list filters on
//     `deletedAt: null` (prisma-merchants.repository), so a retired merchant
//     disappears from the desk immediately.
//   • DRY RUN by default. It prints exactly what it would do and changes
//     nothing unless you pass --apply.
//   • EXPLICIT targets only. You name the merchants by email — there is no
//     "delete anything that looks like a test" pattern that could sweep up a
//     real merchant. (Your real merchants use the same yopmail.com domain as
//     the test ones, so matching by domain would be dangerous.)
//   • REFUSES to retire a merchant that has any ORDERS, or one that is
//     APPROVED, unless you additionally pass --force. Those are the two signals
//     that an account is real. Ghasan Leather Shop, for example, is approved and
//     has a live order, so it is protected from an accidental match.
//
// Usage (run from apps/backend, e.g. in a Railway shell):
//
//   node prisma/retire-test-merchants.cjs a@yopmail.com b@yopmail.com
//        → dry run: shows what would be retired, changes nothing
//
//   node prisma/retire-test-merchants.cjs a@yopmail.com b@yopmail.com --apply
//        → actually retires them
//
//   node prisma/retire-test-merchants.cjs --restore a@yopmail.com --apply
//        → undo: clears deletedAt and brings the merchant back
//
/* eslint-disable @typescript-eslint/no-require-imports, no-console -- plain
   CommonJS maintenance script run directly via `node` (not compiled TS); its
   console output is the operator's record of what changed. */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const FORCE = argv.includes('--force');
const RESTORE = argv.includes('--restore');
const emails = argv
  .filter((a) => !a.startsWith('--'))
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  if (emails.length === 0) {
    console.error(
      'No emails given.\n' +
        'Usage: node prisma/retire-test-merchants.cjs <email> [more emails] [--apply] [--force]\n' +
        '       node prisma/retire-test-merchants.cjs --restore <email> --apply',
    );
    process.exitCode = 1;
    return;
  }

  console.log(RESTORE ? 'Mode: RESTORE' : 'Mode: RETIRE (soft delete)');
  console.log(APPLY ? 'APPLY: changes WILL be written.' : 'DRY RUN: nothing will be written.');
  console.log('');

  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: { email },
      include: { merchantProfile: true },
    });

    if (!user) {
      console.log(`• ${email}: no user found — skipped.`);
      continue;
    }
    const profile = user.merchantProfile;
    if (!profile) {
      console.log(`• ${email}: user exists but has no merchant profile — skipped.`);
      continue;
    }

    if (RESTORE) {
      if (!profile.deletedAt) {
        console.log(`• ${email}: not retired — nothing to restore.`);
        continue;
      }
      if (APPLY) {
        await prisma.merchantProfile.update({
          where: { id: profile.id },
          data: { deletedAt: null },
        });
      }
      console.log(
        `• ${email}: ${APPLY ? 'RESTORED' : 'would restore'} (status ${profile.status}).`,
      );
      continue;
    }

    if (profile.deletedAt) {
      console.log(`• ${email}: already retired on ${profile.deletedAt.toISOString()} — skipped.`);
      continue;
    }

    // Signals that this is a REAL merchant, not a test account.
    const orderCount = await prisma.order.count({ where: { merchantId: profile.id } });
    const blockers = [];
    if (orderCount > 0) blockers.push(`${orderCount} order(s)`);
    if (profile.status === 'APPROVED') blockers.push('status APPROVED');

    if (blockers.length > 0 && !FORCE) {
      console.log(
        `• ${email}: REFUSED — looks like a real merchant (${blockers.join(', ')}). ` +
          'Re-run with --force only if you are certain.',
      );
      continue;
    }

    if (APPLY) {
      await prisma.merchantProfile.update({
        where: { id: profile.id },
        data: { deletedAt: new Date() },
      });
    }
    console.log(
      `• ${email}: ${APPLY ? 'RETIRED' : 'would retire'} ` +
        `(status ${profile.status}, ${orderCount} order(s))` +
        (blockers.length > 0 ? ' [FORCED past safety checks]' : ''),
    );
  }

  const remaining = await prisma.merchantProfile.count({ where: { deletedAt: null } });
  console.log(`\nMerchants still visible in the Operations Console: ${remaining}`);
  if (!APPLY) {
    console.log('Dry run only — re-run with --apply to write these changes.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
