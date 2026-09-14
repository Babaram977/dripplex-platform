import { randomUUID } from 'node:crypto';

import { bootHarness, type Harness } from './merchant-module-guard.shared-spec';

/**
 * B3 — every path that creates or changes a webhook URL must reject non-HTTPS
 * endpoints and must run the existing URL safety validation before persisting.
 *
 * Two defects, deliberately kept distinct:
 *
 * **(A) HTTPS policy.** Four write paths accepted `http:`. Two of them — the
 * legacy `CreateIntegrationDto` / `UpdateIntegrationDto` — carried a bare
 * `@IsUrl()`, which also accepts `ftp:` and even a protocol-less string.
 * Enforcing on only the two C DTOs would have produced a control that looks
 * complete and is not, because a merchant can reach the legacy pair.
 *
 * **(B) Legacy write-path SSRF gap.** `createIntegration` and
 * `updateIntegration` never called `validateUrl`, so the legacy path persisted
 * whatever it was given. Nothing unsafe was ever *contacted* — the test route
 * validates the stored value before fetching — but the write contract differed
 * between two live paths, and the weaker one stored what the stronger rejects.
 *
 * `PATCH /integrations/:id` being served by the legacy controller is the fact
 * both defects hang on, so B3-001 proves it over HTTP rather than inferring it
 * from route registration (CLAUDE.md §5: mapped is not reachable).
 *
 * Existing `http:` rows stay grandfathered — B3-006.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

suite('Webhook HTTPS enforcement at every write path (B3)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await bootHarness(databaseUrl, true);
  }, 240_000);

  afterAll(async () => {
    if (databaseUrl === '') return;
    await h.cleanup();
  }, 120_000);

  it('B3-001 · PATCH /integrations/:id is served by the legacy controller', async () => {
    // The C controller declares no @Patch, so only the legacy handler can
    // answer. A 404 would mean no handler at all; a 400 means one answered and
    // its DTO rejected the body. That is the reachability proof, over HTTP.
    const refused = await h.asMerchant({
      method: 'PATCH',
      path: `/integrations/${h.integrationId}`,
      body: { webhookUrl: 'http://merchant.example/hook' },
    });
    expect(refused.status).toBe(400);

    const accepted = await h.asMerchant({
      method: 'PATCH',
      path: `/integrations/${h.integrationId}`,
      body: { webhookUrl: 'https://merchant.example/hook' },
    });
    expect(accepted.status).toBe(200);
  });

  it('B3-002 · every write path rejects a plain-http webhook', async () => {
    const survivors: string[] = [];
    const probes = [
      { method: 'POST', path: '/integrations' },
      { method: 'PUT', path: `/integrations/${h.integrationId}` },
      { method: 'PATCH', path: `/integrations/${h.integrationId}` },
    ];
    for (const p of probes) {
      const { status, text } = await h.asMerchant({
        ...p,
        body: { vendorName: 'B3 probe', webhookUrl: 'http://merchant.example/hook' },
      });
      if (status !== 400)
        survivors.push(`${p.method} ${p.path} → ${String(status)} ${text.slice(0, 90)}`);
    }
    expect(survivors).toEqual([]);
  });

  it('B3-003 · the legacy DTOs no longer accept ftp: or a protocol-less string', async () => {
    // Both were accepted by the bare @IsUrl() this replaces.
    for (const bad of ['ftp://merchant.example/hook', 'merchant.example/hook']) {
      const { status } = await h.asMerchant({
        method: 'PATCH',
        path: `/integrations/${h.integrationId}`,
        body: { webhookUrl: bad },
      });
      expect(status).toBe(400);
    }
  });

  it('B3-004 · the legacy path now validates URL safety before persisting', async () => {
    // Defect (B), isolated from (A): this URL is HTTPS, so it clears the DTO
    // and can only be refused by validateUrl. Before this change it was
    // persisted unchecked.
    const { status } = await h.asMerchant({
      method: 'PATCH',
      path: `/integrations/${h.integrationId}`,
      body: { webhookUrl: 'https://127.0.0.1/hook' },
    });
    expect(status).not.toBe(200);

    const row = await h.prisma.merchantIntegration.findUnique({
      where: { id: h.integrationId },
      select: { webhookUrl: true },
    });
    expect(row?.webhookUrl).not.toBe('https://127.0.0.1/hook');
  });

  it('B3-005 · an HTTPS webhook is still accepted and stored', async () => {
    const url = `https://merchant-${randomUUID().slice(0, 6)}.example/hook`;
    const { status } = await h.asMerchant({
      method: 'PATCH',
      path: `/integrations/${h.integrationId}`,
      body: { webhookUrl: url },
    });
    expect(status).toBe(200);

    const row = await h.prisma.merchantIntegration.findUnique({
      where: { id: h.integrationId },
      select: { webhookUrl: true },
    });
    expect(row?.webhookUrl).toBe(url);
  });

  it('B3-006 · an existing http: row is left alone, and still readable', async () => {
    // Grandfathering: enforcement is at write time only. A merchant who
    // registered an http endpoint before this rule keeps it until they change
    // it — nothing migrates rows, and reads do not start failing.
    await h.prisma.merchantIntegration.update({
      where: { id: h.integrationId },
      data: { webhookUrl: 'http://legacy.example/hook' },
    });

    const { status, text } = await h.asMerchant({
      method: 'GET',
      path: `/integrations/${h.integrationId}`,
    });
    expect(status).toBe(200);
    expect(text).toContain('http://legacy.example/hook');

    const row = await h.prisma.merchantIntegration.findUnique({
      where: { id: h.integrationId },
      select: { webhookUrl: true },
    });
    expect(row?.webhookUrl).toBe('http://legacy.example/hook');
  });
});
