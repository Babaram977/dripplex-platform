#!/usr/bin/env node
/**
 * Live verification of the category-mapping write path.
 *
 * Proves over real HTTP that a merchant can map a POS category through the API
 * and that the mapping then changes what ingestion does — the loop that was
 * impossible before these routes existed, when `CategoryMappingService`
 * exposed only `resolve()` and nothing could write what it read.
 */
const API = process.env.DPX_API ?? 'http://127.0.0.1:3000/api/v1';
const pass = [],
  fail = [];
const hr = () => console.log('─'.repeat(78));
let step = 0;
const head = (t) => {
  step += 1;
  hr();
  console.log(`STEP ${step}  ${t}`);
  hr();
};
const check = (l, ok, d = '') => {
  (ok ? pass : fail).push(l);
  console.log(`  ${ok ? '✅' : '❌'} ${l}${d ? ` — ${d}` : ''}`);
};

async function call(method, path, { body, jwt, integration, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (integration) {
    headers['x-integration-id'] = integration.id;
    headers['x-integration-key'] = integration.key;
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return raw ? { status: res.status, body: json } : { status: res.status, body: json };
}
const login = async (email, password) => {
  const r = await call('POST', '/auth/login/merchant', { body: { email, password } });
  if (r.status !== 200)
    throw new Error(`login ${email}: HTTP ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.data.accessToken;
};

const run = async () => {
  console.log('\nCategory-mapping write path — live against', API, '\n');

  const ownerJwt = await login('pos.demo.merchant@dripplex.dev', 'PosDemo!Passw0rd');
  const rivalJwt = await login('pos.demo.rival@dripplex.dev', 'RivalDemo!Passw0rd');

  // ── setup: owner's integration + credential ────────────────────────────────
  const made = await call('POST', '/integrations', {
    jwt: ownerJwt,
    body: { vendorName: 'Acme POS', vendorVersion: 'v2.1.0' },
  });
  const integrationId = made.body?.integrationId;
  if (!integrationId) {
    console.error('setup failed', made);
    process.exit(1);
  }
  const SECRET = `acme-map-key-${Date.now()}`;
  await call('POST', `/integrations/${integrationId}/credentials`, {
    jwt: ownerJwt,
    body: { credentialType: 'INCOMING_API_KEY', secret: SECRET, scopes: ['catalog:write'] },
  });
  const auth = { id: integrationId, key: SECRET };
  console.log('  integration', integrationId, '\n');

  const SKU = `ACME-MAPTEST-${Date.now()}`;
  const push = (categoryName, key) =>
    call('POST', '/integrations/catalogue/sync', {
      integration: auth,
      body: {
        idempotencyKey: key,
        items: [
          { externalSku: SKU, name: 'Mapping Probe', price: 1500.0, quantity: 7, categoryName },
        ],
      },
    });

  // 1 ─────────────────────────────────────────────────────────────────────────
  head('Before mapping: an unknown POS category ingests uncategorised');
  const before = await push('Grill Items', `map-before-${Date.now()}`);
  check('batch accepted', before.status === 200, `HTTP ${before.status}`);
  const state0 = await call('GET', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
  });
  check(
    'mapping list starts empty',
    Array.isArray(state0.body?.data) && state0.body.data.length === 0,
    `${state0.body?.data?.length ?? '?'} mappings`,
  );

  // 2 ─────────────────────────────────────────────────────────────────────────
  head('A merchant maps the category through the API');
  const cats = await call('GET', '/categories', { jwt: ownerJwt });
  let categoryId = null,
    categoryName = null;
  const list = cats.body?.data?.items ?? cats.body?.data ?? cats.body?.items ?? [];
  if (Array.isArray(list)) {
    const hit = list.find((c) => c?.slug === 'restaurants-food') ?? list[0];
    categoryId = hit?.id ?? null;
    categoryName = hit?.name ?? null;
  }
  if (!categoryId) {
    categoryId = process.env.DPX_CATEGORY_ID;
    categoryName = 'Restaurants & Food';
  }
  check(
    'a DrippleX category is available to map to',
    Boolean(categoryId),
    `${categoryName} ${categoryId ?? ''}`,
  );

  const put = await call('PUT', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
    body: { externalCategoryName: 'Grill Items', categoryId },
  });
  check(
    'PUT mapping accepted',
    put.status === 200,
    `HTTP ${put.status} ${JSON.stringify(put.body ?? {})}`,
  );

  const state1 = await call('GET', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
  });
  check(
    'mapping is listed back',
    (state1.body?.data ?? []).some((m) => m.externalCategoryName === 'Grill Items'),
    JSON.stringify(state1.body?.data ?? []),
  );

  // 3 ─────────────────────────────────────────────────────────────────────────
  head('Idempotent: the same PUT twice is not an error');
  const put2 = await call('PUT', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
    body: { externalCategoryName: 'Grill Items', categoryId },
  });
  check('second PUT also accepted', put2.status === 200, `HTTP ${put2.status}`);
  const state2 = await call('GET', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
  });
  check(
    'still exactly one mapping',
    (state2.body?.data ?? []).length === 1,
    `${(state2.body?.data ?? []).length} mappings`,
  );

  // 4 ─────────────────────────────────────────────────────────────────────────
  head('After mapping: the same POS category now resolves');
  const after = await push('Grill Items', `map-after-${Date.now()}`);
  check('batch accepted', after.status === 200, `HTTP ${after.status}`);
  console.log('   summary:', JSON.stringify(after.body?.data ?? {}));

  // 5 ─────────────────────────────────────────────────────────────────────────
  head('Ownership: another merchant cannot touch these mappings');
  const rivalRead = await call('GET', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: rivalJwt,
  });
  check('rival cannot read them', rivalRead.status === 403, `HTTP ${rivalRead.status}`);
  const rivalWrite = await call('PUT', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: rivalJwt,
    body: { externalCategoryName: 'Hijacked', categoryId },
  });
  check('rival cannot write one', rivalWrite.status === 403, `HTTP ${rivalWrite.status}`);
  const rivalDelete = await call(
    'DELETE',
    `/integrations/catalogue/mappings/${integrationId}?externalCategoryName=Grill%20Items`,
    { jwt: rivalJwt },
  );
  check('rival cannot delete one', rivalDelete.status === 403, `HTTP ${rivalDelete.status}`);
  const stillThere = await call('GET', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
  });
  check(
    "owner's mapping survived the attempts",
    (stillThere.body?.data ?? []).length === 1,
    `${(stillThere.body?.data ?? []).length} mappings`,
  );

  // 6 ─────────────────────────────────────────────────────────────────────────
  head('A POS may never invent a DrippleX category');
  const bogus = await call('PUT', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
    body: { externalCategoryName: 'Invented', categoryId: '00000000-0000-4000-8000-000000000000' },
  });
  check('mapping to a non-existent category refused', bogus.status === 404, `HTTP ${bogus.status}`);
  const unauth = await call('PUT', `/integrations/catalogue/mappings/${integrationId}`, {
    body: { externalCategoryName: 'NoAuth', categoryId },
  });
  check('unauthenticated write refused', unauth.status === 401, `HTTP ${unauth.status}`);

  // 7 ─────────────────────────────────────────────────────────────────────────
  head('Delete restores the unmapped behaviour');
  const del = await call(
    'DELETE',
    `/integrations/catalogue/mappings/${integrationId}?externalCategoryName=Grill%20Items`,
    { jwt: ownerJwt },
  );
  check('DELETE accepted', del.status === 200, `HTTP ${del.status}`);
  const state3 = await call('GET', `/integrations/catalogue/mappings/${integrationId}`, {
    jwt: ownerJwt,
  });
  check(
    'mapping is gone',
    (state3.body?.data ?? []).length === 0,
    `${(state3.body?.data ?? []).length} mappings`,
  );
  const delAgain = await call(
    'DELETE',
    `/integrations/catalogue/mappings/${integrationId}?externalCategoryName=Grill%20Items`,
    { jwt: ownerJwt },
  );
  check(
    'deleting a missing mapping is 404, not silent',
    delAgain.status === 404,
    `HTTP ${delAgain.status}`,
  );
  const afterDelete = await push('Grill Items', `map-post-delete-${Date.now()}`);
  check(
    'ingestion still succeeds unmapped',
    afterDelete.status === 200,
    `HTTP ${afterDelete.status}`,
  );

  hr();
  console.log(`RESULT  ${pass.length} passed, ${fail.length} failed`);
  if (fail.length) console.log('failed:', fail.join(' | '));
  hr();
  console.log('SKU', SKU);
  console.log('integrationId', integrationId);
};
run().catch((e) => {
  console.error('verifier error:', e);
  process.exit(1);
});
