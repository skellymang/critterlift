// GET /api/alerts?lat=30.27&lng=-97.74
// Active weather alerts for a point, from the U.S. National Weather Service
// (api.weather.gov: free, no key). We keep only the kinds that put wildlife at
// risk: freezes and winter storms, extreme heat, floods, severe storms and
// fire weather. Cached 10 minutes.

import { loadLocalEnv } from './_env.js';

loadLocalEnv();

// NASA and the weather service can be slow; allow more than the short default.
export const config = { maxDuration: 30 };

const TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const UA = 'WildlifeHelp/0.1 (RiverHacks student project)';

// NWS event name -> our hazard category
export function categorize(event = '') {
  const e = event.toLowerCase();
  if (/red flag|fire weather|fire warning|extreme fire/.test(e)) return 'fire';
  if (/freez|frost|winter|ice storm|blizzard|snow|sleet|cold|wind chill/.test(e)) return 'cold';
  if (/heat/.test(e)) return 'heat';
  if (/flood|hydrologic/.test(e)) return 'flood';
  if (/tornado|thunderstorm|hurricane|tropical|high wind|wind advisory|extreme wind|hail|dust storm/.test(e)) return 'storm';
  return null;
}

export function shape(feature) {
  const p = feature.properties || {};
  const category = categorize(p.event);
  if (!category) return null;
  return {
    id: p.id || feature.id,
    event: p.event,
    category,
    severity: p.severity || 'Unknown',
    headline: p.headline || p.event,
    area: p.areaDesc || '',
    starts: p.onset || p.effective || null,
    ends: p.ends || p.expires || null,
    // Many alerts are issued for whole counties and carry no outline.
    geometry: feature.geometry || null,
  };
}

// Most alerts (freezes, heat, fire weather) are issued for whole counties or
// forecast zones and carry no outline of their own. For those we fetch the
// outline of each affected zone so the alert can be drawn on the map.
const zoneCache = new Map();
const MAX_ZONES = 40;
const MAX_RING_POINTS = 120;

const thin = (ring) => {
  if (ring.length <= MAX_RING_POINTS) return ring.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
  const step = Math.ceil(ring.length / MAX_RING_POINTS);
  const out = ring.filter((_, i) => i % step === 0).map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
  out.push(out[0]); // close the ring again
  return out;
};
export function simplify(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') return { type: 'Polygon', coordinates: geometry.coordinates.map(thin) };
  if (geometry.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geometry.coordinates.map((poly) => poly.map(thin)) };
  }
  if (geometry.type === 'GeometryCollection') {
    return { type: 'GeometryCollection', geometries: geometry.geometries.map(simplify).filter(Boolean) };
  }
  return null;
}

async function zoneOutline(url) {
  if (typeof url !== 'string' || !url.startsWith('https://api.weather.gov/zones/')) return null;
  if (zoneCache.has(url)) return zoneCache.get(url);
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return null;
  const outline = simplify((await r.json()).geometry);
  zoneCache.set(url, outline);
  return outline;
}

export async function withArea(feature) {
  const alert = shape(feature);
  if (!alert) return null;
  if (alert.geometry) {
    alert.geometry = simplify(alert.geometry) || alert.geometry;
    return alert;
  }
  const zones = (feature.properties?.affectedZones || []).slice(0, MAX_ZONES);
  const outlines = (await Promise.all(zones.map((z) => zoneOutline(z).catch(() => null)))).filter(Boolean);
  if (outlines.length) alert.geometry = { type: 'GeometryCollection', geometries: outlines };
  return alert;
}

export default async function handler(req, res) {
  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  const point = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(point);
  if (hit && Date.now() - hit.at < TTL_MS) return res.status(200).json({ ...hit.body, cached: true });

  try {
    const r = await fetch(`https://api.weather.gov/alerts/active?point=${point}`, {
      headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`NWS HTTP ${r.status}`);
    const data = await r.json();
    const alerts = (await Promise.all((data.features || []).map(withArea))).filter(Boolean);
    const body = { alerts, point, fetched_at: new Date().toISOString() };
    cache.set(point, { at: Date.now(), body });
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    return res.status(200).json(body);
  } catch (e) {
    console.error('alerts failed', e);
    return res.status(502).json({ error: 'Could not load weather alerts', detail: String(e.message || e) });
  }
}
