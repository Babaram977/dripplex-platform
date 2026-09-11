import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PERMISSION_SEEDS } from '../../../prisma/seed-data/permissions';
import { ROLE_PERMISSION_GRANTS } from '../../../prisma/seed-data/role-permissions';
import { SUPPORT_PERMISSIONS } from '../support.constants';

const AI_HANDOFF = 'support:tickets:ai-handoff';

/**
 * DPX-SUPPORT-002 B2 — the AI-handoff capability.
 *
 * Handing a live conversation to automation is a different act from replying to
 * one, and the decision was that it must not ride along with the grant every
 * Operations responder already holds. Seeded and granted to nobody is the
 * correct end state for B2; these tests are what keep it that way.
 */
describe('support:tickets:ai-handoff', () => {
  it('exists in the catalogue, so the permission can be assigned when policy allows', () => {
    const catalogue = new Set(PERMISSION_SEEDS.map((permission) => permission.code));
    expect(catalogue.has(AI_HANDOFF)).toBe(true);
  });

  it('exists in the catalogue that actually runs in production', () => {
    // seed-rbac.cjs is the copy that seeds production; a permission present only
    // in the TypeScript one would 403 for everybody the day it is granted.
    const source = readFileSync(
      join(__dirname, '..', '..', '..', 'prisma', 'seed-rbac.cjs'),
      'utf8',
    );
    expect(source).toContain(`code: '${AI_HANDOFF}'`);
  });

  it('is granted to no role at all', () => {
    // Not customer, not rider, not driver, not merchant, not fleet owner, and
    // not the ordinary support responder. It is assigned deliberately, to a
    // named Operations role, once the operational policy exists — which has not
    // happened, so the correct answer today is nobody.
    const holders = Object.entries(ROLE_PERMISSION_GRANTS)
      .filter(([, codes]) => codes.includes(AI_HANDOFF))
      .map(([role]) => role);
    expect(holders).toEqual([]);
  });

  it('is granted to no role in the production catalogue either', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', '..', 'prisma', 'seed-rbac.cjs'),
      'utf8',
    );
    const grants = source.slice(source.indexOf('ROLE_PERMISSION_GRANTS'));
    expect(grants).not.toContain(AI_HANDOFF);
  });

  it('is a different string from using or managing tickets', () => {
    // The whole point of the separation. If these ever collapse into one grant,
    // every Operations responder silently gains the ability to hand a live
    // conversation to a machine.
    expect(AI_HANDOFF).not.toBe(SUPPORT_PERMISSIONS.TICKETS_USE);
    expect(AI_HANDOFF).not.toBe(SUPPORT_PERMISSIONS.ADMIN_MANAGE);
  });
});

/**
 * B2 may read `requiresHumanHandling`. B2 must never write or clear it.
 *
 * That column belongs to the deterministic gate layer. This is a structural
 * test rather than a behavioural one, because the failure it guards against is
 * a line of code that does not exist yet — and by the time it does, a
 * behavioural test would have to guess where to look.
 */
describe('requiresHumanHandling has exactly one writer', () => {
  it('is assigned in exactly one place, the B1 create path', () => {
    // B2 may READ this column and must never write or clear it: it belongs to
    // the deterministic gate layer.
    //
    // A structural test rather than a behavioural one, because the failure it
    // guards against is a line of code that does not exist yet — and by the
    // time it does, a behavioural test would have to guess where to look.
    //
    // Copying the value OUT (`requiresHumanHandling: ticket.requiresHumanHandling`
    // in a DTO mapper or an audit payload) is a read and is excluded. Anything
    // else assigning the key is a candidate writer.
    expect(assignments()).toEqual([
      'support/support.service.ts:        requiresHumanHandling: requiresHumanHandling(dto.category) || requiresHuman(gate),',
    ]);
  });
});

/** Lines that ASSIGN a value to requiresHumanHandling, excluding the
 *  copy-it-out-of-the-row pattern the mappers use. Relative to `src/`. */
function assignments(): string[] {
  const root = join(__dirname, '..', '..');
  const out = execSync(
    `grep -rnE "requiresHumanHandling(:| =)" ${JSON.stringify(root)} --include=*.ts ` +
      `| grep -v "\\.spec\\.ts" ` +
      `| grep -vE "requiresHumanHandling: [A-Za-z_$][A-Za-z0-9_$]*\\.requiresHumanHandling" || true`,
    { encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const withoutRoot = line.slice(root.length + 1);
      // Drop the line number, keep file and text, so a move is visible but a
      // shifted line number is not a failure.
      return withoutRoot.replace(/^([^:]+):\d+:/, '$1:');
    })
    .sort();
}
