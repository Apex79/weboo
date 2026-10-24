/**
 * /api/donations — GET: list donations; POST: submit a new donation.
 * Vercel serverless function.
 */

const fs   = require('fs');
const { readJson, writeJson, dataPath } = require('./_data');
const { sendJson, parseBody, getToken } = require('./_helpers');

function sanitizeDonation(d) {
  return { id: d.id, donorName: d.donorName, email: d.email, phone: d.phone,
           type: d.type, quantity: d.quantity, condition: d.condition,
           method: d.method, notes: d.notes, date: d.date, status: d.status };
}

function resolveEmailFromToken(req) {
  const rawToken = getToken(req);
  if (!rawToken) return null;
  const tokens = readJson('tokens.json') || {};
  return tokens[rawToken] ? tokens[rawToken].email : null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.status(204).end();
  }

  // GET — return donations (filtered by token if present)
  if (req.method === 'GET') {
    const email     = resolveEmailFromToken(req);
    const donations = readJson('donations.json');
    const filtered  = email
      ? donations.filter((d) => d.email === email.toLowerCase())
      : donations;
    return sendJson(res, 200, { donations: filtered.map(sanitizeDonation) });
  }

  // POST — submit a new donation
  if (req.method === 'POST') {
    try {
      const { type, quantity, condition, donorName, email, phone, method, notes } = await parseBody(req);

      if (!type || !quantity || !condition || !donorName || !email || !phone) {
        return sendJson(res, 400, { error: 'Please complete all required donation fields.' });
      }

      const donation = {
        id:        `CC${String(Date.now()).slice(-5)}`,
        donorName: String(donorName).trim(),
        email:     String(email).trim().toLowerCase(),
        phone:     String(phone).trim(),
        type:      String(type).trim(),
        quantity:  Number(quantity),
        condition: String(condition).trim(),
        method:    String(method || 'Pickup').trim(),
        notes:     String(notes || '').trim(),
        date:      new Date().toISOString(),
        status:    'In review',
      };

      const donations = readJson('donations.json');
      donations.unshift(donation);
      writeJson('donations.json', donations);

      return sendJson(res, 201, { message: 'Donation saved successfully.', donation: sanitizeDonation(donation) });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed.' });
};
