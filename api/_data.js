/**
 * _data.js — shared data helpers for Vercel API routes.
 *
 * Vercel's serverless environment has a read-only root filesystem.
 * Writes must go to /tmp. On the first access of each file we copy
 * the committed seed file from data/ into /tmp so the server has a
 * starting dataset. Subsequent reads and writes use /tmp.
 *
 * NOTE: /tmp is ephemeral — it is reset on every cold start (new
 * function instance). For production persistence you should swap
 * these helpers for a proper database (e.g. Vercel Postgres, PlanetScale,
 * MongoDB Atlas). The DATA_DIR environment variable lets you override the
 * storage directory for local development (where the filesystem is writable).
 */

const fs   = require('fs');
const path = require('path');

// In local dev the server.js file already handles its own data directory,
// so DATA_DIR is not set. In Vercel production we write to /tmp.
const isVercel = process.env.VERCEL === '1';

// The directory from which seed data is loaded (always the committed files).
const SEED_DIR = path.join(__dirname, '..', 'data');

// The directory to which live data is written.
const LIVE_DIR = isVercel
  ? '/tmp/clothcare-data'
  : path.join(__dirname, '..', 'data');

function ensureDir() {
  fs.mkdirSync(LIVE_DIR, { recursive: true });
}

/**
 * Returns the writable path for a given filename.
 * On Vercel, copies the seed file to /tmp on first access.
 */
function dataPath(filename) {
  ensureDir();
  const live = path.join(LIVE_DIR, filename);
  if (isVercel && !fs.existsSync(live)) {
    const seed = path.join(SEED_DIR, filename);
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, live);
    } else {
      // Write a sensible default so the file always exists.
      const defaults = { 'users.json': '[]', 'donations.json': '[]', 'tokens.json': '{}' };
      fs.writeFileSync(live, defaults[filename] ?? '[]');
    }
  }
  return live;
}

function readJson(filename) {
  const file = dataPath(filename);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeJson(filename, data) {
  const file = dataPath(filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = { readJson, writeJson, dataPath, LIVE_DIR };
