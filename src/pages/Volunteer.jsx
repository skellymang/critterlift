import { useEffect, useMemo, useRef, useState } from 'react';
import MapView from '../components/MapView.jsx';
import MapLegend from '../components/MapLegend.jsx';
import HazardCards from '../components/HazardCards.jsx';
import { loadAlerts, HAZARDS } from '../lib/hazards.js';
import Fader from '../components/Fader.jsx';
import { VOLUNTEER_PHOTOS } from '../lib/photos.js';
import { supabase, loadRehabs, loadFires } from '../lib/supabase.js';
import { getLocation, haversineKm, volunteerMatches, fmtDist } from '../lib/geo.js';
import { ANIMAL_TYPES, AUSTIN } from '../lib/constants.js';

const SAVED = 'wh_volunteer';
const SEEN_FIRES = 'wh_seen_fires';
const SEEN_ALERTS = 'wh_seen_alerts';

const load = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};

export default function Volunteer() {
  const [vol, setVol] = useState(() => load(SAVED, null));
  const [upgrade, setUpgrade] = useState(false);
  const signOut = () => { localStorage.removeItem(SAVED); setVol(null); };
  if (!vol) {
    return <SignUp startAsVolunteer={upgrade} onDone={(v) => { localStorage.setItem(SAVED, JSON.stringify(v)); setVol(v); setUpgrade(false); }} />;
  }
  // Accounts made before the choice existed are volunteers.
  if (vol.volunteer === false) {
    return (
      <section className="card">
        <h2>Hi, {vol.name}</h2>
        <p>Your account is set up for reporting animals. Your first name goes on the reports you send from the Found an animal tab.</p>
        <p>Want to do more? Volunteers get alerts for animals nearby and drive them to a rehabber.</p>
        <button className="btn primary" onClick={() => { setUpgrade(true); signOut(); }}>Become a volunteer</button>
        <button className="btn" onClick={signOut}>Sign out</button>
      </section>
    );
  }
  return <Dashboard vol={vol} onSignOut={signOut} />;
}

// US phone numbers: 10 digits, or 11 starting with 1. Returns "(512) 555-0100" or null.
export function formatPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
export const validEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw || '').trim());

const newId = () =>
  crypto.randomUUID?.() ||
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

function SignUp({ onDone, startAsVolunteer = false }) {
  const [wantVol, setWantVol] = useState(startAsVolunteer);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState({});
  const [loc, setLoc] = useState(AUSTIN);
  const [locNote, setLocNote] = useState('Default: central Austin. Tap the map or use your location.');
  const [radiusMi, setRadiusMi] = useState(5);
  const [types, setTypes] = useState(['bird', 'small_mammal', 'reptile']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emailOk = validEmail(email);
  const phoneOk = Boolean(formatPhone(phone));
  const ready = name.trim() && emailOk && phoneOk && (!wantVol || types.length > 0);

  const toggle = (id) =>
    setTypes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  async function useMine() {
    setLocNote('Finding you…');
    const l = await getLocation();
    setLoc({ lat: l.lat, lng: l.lng });
    setLocNote(l.fallback ? 'Location blocked. Tap the map to set your home area.' : 'Using your location.');
  }

  async function submit(e) {
    e.preventDefault();
    setTouched({ email: true, phone: true });
    if (!ready) return setError('Check the highlighted fields.');
    setBusy(true);
    setError('');
    // Ask for notifications while we have a tap, but never wait on the answer:
    // the in-app banner works either way.
    try { window.Notification?.requestPermission?.(); } catch { /* not supported */ }

    const vol = {
      id: newId(),
      name: name.trim(),
      lat: loc.lat,
      lng: loc.lng,
      // A finder-only account has no pickup area, so it never matches a report.
      radius_km: wantVol ? Number((radiusMi * 1.60934).toFixed(2)) : 0,
      species_ok: wantVol ? types : [],
      volunteer: wantVol,
    };
    const { volunteer: _local, ...row } = vol; // "volunteer" is kept on this device only
    try {
      // No .select(): contact details are write-only for the public key, so we
      // never ask the database to send the row back.
      const { error: dbErr } = await supabase
        .from('volunteers')
        .insert({ ...row, email: email.trim().toLowerCase(), phone: formatPhone(phone) });
      if (dbErr) {
        const missingColumn = dbErr.code === 'PGRST204' || /column/i.test(dbErr.message || '');
        return setError(
          missingColumn
            ? 'The database needs the new email and phone columns. Run supabase/volunteer_contact.sql in the Supabase SQL Editor, then try again.'
            : `Could not sign you up: ${dbErr.message}`
        );
      }
      onDone(vol);
    } catch (err) {
      setError(navigator.onLine ? `Could not sign you up: ${err.message || err}` : 'No signal. Try again when you have a connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <Fader photos={VOLUNTEER_PHOTOS} className="card-photo" />
      <h2>Create your CritterLift account</h2>
      <p>One account for everyone. Use it to report animals you find, and choose below whether you also want to volunteer.</p>
      <label className="field">
        Your first name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="given-name" />
      </label>

      <p className="label">How we can reach you</p>
      <label className="field">
        Email
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          maxLength={120}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          aria-invalid={touched.email && !emailOk}
          required
        />
      </label>
      {touched.email && !emailOk && <p className="field-error">Enter an email like name@example.com.</p>}
      <label className="field">
        Phone
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          maxLength={20}
          placeholder="(512) 555-0100"
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => {
            setTouched((t) => ({ ...t, phone: true }));
            const f = formatPhone(phone);
            if (f) setPhone(f);
          }}
          aria-invalid={touched.phone && !phoneOk}
          required
        />
      </label>
      {touched.phone && !phoneOk && <p className="field-error">Enter a 10-digit US phone number.</p>}
      <p className="fine">Only used to reach you about a report or pickup. Other people using the app can't see it.</p>

      <label className="check hit-check">
        <input type="checkbox" checked={wantVol} onChange={(e) => setWantVol(e.target.checked)} />
        <span>
          <strong>I also want to volunteer</strong>
          <span className="fine"> Get an alert when an injured animal is reported near you, pick it up, and drive it to a licensed rehabber.</span>
        </span>
      </label>

      {wantVol && (<>

      <p className="label">Home area</p>
      <p className="fine">{locNote}</p>
      <MapView center={loc} pin={loc} onPick={setLoc} radius={{ ...loc, km: radiusMi * 1.60934 }} height={220} />
      <button type="button" className="btn" onClick={useMine}>Use my location</button>

      <label className="field">
        Pickup radius: {radiusMi} mi
        <input type="range" min="1" max="30" value={radiusMi} onChange={(e) => setRadiusMi(Number(e.target.value))} />
      </label>

      <p className="label">Animals you're comfortable handling</p>
      {ANIMAL_TYPES.map((t) => (
        <label key={t.id} className="check">
          <input type="checkbox" checked={types.includes(t.id)} onChange={() => toggle(t.id)} />
          {t.label}
        </label>
      ))}
      </>)}

      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary big" disabled={busy}>
        {busy ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  );
}

function Dashboard({ vol, onSignOut }) {
  const [reports, setReports] = useState([]);
  const [rehabs, setRehabs] = useState([]);
  const [fires, setFires] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [banner, setBanner] = useState(null); // { kind, text }
  const [error, setError] = useState('');
  const volRef = useRef(vol);

  function alertUser(kind, text) {
    setBanner({ kind, text });
    navigator.vibrate?.(200);
    try {
      // Throws on Android Chrome (needs a service worker) and is missing on
      // iPhone Safari; the banner above is the alert that always works.
      if (window.Notification?.permission === 'granted') new Notification('CritterLift', { body: text });
    } catch { /* banner only */ }
  }

  async function refreshFires(force, quiet = false) {
    try {
      const all = await loadFires(null, { force });
      setFires(all);
      const mine = all.filter((f) => haversineKm(vol, f) <= vol.radius_km);
      const seen = new Set(load(SEEN_FIRES, []));
      const fresh = mine.filter((f) => !seen.has((f.cell || `${f.lat},${f.lng}`)));
      if (fresh.length) {
        alertUser(
          'fire',
          `NASA satellites detected ${fresh.length} new fire ${fresh.length === 1 ? 'point' : 'points'} in your area. Displaced or injured animals are likely nearby.`
        );
        localStorage.setItem(
          SEEN_FIRES,
          JSON.stringify(mine.map((f) => (f.cell || `${f.lat},${f.lng}`)))
        );
      } else if (force && !quiet) {
        setBanner({ kind: 'info', text: 'No new fires in your area.' });
      }
    } catch (e) {
      if (force && !quiet) setError(e.message);
    }
  }

  async function refreshAlerts(force) {
    try {
      const list = await loadAlerts(vol, { force });
      setAlerts(list);
      const seen = new Set(load(SEEN_ALERTS, []));
      const fresh = list.filter((a) => !seen.has(a.id));
      if (fresh.length) {
        const a = fresh[0];
        alertUser('fire', `${a.event} for your area. ${HAZARDS[a.category].animals}`);
        localStorage.setItem(SEEN_ALERTS, JSON.stringify(list.map((x) => x.id)));
      }
    } catch { /* weather alerts are extra context; stay quiet if they fail */ }
  }

  useEffect(() => {
    loadRehabs().then(setRehabs).catch(() => {});
    refreshFires(false);
    refreshAlerts(false);
    const timer = setInterval(() => { refreshFires(true, true); refreshAlerts(true); }, 30 * 60 * 1000);

    supabase
      .from('reports')
      .select('*')
      .neq('status', 'delivered')
      .order('created_at', { ascending: false })
      .then(({ data, error: e }) => (e ? setError(e.message) : setReports(data)));

    const ch = supabase
      .channel('reports-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (p) => {
        setReports((rs) => [p.new, ...rs.filter((r) => r.id !== p.new.id)]);
        if (volunteerMatches(volRef.current, p.new)) {
          alertUser('report', p.new.ai_json?.second_look
            ? `A finder nearby wants a second look at a ${p.new.species || 'wild animal'}. Check the photo.`
            : `New report nearby: ${p.new.species || 'animal'} needs help.`);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports' }, (p) => {
        setReports((rs) => rs.map((r) => (r.id === p.new.id ? p.new : r)));
      })
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(ch);
    };
  }, []);

  const rehabById = useMemo(() => Object.fromEntries(rehabs.map((r) => [r.id, r])), [rehabs]);
  const mine = reports.filter((r) => r.volunteer_id === vol.id && r.status !== 'delivered');
  const open = reports
    .filter((r) => r.status === 'open' && volunteerMatches(vol, r))
    .sort((a, b) => haversineKm(vol, a) - haversineKm(vol, b));

  async function accept(r) {
    // Only succeeds if still open, so two volunteers can't both take it.
    const { data, error: e } = await supabase
      .from('reports')
      .update({ status: 'accepted', volunteer_id: vol.id })
      .eq('id', r.id)
      .eq('status', 'open')
      .select();
    if (e) return setError(e.message);
    if (!data.length) return setBanner({ kind: 'info', text: 'Someone else just accepted that one.' });
    setReports((rs) => rs.map((x) => (x.id === r.id ? data[0] : x)));
  }

  // A second look where the animal turns out to be fine: close it and tell the finder.
  async function closeFine(r) {
    const { data, error: e } = await supabase
      .from('reports').update({ status: 'delivered', ai_json: { ...r.ai_json, checked_ok: true } }).eq('id', r.id).select().single();
    if (e) return setError(e.message);
    setReports((rs) => rs.map((x) => (x.id === r.id ? data : x)));
  }

  async function advance(r, status) {
    const { data, error: e } = await supabase
      .from('reports').update({ status }).eq('id', r.id).select().single();
    if (e) return setError(e.message);
    setReports((rs) => rs.map((x) => (x.id === r.id ? data : x)));
  }

  return (
    <section>
      {banner && (
        <div className={`banner ${banner.kind}`} onClick={() => setBanner(null)} role="alert">
          {banner.text} <span className="fine">Tap to dismiss</span>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <div className="row">
        <p><strong>{vol.name}</strong> · within {fmtDist(vol.radius_km)}</p>
        <button className="link" onClick={onSignOut}>Change</button>
      </div>

      <MapView
        center={vol}
        reports={reports.filter((r) => r.status !== 'delivered')}
        fires={fires}
        alerts={alerts}
        radius={{ lat: vol.lat, lng: vol.lng, km: vol.radius_km }}
        height={260}
      />
      <div className="row">
        <p className="fine">Fire zones are places to check, not confirmed sightings.</p>
        <button className="btn small" onClick={() => refreshFires(true)}>Refresh fires</button>
      </div>
      <MapLegend radius alerts={alerts} />
      <HazardCards alerts={alerts} />

      {mine.length > 0 && <h2>Your pickups</h2>}
      {mine.map((r) => (
        <ReportCard key={r.id} r={r} vol={vol} rehab={rehabById[r.rehab_id]}>
          {r.status === 'accepted' && (
            <button className="btn primary" onClick={() => advance(r, 'picked_up')}>Mark picked up</button>
          )}
          {r.status === 'accepted' && r.ai_json?.second_look && (
            <button className="btn" onClick={() => closeFine(r)}>Animal is fine: close the report</button>
          )}
          {r.status === 'picked_up' && (
            <button className="btn primary" onClick={() => advance(r, 'delivered')}>Mark delivered</button>
          )}
          <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`} target="_blank" rel="noreferrer">
            Directions to animal
          </a>
        </ReportCard>
      ))}

      <h2>Open reports near you</h2>
      {open.length === 0 && <p className="fine">Nothing right now. Alerts only arrive while this page is open, so keep it open.</p>}
      {open.map((r) => (
        <ReportCard key={r.id} r={r} vol={vol} rehab={rehabById[r.rehab_id]}>
          <button className="btn primary" onClick={() => accept(r)}>Accept</button>
        </ReportCard>
      ))}
    </section>
  );
}

function ReportCard({ r, vol, rehab, children }) {
  const t = r.ai_json?.triage;
  return (
    <div className="card report">
      <img src={r.photo_url} alt={r.species || 'Reported animal'} />
      <div>
        <p className="eyebrow">
          {fmtDist(haversineKm(vol, r))} away · <span className={`tag ${r.urgency}`}>{r.urgency} urgency</span>
        </p>
        <h3>{r.species || 'Unknown animal'}{r.age_stage && r.age_stage !== 'unknown' ? ` (${r.age_stage})` : ''}</h3>
        {r.near_fire && <p className="tag fire">Near recent fire ({fmtDist(r.fire_distance_km)})</p>}
        {r.ai_json?.hit_by_vehicle && <p className="tag">Hit by a car</p>}
        {r.ai_json?.second_look && (
          <p className="tag second-look-tag">
            Second look requested: the photo check said "{({ leave_it: 'Leave it', watch: 'Watch it', needs_help: 'Needs help' })[r.verdict] || 'Not sure'}", the finder disagrees
          </p>
        )}
        {r.ai_json?.hazards?.map((h) => (
          <p className="tag hazard-tag" key={h.event} style={{ '--hazard': HAZARDS[h.category]?.color }}>During: {h.event}</p>
        ))}
        {t?.reasons?.length > 0 && <p>{t.reasons.join(' ')}</p>}
        {t?.handling_warning && <p className="error">{t.handling_warning}</p>}
        {r.ai_json?.finder_name && <p className="fine">Reported by {r.ai_json.finder_name}</p>}
        {r.note && <p>Finder's note: {r.note}</p>}
        <p className="fine">
          {rehab
            ? `Take to: ${rehab.name}${rehab.hours ? ` · ${rehab.hours}` : ''}${rehab.phone ? ` · ${rehab.phone}` : ''}`
            : 'Take to: the nearest licensed wildlife rehabber. Call them first to check they take this animal.'}
        </p>
        <div className="actions">{children}</div>
      </div>
    </div>
  );
}
