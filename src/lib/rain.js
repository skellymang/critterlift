// NASA GPM IMERG rain rate, from NASA GIBS map tiles. The images run many hours
// behind real time and a request for a time NASA hasn't published yet fails, so
// we look for the newest half-hour that actually exists.
const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/IMERG_Precipitation_Rate/default';
export const rainTileUrl = (time) => `${BASE}/${time}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`;
const tile = (time, z, x, y) => `${BASE}/${time}/GoogleMapsCompatible_Level6/${z}/${y}/${x}.png`;

const iso = (ms) => new Date(ms).toISOString().slice(0, 19) + 'Z';
const HALF_HOUR = 30 * 60 * 1000;

const loads = (url) =>
  new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(true);
    img.onerror = () => ok(false);
    img.src = url;
  });

// date: 'YYYY-MM-DD' for around noon in Austin that day, or null for the latest.
// Resolves with a time string, or null if NASA has nothing in the window.
export async function findRainTime(date) {
  const start = date
    ? Date.parse(`${date}T18:00:00Z`)
    : Math.floor((Date.now() - 4 * 3600e3) / HALF_HOUR) * HALF_HOUR;
  const times = Array.from({ length: date ? 12 : 72 }, (_, i) => iso(start - i * HALF_HOUR));
  for (let i = 0; i < times.length; i += 12) {
    const batch = times.slice(i, i + 12);
    const found = await Promise.all(batch.map((t) => loads(tile(t, 3, 1, 3)))); // the tile over North America
    const hit = found.indexOf(true);
    if (hit !== -1) return batch[hit];
  }
  return null;
}

// Share (0 to 1) of the map tile around a point that has rain in it, or null if
// the browser won't let us read the pixels.
export function rainShareNear(time, { lat, lng }) {
  const z = 6;
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return new Promise((ok) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, c.width, c.height).data;
        let wet = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 0) wet++;
        ok(wet / (px.length / 4));
      } catch {
        ok(null);
      }
    };
    img.onerror = () => ok(null);
    img.src = tile(time, z, x, y);
  });
}
