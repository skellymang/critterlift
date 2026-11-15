// Road danger spots: places where finders have reported several animals hit by
// vehicles close together. Built only from this app's own reports.
import { haversineKm } from './geo.js';

export const ROAD_MIN_REPORTS = 2;   // reports needed before a spot is listed
const CELL_DEG = 0.004;              // about a quarter mile

// The finder's own tick box wins; otherwise go by what the photo check thought.
export const isVehicleReport = (r) =>
  r.ai_json?.hit_by_vehicle ?? r.ai_json?.triage?.cause === 'vehicle';

// Made-up spots, clearly labelled, for showing the feature before real reports exist.
export const EXAMPLE_SPOTS = [
  { id: 'example-1', example: true, lat: 30.335, lng: -97.8, count: 5, species: ['White-tailed deer', 'Virginia opossum', 'Nine-banded armadillo'], first: null, last: null, spreadKm: 0.3 },
  { id: 'example-2', example: true, lat: 30.22, lng: -97.83, count: 3, species: ['Raccoon', 'Eastern fox squirrel'], first: null, last: null, spreadKm: 0.2 },
];

export function roadHotspots(reports, min = ROAD_MIN_REPORTS) {
  const cells = new Map();
  for (const r of reports || []) {
    if (!isVehicleReport(r) || r.lat == null) continue;
    const key = `${Math.floor(r.lat / CELL_DEG)},${Math.floor(r.lng / CELL_DEG)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(r);
  }
  const spots = [];
  for (const [key, list] of cells) {
    if (list.length < min) continue;
    const lat = list.reduce((a, r) => a + r.lat, 0) / list.length;
    const lng = list.reduce((a, r) => a + r.lng, 0) / list.length;
    const dates = list.map((r) => r.created_at).filter(Boolean).sort();
    spots.push({
      id: key,
      lat, lng,
      count: list.length,
      species: [...new Set(list.map((r) => r.species).filter((s) => s && s !== 'Unknown'))],
      first: dates[0] || null,
      last: dates[dates.length - 1] || null,
      spreadKm: Math.max(...list.map((r) => haversineKm({ lat, lng }, r))),
    });
  }
  return spots.sort((a, b) => b.count - a.count);
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '');

// The request a resident can send to the city. Nothing is sent by the app.
export function signRequestText(spot) {
  const when = spot.first && spot.last && day(spot.first) !== day(spot.last)
    ? `between ${day(spot.first)} and ${day(spot.last)}`
    : spot.last ? `on ${day(spot.last)}` : 'recently';
  return [
    ...(spot.example ? ['[EXAMPLE ONLY: this spot is made up to show how the request looks. Do not send.]', ''] : []),
    'Request: wildlife crossing warning sign',
    '',
    `Location: ${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}`,
    `Map: https://www.google.com/maps?q=${spot.lat.toFixed(5)},${spot.lng.toFixed(5)}`,
    '',
    `Why: ${spot.count} wild animals hit by vehicles were reported within about a quarter mile of this spot ${when}, through CritterLift, a volunteer wildlife rescue app.` +
      (spot.species.length ? ` Animals reported: ${spot.species.join(', ')}.` : ''),
    '',
    'Please evaluate this location for a wildlife crossing warning sign, or other ways to slow drivers and warn them that animals cross here.',
    '',
    'Submitted by: [your name], [your phone or email]',
  ].join('\n');
}
