// GET /api/fires            -> detections for the last 2 days
// GET /api/fires?date=YYYY-MM-DD -> detections for that one day (demo replay)
// NASA FIRMS area API (VIIRS 375 m hot spots), cached 30 minutes.

import { loadLocalEnv } from './_env.js';

loadLocalEnv();

// NASA and the weather service can be slow; allow more than the short default.
export const config = { maxDuration: 30 };

const BBOX = '-98.6,29.6,-96.9,31.0'; // west,south,east,north: roughly Central Texas
const TTL_MS = 30 * 60 * 1000;
const cache = new Map();

export function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  if (!header.includes('latitude')) {
    throw new Error(`FIRMS: ${lines[0].slice(0, 120)}`); // e.g. "Invalid MAP_KEY."
  }
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  return lines.slice(1).filter(Boolean).map((line) => {
    const c = line.split(',');
    const time = String(c[col.acq_time] ?? '').padStart(4, '0');
    return {
      lat: Number(c[col.latitude]),
      lng: Number(c[col.longitude]),
      brightness: Number(c[col.bright_ti4 ?? col.brightness]),
      confidence: c[col.confidence], // VIIRS: l, n, h
      frp: Number(c[col.frp]),
      acquired: `${c[col.acq_date]}T${time.slice(0, 2)}:${time.slice(2)}Z`,
    };
  }).filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lng));
}

async function fetchFirms(source, days, date) {
  const key = process.env.FIRMS_MAP_KEY;
  const url =
    `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${BBOX}/${days}` +
    (date ? `/${date}` : '');
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`FIRMS HTTP ${r.status}`);
  return parseCsv(await r.text());
}

export default async function handler(req, res) {
  if (!process.env.FIRMS_MAP_KEY) {
    return res.status(500).json({ error: 'FIRMS_MAP_KEY not set' });
  }
  const date = req.query?.date;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  const days = date ? 1 : 2;
  const cacheKey = date || 'recent';
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return res.status(200).json({ ...hit.body, cached: true });
  }

  try {
    // NOAA-20 is the current VIIRS satellite; Suomi-NPP is the older one. Try
    // near-real-time first, then the archives (needed for older replay dates).
    const sources = date
      ? ['VIIRS_NOAA20_NRT', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_SP', 'VIIRS_SNPP_SP']
      : ['VIIRS_NOAA20_NRT', 'VIIRS_SNPP_NRT'];
    let source = sources[0];
    let fires = [];
    let lastError = null;
    for (const candidate of sources) {
      try {
        const found = await fetchFirms(candidate, days, date);
        source = candidate;
        fires = found;
        lastError = null;
        if (found.length) break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError && !fires.length) throw lastError;
    const body = { fires, source, date: date || null, fetched_at: new Date().toISOString() };
    cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
    return res.status(200).json(body);
  } catch (e) {
    console.error('fires failed', e);
    return res.status(502).json({ error: 'Could not load NASA fire data', detail: String(e.message || e) });
  }
}
