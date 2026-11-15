import { AUSTIN, FIRE_NEAR_KM } from './constants.js';

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const kmToMi = (km) => km * 0.621371;
export const fmtDist = (km) => `${kmToMi(km).toFixed(1)} mi`;

// Resolves with the device location, or Austin if denied / unavailable.
export function getLocation() {
  // For demos and testing: add ?pretend=39.74,-104.99 to the address to act as
  // if the phone were somewhere else.
  const pretend = new URLSearchParams(window.location.search).get('pretend');
  if (pretend) {
    const [lat, lng] = pretend.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return Promise.resolve({ lat, lng, fallback: false });
  }
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ ...AUSTIN, fallback: true });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, fallback: false }),
      () => resolve({ ...AUSTIN, fallback: true }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export function nearestFire(point, fires) {
  let best = null;
  for (const f of fires || []) {
    const km = haversineKm(point, f);
    if (!best || km < best.km) best = { fire: f, km };
  }
  return best;
}

export function fireContext(point, fires) {
  const n = nearestFire(point, fires);
  return n && n.km <= FIRE_NEAR_KM
    ? { near_fire: true, fire_distance_km: Number(n.km.toFixed(2)) }
    : { near_fire: false, fire_distance_km: null };
}

export const bumpUrgency = (u) => (u === 'low' ? 'medium' : 'high');

// Nearest rehab that takes this animal type.
export function pickRehab(point, animalType, rehabs) {
  let best = null;
  for (const r of rehabs || []) {
    if (!r.species_ok?.includes(animalType)) continue;
    const km = haversineKm(point, r);
    if (!best || km < best.km) best = { rehab: r, km };
  }
  return best;
}

// Does this volunteer cover this report?
export function volunteerMatches(vol, report) {
  if (!vol || report.lat == null) return false;
  const inRadius = haversineKm(vol, report) <= vol.radius_km;
  const typeOk = !report.animal_type || vol.species_ok?.includes(report.animal_type);
  return inRadius && typeOk;
}
