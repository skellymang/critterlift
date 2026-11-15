// Harmonizing MODIS and VIIRS hot spots into one burning-activity calendar.
//
// The problem: MODIS sees fire in 1 km pixels, VIIRS in 375 m pixels. One fire
// front that MODIS reports once can show up as several VIIRS detections, and
// VIIRS also catches small fires MODIS misses. Raw detection counts from the
// two sensors therefore can't be compared or added.
//
// What we do:
//   1. Drop low-confidence detections from both sensors.
//   2. Snap every detection to the same 0.01 degree grid (about 1 km). The unit
//      becomes "burning cell-day": a grid cell with at least one detection that
//      day. Several VIIRS pixels in one cell count once, like one MODIS pixel.
//   3. Over the days both sensors covered, measure how many burning cells VIIRS
//      sees per MODIS cell (k). On days with no VIIRS coverage, MODIS cells are
//      scaled by k, so the whole calendar is in VIIRS-equivalent cells.
//   4. Flag unusual days against the same calendar month in the other years.
//
// A hot spot is a satellite observation, not a count of fires, and none of this
// is a forecast. Pure functions only: used by the build script and the browser.

export const GRID_DEG = 0.01;
export const MIN_MODIS_CONFIDENCE = 30; // MODIS confidence is 0 to 100

export const cellOf = (lat, lng) => [Math.floor(lat / GRID_DEG), Math.floor(lng / GRID_DEG)];
export const cellCenter = (i, j) => ({ lat: (i + 0.5) * GRID_DEG, lng: (j + 0.5) * GRID_DEG });

// sensor: 'm' (MODIS) or 'v' (VIIRS)
export function keepDetection(sensor, confidence) {
  if (sensor === 'm') return Number(confidence) >= MIN_MODIS_CONFIDENCE;
  return !String(confidence ?? 'n').trim().toLowerCase().startsWith('l'); // VIIRS: l / n / h
}

// detections: [{ date:'YYYY-MM-DD', lat, lng, sensor, confidence }]
// Returns { 'YYYY-MM-DD': { rm, rv, cells:[i, j, flag, ...] } }
//   rm / rv = raw detection counts kept per sensor
//   flag: 1 = MODIS only, 2 = VIIRS only, 3 = both saw this cell that day
export function buildDays(detections) {
  const byDay = new Map();
  for (const d of detections) {
    if (!keepDetection(d.sensor, d.confidence)) continue;
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lng)) continue;
    let day = byDay.get(d.date);
    if (!day) byDay.set(d.date, (day = { rm: 0, rv: 0, cells: new Map() }));
    if (d.sensor === 'm') day.rm++; else day.rv++;
    const [i, j] = cellOf(d.lat, d.lng);
    const key = `${i},${j}`;
    day.cells.set(key, (day.cells.get(key) || 0) | (d.sensor === 'm' ? 1 : 2));
  }
  const out = {};
  for (const [date, day] of [...byDay].sort((a, b) => a[0].localeCompare(b[0]))) {
    const flat = [];
    for (const [key, flag] of day.cells) {
      const [i, j] = key.split(',').map(Number);
      flat.push(i, j, flag);
    }
    out[date] = { rm: day.rm, rv: day.rv, cells: flat };
  }
  return out;
}

const kmBetween = (a, b) => {
  const rad = (x) => (x * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

const inRange = (date, range) => Boolean(range && date >= range[0] && date <= range[1]);

export function* eachDate(start, end) {
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  for (; d <= last; d.setUTCDate(d.getUTCDate() + 1)) yield d.toISOString().slice(0, 10);
}

// calendar: { start, end, coverage:{ m:[from,to], v:[from,to] }, days }
// aoi: null for the whole region, or { lat, lng, km }
// Returns one row per date in [start, end], with burning-cell counts per sensor.
export function summarize(calendar, aoi = null) {
  const rows = [];
  for (const date of eachDate(calendar.start, calendar.end)) {
    const day = calendar.days[date];
    let m = 0, v = 0, both = 0;
    if (day) {
      const c = day.cells;
      for (let n = 0; n < c.length; n += 3) {
        if (aoi && kmBetween(aoi, cellCenter(c[n], c[n + 1])) > aoi.km) continue;
        const flag = c[n + 2];
        if (flag & 1) m++;
        if (flag & 2) v++;
        if (flag === 3) both++;
      }
    }
    rows.push({
      date, m, v, both,
      rm: day?.rm || 0, rv: day?.rv || 0,
      hasM: inRange(date, calendar.coverage?.m),
      hasV: inRange(date, calendar.coverage?.v),
    });
  }
  return rows;
}

// Adds h (harmonized, VIIRS-equivalent burning cells) to each row.
export function harmonize(rows) {
  let sumM = 0, sumV = 0, sumBoth = 0, rawM = 0, rawV = 0, overlapDays = 0;
  for (const r of rows) {
    if (!(r.hasM && r.hasV)) continue;
    overlapDays++;
    sumM += r.m; sumV += r.v; sumBoth += r.both; rawM += r.rm; rawV += r.rv;
  }
  const k = sumM > 0 && sumV > 0 ? sumV / sumM : 1;
  const out = rows.map((r) => ({
    ...r,
    h: r.hasV ? r.v : r.hasM ? Math.round(r.m * k) : null,
    source: r.hasV ? 'viirs' : r.hasM ? 'modis-scaled' : 'none',
  }));
  return {
    rows: out,
    stats: {
      k,
      overlapDays,
      rawRatio: rawM > 0 ? rawV / rawM : null,       // VIIRS : MODIS, raw detections
      gridRatio: sumM > 0 ? sumV / sumM : null,      // VIIRS : MODIS, after gridding
      modisSeenByViirs: sumM > 0 ? sumBoth / sumM : null, // share of MODIS cells VIIRS also saw
    },
  };
}

// Marks unusual days: well above what the same calendar month looks like in the
// other years on record (mean + 2 standard deviations, and at least 3 cells).
export function flagUnusual(rows) {
  const byMonth = Array.from({ length: 12 }, () => []);
  for (const r of rows) if (r.h != null) byMonth[Number(r.date.slice(5, 7)) - 1].push(r.h);
  const base = byMonth.map((vals) => {
    if (!vals.length) return { mean: 0, sd: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    return { mean, sd };
  });
  return rows.map((r) => {
    const b = base[Number(r.date.slice(5, 7)) - 1];
    const threshold = Math.max(3, b.mean + 2 * b.sd);
    return { ...r, unusual: r.h != null && r.h >= threshold, monthMean: b.mean };
  });
}

// Average harmonized burning cells per day for each month: the "critical periods".
export function monthlyAverages(rows) {
  const sum = new Array(12).fill(0);
  const n = new Array(12).fill(0);
  for (const r of rows) {
    if (r.h == null) continue;
    const m = Number(r.date.slice(5, 7)) - 1;
    sum[m] += r.h; n[m]++;
  }
  return sum.map((s, m) => (n[m] ? s / n[m] : 0));
}

// Burning cells between two dates (inclusive), as points for the map.
// seenBy: 'both' | 'viirs' | 'modis'
export function cellsBetween(calendar, from, to) {
  const out = [];
  for (const [date, day] of Object.entries(calendar.days)) {
    if (date < from || date > to) continue;
    const c = day.cells;
    for (let n = 0; n < c.length; n += 3) {
      const { lat, lng } = cellCenter(c[n], c[n + 1]);
      out.push({ lat, lng, date, seenBy: c[n + 2] === 3 ? 'both' : c[n + 2] === 2 ? 'viirs' : 'modis' });
    }
  }
  return out;
}
