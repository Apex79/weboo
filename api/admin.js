/**
 * /api/admin — GET: admin dashboard data; PUT: update a donation status.
 * Vercel serverless function.
 */

const fs   = require('fs');
const { readJson, writeJson, dataPath } = require('./_data');
const { sendJson, parseBody, getToken } = require('./_helpers');

const ADMIN_EMAIL = 'admin@clothcare.org';

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, createdAt: user.createdAt };
}

function sanitizeDonation(d) {
  return { id: d.id, donorName: d.donorName, email: d.email, phone: d.phone,
           type: d.type, quantity: d.quantity, condition: d.condition,
           method: d.method, notes: d.notes, date: d.date, status: d.status };
}

function resolveEmailFromToken(req) {
  const rawToken = getToken(req);
  if (!rawToken) return null;
  const tokensFile = dataPath('tokens.json');
  try {
    const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf8') || '{}');
    return tokens[rawToken] ? tokens[rawToken].email : null;
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(204).end();
  }

  const email = resolveEmailFromToken(req);

  // GET — return admin dashboard data
  if (req.method === 'GET') {
    if (!email) return sendJson(res, 401, { error: 'Admin access required.' });

    const users = readJson('users.json');
    const user  = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return sendJson(res, 403, { error: 'User session not found.' });

    const donations = readJson('donations.json');
    return sendJson(res, 200, {
      user:      sanitizeUser(user),
      donations: donations.map(sanitizeDonation),
      stats: {
        totalPieces: donations.reduce((sum, d) => sum + Number(d.quantity || 0), 0),
        pending:     donations.filter((d) => d.status === 'In review').length,
        matched:     donations.filter((d) => d.status === 'Matched').length,
        partners:    42,
      },
      isAdmin: user.email.toLowerCase() === ADMIN_EMAIL,
    });
  }

  // PUT — update donation status
  if (req.method === 'PUT') {
    if (!email) return sendJson(res, 401, { error: 'Admin access required.' });

    const users = readJson('users.json');
    const user  = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.email.toLowerCase() !== ADMIN_EMAIL) {
      return sendJson(res, 403, { error: 'You do not have admin access.' });
    }

    try {
      const { donationId, status } = await parseBody(req);
      if (!donationId || !status) {
        return sendJson(res, 400, { error: 'Donation id and status are required.' });
      }

      const donations = readJson('donations.json');
      const index     = donations.findIndex((d) => d.id === donationId);
      if (index === -1) return sendJson(res, 404, { error: 'Donation not found.' });

      donations[index].status = String(status).trim();
      writeJson('donations.json', donations);

      return sendJson(res, 200, { message: 'Donation status updated.', donation: sanitizeDonation(donations[index]) });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed.' });
};
