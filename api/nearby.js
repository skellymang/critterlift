// GET /api/nearby?lat=39.74&lng=-104.99
// Finds real help near any point in the US with Google Maps (through SerpApi):
// wildlife rehabbers, and animal control or shelters. Three searches per new
// area, cached for a day so repeat lookups don't spend the SerpApi quota.
import { loadLocalEnv } from './_env.js';

loadLocalEnv();

export const config = { maxDuration: 30 };

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_KM = 120;
const cache = new Map();

const SEARCHES = [
  { group: 'wildlife', q: 'wildlife rehabilitation' },
  { group: 'animal_control', q: 'animal control' },
  { group: 'animal_control', q: 'animal shelter' },
];

// Google returns pest-removal companies for these searches; they are not rescues.
const NOT_HELP = /pest|exterminat|removal|trapp|termite|nuisance|taxiderm|groom|boarding|kennel|pet store|pet supply|veterinar|animal hospital|zoo\b/i;
const LOOKS_LIKE = {
  wildlife: /wildlife|rehab|rescue|raptor|bird|nature center|sanctuary|conservation/i,
  animal_control: /animal (control|services|care|protection|shelter|welfare)|humane|spca|shelter|pound|adoption/i,
};

const km = (a, b) => {
  const rad = (x) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

export function tidy(result, group, here) {
  const name = String(result.title || '').trim();
  const type = String(result.type || (result.types || [])[0] || '').trim();
  const lat = result.gps_coordinates?.latitude;
  const lng = result.gps_coordinates?.longitude;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const text = `${name} ${type}`;
  if (NOT_HELP.test(text) || !LOOKS_LIKE[group].test(text)) return null;
  const distance = km(here, { lat, lng });
  if (distance > MAX_KM) return null;
  const digits = String(result.phone || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const website = /^https?:\/\//i.test(result.website || '') ? result.website : null;
  return {
    group,
    name: name.slice(0, 90),
    type: type.slice(0, 60),
    address: String(result.address || '').slice(0, 140),
    phone: ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : null,
    tel: ten.length === 10 ? `+1${ten}` : null,
    open: String(result.open_state || '').slice(0, 60),
    website,
    lat,
    lng,
    km: Number(distance.toFixed(1)),
  };
}

async function search(q, here) {
  const params = new URLSearchParams({
    engine: 'google_maps',
    type: 'search',
    q,
    ll: `@${here.lat},${here.lng},11z`,
    hl: 'en',
    api_key: process.env.SERPAPI_KEY,
  });
  const r = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(20000) });
  const data = await r.json();
  if (data.error && !/hasn't returned any results/i.test(data.error)) throw new Error(data.error);
  return data.local_results || (data.place_results ? [data.place_results] : []);
}

export default async function handler(req, res) {
  const lat = Number(req.query?.lat);
  const lng = Number(req.query?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }
  if (!process.env.SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY not set' });

  // Round to about 5 km so neighbours share one cached answer.
  const here = { lat: Math.round(lat * 20) / 20, lng: Math.round(lng * 20) / 20 };
  const key = `${here.lat},${here.lng}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return res.status(200).json({ ...hit.body, cached: true });

  try {
    const lists = await Promise.all(SEARCHES.map((s) => search(s.q, here).catch(() => [])));
    const seen = new Set();
    const places = [];
    lists.forEach((list, i) => {
      for (const raw of list) {
        const p = tidy(raw, SEARCHES[i].group, { lat, lng });
        if (!p || seen.has(p.name.toLowerCase())) continue;
        seen.add(p.name.toLowerCase());
        places.push(p);
      }
    });
    places.sort((a, b) => a.km - b.km);
    const body = {
      wildlife: places.filter((p) => p.group === 'wildlife').slice(0, 4),
      animal_control: places.filter((p) => p.group === 'animal_control').slice(0, 3),
      fetched_at: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), body });
    res.setHeader('Cache-Control', 's-maxage=86400');
    return res.status(200).json(body);
  } catch (e) {
    console.error('nearby failed', e);
    return res.status(502).json({ error: 'Could not search for help nearby', detail: String(e.message || e) });
  }
}
