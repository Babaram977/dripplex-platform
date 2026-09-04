const jwt = require('jsonwebtoken');
const http = require('http');

const BASE_URL = 'http://localhost:3000/api/v1';
const JWT_ACCESS_SECRET = 'test-access-secret-with-at-least-32-chars';
const MERCHANT_A = {
  userId: '550e8400-e29b-41d4-a716-446655440001',
  sessionId: '550e8400-e29b-41d4-a716-446655440011',
};

function generateJWT(merchant) {
  return jwt.sign({
    sub: merchant.userId,
    sid: merchant.sessionId,
    role: 'merchant',
    portal: 'merchant',
    typ: 'access'
  }, JWT_ACCESS_SECRET, { expiresIn: '1h' });
}

async function makeRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(BASE_URL + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };

    const req = http.request(urlObj, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  const tokenA = generateJWT(MERCHANT_A);
  
  console.log('\n[TEST] Creating integration...');
  const createRes = await makeRequest('POST', '/integrations', tokenA, { vendorName: 'Quick Test' });
  console.log(`[RESULT] CREATE: status=${createRes.status}`);
  if (createRes.status === 201) {
    console.log(`[RESULT] integrationId=${createRes.data.integrationId}`);
    console.log(`[RESULT] credentials in CREATE response: ${createRes.data.credentials?.length} items`);
    
    console.log('\n[TEST] Getting integration...');
    const getRes = await makeRequest('GET', `/integrations/${createRes.data.integrationId}`, tokenA);
    console.log(`[RESULT] GET: status=${getRes.status}`);
    console.log(`[RESULT] credentials in GET response: ${getRes.data.credentials?.length} items`);
    if (getRes.data.credentials?.length > 0) {
      console.log(`[RESULT] First credential: ${JSON.stringify(getRes.data.credentials[0])}`);
    }
  }
}

test().catch(console.error);
