// Where is the person, and who can help there? Inside the Austin area we use
// the contacts checked by hand (lib/contacts.js). Anywhere else in the US we
// search for nearby rehabbers and animal control.
import { AUSTIN } from './constants.js';
import { getLocation, haversineKm } from './geo.js';

const AUSTIN_AREA_KM = 60;
const SAVED = 'wh_local_help';

export const inAustinArea = (point) => haversineKm(point, AUSTIN) <= AUSTIN_AREA_KM;

// A nationwide wildlife-emergency directory, as a safety net when search finds little.
export const NATIONWIDE = { name: 'Animal Help Now', url: 'https://ahnow.org/' };

export function savedLocalHelp() {
  try {
    return JSON.parse(sessionStorage.getItem(SAVED));
  } catch {
    return null;
  }
}

// Resolves with { mode: 'austin' | 'nearby' | 'unknown', ... }
export async function findLocalHelp() {
  const loc = await getLocation();
  let out;
  if (loc.fallback) out = { mode: 'unknown' };
  else if (inAustinArea(loc)) out = { mode: 'austin' };
  else {
    const r = await fetch(`/api/nearby?lat=${loc.lat.toFixed(3)}&lng=${loc.lng.toFixed(3)}`);
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || 'Could not search for help nearby');
    out = { mode: 'nearby', wildlife: body.wildlife || [], animal_control: body.animal_control || [] };
  }
  // Remember a real answer for this visit, but not a failed location: the person
  // may allow location a moment later and should get a fresh lookup.
  if (out.mode !== 'unknown') {
    try { sessionStorage.setItem(SAVED, JSON.stringify(out)); } catch { /* private mode */ }
  }
  return out;
}
