// One-off migration: extend legacy 90-day POS credentials to the 99-year
// lifetime (founder ruling, 2026-09-15, following the P3 supersession).
//
// P3 issued platform credentials with a 90-day expiry. That was superseded by a
// 99-year lifetime (PR #406), but only for NEW issuance and rotation — every
// credential issued before that deploy still carries its original 90-day date.
//
// Left alone, each of those lapses within 90 days. There is no expiry warning
// anywhere in the backend, and an expired credential is refused as
// `unauthenticated` — a 401 with a body identical to a wrong key. So a lapse
// looks to the merchant exactly like "your key is wrong": the till stops
// working mid-shift and the error misdirects whoever investigates. That is the
// failure the 99-year ruling was made to end, and this script is what stops it
// happening one last time to the existing population.
//
// WHAT IT TOUCHES
//
//   archivedAt IS NULL          — live credentials only
//   expiresAt IS NOT NULL       — a NULL expiry is the separate c4 population
//                                 (non-compliant with issuance policy); it is
//                                 NOT legacy, and this script leaves it alone
//   expiresAt > now()           — NOT already expired
//   expiresAt < issued + 1 year — stamped under the old policy
//
// WHAT IT DELIBERATELY DOES NOT TOUCH
//
//   Already-expired credentials. Extending one is not a lifetime adjustment,
//   it is restoring access that has already died — a different security act,
//   and an explicitly separate decision. They stay expired.
//
//   Archived credentials, and credentials with no expiry at all.
//
// THE NEW DATE: issued + 99 years, NOT now() + 99 years.
//
//   `issued` is COALESCE(rotatedAt, createdAt) — the moment the current expiry
//   was actually stamped. Rotation does NOT create a new row: the
//   @@unique([integrationId, credentialType]) constraint means createCredential
//   REUSES the archived row via update, setting rotatedAt and leaving createdAt
//   at the original creation. Anchoring on createdAt alone would misread every
//   rotated credential.
//
//   Anchoring on the issuance moment rather than on `now` has two consequences
//   worth having: a migrated credential ends up with exactly the date it would
//   have been given had it been issued under the new policy, so it is
//   indistinguishable from a native one; and the script is IDEMPOTENT —
//   re-running it computes the same date rather than pushing the expiry further
//   out each time.
//
// VERIFYING IT AFTERWARDS
//
//   The P4 inventory's `c5_legacy_short_lifetime` counts every live legacy
//   credential, expired or not. After this runs, c5 should equal the number of
//   already-expired legacy credentials — which the dry run prints separately,
//   precisely so the two numbers can be reconciled rather than guessed at.
//
//   NOTE: c5 is therefore NOT the blast radius of this script. c5 is the
//   superset; this script's own dry-run count is the exact figure, and it is
//   measured in the same session as the write rather than ahead of it.
//
// Usage (run from apps/backend, e.g. in a Railway shell, after `pnpm build`):
//
//   node prisma/extend-legacy-credential-expiry.cjs
//        → dry run: reports what it would change, and the expired population it
//          would leave alone. Changes nothing.
//
//   node prisma/extend-legacy-credential-expiry.cjs --apply
//        → performs the extension.
//
/* eslint-disable @typescript-eslint/no-require-imports, no-console -- plain
   CommonJS maintenance script run directly via `node` (not compiled TS); its
   console output is the operator's record of what changed. */
const { PrismaClient } = require('@prisma/client');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');

const LIFETIME_YEARS = 99;

/** Mirrors credentialExpiry() in credentials.service.ts — calendar arithmetic,
 *  not a day count, so "99 years" means 99 years rather than 99 x 365 days. */
function extendedExpiry(issuedAtDate) {
  const expiry = new Date(issuedAtDate.getTime());
  expiry.setFullYear(expiry.getFullYear() + LIFETIME_YEARS);
  return expiry;
}

/** The moment the credential's CURRENT expiry was stamped. */
function issuedAt(credential) {
  return credential.rotatedAt ?? credential.createdAt;
}

/** Stamped with a lifetime shorter than a year = issued under the old policy.
 *  A separator, not a threshold: the two policies are 90 days and 99 years,
 *  three orders of magnitude apart, so any cut between them gives the same
 *  answer. It encodes no judgement. */
function isLegacyLifetime(credential) {
  if (credential.expiresAt === null) return false;
  const boundary = new Date(issuedAt(credential).getTime());
  boundary.setFullYear(boundary.getFullYear() + 1);
  return credential.expiresAt < boundary;
}

async function main() {
  const prisma = new PrismaClient();
  const now = new Date();

  try {
    const live = await prisma.integrationCredential.findMany({
      where: { archivedAt: null, expiresAt: { not: null } },
      orderBy: { createdAt: 'asc' },
    });

    const legacy = live.filter(isLegacyLifetime);
    const toExtend = legacy.filter((c) => c.expiresAt > now);
    const alreadyExpired = legacy.filter((c) => c.expiresAt <= now);

    console.log(`Scanned ${String(live.length)} live credentials carrying an expiry.`);
    console.log('');
    console.log(`  legacy lifetime (this is what P4 c5 counts): ${String(legacy.length)}`);
    console.log(`    of which still valid     -> WILL EXTEND:   ${String(toExtend.length)}`);
    console.log(`    of which already expired -> LEFT ALONE:    ${String(alreadyExpired.length)}`);
    console.log('');

    if (alreadyExpired.length > 0) {
      console.log('Already-expired credentials are NOT touched. Extending one would restore');
      console.log('access that has already died, which is a separate security decision.');
      console.log('');
    }

    if (toExtend.length === 0) {
      console.log('Nothing to extend.');
      return;
    }

    for (const credential of toExtend) {
      const from = issuedAt(credential);
      const next = extendedExpiry(from);
      console.log(
        `  ${credential.id}  ${credential.credentialType}` +
          `  issued ${from.toISOString().slice(0, 10)}` +
          `  ${credential.expiresAt.toISOString().slice(0, 10)} -> ${next.toISOString().slice(0, 10)}` +
          `${credential.rotatedAt ? '  (anchored on rotation)' : ''}`,
      );
    }
    console.log('');

    if (!apply) {
      console.log('DRY RUN — nothing was changed. Re-run with --apply to perform it.');
      return;
    }

    let extended = 0;
    for (const credential of toExtend) {
      // Guarded by the expiry we read, so a credential rotated or revoked
      // between the scan and the write is skipped rather than overwritten.
      const result = await prisma.integrationCredential.updateMany({
        where: {
          id: credential.id,
          archivedAt: null,
          expiresAt: credential.expiresAt,
        },
        data: { expiresAt: extendedExpiry(issuedAt(credential)) },
      });
      if (result.count === 1) {
        extended += 1;
      } else {
        console.log(`  SKIPPED ${credential.id} — changed since the scan.`);
      }
    }

    console.log(`Extended ${String(extended)} of ${String(toExtend.length)} credentials.`);
    console.log('');
    console.log('Re-run without --apply to confirm: "WILL EXTEND" should now be 0,');
    console.log(
      `and P4 c5 should equal ${String(alreadyExpired.length)} (the expired population).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
