// What each kind of weather alert means for wildlife, and for someone holding
// an injured animal. Colours are also used for alert areas on the map.
export const HAZARDS = {
  cold: {
    icon: '❄️',
    label: 'Freeze or winter weather',
    color: '#0097a7',
    animals:
      'Bats can fall from bridges and roosts when it freezes, and birds and small mammals may be found stunned or unable to move. Reptiles that are just slow from the cold are usually fine.',
    finder:
      'Bring the box indoors to a quiet room. Let the animal warm up slowly: no heaters, hair dryers or hot water.',
  },
  heat: {
    icon: '🌡️',
    label: 'Extreme heat',
    color: '#e65100',
    animals: 'Watch for birds and mammals that are panting, weak, or lying in the open near water or shade.',
    finder: 'Move the box into shade or indoors. Do not pour water on the animal or force it to drink.',
  },
  flood: {
    icon: '🌊',
    label: 'Flooding',
    color: '#00796b',
    animals: 'Nests, burrows and dens can wash out, so young animals may turn up soaked, cold or far from where they belong.',
    finder: 'Stay out of moving water. Keep the animal dry in a box lined with a towel.',
  },
  storm: {
    icon: '⛈️',
    label: 'Severe storm',
    color: '#6a1b9a',
    animals: 'High wind brings down nests and tree hollows. Expect baby birds and squirrels on the ground afterward.',
    finder: 'Wait until the storm has passed before going out. Then keep the animal dark, dry and quiet.',
  },
  fire: {
    icon: '🔥',
    label: 'Fire weather',
    color: '#c2185b',
    animals: 'Dry, windy conditions mean a fire could start and spread fast. Animals fleeing a fire may be burned, exhausted or in unusual places.',
    finder: 'Stay out of burned areas until officials say they are safe. Do not put anything on burns.',
  },
};

// Clearly labelled samples, one per kind of alert, for showing the feature on
// a day with no live alerts.
// A rough circle on the map, so each example has an area to colour in.
function circle(lat, lng, km) {
  const ring = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * 2 * Math.PI;
    ring.push([
      +(lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)).toFixed(4),
      +(lat + (km / 110.57) * Math.sin(a)).toFixed(4),
    ]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
const example = (event, category, lat, lng) => ({
  id: `example-${category}`, example: true, event, category,
  severity: 'Moderate', headline: `Example only: ${event}`, area: '', ends: null,
  geometry: circle(lat, lng, 22),
});
// Spread around Austin so the five colours don't sit on top of each other.
export const EXAMPLE_ALERTS = [
  example('Freeze Warning', 'cold', 30.62, -97.74),
  example('Heat Advisory', 'heat', 30.27, -97.28),
  example('Flash Flood Warning', 'flood', 29.92, -97.74),
  example('Severe Thunderstorm Warning', 'storm', 30.27, -98.2),
  example('Red Flag Warning', 'fire', 30.27, -97.74),
];

const cache = new Map();
export async function loadAlerts(point, { force = false } = {}) {
  const key = `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`;
  if (!force && cache.has(key)) return cache.get(key);
  const r = await fetch(`/api/alerts?lat=${point.lat.toFixed(2)}&lng=${point.lng.toFixed(2)}`);
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || 'Could not load weather alerts');
  cache.set(key, body.alerts);
  return body.alerts;
}

export const untilText = (iso) =>
  iso
    ? `until ${new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
    : '';
