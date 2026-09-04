#!/usr/bin/env node
/**
 * C-Phase Integration API Behavioral Acceptance Test Harness
 *
 * Traceable to: C-PLAN.md § Acceptance Criteria + Risk Mitigation
 *
 * This harness runs comprehensive HTTP tests against a live backend.
 * It does NOT mock responses or database state.
 *
 * Prerequisites:
 * - PostgreSQL running on localhost:5432 (dripplex_test db)
 * - Redis running on localhost:6379
 * - Backend running on localhost:3000
 * - Environment variables set: DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const assert = require('assert');

// ─────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000/api/v1';
// Must match backend's JWT_ACCESS_SECRET from .env
const JWT_SECRET = 'test-access-secret-with-at-least-32-chars-for-testing';

// Test merchants (different JWT identities)
const MERCHANT_A = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  sessionId: '550e8400-e29b-41d4-a716-446655440011',
};

const MERCHANT_B = {
  userId: '550e8400-e29b-41d4-a716-446655440002',
  sessionId: '550e8400-e29b-41d4-a716-446655440022',
};

// ─────────────────────────────────────────────────────────────────
// Test State & Results
// ─────────────────────────────────────────────────────────────────

const testResults = {
  PASS: [],
  FAIL: [],
  SKIPPED: [],
  NOT_EXECUTED: [],
};

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

function generateJWT(merchant) {
  return jwt.sign({
    sub: merchant.userId,
    sid: merchant.sessionId,
    role: 'merchant',
    portal: 'merchant',
    typ: 'access'
  }, JWT_SECRET, { expiresIn: '1h' });
}

function makeRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(BASE_URL + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
    };

    const req = http.request(urlObj, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            data: parsed,
            rawBody: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            data: { error: 'Failed to parse JSON' },
            rawBody: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function recordTest(testId, testName, passed, evidence = '') {
  const result = {
    testId,
    testName,
    status: passed ? 'PASS' : 'FAIL',
    evidence,
    timestamp: new Date().toISOString(),
  };

  if (passed) {
    testResults.PASS.push(result);
  } else {
    testResults.FAIL.push(result);
  }

  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testId}: ${testName}`);
  if (!passed && evidence) console.log(`   Evidence: ${evidence}`);
}

function skipTest(testId, testName, reason) {
  testResults.SKIPPED.push({
    testId,
    testName,
    reason,
    timestamp: new Date().toISOString(),
  });
  console.log(`⊘ ${testId}: ${testName} [SKIPPED: ${reason}]`);
}

// ─────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('C-Phase Integration API — Acceptance Test Suite v1');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const tokenA = generateJWT(MERCHANT_A);
  const tokenB = generateJWT(MERCHANT_B);

  let integrationIdA1 = null;
  let integrationIdA2 = null;
  let integrationIdB1 = null;

  // ───────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 1: POST /integrations returns 201 with credentials
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Acceptance Criterion 1: Create Integration with API Key\n');

  try {
    const createRes = await makeRequest('POST', '/integrations', tokenA, {
      vendorName: 'Square POS',
      vendorVersion: '1.0.0',
      merchantContactEmail: 'merchant@example.com',
      webhookUrl: 'https://example.com/webhooks',
    });

    const criterion1Pass =
      createRes.status === 201 &&
      createRes.data.integrationId &&
      createRes.data.apiKey &&
      createRes.data.apiKey.startsWith('dpx_integration_');

    integrationIdA1 = createRes.data.integrationId;

    recordTest(
      'C1.1',
      'POST /integrations returns 201 Created',
      createRes.status === 201,
      `Status: ${createRes.status}`
    );

    recordTest(
      'C1.2',
      'Response includes integrationId UUID',
      !!integrationIdA1 && integrationIdA1.match(/^[0-9a-f-]{36}$/i),
      `IntegrationId: ${integrationIdA1}`
    );

    recordTest(
      'C1.3',
      'Response includes apiKey with dpx_integration_ prefix',
      createRes.data.apiKey && createRes.data.apiKey.startsWith('dpx_integration_'),
      `Key prefix: ${createRes.data.apiKey?.substring(0, 20)}...`
    );

    recordTest(
      'C1.4',
      'Response includes credentials array (at least one)',
      Array.isArray(createRes.data.credentials) && createRes.data.credentials.length > 0,
      `Credentials count: ${createRes.data.credentials?.length || 0}`
    );

  } catch (err) {
    recordTest('C1.1', 'POST /integrations returns 201 Created', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 2: Credentials returned only once
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Acceptance Criterion 2: Credential Masking on GET\n');

  try {
    // First GET - should return masked credentials
    const getRes = await makeRequest('GET', `/integrations/${integrationIdA1}`, tokenA);

    const hasCredentials =
      Array.isArray(getRes.data.credentials) &&
      getRes.data.credentials.length > 0;

    const firstCred = getRes.data.credentials?.[0];
    const isMasked =
      firstCred &&
      typeof firstCred.publicSuffix === 'string' &&
      !firstCred.apiKey && // API key should NOT be in response
      firstCred.publicSuffix.startsWith('*'); // Masked with asterisks

    recordTest(
      'C2.1',
      'GET /integrations/{id} returns 200 with credentials',
      getRes.status === 200 && hasCredentials,
      `Status: ${getRes.status}, Credentials: ${getRes.data.credentials?.length}`
    );

    recordTest(
      'C2.2',
      'Credential response includes publicSuffix (masked, not plaintext)',
      isMasked,
      `Suffix: ${firstCred?.publicSuffix}, Has apiKey: ${!!firstCred?.apiKey}`
    );

    recordTest(
      'C2.3',
      'Plaintext API key NOT included in GET response',
      !firstCred?.apiKey && !getRes.data.apiKey,
      'No apiKey field in response'
    );

  } catch (err) {
    recordTest('C2.1', 'GET /integrations/{id} returns 200 with credentials', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 3: List returns only authenticated merchant's integrations
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Acceptance Criterion 3: Merchant-Scoped List\n');

  try {
    // Create another integration for merchant A
    const create2Res = await makeRequest('POST', '/integrations', tokenA, {
      vendorName: 'Toast POS',
    });
    integrationIdA2 = create2Res.data.integrationId;

    // Create one for merchant B
    const createBRes = await makeRequest('POST', '/integrations', tokenB, {
      vendorName: 'Toast POS - Merchant B',
    });
    integrationIdB1 = createBRes.data.integrationId;

    // List as merchant A
    const listARes = await makeRequest('GET', '/integrations', tokenA);

    // List as merchant B
    const listBRes = await makeRequest('GET', '/integrations', tokenB);

    const merchantAIntegrations = listARes.data.integrations || [];
    const merchantBIntegrations = listBRes.data.integrations || [];

    recordTest(
      'C3.1',
      'GET /integrations returns 200 with list',
      listARes.status === 200 && Array.isArray(merchantAIntegrations),
      `Count for Merchant A: ${merchantAIntegrations.length}`
    );

    recordTest(
      'C3.2',
      'Merchant A sees only own integrations (not Merchant B\'s)',
      merchantAIntegrations.every(i => i.integrationId === integrationIdA1 || i.integrationId === integrationIdA2) &&
      !merchantAIntegrations.some(i => i.integrationId === integrationIdB1),
      `Merchant A: ${merchantAIntegrations.length} integrations, Merchant B: ${merchantBIntegrations.length}`
    );

    recordTest(
      'C3.3',
      'Merchant B sees only own integrations',
      merchantBIntegrations.every(i => i.integrationId === integrationIdB1) &&
      !merchantBIntegrations.some(i => i.integrationId === integrationIdA1 || i.integrationId === integrationIdA2),
      `Merchant B sees ${merchantBIntegrations.length} integration(s)`
    );

  } catch (err) {
    recordTest('C3.1', 'GET /integrations returns 200 with list', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 4: GET returns full metadata
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Acceptance Criterion 4: Full Metadata Response\n');

  try {
    const getRes = await makeRequest('GET', `/integrations/${integrationIdA1}`, tokenA);

    const hasAllFields =
      getRes.data.integrationId &&
      getRes.data.vendorName &&
      getRes.data.vendorVersion &&
      getRes.data.status &&
      getRes.data.createdAt &&
      getRes.data.updatedAt;

    recordTest(
      'C4.1',
      'Response includes all required metadata fields',
      hasAllFields,
      `Fields: integrationId=${!!getRes.data.integrationId}, vendorName=${!!getRes.data.vendorName}, status=${getRes.data.status}`
    );

    recordTest(
      'C4.2',
      'Status field is valid (ACTIVE, ARCHIVED, etc.)',
      ['ACTIVE', 'ARCHIVED', 'INACTIVE'].includes(getRes.data.status),
      `Status: ${getRes.data.status}`
    );

  } catch (err) {
    recordTest('C4.1', 'Response includes all required metadata fields', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 5: PUT updates metadata
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Acceptance Criterion 5: Update Integration\n');

  try {
    const updateRes = await makeRequest('PUT', `/integrations/${integrationIdA1}`, tokenA, {
      vendorName: 'Updated Square POS',
      webhookUrl: 'https://updated.example.com/webhooks',
    });

    const isUpdated =
      updateRes.status === 200 &&
      updateRes.data.vendorName === 'Updated Square POS';

    recordTest(
      'C5.1',
      'PUT /integrations/{id} returns 200 OK',
      updateRes.status === 200,
      `Status: ${updateRes.status}`
    );

    recordTest(
      'C5.2',
      'Updated fields are reflected in response',
      isUpdated,
      `vendorName: ${updateRes.data.vendorName}`
    );

    // Verify update persisted
    const getRes = await makeRequest('GET', `/integrations/${integrationIdA1}`, tokenA);
    recordTest(
      'C5.3',
      'Update persists across GET request',
      getRes.data.vendorName === 'Updated Square POS',
      `Retrieved vendorName: ${getRes.data.vendorName}`
    );

  } catch (err) {
    recordTest('C5.1', 'PUT /integrations/{id} returns 200 OK', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 6: DELETE soft-deletes and excludes from list
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Acceptance Criterion 6: Soft-Delete (Archive)\n');

  try {
    // Delete integration A2
    const deleteRes = await makeRequest('DELETE', `/integrations/${integrationIdA2}`, tokenA);

    recordTest(
      'C6.1',
      'DELETE /integrations/{id} returns 204 No Content',
      deleteRes.status === 204,
      `Status: ${deleteRes.status}`
    );

    // Verify deleted integration excluded from list
    const listRes = await makeRequest('GET', '/integrations', tokenA);
    const integrations = listRes.data.integrations || [];
    const isExcluded = !integrations.some(i => i.integrationId === integrationIdA2);

    recordTest(
      'C6.2',
      'Deleted integration excluded from GET /integrations list',
      isExcluded,
      `Found in list: ${!isExcluded}`
    );

    // Verify GET returns 404 for deleted integration
    const getDeletedRes = await makeRequest('GET', `/integrations/${integrationIdA2}`, tokenA);

    recordTest(
      'C6.3',
      'GET /integrations/{deleted-id} returns 404 Not Found',
      getDeletedRes.status === 404,
      `Status: ${getDeletedRes.status}`
    );

  } catch (err) {
    recordTest('C6.1', 'DELETE /integrations/{id} returns 204 No Content', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // ACCEPTANCE CRITERIA 7: Test endpoint (SSRF + connectivity)
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Acceptance Criterion 7: Test Webhook Connectivity\n');

  try {
    // Test with valid webhook URL
    const testRes = await makeRequest('GET', `/integrations/${integrationIdA1}/test`, tokenA);

    recordTest(
      'C7.1',
      'GET /integrations/{id}/test returns 200 OK',
      testRes.status === 200,
      `Status: ${testRes.status}`
    );

    const hasStatus = ['SUCCESS', 'FAILED', 'UNCONFIGURED'].includes(testRes.data.status);
    recordTest(
      'C7.2',
      'Response includes valid status (SUCCESS|FAILED|UNCONFIGURED)',
      hasStatus,
      `Status: ${testRes.data.status}`
    );

    recordTest(
      'C7.3',
      'Response includes testedAt timestamp',
      testRes.data.testedAt && new Date(testRes.data.testedAt).getTime() > 0,
      `testedAt: ${testRes.data.testedAt}`
    );

  } catch (err) {
    recordTest('C7.1', 'GET /integrations/{id}/test returns 200 OK', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // RISK MITIGATION: CRIT-006 (Merchant Isolation)
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Risk Mitigation: CRIT-006 — Merchant Isolation\n');

  try {
    // Merchant B attempts to access Merchant A's integration
    const getRes = await makeRequest('GET', `/integrations/${integrationIdA1}`, tokenB);

    recordTest(
      'CRIT-006.1',
      'Cross-merchant GET returns 403 Forbidden (not 404)',
      getRes.status === 403,
      `Status: ${getRes.status}`
    );

    // Attempt to update Merchant A's integration as Merchant B
    const updateRes = await makeRequest('PUT', `/integrations/${integrationIdA1}`, tokenB, {
      vendorName: 'Hacked',
    });

    recordTest(
      'CRIT-006.2',
      'Cross-merchant PUT returns 403 Forbidden',
      updateRes.status === 403,
      `Status: ${updateRes.status}`
    );

    // Attempt to delete Merchant A's integration as Merchant B
    const deleteRes = await makeRequest('DELETE', `/integrations/${integrationIdA1}`, tokenB);

    recordTest(
      'CRIT-006.3',
      'Cross-merchant DELETE returns 403 Forbidden',
      deleteRes.status === 403,
      `Status: ${deleteRes.status}`
    );

  } catch (err) {
    recordTest('CRIT-006.1', 'Cross-merchant GET returns 403 Forbidden', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // SSRF PROTECTION: Webhook URL validation
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ SSRF Protection Tests\n');

  const ssrfTests = [
    { url: 'http://127.0.0.1:8080/webhook', name: 'Loopback IPv4' },
    { url: 'http://[::1]/webhook', name: 'Loopback IPv6' },
    { url: 'http://192.168.1.1/webhook', name: 'Private IP (RFC1918)' },
    { url: 'http://10.0.0.1/webhook', name: 'Private IP (10.0.0.0/8)' },
    { url: 'http://172.16.0.1/webhook', name: 'Private IP (172.16.0.0/12)' },
    { url: 'http://169.254.169.254/webhook', name: 'Metadata Service (AWS)' },
    { url: 'http://[fe80::1]/webhook', name: 'Link-local IPv6' },
    { url: 'https://example.com/webhook', name: 'Valid HTTPS domain' },
  ];

  for (const test of ssrfTests) {
    try {
      const res = await makeRequest('POST', '/integrations', tokenA, {
        vendorName: `SSRF Test: ${test.name}`,
        webhookUrl: test.url,
      });

      const isBlocked = res.status === 400;
      const shouldBlock = !test.url.startsWith('https://example.com');

      recordTest(
        `SSRF.${test.name.replace(/\s+/g, '.')}`,
        `SSRF: ${test.name} ${shouldBlock ? 'blocked' : 'allowed'}`,
        isBlocked === shouldBlock,
        `Status: ${res.status}, Expected: ${shouldBlock ? '400' : '201'}`
      );
    } catch (err) {
      recordTest(
        `SSRF.${test.name.replace(/\s+/g, '.')}`,
        `SSRF: ${test.name} ${test.url.startsWith('https://example.com') ? 'allowed' : 'blocked'}`,
        false,
        err.message
      );
    }
  }

  // ───────────────────────────────────────────────────────────────
  // VALIDATION TESTS
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Input Validation Tests\n');

  const validationTests = [
    {
      name: 'Missing required vendorName',
      body: { vendorVersion: '1.0' },
      expectStatus: 400,
    },
    {
      name: 'Empty vendorName',
      body: { vendorName: '' },
      expectStatus: 400,
    },
    {
      name: 'Invalid email format',
      body: { vendorName: 'Test', merchantContactEmail: 'not-an-email' },
      expectStatus: 400,
    },
    {
      name: 'Invalid URL (not HTTPS in production)',
      body: { vendorName: 'Test', webhookUrl: 'http://example.com' },
      expectStatus: 400,
    },
  ];

  for (const test of validationTests) {
    try {
      const res = await makeRequest('POST', '/integrations', tokenA, test.body);
      recordTest(
        `VAL.${test.name.replace(/\s+/g, '.')}`,
        `Validation: ${test.name}`,
        res.status === test.expectStatus,
        `Status: ${res.status}, Expected: ${test.expectStatus}`
      );
    } catch (err) {
      recordTest(
        `VAL.${test.name.replace(/\s+/g, '.')}`,
        `Validation: ${test.name}`,
        false,
        err.message
      );
    }
  }

  // ───────────────────────────────────────────────────────────────
  // AUTHENTICATION TESTS
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Authentication Tests\n');

  try {
    // Missing token
    const noTokenRes = await makeRequest('GET', '/integrations', null);
    recordTest(
      'AUTH.1',
      'Request without token returns 401 Unauthorized',
      noTokenRes.status === 401,
      `Status: ${noTokenRes.status}`
    );

    // Invalid token
    const invalidTokenRes = await makeRequest('GET', '/integrations', 'Bearer invalid-token');
    recordTest(
      'AUTH.2',
      'Request with invalid token returns 401 Unauthorized',
      invalidTokenRes.status === 401,
      `Status: ${invalidTokenRes.status}`
    );

  } catch (err) {
    recordTest('AUTH.1', 'Request without token returns 401 Unauthorized', false, err.message);
  }

  // ───────────────────────────────────────────────────────────────
  // IDEMPOTENCY RESOLUTION
  // ───────────────────────────────────────────────────────────────
  console.log('\n▶ Idempotency Status\n');
  skipTest(
    'IDEM.1',
    'Idempotency-Key header support',
    'Out of scope for C phase per C-PLAN.md line 991: "C does NOT use Idempotency-Key for CRUD operations"'
  );

  // ───────────────────────────────────────────────────────────────
  // Summary Report
  // ───────────────────────────────────────────────────────────────
  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log('TEST SUITE SUMMARY');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const total = testResults.PASS.length + testResults.FAIL.length + testResults.SKIPPED.length;

  console.log(`TOTAL:        ${total}`);
  console.log(`PASS:         ${testResults.PASS.length}`);
  console.log(`FAIL:         ${testResults.FAIL.length}`);
  console.log(`SKIPPED:      ${testResults.SKIPPED.length}`);
  console.log(`NOT EXECUTED: ${testResults.NOT_EXECUTED.length}\n`);

  if (testResults.FAIL.length > 0) {
    console.log('FAILED TESTS:');
    testResults.FAIL.forEach(t => {
      console.log(`  - ${t.testId}: ${t.testName}`);
      console.log(`    Evidence: ${t.evidence}`);
    });
    console.log();
  }

  if (testResults.SKIPPED.length > 0) {
    console.log('SKIPPED TESTS:');
    testResults.SKIPPED.forEach(t => {
      console.log(`  - ${t.testId}: ${t.testName}`);
      console.log(`    Reason: ${t.reason}`);
    });
    console.log();
  }

  console.log('═════════════════════════════════════════════════════════════════');
  const passed = testResults.PASS.length === total - testResults.SKIPPED.length;
  if (passed) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log('❌ SOME TESTS FAILED');
  }
  console.log('═════════════════════════════════════════════════════════════════\n');

  // Exit with status code
  process.exit(testResults.FAIL.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
