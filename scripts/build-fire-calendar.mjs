// Builds public/fire-calendar.json: the harmonized MODIS + VIIRS burning record
// for Central Texas, straight from NASA FIRMS.
//
//   node scripts/build-fire-calendar.mjs            (last 3 full years + this year)
//   node scripts/build-fire-calendar.mjs 2022 2026  (a range of years)
//
// Needs FIRMS_MAP_KEY in .env.local. Takes a few minutes. If NASA rate-limits the
// key it waits and carries on, and a stopped run resumes from where it got to.
import fs from 'node:fs';
import { buildDays } from '../src/lib/fireCalendar.js';

const BBOX = '-98.6,29.6,-96.9,31.0'; // same region as api/fires.js
const OUT = new URL('../public/fire-calendar.json', import.meta.url);

function readKey() {
  if (process.env.FIRMS_MAP_KEY) return process.env.FIRMS_MAP_KEY;
  try {
    const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    return env.match(/^FIRMS_MAP_KEY=(.*)$/m)?.[1]?.trim() || '';
  } catch {
    return '';
  }
}
const KEY = readKey();
if (!KEY) {
  console.error('FIRMS_MAP_KEY is missing. Add it to .env.local first.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const thisYear = Number(today.slice(0, 4));
const y0 = Number(process.argv[2]) || thisYear - 3;
const y1 = Number(process.argv[3]) || thisYear;
const START = `${y0}-01-01`;
const END = y1 >= thisYear ? today : `${y1}-12-31`;

// Each sensor: the archive-quality record first, then near-real-time to fill
// the most recent months the archive hasn't reached yet.
const SENSORS = {
  m: ['MODIS_SP', 'MODIS_NRT'],
  v: ['VIIRS_SNPP_SP', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'],
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Finished windows are saved here, so a run that stops can pick up where it left off.
const CACHE = new URL('../node_modules/.cache/firms/', import.meta.url);
fs.mkdirSync(CACHE, { recursive: true });
const RETRY_MS = Number(process.env.FIRMS_RETRY_MS) || 65000;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

let span = 10; // FIRMS caps the day range; we step down if it refuses
async function fetchWindow(source, start) {
  for (let attempt = 1; ; attempt++) {
    const cached = new URL(`${source}_${start}_${span}.csv`, CACHE);
    if (fs.existsSync(cached)) return { text: fs.readFileSync(cached, 'utf8'), span };

    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${source}/${BBOX}/${span}/${start}`;
    let head = '';
    let text = '';
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      text = (await r.text()).trim();
      head = text.split(/\r?\n/)[0] || '';
    } catch (e) {
      head = `network: ${e.message}`;
    }
    if (head.startsWith('latitude')) {
      fs.writeFileSync(cached, text);
      return { text, span };
    }
    if (/day.?range/i.test(head) && span > 1) { span = span > 5 ? 5 : 1; attempt = 0; continue; }
    // FIRMS answers "Invalid MAP_KEY" (or a limit message) when a key that was
    // working has used up its requests for the current 10 minutes. Wait it out.
    if (/map_key|transaction|limit|exceed|network:|timeout/i.test(head)) {
      if (attempt > 12) throw new Error(`FIRMS keeps refusing: ${head}`);
      process.stdout.write(`\nNASA is rate-limiting this key (${head.slice(0, 40)}). Waiting a minute, try ${attempt} of 12...\n`);
      await sleep(RETRY_MS);
      continue;
    }
    return { text: '', span, note: head.slice(0, 80) }; // no data for this window / source
  }
}

function parse(text, sensor) {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const col = Object.fromEntries(lines[0].split(',').map((h, i) => [h, i]));
  return lines.slice(1).filter(Boolean).map((line) => {
    const c = line.split(',');
    return {
      date: c[col.acq_date],
      lat: Number(c[col.latitude]),
      lng: Number(c[col.longitude]),
      sensor,
      confidence: c[col.confidence],
    };
  });
}

const detections = [];
const coverage = {};
for (const [sensor, sources] of Object.entries(SENSORS)) {
  let first = null, last = null;
  for (let start = START; start <= END; ) {
    // The archive first. Only if it has nothing for a recent window do we ask the
    // near-real-time feeds, which hold the last few months the archive lacks.
    const recent = start >= addDays(today, -200);
    let got = null;
    for (const source of sources) {
      const isArchive = source.endsWith('_SP');
      if (!isArchive && !recent) continue;
      const res = await fetchWindow(source, start);
      if (!res.text) continue;
      const count = res.text.split(/\r?\n/).length - 1;
      if (!got || count > got.count) got = { ...res, source, count };
      if (isArchive && count > 0) break;
    }
    const used = got?.span || span;
    const rows = got?.text ? parse(got.text, sensor) : [];
    // A window that answered with a proper header counts as covered, even with zero fires.
    if (got?.text) {
      first = first || start;
      last = addDays(start, used - 1) > END ? END : addDays(start, used - 1);
      detections.push(...rows.filter((d) => d.date >= START && d.date <= END));
    }
    process.stdout.write(`\r${sensor === 'm' ? 'MODIS' : 'VIIRS'} ${start}  ${detections.length} detections   `);
    start = addDays(start, used);
    await sleep(250); // go easy on NASA's server
  }
  coverage[sensor] = first ? [first, last] : null;
  console.log(`\n${sensor === 'm' ? 'MODIS' : 'VIIRS'} coverage: ${coverage[sensor]?.join(' to ') || 'none'}`);
}

const calendar = {
  generated: new Date().toISOString(),
  source: 'NASA FIRMS area API (MODIS Collection 6.1, VIIRS 375 m)',
  bbox: BBOX,
  start: START,
  end: END,
  coverage,
  days: buildDays(detections),
};
fs.mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(calendar));
console.log(`Wrote public/fire-calendar.json: ${Object.keys(calendar.days).length} days with fire, ${detections.length} detections.`);
