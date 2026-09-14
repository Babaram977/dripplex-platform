import { randomUUID } from 'node:crypto';

import {
  bootHarness,
  merchantRoutes,
  posRoutes,
  MODULE_OFF,
  type Harness,
} from './merchant-module-guard.shared-spec';

/**
 * Merchant Module **OFF** (founder ruling, 2026-09-14).
 *
 * Module off must gate Merchant Connect — the merchant-facing reads and
 * writes — while leaving POS ingestion running. The two audiences share
 * controllers: `CatalogueSyncController` and `InventorySyncController` each
 * carry a credential-authenticated POS route alongside JWT-authenticated
 * merchant routes, and every route on `OrderSyncController` is POS.
 *
 * The failure this file exists to prevent is a plausible tidy-up: hoisting
 * `MerchantModuleEnabledGuard` to the class. That reads as more consistent and
 * would silently take POS ingestion down with the merchant UI, answering
 * integrators "The merchant module is not enabled" — a sentence about a
 * product surface they do not use and cannot act on. MMG-004 and MMG-005 are
 * the only place that shows up.
 *
 * The discriminator throughout is the guard's **message**, not the status: a
 * route refused for ownership or scope also answers 403, and conflating the
 * two would let a class-level guard pass unnoticed.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

suite('Merchant Module OFF — integrations surface (MMG)', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await bootHarness(databaseUrl, false);
  }, 240_000);

  afterAll(async () => {
    if (databaseUrl === '') return;
    await h.cleanup();
  }, 120_000);

  it('MMG-001 · the app really is running with the module off', () => {
    // Without this the whole file could run against a module that is on and
    // every "gated" assertion below would be proving nothing.
    expect(h.moduleEnabled).toBe(false);
  });

  it('MMG-002 · every merchant-facing integrations route is gated', async () => {
    const survivors: string[] = [];
    for (const probe of merchantRoutes()) {
      const { status, text } = await h.asMerchant(probe);
      if (status !== 403 || !text.includes(MODULE_OFF)) {
        survivors.push(`${probe.method} ${probe.path} → ${String(status)} ${text.slice(0, 120)}`);
      }
    }
    expect(survivors).toEqual([]);
  });

  it('MMG-003 · the merchant read for a real owned integration is gated too', async () => {
    const { status, text } = await h.asMerchant({
      method: 'GET',
      path: `/integrations/catalogue/products/${h.integrationId}`,
    });
    expect(status).toBe(403);
    expect(text).toContain(MODULE_OFF);
  });

  it('MMG-004 · no POS machine-to-machine route is refused as module-disabled', async () => {
    const refused: string[] = [];
    for (const probe of posRoutes()) {
      const { status, text } = await h.asPos(probe);
      if (text.includes(MODULE_OFF)) {
        refused.push(`${probe.method} ${probe.path} → ${String(status)}`);
      }
    }
    expect(refused).toEqual([]);
  });

  it('MMG-005 · POS catalogue ingestion still works, end to end', async () => {
    // Not merely "not 403": the push is accepted and the catalogue actually
    // moves, which is what "ingestion continues working" has to mean.
    const sku = `MMG-OFF-${randomUUID().slice(0, 8)}`;
    const { status, text } = await h.asPos({
      method: 'POST',
      path: '/integrations/catalogue/sync',
      body: {
        idempotencyKey: `mmg-off-${randomUUID()}`,
        items: [{ externalSku: sku, name: 'Ingested while module off', price: 25.5 }],
      },
    });

    expect(text).not.toContain(MODULE_OFF);
    expect([200, 201, 202]).toContain(status);

    const mapping = await h.prisma.productSync.findFirst({
      where: { integrationId: h.integrationId, externalSku: sku },
    });
    expect(mapping).not.toBeNull();
  });

  it('MMG-006 · POS inventory push still moves stock, end to end', async () => {
    // Inventory sync refuses a SKU it has no mapping for (SKU_NOT_LINKED), so
    // the SKU is ingested first — which is also how a real POS reaches this
    // route. Asserting the stock actually moved is the point: a 2xx alone
    // would not distinguish "accepted" from "accepted and ignored".
    const sku = `MMG-INV-${randomUUID().slice(0, 8)}`;
    const ingest = await h.asPos({
      method: 'POST',
      path: '/integrations/catalogue/sync',
      body: {
        idempotencyKey: `mmg-inv-${randomUUID()}`,
        items: [{ externalSku: sku, name: 'Stock probe', price: 12, quantity: 1 }],
      },
    });
    expect([200, 201, 202]).toContain(ingest.status);

    const { status, text } = await h.asPos({
      method: 'PUT',
      path: '/integrations/inventory/sync',
      body: { items: [{ externalSku: sku, quantity: 7 }] },
      headers: { 'Idempotency-Key': `mmg-inv-${randomUUID()}` },
    });

    expect(text).not.toContain(MODULE_OFF);
    expect([200, 201, 202]).toContain(status);

    const mapping = await h.prisma.productSync.findFirst({
      where: { integrationId: h.integrationId, externalSku: sku },
    });
    expect(mapping?.productId).toBeTruthy();
    const inventory = await h.prisma.productInventory.findFirst({
      where: { productId: mapping?.productId ?? '' },
    });
    expect(inventory?.quantity).toBe(7);
  });

  it('MMG-007 · the module guard never pre-empts authentication', async () => {
    // Ordering: an unauthenticated caller is still refused as unauthenticated,
    // not told about a product surface they have not authenticated into.
    const { status, text } = await h.anonymous({
      method: 'GET',
      path: `/integrations/catalogue/products/${h.integrationId}`,
    });
    expect(status).toBe(401);
    expect(text).not.toContain(MODULE_OFF);
  });
});
