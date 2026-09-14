import { randomUUID } from 'node:crypto';

import {
  bootHarness,
  merchantRoutes,
  posRoutes,
  MODULE_OFF,
  type Harness,
} from './merchant-module-guard.shared-spec';

/**
 * Merchant Module **ON** — the other half of the ruling.
 *
 * A guard that gates everything when the module is off is only half correct;
 * it must also gate nothing when the module is on. This is a separate file
 * because the flag cannot be changed twice in one process — see the note in
 * `merchant-module-guard.shared-spec.ts`.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

suite('Merchant Module ON — integrations surface (MMGN)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await bootHarness(databaseUrl, true);
  }, 240_000);

  afterAll(async () => {
    if (databaseUrl === '') return;
    await h.cleanup();
  }, 120_000);

  it('MMGN-001 · the app really is running with the module on', () => {
    expect(h.moduleEnabled).toBe(true);
  });

  it('MMGN-002 · no merchant-facing integrations route is module-gated', async () => {
    // Addressed at an integration belonging to nobody, so each is refused on
    // ownership or validation rather than acted on — nothing is mutated, the
    // destructive routes included.
    const gated: string[] = [];
    for (const probe of merchantRoutes()) {
      const { status, text } = await h.asMerchant(probe);
      if (text.includes(MODULE_OFF)) {
        gated.push(`${probe.method} ${probe.path} → ${String(status)}`);
      }
    }
    expect(gated).toEqual([]);
  });

  it('MMGN-003 · the merchant read for a real owned integration is served', async () => {
    const { status, text } = await h.asMerchant({
      method: 'GET',
      path: `/integrations/catalogue/products/${h.integrationId}`,
    });
    expect(status).toBe(200);
    expect(text).not.toContain(MODULE_OFF);
  });

  it('MMGN-004 · POS routes are unaffected', async () => {
    const refused: string[] = [];
    for (const probe of posRoutes()) {
      const { text } = await h.asPos(probe);
      if (text.includes(MODULE_OFF)) refused.push(`${probe.method} ${probe.path}`);
    }
    expect(refused).toEqual([]);
  });

  it('MMGN-005 · POS catalogue ingestion works, end to end', async () => {
    // The paired half of MMG-005: the same push, the same proof, so the two
    // files together show ingestion is genuinely indifferent to the flag.
    const sku = `MMGN-ON-${randomUUID().slice(0, 8)}`;
    const { status, text } = await h.asPos({
      method: 'POST',
      path: '/integrations/catalogue/sync',
      body: {
        idempotencyKey: `mmgn-on-${randomUUID()}`,
        items: [{ externalSku: sku, name: 'Ingested while module on', price: 25.5 }],
      },
    });

    expect(text).not.toContain(MODULE_OFF);
    expect([200, 201, 202]).toContain(status);

    const mapping = await h.prisma.productSync.findFirst({
      where: { integrationId: h.integrationId, externalSku: sku },
    });
    expect(mapping).not.toBeNull();
  });
});
