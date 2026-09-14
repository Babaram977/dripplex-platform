#!/usr/bin/env node
/**
 * DrippleX POS simulator — exercises the Phase 1 catalogue ingestion contract
 * over real HTTP against a running DrippleX API.
 *
 * Stands in for a merchant's POS until a provider adapter exists. Speaks only
 * the documented public surface: a JWT for merchant-owned setup, then the
 * integration credential headers a real POS would hold.
 */
const API = process.env.DPX_API ?? 'http://127.0.0.1:3000/api/v1';
const JWT = process.env.DPX_JWT;
if (!JWT) {
  console.error('DPX_JWT required');
  process.exit(1);
}

let step = 0;
const pass = [],
  fail = [];
const hr = () => console.log('─'.repeat(78));
function head(t) {
  step += 1;
  hr();
  console.log(`STEP ${step}  ${t}`);
  hr();
}
function check(label, ok, detail = '') {
  (ok ? pass : fail).push(label);
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
}

async function call(method, path, { body, jwt, integration, idempotencyKey } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${JWT}`;
  if (integration) {
    headers['x-integration-id'] = integration.id;
    headers['x-integration-key'] = integration.key;
  }
  // Inventory and order pushes carry the key in a header; the catalogue push
  // carries it in the body. Two conventions, both as their tickets specify.
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

const item = (o) => ({
  externalSku: o.sku,
  name: o.name,
  price: o.price,
  ...(o.qty !== undefined ? { quantity: o.qty } : {}),
  ...(o.category ? { categoryName: o.category } : {}),
  ...(o.currency ? { currency: o.currency } : {}),
  ...(o.active !== undefined ? { active: o.active } : {}),
});

const run = async () => {
  console.log('\nDrippleX ⇄ POS — Phase 1 catalogue ingestion, live against', API, '\n');

  // 1 ─────────────────────────────────────────────────────────────────────────
  head('Connect the integration (merchant, JWT)');
  const created = await call('POST', '/integrations', {
    jwt: true,
    body: {
      vendorName: 'Acme POS',
      vendorVersion: 'v2.1.0',
      merchantContactEmail: 'ops@acmepos.example',
      metadata: { branch: 'lagos-1' },
    },
  });
  check(
    'POST /integrations accepted',
    created.status === 201 || created.status === 200,
    `HTTP ${created.status}`,
  );
  const integrationId =
    created.body?.data?.integrationId ??
    created.body?.integrationId ??
    created.body?.data?.id ??
    created.body?.id;
  check(
    'integration id returned',
    Boolean(integrationId),
    integrationId ?? JSON.stringify(created.body).slice(0, 200),
  );
  if (!integrationId) {
    console.error('cannot continue');
    process.exit(1);
  }

  // 2 ─────────────────────────────────────────────────────────────────────────
  head('Use the credential DrippleX generated');
  // No workaround here any more. This used to discard the returned apiKey and
  // issue a merchant-chosen INCOMING_API_KEY through POST /{id}/credentials,
  // because the generated one was stored as OUTGOING_API_KEY and authenticated
  // nothing. Routing around that defect is why nobody noticed it for so long.
  // A reference client has to use the lifecycle a real merchant uses.
  const apiKey = created.body?.apiKey ?? created.body?.data?.apiKey;
  check('generated apiKey returned once', Boolean(apiKey), apiKey ? 'present' : 'absent');
  check(
    'apiKey is 256 bits in the approved format',
    /^dpx_integration_[0-9a-f]{64}$/.test(apiKey ?? ''),
    (apiKey ?? '').slice(0, 24) + '…',
  );
  if (!apiKey) {
    console.error('cannot continue without the generated credential');
    process.exit(1);
  }
  const auth = { id: integrationId, key: apiKey };

  const listed = await call('GET', `/integrations/${integrationId}/credentials`, { jwt: true });
  check(
    'the secret is never returned again',
    !JSON.stringify(listed.body ?? {}).includes(apiKey),
    `publicSuffix=${listed.body?.data?.[0]?.publicSuffix ?? '?'}`,
  );

  const replaced = await call('POST', `/integrations/${integrationId}/credentials`, {
    jwt: true,
    body: {
      credentialType: 'INCOMING_API_KEY',
      secret: `would-replace-${Date.now()}`,
      scopes: ['catalog:write'],
    },
  });
  check(
    'a live credential is not silently replaced',
    replaced.status === 409,
    `HTTP ${replaced.status}`,
  );

  // 3 ─────────────────────────────────────────────────────────────────────────
  head('Authentication is actually enforced');
  const noAuth = await call('POST', '/integrations/catalogue/sync', {
    body: { idempotencyKey: 'x', items: [item({ sku: 'X', name: 'X', price: 1 })] },
  });
  check('unauthenticated push refused', noAuth.status === 401, `HTTP ${noAuth.status}`);
  const badKey = await call('POST', '/integrations/catalogue/sync', {
    integration: { id: integrationId, key: 'wrong-key' },
    body: { idempotencyKey: 'x', items: [item({ sku: 'X', name: 'X', price: 1 })] },
  });
  check('wrong key refused', badKey.status === 401, `HTTP ${badKey.status}`);
  check(
    'refusal does not reveal why',
    (badKey.body?.message ?? '') === (noAuth.body?.message ?? '') ||
      !/not found|no such/i.test(badKey.body?.message ?? ''),
    badKey.body?.message ?? '',
  );

  // 4 ─────────────────────────────────────────────────────────────────────────
  head('Push the opening catalogue');
  const BATCH1 = `acme-batch-${Date.now()}`;
  const push1 = await call('POST', '/integrations/catalogue/sync', {
    integration: auth,
    body: {
      idempotencyKey: BATCH1,
      items: [
        item({
          sku: 'ACME-BURGER-001',
          name: 'Zinger Burger',
          price: 4500.0,
          qty: 25,
          category: 'Fast Food',
        }),
        item({
          sku: 'ACME-FRIES-002',
          name: 'Large Fries',
          price: 1800.5,
          qty: 60,
          category: 'Fast Food',
        }),
        item({
          sku: 'ACME-COLA-003',
          name: 'Cola 50cl',
          price: 900.0,
          qty: 120,
          category: 'Soft Drinks',
        }),
      ],
    },
  });
  check('batch accepted', push1.status === 200, `HTTP ${push1.status}`);
  const s1 = push1.body?.data ?? {};
  console.log('   job summary:', JSON.stringify(s1));
  check(
    'three items applied',
    s1.productCount === 3 && s1.failedCount === 0,
    `productCount=${s1.productCount} failedCount=${s1.failedCount}`,
  );
  check('job reported COMPLETED', s1.jobStatus === 'COMPLETED', String(s1.jobStatus));

  // 5 ─────────────────────────────────────────────────────────────────────────
  head('Idempotency — replay the identical batch');
  const push1replay = await call('POST', '/integrations/catalogue/sync', {
    integration: auth,
    body: {
      idempotencyKey: BATCH1,
      items: [
        item({
          sku: 'ACME-BURGER-001',
          name: 'Zinger Burger',
          price: 4500.0,
          qty: 25,
          category: 'Fast Food',
        }),
        item({
          sku: 'ACME-FRIES-002',
          name: 'Large Fries',
          price: 1800.5,
          qty: 60,
          category: 'Fast Food',
        }),
        item({
          sku: 'ACME-COLA-003',
          name: 'Cola 50cl',
          price: 900.0,
          qty: 120,
          category: 'Soft Drinks',
        }),
      ],
    },
  });
  check('replay accepted', push1replay.status === 200, `HTTP ${push1replay.status}`);
  const s1r = push1replay.body?.data ?? {};
  console.log('   replay summary:', JSON.stringify(s1r));
  check(
    'replay returns the original job, not a new one',
    s1r.jobId === s1.jobId,
    `${s1.jobId} vs ${s1r.jobId}`,
  );
  check('replay is flagged as a replay', s1r.replayed === true, `replayed=${s1r.replayed}`);

  // 6 ─────────────────────────────────────────────────────────────────────────
  head('Inventory-only update');
  const push2 = await call('POST', '/integrations/catalogue/sync', {
    integration: auth,
    body: {
      idempotencyKey: `acme-inv-${Date.now()}`,
      items: [
        item({
          sku: 'ACME-BURGER-001',
          name: 'Zinger Burger',
          price: 4500.0,
          qty: 4,
          category: 'Fast Food',
        }),
      ],
    },
  });
  check('inventory batch accepted', push2.status === 200, `HTTP ${push2.status}`);
  console.log('   summary:', JSON.stringify(push2.body?.data ?? {}));

  // 7 ─────────────────────────────────────────────────────────────────────────
  head('Rejections do not fail the batch');
  const push3 = await call('POST', '/integrations/catalogue/sync', {
    integration: auth,
    body: {
      idempotencyKey: `acme-mixed-${Date.now()}`,
      items: [
        item({
          sku: 'ACME-WATER-004',
          name: 'Table Water 75cl',
          price: 500.0,
          qty: 200,
          category: 'Soft Drinks',
        }),
        item({
          sku: 'ACME-EURO-005',
          name: 'Imported Sauce',
          price: 12.0,
          qty: 5,
          currency: 'EUR',
          category: 'Soft Drinks',
        }),
        item({
          sku: 'ACME-NEG-006',
          name: 'Broken Row',
          price: 100.0,
          qty: -5,
          category: 'Soft Drinks',
        }),
      ],
    },
  });
  check('mixed batch still accepted', push3.status === 200, `HTTP ${push3.status}`);
  const s3 = push3.body?.data ?? {};
  console.log('   summary:', JSON.stringify(s3));
  check(
    'good items applied despite a rejection',
    (s3.productCount ?? 0) >= 1,
    `productCount=${s3.productCount}`,
  );
  check(
    'rejection counted, batch not failed',
    s3.failedCount === 1 && s3.jobStatus === 'PARTIAL',
    `${s3.jobStatus} failed=${s3.failedCount}`,
  );

  // 8 ─────────────────────────────────────────────────────────────────────────
  head('Archive at source');
  const push4 = await call('POST', '/integrations/catalogue/sync', {
    integration: auth,
    body: {
      idempotencyKey: `acme-arch-${Date.now()}`,
      items: [
        item({
          sku: 'ACME-COLA-003',
          name: 'Cola 50cl',
          price: 900.0,
          active: false,
          category: 'Soft Drinks',
        }),
      ],
    },
  });
  check('archive batch accepted', push4.status === 200, `HTTP ${push4.status}`);
  console.log('   summary:', JSON.stringify(push4.body?.data ?? {}));

  // 9 ─────────────────────────────────────────────────────────────────────────
  head('The merchant can see the sync history');
  const jobs = await call('GET', `/integrations/catalogue/jobs/${integrationId}`, { jwt: true });
  check('merchant can list jobs', jobs.status === 200, `HTTP ${jobs.status}`);
  const list = jobs.body?.data ?? [];
  check(
    'jobs recorded',
    Array.isArray(list) && list.length >= 4,
    `${Array.isArray(list) ? list.length : '?'} jobs`,
  );
  for (const j of Array.isArray(list) ? list.slice(0, 6) : []) {
    console.log(
      `   ${j.jobStatus ?? j.status}  items=${j.itemsProcessed ?? j.processed ?? '?'}  key=${j.idempotencyKey ?? '?'}`,
    );
  }

  // 10 ────────────────────────────────────────────────────────────────────────
  head('The order half of the journey');
  // Previously absent entirely: the reference client exercised catalogue and
  // inventory and never touched orders, which is the newest code and the only
  // part that moves an order's state.
  const orders = await call('GET', '/integrations/orders/list', { integration: auth });
  check('POS can list its merchant orders', orders.status === 200, `HTTP ${orders.status}`);

  const first = orders.body?.data?.items?.[0];
  if (!first) {
    console.log('   no orders for this merchant yet — fulfilment steps skipped');
  } else {
    const detail = await call(`GET`, `/integrations/orders/detail/${first.orderNumber}`, {
      integration: auth,
    });
    check('POS can read one order', detail.status === 200, `HTTP ${detail.status}`);
    check(
      'no customer identity on the wire',
      !/customerId|deliveryAddress|paymentMethod|deliveryFee/.test(
        JSON.stringify(detail.body ?? {}),
      ),
      'allow-list honoured',
    );

    const prep = await call('PUT', `/integrations/orders/status/${first.orderNumber}`, {
      integration: auth,
      idempotencyKey: `sim-${Date.now()}`,
      body: {
        externalOrderId: `POS-${Date.now()}`,
        status: 'PREPARING',
        sourceTimestamp: new Date().toISOString(),
      },
    });
    check('accept transitions the order', [200, 409].includes(prep.status), `HTTP ${prep.status}`);

    const ready = await call('PUT', `/integrations/orders/status/${first.orderNumber}`, {
      integration: auth,
      idempotencyKey: `sim-ready-${Date.now()}`,
      body: {
        externalOrderId: `POS-${Date.now()}`,
        status: 'READY',
        sourceTimestamp: new Date().toISOString(),
      },
    });
    check(
      'ready completes the POS half',
      [200, 409].includes(ready.status),
      `HTTP ${ready.status}`,
    );

    const after = await call('GET', `/integrations/orders/detail/${first.orderNumber}`, {
      integration: auth,
    });
    check(
      'the order reached READY',
      after.body?.data?.status === 'READY',
      after.body?.data?.status ?? '?',
    );
  }

  const cancel = await call('PUT', `/integrations/orders/status/DPX-DOES-NOT-EXIST`, {
    integration: auth,
    idempotencyKey: `sim-cancel-${Date.now()}`,
    body: {
      externalOrderId: `POS-${Date.now()}`,
      status: 'CANCELLED',
      sourceTimestamp: new Date().toISOString(),
    },
  });
  check('a POS may never cancel', cancel.status === 400, `HTTP ${cancel.status}`);

  hr();
  console.log(`RESULT  ${pass.length} passed, ${fail.length} failed`);
  if (fail.length) console.log('failed:', fail.join(' | '));
  hr();
  console.log('integrationId', integrationId);
};
run().catch((e) => {
  console.error('simulator error:', e);
  process.exit(1);
});
