/**
 * /api/register — POST: create a new user account.
 * Vercel serverless function.
 */

const crypto  = require('crypto');
const { readJson, writeJson } = require('./_data');
const { sendJson, parseBody } = require('./_helpers');

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt };
}

module.exports = async function handler(req, res) {
  // CORS pre-flight
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
    const { name, email, password, phone } = await parseBody(req);

    if (!name || !email || !password || !phone) {
      return sendJson(res, 400, { error: 'Please fill in all required details.' });
    }

    const users = readJson('users.json');
    const exists = users.some((u) => u.email.toLowerCase() === String(email).toLowerCase());
    if (exists) {
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
    writeJson('users.json', users);

    return sendJson(res, 201, { message: 'Account created successfully.', user: sanitizeUser(user) });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
};
