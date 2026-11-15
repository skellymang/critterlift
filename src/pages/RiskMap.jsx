import { useEffect, useState } from 'react';
import MapView from '../components/MapView.jsx';
import MapLegend from '../components/MapLegend.jsx';
import HazardCards from '../components/HazardCards.jsx';
import RoadHotspots from '../components/RoadHotspots.jsx';
import { roadHotspots, EXAMPLE_SPOTS } from '../lib/roads.js';
import { loadAlerts, EXAMPLE_ALERTS } from '../lib/hazards.js';
import { supabase, loadFires } from '../lib/supabase.js';
import { AUSTIN } from '../lib/constants.js';
import { getLocation } from '../lib/geo.js';
import { inAustinArea } from '../lib/localHelp.js';
import { cellsBetween } from '../lib/fireCalendar.js';
import { findRainTime, rainShareNear } from '../lib/rain.js';

// The saved MODIS + VIIRS record (built by `npm run fire-calendar`), loaded once.
let calendarPromise = null;
const loadCalendar = () =>
  (calendarPromise ||= fetch('/fire-calendar.json').then((r) =>
    r.ok && r.headers.get('content-type')?.includes('json') ? r.json() : Promise.reject(new Error('no calendar'))
  ));

// Turn saved burning cells into map points. Colour says which satellites saw them.
const SEEN = {
  both: { confidence: 'h', label: 'Seen by both satellites' },
  viirs: { confidence: 'n', label: 'Seen by VIIRS only' },
  modis: { confidence: 'l', label: 'Seen by MODIS only' },
};
const historyPoints = (calendar, from, to) =>
  cellsBetween(calendar, from, to).map((c) => ({
    lat: c.lat, lng: c.lng, acquired: c.date, confidence: SEEN[c.seenBy].confidence, label: SEEN[c.seenBy].label,
  }));

const PERIODS = [
  { id: 'live', label: 'Last 2 days (live from NASA)' },
  { id: '30', label: 'Past 30 days', days: 30 },
  { id: '365', label: 'Past 12 months', days: 365 },
  { id: 'day', label: 'One specific day' },
];

// Land surface temperature tiles lag a couple of days, so default to 3 days ago.
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
// Today's date on this device's own clock, for the date pickers.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const TODAY = localToday();

export default function RiskMap() {
  // The map opens on Austin, then moves to wherever the person is.
  const [here, setHere] = useState(AUSTIN);
  useEffect(() => {
    getLocation().then((l) => { if (!l.fallback) setHere({ lat: l.lat, lng: l.lng }); });
  }, []);
  const away = !inAustinArea(here);
  const [period, setPeriod] = useState('live');
  const [pickedDate, setPickedDate] = useState(TODAY);
  // Today means "the newest there is", which is '' from here on.
  const date = period === 'day' && pickedDate !== TODAY ? pickedDate : '';
  const [pickedLayerDate, setLayerDate] = useState(TODAY);
  const ownLayerDate = pickedLayerDate && pickedLayerDate !== TODAY ? pickedLayerDate : '';
  // One date drives both layers: the rain and temperature date if set, otherwise
  // the day picked for fires, otherwise the newest images.
  const layerDate = ownLayerDate || date;
  const heatShown = layerDate || daysAgo(3);
  const [fireMode, setFireMode] = useState('live'); // which colour key the map needs
  const [showHeat, setShowHeat] = useState(false);
  const [showRain, setShowRain] = useState(false);
  const [rainNote, setRainNote] = useState('');
  const [rainTime, setRainTime] = useState(null);
  const [fires, setFires] = useState([]);
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [alertNote, setAlertNote] = useState('Checking weather alerts…');
  const [example, setExample] = useState(false);
  const [spots, setSpots] = useState([]);
  const [roadExamples, setRoadExamples] = useState(false);
  const shownSpots = roadExamples ? [...spots, ...EXAMPLE_SPOTS] : spots;
  // What the map and its key show: live alerts, plus the examples when they are switched on.
  const mapAlerts = example ? [...alerts, ...EXAMPLE_ALERTS] : alerts;

  useEffect(() => {
    let live = true;
    const show = (list, mode, text) => {
      if (!live) return;
      setFires(list);
      setFireMode(mode);
      setStatus(text);
    };
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const fromHistory = async (days, lead = '') => {
      const cal = await loadCalendar();
      const pts = historyPoints(cal, daysAgo(days), daysAgo(0));
      show(pts, 'history', `${lead}${plural(pts.length, 'burning spot')} in the past ${days === 365 ? '12 months' : `${days} days`}, from NASA's MODIS and VIIRS records.`);
    };

    setStatus('Loading NASA fire data…');
    (async () => {
      try {
        const chosen = PERIODS.find((p) => p.id === period);
        if (chosen.days) return await fromHistory(chosen.days);
        if (period === 'day' && !pickedDate) return show([], 'live', 'Pick a day to see its fires.');

        const when = date ? `on ${date}` : 'in the last 2 days';
        let found = [];
        let problem = '';
        try {
          found = await loadFires(date || null);
        } catch (e) {
          problem = e.message;
        }
        if (found.length) return show(found, 'live', `${plural(found.length, 'fire detection')} ${when}, live from NASA.`);

        // Nothing live: fall back to the saved record so the map is never empty.
        try {
          const cal = await loadCalendar();
          if (date) {
            const pts = historyPoints(cal, date, date);
            return show(pts, 'history', pts.length
              ? `${plural(pts.length, 'burning spot')} on ${date}, from NASA's MODIS and VIIRS records.`
              : `No burning recorded on ${date}. Try another day, or "Past 30 days".`);
          }
          return await fromHistory(30, problem ? `Live fire data is unavailable (${problem}). Showing ` : 'No fires in the last 2 days. Showing ');
        } catch {
          show([], 'live', problem || `No fire detections ${when}.`);
        }
      } catch (e) {
        show([], 'live', e.message === 'no calendar' ? 'The saved fire record is missing. Run "npm run fire-calendar".' : e.message);
      }
    })();
    return () => { live = false; };
  }, [period, pickedDate]);

  useEffect(() => {
    loadAlerts(here)
      .then((a) => {
        setAlerts(a);
        setAlertNote(a.length ? '' : 'No freeze, heat, flood, storm or fire-weather alerts for your area right now.');
      })
      .catch((e) => setAlertNote(e.message));
  }, [here.lat, here.lng]);

  // Find NASA's newest rain image, then say plainly what it shows: rain is
  // invisible when it isn't raining, and the image runs hours behind.
  useEffect(() => {
    setRainTime(null);
    if (!showRain) return setRainNote('');
    let live = true;
    setRainNote('Looking for NASA\'s newest rain image…');
    (async () => {
      const time = await findRainTime(layerDate || null);
      if (!live) return;
      if (!time) return setRainNote('NASA has no rain image for that time. Try another day, or check the connection.');
      setRainTime(time);
      const when = new Date(time).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
      const share = await rainShareNear(time, here);
      if (!live) return;
      const lead = `Showing NASA's rain image from ${when}${layerDate ? '' : ', the newest available'}.`;
      setRainNote(
        share == null
          ? `${lead} No colour over an area means no rain there.`
          : share === 0
            ? `${lead} No rain over your area then, so the map looks unchanged here. Zoom out to see rain elsewhere.`
            : `${lead} Rain covered about ${Math.max(1, Math.round(share * 100))}% of your area.`
      );
    })();
    return () => { live = false; };
  }, [showRain, layerDate, here.lat, here.lng]);

  // Road danger spots use every report ever sent, including delivered ones.
  useEffect(() => {
    supabase
      .from('reports')
      .select('lat, lng, species, created_at, ai_json')
      .then(({ data }) => setSpots(roadHotspots(data || [])));
  }, []);

  useEffect(() => {
    supabase
      .from('reports')
      .select('*')
      .neq('status', 'delivered')
      .then(({ data }) => setReports(data || []));
  }, []);

  return (
    <section>
      <div className="card">
        <h2>Where to look</h2>
        <p className="fine">
          Fires, heat and heavy rain show where animals may need help. They are not confirmed sightings.
        </p>
        {away && (
          <p className="fine">
            The map is centred on your location. Rain, ground temperature and weather alerts work
            anywhere in the US. Fire points and road danger spots cover Central Texas only for now.
          </p>
        )}
        <label className="field">
          Show fires from
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {period === 'day' && (
          <label className="field">
            Day
            <input type="date" value={pickedDate} max={TODAY} onChange={(e) => setPickedDate(e.target.value || TODAY)} />
          </label>
        )}
        <p className="fire-status" role="status">{status}</p>
        <label className="check">
          <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
          Show ground temperature (NASA MODIS)
        </label>
        {showHeat && (
          <p className="fine" role="status">
            Showing ground temperature for {heatShown}
            {layerDate ? '.' : ', the newest day that is reliably available (it runs about 3 days behind).'}
            {' '}Blank patches are clouds.
          </p>
        )}
        <label className="check">
          <input type="checkbox" checked={showRain} onChange={(e) => setShowRain(e.target.checked)} />
          Show rain (NASA GPM satellites)
        </label>
        {rainNote && <p className="fine" role="status">{rainNote}</p>}
        <div className="row layer-date">
          <label className="field inline">
            Date for rain and temperature
            <input type="date" value={layerDate || TODAY} max={TODAY} onChange={(e) => setLayerDate(e.target.value || TODAY)} />
          </label>
          {ownLayerDate && <button className="link" onClick={() => setLayerDate(TODAY)}>{date ? 'Match fires' : 'Today'}</button>}
        </div>
        <p className="fine">
          {layerDate
            ? `Rain and ground temperature both show ${layerDate}${!ownLayerDate ? ', the same day as the fires' : ''}. Rain is from around noon.`
            : 'Today is selected, so the map shows the newest images NASA has: rain from within the last day and ground temperature from about 3 days ago. Pick an earlier day to look back.'}
        </p>
      </div>
      <MapView
        center={here}
        fires={fires}
        reports={reports}
        alerts={mapAlerts}
        hotspots={shownSpots}
        rain={showRain ? rainTime : null}
        heatDate={showHeat ? heatShown : null}
        height={420}
      />
      <MapLegend fireMode={fireMode} heat={showHeat} rain={showRain} alerts={mapAlerts} roads />
      <RoadHotspots spots={shownSpots} showExamples={roadExamples} onToggleExamples={() => setRoadExamples((v) => !v)} />

      <div className="card">
        <h2>Conditions right now</h2>
        <p className="fine">
          Weather alerts from the National Weather Service, with what each one means for wildlife.
        </p>
        {alertNote && <p>{alertNote}</p>}
        <button className="link" onClick={() => setExample((v) => !v)}>
          {example ? 'Hide the examples' : 'Show an example of every kind of alert'}
        </button>
        {example && <p className="fine">The examples are also drawn on the map above, each in its own colour.</p>}
      </div>
      <HazardCards alerts={alerts} />
      {example && <HazardCards alerts={EXAMPLE_ALERTS} />}
    </section>
  );
}
