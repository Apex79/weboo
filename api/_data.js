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

// In local dev the server.js file already handles its own data directory.
// In Vercel production we write to /tmp.
const isVercel = process.env.VERCEL === '1';

// Direct require guarantees Vercel's bundler includes the seed files in the deployment artifact.
let seedUsers = [];
let seedDonations = [];
try { seedUsers = require('../data/users.json'); } catch { seedUsers = []; }
try { seedDonations = require('../data/donations.json'); } catch { seedDonations = []; }

// The directory to which live data is written.
const LIVE_DIR = isVercel
  ? '/tmp/clothcare-data'
  : path.join(__dirname, '..', 'data');

function ensureDir() {
  try {
    fs.mkdirSync(LIVE_DIR, { recursive: true });
  } catch (_) {}
}

function getInitialData(filename) {
  if (filename === 'users.json') return seedUsers;
  if (filename === 'donations.json') return seedDonations;
  if (filename === 'tokens.json') return {};
  return [];
}

/**
 * Returns the writable path for a given filename.
 * On Vercel, initializes the seed file in /tmp on first access.
 */
function dataPath(filename) {
  ensureDir();
  const live = path.join(LIVE_DIR, filename);
  if (isVercel && !fs.existsSync(live)) {
    try {
      const initial = getInitialData(filename);
      fs.writeFileSync(live, JSON.stringify(initial, null, 2));
    } catch (_) {}
  }
  return live;
}

function readJson(filename) {
  const fallback = getInitialData(filename);
  try {
    const file = dataPath(filename);
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(filename, data) {
  try {
    const file = dataPath(filename);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn(`Failed writing ${filename}:`, err.message);
  }
}

module.exports = { readJson, writeJson, dataPath, LIVE_DIR };
