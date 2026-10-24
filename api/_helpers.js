/**
 * _helpers.js — shared HTTP helpers for Vercel API routes.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function setCors(res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
}

function sendJson(res, statusCode, payload) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function') {
    res.status(statusCode);
    if (typeof res.json === 'function') {
      return res.json(payload);
    }
    return res.end(JSON.stringify(payload));
  }
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'object') {
        return resolve(req.body);
      }
      if (typeof req.body === 'string') {
        if (!req.body.trim()) return resolve({});
        try {
          return resolve(JSON.parse(req.body));
        } catch {
          return reject(new Error('Invalid JSON body'));
        }
      }
    }
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) { req.destroy(); reject(new Error('Payload too large')); }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function getToken(req) {
  const auth = (req.headers && req.headers.authorization) || '';
  const bearer = auth.replace('Bearer ', '').trim();
  const query = (req.query || {}).token || '';
  return bearer || query || '';
}

module.exports = { sendJson, parseBody, getToken, setCors };
