const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const rootDir = __dirname;

const USERS_FILE = path.join(rootDir, 'data', 'users.json');
const DONATIONS_FILE = path.join(rootDir, 'data', 'donations.json');
const TOKENS_FILE = path.join(rootDir, 'data', 'tokens.json');

function ensureDataFiles() {
  fs.mkdirSync(path.join(rootDir, 'data'), { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
  if (!fs.existsSync(DONATIONS_FILE)) fs.writeFileSync(DONATIONS_FILE, '[]');
  if (!fs.existsSync(TOKENS_FILE)) fs.writeFileSync(TOKENS_FILE, '{}');

  const users = readJson(USERS_FILE);
  const adminExists = users.some((user) => user.email === 'admin@clothcare.org');
  if (!adminExists) {
    users.push({
      id: crypto.randomUUID(),
      name: 'ClothCare Admin',
      email: 'admin@clothcare.org',
      password: 'admin123',
      phone: '+1555000000',
      createdAt: new Date().toISOString(),
    });
    writeJson(USERS_FILE, users);
  }

  const donations = readJson(DONATIONS_FILE);
  if (!donations.length) {
    const demoDonations = [
      { id: 'CC1001', donorName: 'Rahul Sharma', email: 'rahul@example.com', phone: '+919876543210', type: 'Everyday clothes', quantity: 6, condition: 'Good', method: 'Pickup', notes: 'Mostly shirts and trousers.', date: new Date(Date.now() - 86400000).toISOString(), status: 'In review' },
      { id: 'CC1002', donorName: 'Priya Singh', email: 'priya@example.com', phone: '+919812345678', type: "Children's clothes", quantity: 4, condition: 'Excellent', method: 'Drop-off', notes: 'Children clothing in good condition.', date: new Date(Date.now() - 172800000).toISOString(), status: 'Matched' },
      { id: 'CC1003', donorName: 'Anita Patel', email: 'anita@example.com', phone: '+919812345670', type: 'Warm layers', quantity: 3, condition: 'Very good', method: 'Pickup', notes: 'Sweaters and cardigans.', date: new Date(Date.now() - 259200000).toISOString(), status: 'Completed' },
    ];
    writeJson(DONATIONS_FILE, demoDonations);
  }
}

function readJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getUserByEmail(email) {
  const users = readJson(USERS_FILE);
  return users.find((user) => user.email.toLowerCase() === String(email).toLowerCase());
}

function createToken(email) {
  const token = crypto.randomBytes(24).toString('hex');
  const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8') || '{}');
  tokens[token] = { email, createdAt: Date.now() };
  writeJson(TOKENS_FILE, tokens);
  return token;
}

function resolveToken(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '') || '';
  const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8') || '{}');
  return tokens[token] ? tokens[token].email : null;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

function sanitizeDonation(donation) {
  return {
    id: donation.id,
    donorName: donation.donorName,
    email: donation.email,
    phone: donation.phone,
    type: donation.type,
    quantity: donation.quantity,
    condition: donation.condition,
    method: donation.method,
    notes: donation.notes,
    date: donation.date,
    status: donation.status,
  };
}

function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
    res.end();
    return true;
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    parseBody(req)
      .then(({ name, email, password, phone }) => {
        if (!name || !email || !password || !phone) {
          return sendJson(res, 400, { error: 'Please fill in all required details.' });
        }
        const users = readJson(USERS_FILE);
        if (getUserByEmail(email)) {
          return sendJson(res, 409, { error: 'An account already exists for this email.' });
        }
        const user = {
          id: crypto.randomUUID(),
          name: String(name).trim(),
          email: String(email).trim().toLowerCase(),
          password: String(password),
          phone: String(phone).trim(),
          createdAt: new Date().toISOString(),
        };
        users.push(user);
        writeJson(USERS_FILE, users);
        sendJson(res, 201, { message: 'Account created successfully.', user: sanitizeUser(user) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    parseBody(req)
      .then(({ email, password }) => {
        const user = getUserByEmail(email);
        if (!user || user.password !== String(password)) {
          return sendJson(res, 401, { error: 'Invalid email or password.' });
        }
        const token = createToken(user.email);
        sendJson(res, 200, { message: 'Login successful.', token, user: sanitizeUser(user) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (url.pathname === '/api/donations' && req.method === 'POST') {
    parseBody(req)
      .then((payload) => {
        const { type, quantity, condition, donorName, email, phone, method, notes } = payload;
        if (!type || !quantity || !condition || !donorName || !email || !phone) {
          return sendJson(res, 400, { error: 'Please complete all required donation fields.' });
        }
        const donation = {
          id: `CC${String(Date.now()).slice(-5)}`,
          donorName: String(donorName).trim(),
          email: String(email).trim().toLowerCase(),
          phone: String(phone).trim(),
          type: String(type).trim(),
          quantity: Number(quantity),
          condition: String(condition).trim(),
          method: String(method || 'Pickup').trim(),
          notes: String(notes || '').trim(),
          date: new Date().toISOString(),
          status: 'In review',
        };
        const donations = readJson(DONATIONS_FILE);
        donations.unshift(donation);
        writeJson(DONATIONS_FILE, donations);
        sendJson(res, 201, { message: 'Donation saved successfully.', donation: sanitizeDonation(donation) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (url.pathname === '/api/donations' && req.method === 'GET') {
    const email = resolveToken(req);
    const donations = readJson(DONATIONS_FILE);
    const filtered = email ? donations.filter((item) => item.email === email.toLowerCase()) : donations;
    sendJson(res, 200, { donations: filtered.map(sanitizeDonation) });
    return true;
  }

  if (url.pathname === '/api/admin' && req.method === 'GET') {
    const email = resolveToken(req);
    if (!email) { sendJson(res, 401, { error: 'Admin access required.' }); return true; }
    const user = getUserByEmail(email);
    if (!user) { sendJson(res, 403, { error: 'User session not found.' }); return true; }
    const donations = readJson(DONATIONS_FILE);
    sendJson(res, 200, {
      user: sanitizeUser(user),
      donations: donations.map(sanitizeDonation),
      stats: {
        totalPieces: donations.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        pending: donations.filter((item) => item.status === 'In review').length,
        matched: donations.filter((item) => item.status === 'Matched').length,
        partners: 42,
      },
      isAdmin: String(user.email).toLowerCase() === 'admin@clothcare.org',
    });
    return true;
  }

  if (url.pathname === '/api/admin' && req.method === 'PUT') {
    const email = resolveToken(req);
    if (!email) { sendJson(res, 401, { error: 'Admin access required.' }); return true; }
    const user = getUserByEmail(email);
    if (!user || String(user.email).toLowerCase() !== 'admin@clothcare.org') {
      sendJson(res, 403, { error: 'You do not have admin access.' }); return true;
    }
    parseBody(req)
      .then(({ donationId, status }) => {
        if (!donationId || !status) return sendJson(res, 400, { error: 'Donation id and status are required.' });
        const donations = readJson(DONATIONS_FILE);
        const index = donations.findIndex((item) => item.id === donationId);
        if (index === -1) return sendJson(res, 404, { error: 'Donation not found.' });
        donations[index].status = String(status).trim();
        writeJson(DONATIONS_FILE, donations);
        sendJson(res, 200, { message: 'Donation status updated.', donation: sanitizeDonation(donations[index]) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  return false;
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  pathname = pathname.replace(/\/+/, '/');
  const safePath = path.normalize(path.join(rootDir, pathname));
  if (!safePath.startsWith(rootDir)) {
    res.writeHead(403); res.end('Forbidden');
    return true;
  }

  const asset = path.join(rootDir, pathname); 
  try {
    const file = fs.readFileSync(asset);
    const ext = path.extname(asset).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8' });
    res.end(file);
    return true;
  } catch (error) {
    return false;
  }
}

ensureDataFiles();

const server = http.createServer((req, res) => {
  if (handleApi(req, res)) return;
  if (serveStatic(req, res)) return;
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`ClothCare server running on http://localhost:${PORT}`);
});

module.exports = server;
