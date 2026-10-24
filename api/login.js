/**
 * /api/login — POST: authenticate a user and return a session token.
 * Vercel serverless function.
 */

const crypto  = require('crypto');
const fs      = require('fs');
const { readJson, writeJson, dataPath } = require('./_data');
const { sendJson, parseBody }           = require('./_helpers');

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt };
}

function createToken(email) {
  const token = crypto.randomBytes(24).toString('hex');
  const tokensFile = dataPath('tokens.json');
  let tokens = {};
  try { tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8') || '{}'); } catch { tokens = {}; }
  tokens[token] = { email, createdAt: Date.now() };
  writeJson('tokens.json', tokens);
  return token;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const { email, password } = await parseBody(req);
    const users = readJson('users.json');
    const user  = users.find((u) => u.email.toLowerCase() === String(email || '').toLowerCase());

    if (!user || user.password !== String(password)) {
      return sendJson(res, 401, { error: 'Invalid email or password.' });
    }

    const token = createToken(user.email);
    return sendJson(res, 200, { message: 'Login successful.', token, user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
};
