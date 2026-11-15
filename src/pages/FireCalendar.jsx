import { useEffect, useMemo, useState } from 'react';
import { summarize, harmonize, flagUnusual, monthlyAverages } from '../lib/fireCalendar.js';
import { AUSTIN } from '../lib/constants.js';

// NASA Space Apps 2026 challenge: "Harmonization of MODIS and VIIRS Hot Spots".
// The data file is built once from NASA FIRMS by `npm run fire-calendar`.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// One hue, light to dark. Step 0 is "no burning seen".
const BINS = [
  { max: 0, color: '#e3e7e3', label: '0' },
  { max: 2, color: '#fbd0bb', label: '1 to 2' },
  { max: 5, color: '#f5a27c', label: '3 to 5' },
  { max: 10, color: '#eb6834', label: '6 to 10' },
  { max: 20, color: '#b3440f', label: '11 to 20' },
  { max: Infinity, color: '#6f2706', label: '21+' },
];
const binOf = (h) => BINS.find((b) => h <= b.max);

const AREAS = [
  { id: 'all', label: 'All of Central Texas', aoi: null },
  { id: 'austin', label: 'Within 25 miles of Austin', aoi: { ...AUSTIN, km: 40 } },
  { id: 'bastrop', label: 'Within 20 miles of Bastrop', aoi: { lat: 30.1105, lng: -97.3153, km: 32 } },
  { id: 'sanmarcos', label: 'Within 20 miles of San Marcos', aoi: { lat: 29.8833, lng: -97.9414, km: 32 } },
  { id: 'georgetown', label: 'Within 20 miles of Georgetown', aoi: { lat: 30.6333, lng: -97.6781, km: 32 } },
];

function savedVolunteerArea() {
  try {
    const v = JSON.parse(localStorage.getItem('wh_volunteer'));
    return v ? { id: 'mine', label: 'My pickup area', aoi: { lat: v.lat, lng: v.lng, km: v.radius_km } } : null;
  } catch {
    return null;
  }
}

const fmt = (n, d = 1) => (n == null ? 'n/a' : n.toFixed(d));
const longDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export default function FireCalendar() {
  const [calendar, setCalendar] = useState(null);
  const [missing, setMissing] = useState(false);
  const areas = useMemo(() => [...AREAS, savedVolunteerArea()].filter(Boolean), []);
  const [areaId, setAreaId] = useState('all');
  const [year, setYear] = useState(null);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    fetch('/fire-calendar.json')
      .then((r) => (r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : Promise.reject()))
      .then((c) => {
        setCalendar(c);
        setYear(Number(c.end.slice(0, 4)));
      })
      .catch(() => setMissing(true));
  }, []);

  const result = useMemo(() => {
    if (!calendar) return null;
    const aoi = areas.find((a) => a.id === areaId)?.aoi || null;
    const { rows, stats } = harmonize(summarize(calendar, aoi));
    const flagged = flagUnusual(rows);
    return { rows: flagged, stats, months: monthlyAverages(flagged), byDate: Object.fromEntries(flagged.map((r) => [r.date, r])) };
  }, [calendar, areaId, areas]);

  if (missing) {
    return (
      <div className="card warn">
        <h2>The fire calendar isn't built yet</h2>
        <p>It is made once from NASA's fire records. In PowerShell, in the project folder, run:</p>
        <p><code>npm run fire-calendar</code></p>
        <p className="fine">It needs the FIRMS key in .env.local and takes a few minutes. Then reload this page.</p>
      </div>
    );
  }
  if (!result) return <div className="card center"><div className="spinner" /><p>Loading NASA fire records…</p></div>;

  const { rows, months, byDate } = result;
  const years = [];
  for (let y = Number(calendar.start.slice(0, 4)); y <= Number(calendar.end.slice(0, 4)); y++) years.push(y);
  const unusual = rows.filter((r) => r.unusual);
  const topMonths = months.map((v, m) => ({ v, m })).sort((a, b) => b.v - a.v).slice(0, 3).filter((x) => x.v > 0);
  const maxMonth = Math.max(...months, 0.0001);
  const sel = picked ? byDate[picked] : null;

  return (
    <section className="viz">
      <div className="card">
        <h2>Burning activity calendar</h2>
        <label className="field">
          Area
          <select value={areaId} onChange={(e) => { setAreaId(e.target.value); setPicked(null); }}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <div className="year-row" role="group" aria-label="Year">
          {years.map((y) => (
            <button key={y} className={y === year ? 'on' : ''} onClick={() => { setYear(y); setPicked(null); }}>{y}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="viz-title">Burning grid cells per day, {year}</h3>
        <p className="fine">Each square is a day. Tap one for details. A dark outline marks an unusual day.</p>
        <div className="months">
          {MONTHS.map((name, m) => <Month key={name} year={year} month={m} name={name} byDate={byDate} picked={picked} onPick={setPicked} />)}
        </div>
        <div className="ramp" aria-label="Colour scale: burning grid cells per day">
          {BINS.map((b) => (
            <span key={b.label}><i style={{ background: b.color }} />{b.label}</span>
          ))}
          <span><i className="unusual-key" />Unusual day</span>
        </div>

        {sel ? (
          <div className="day-detail" role="status">
            <h3>{longDate(sel.date)}{sel.unusual ? ': unusual' : ''}</h3>
            {sel.h == null ? (
              <p>No satellite record for this day.</p>
            ) : (
              <>
                <p>
                  <strong>{sel.h}</strong> burning grid {sel.h === 1 ? 'cell' : 'cells'} on the shared scale
                  {sel.source === 'modis-scaled' ? ' (MODIS only that day, scaled to match VIIRS)' : ''}.
                  A typical day in {MONTHS[Number(sel.date.slice(5, 7)) - 1]} has {fmt(sel.monthMean)}.
                </p>
                <p className="fine">
                  MODIS saw {sel.m} {sel.m === 1 ? 'cell' : 'cells'} ({sel.rm} raw detections). VIIRS saw {sel.v} ({sel.rv} raw detections). Both saw {sel.both}.
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="fine">Nothing selected.</p>
        )}
      </div>

      <div className="card">
        <h3 className="viz-title">Critical periods: average burning cells per day, by month</h3>
        <div className="bars" role="img" aria-label={`Average burning cells per day by month. Highest: ${topMonths.map((t) => MONTHS[t.m]).join(', ')}.`}>
          {months.map((v, m) => (
            <div className="bar-col" key={m} title={`${MONTHS[m]}: ${fmt(v, 2)} per day`}>
              <span className="bar-value">{topMonths.some((t) => t.m === m) ? fmt(v) : ''}</span>
              <div className="bar" style={{ height: `${Math.max(2, (v / maxMonth) * 100)}%` }} />
              <span className="bar-label">{MONTHS[m][0]}</span>
            </div>
          ))}
        </div>
        {topMonths.length > 0 ? (
          <p>
            Busiest months on record here: <strong>{topMonths.map((t) => MONTHS[t.m]).join(', ')}</strong>.
            That is when volunteers are most likely to be needed after a fire.
            There {unusual.length === 1 ? 'is' : 'are'} {unusual.length} unusual {unusual.length === 1 ? 'day' : 'days'} in the record.
          </p>
        ) : (
          <p>No burning was recorded in this area in the period covered.</p>
        )}
      </div>

      <div className="card">
        <h3 className="viz-title">Unusual days</h3>
        <p className="fine">
          Days with far more burning than normal for that month. Source: {calendar.source}, {calendar.start} to {calendar.end}.
        </p>
        <details>
          <summary>Show unusual days as a table</summary>
          <table className="viz-table">
            <thead><tr><th>Date</th><th>Shared scale</th><th>MODIS cells</th><th>VIIRS cells</th></tr></thead>
            <tbody>
              {unusual.slice(-60).reverse().map((r) => (
                <tr key={r.date}><td>{r.date}</td><td>{r.h}</td><td>{r.m}</td><td>{r.v}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}

function Month({ year, month, name, byDate, picked, onPick }) {
  const first = new Date(Date.UTC(year, month, 1));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < first.getUTCDay(); i++) cells.push(<span key={`pad${i}`} className="day pad" />);
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const r = byDate[iso];
    const known = r && r.h != null;
    cells.push(
      <button
        key={iso}
        className={`day${r?.unusual ? ' unusual' : ''}${picked === iso ? ' picked' : ''}${known ? '' : ' nodata'}`}
        style={known ? { background: binOf(r.h).color } : undefined}
        title={known ? `${iso}: ${r.h} burning cells${r.unusual ? ' (unusual)' : ''}` : `${iso}: no record`}
        aria-label={known ? `${iso}, ${r.h} burning cells${r.unusual ? ', unusual' : ''}` : `${iso}, no record`}
        onClick={() => onPick(iso)}
      />
    );
  }
  return (
    <div className="month">
      <p>{name}</p>
      <div className="month-grid">{cells}</div>
    </div>
  );
}
