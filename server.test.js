/**
 * server.test.js — integration tests for ClothCare backend API.
 *
 * Starts the server on PORT 4321 before tests, then closes it after.
 * Run with: npm test
 */

const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');

const PORT   = Number(process.env.PORT) || 4321;

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let server;

function startServer() {
  return new Promise((resolve) => {
    // Clear the require cache so each test run gets a fresh server instance.
    Object.keys(require.cache).forEach((k) => {
      if (k.includes('server.js')) delete require.cache[k];
    });
    server = require('./server');
    // server.js already calls listen(); wait for it to be ready.
    if (server.listening) return resolve();
    server.once('listening', resolve);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!server || !server.listening) return resolve();
    server.close(resolve);
  });
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path: pathname, method: options.method || 'GET', headers: options.headers || {} },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('backend API routes', async (t) => {
  await startServer();

  t.after(stopServer);

  const email = `test-${Date.now()}@example.com`;

  await t.test('POST /api/register — creates a user', async () => {
    const res = await request('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email, password: 'secret123', phone: '+1234567890' }),
    });
    assert.equal(res.statusCode, 201, `expected 201, got ${res.statusCode}: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.equal(data.user.email, email);
  });

  await t.test('POST /api/register — duplicate returns 409', async () => {
    const res = await request('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email, password: 'secret123', phone: '+1234567890' }),
    });
    assert.equal(res.statusCode, 409, `expected 409, got ${res.statusCode}: ${res.body}`);
  });

  let token;

  await t.test('POST /api/login — returns token', async () => {
    const res = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'secret123' }),
    });
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.ok(data.token, 'should return a token');
    token = data.token;
  });

  await t.test('POST /api/login — wrong password returns 401', async () => {
    const res = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrongpassword' }),
    });
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}: ${res.body}`);
  });

  let donationId;

  await t.test('POST /api/donations — creates a donation', async () => {
    const res = await request('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'Warm layers', quantity: 3, condition: 'Good',
        donorName: 'Test User', email, phone: '+1234567890',
      }),
    });
    assert.equal(res.statusCode, 201, `expected 201, got ${res.statusCode}: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.ok(data.donation.id, 'should return a donation id');
    donationId = data.donation.id;
  });

  await t.test('POST /api/donations — missing fields returns 400', async () => {
    const res = await request('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'Warm layers' }),
    });
    assert.equal(res.statusCode, 400, `expected 400, got ${res.statusCode}: ${res.body}`);
  });

  await t.test('GET /api/donations — returns donations array with JSON content-type', async () => {
    const res = await request('/api/donations?' + new URLSearchParams({ token }));
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.body}`);
    const ct = res.headers['content-type'] || '';
    assert.ok(ct.includes('application/json'), `Content-Type must be JSON, got: ${ct}`);
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data.donations), 'should return a donations array');
  });

  await t.test('GET /api/admin — without token returns 401', async () => {
    const res = await request('/api/admin');
    assert.equal(res.statusCode, 401, `expected 401, got ${res.statusCode}: ${res.body}`);
  });

  await t.test('GET /api/admin — with non-admin token returns 200', async () => {
    const res = await request('/api/admin?' + new URLSearchParams({ token }));
    assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.ok(Array.isArray(data.donations), 'should return donations array');
    assert.equal(data.isAdmin, false, 'test user should not be admin');
  });
});
