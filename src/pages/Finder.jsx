import { useEffect, useState } from 'react';
import MapView from '../components/MapView.jsx';
import Fader from '../components/Fader.jsx';
import HelpPopup from '../components/HelpPopup.jsx';
import LocalHelp from '../components/LocalHelp.jsx';
import HazardCards from '../components/HazardCards.jsx';
import { loadAlerts } from '../lib/hazards.js';
import { HERO_PHOTOS, STEP_PHOTOS, PHOTO_CREDITS } from '../lib/photos.js';
import { supabase, uploadPhoto, loadRehabs, loadFires } from '../lib/supabase.js';
import { getLocation, fireContext, bumpUrgency, pickRehab, fmtDist } from '../lib/geo.js';
import { VERDICT_TEXT, STATUS_TEXT } from '../lib/constants.js';

const SAVED = 'wh_my_report';

// How the app works, in order. Shown on the landing page.
const STORY = [
  {
    photos: STEP_PHOTOS[0],
    title: 'Take a photo and find out if it needs you',
    text: 'CritterLift names the animal and tells you to leave it, watch it, or get it help. Most young animals on the ground are fine, and the app says so. If you think it got it wrong, you can ask a volunteer for a second look.',
  },
  {
    photos: STEP_PHOTOS[1],
    title: 'If it needs help, you choose how',
    text: 'There are three ways, and the difference is who moves the animal:',
    options: [
      ['A volunteer comes to you', 'Ping a volunteer. Someone nearby gets an alert with your photo and pin, picks the animal up and drives it to a rehabber.'],
      ['A rescue service handles it', 'Call one for advice. Animal control (3-1-1 in Austin) can send an officer to collect the animal.'],
      ['You drive it in', 'Phone the rescue to say you are coming, box the animal up and take it there yourself.'],
    ],
  },
  {
    photos: STEP_PHOTOS[2],
    title: 'The goal is to send it home',
    text: 'Rehabbers treat it and, when it is strong enough, release it back where it belongs.',
  },
];

export default function Finder() {
  const [step, setStep] = useState('start'); // start | working | result | report | sent
  const [photoUrl, setPhotoUrl] = useState(null);
  const [result, setResult] = useState(null); // { triage, lens, identified_with }
  const [pin, setPin] = useState(null);
  const [pinNote, setPinNote] = useState('');
  const [note, setNote] = useState('');
  const [report, setReport] = useState(null);
  const [rehab, setRehab] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hitByCar, setHitByCar] = useState(false);
  const [secondLook, setSecondLook] = useState(false); // finder disagrees with the photo check
  const [alerts, setAlerts] = useState([]);
  const account = (() => { try { return JSON.parse(localStorage.getItem('wh_volunteer')); } catch { return null; } })();

  // Weather alerts for wherever the pin is (freeze, heat, flood, storm, fire weather).
  useEffect(() => {
    if (!pin) return;
    let live = true;
    loadAlerts(pin).then((a) => live && setAlerts(a)).catch(() => live && setAlerts([]));
    return () => { live = false; };
  }, [pin?.lat.toFixed(2), pin?.lng.toFixed(2)]);

  // Come back to a report in progress after a reload.
  useEffect(() => {
    const id = localStorage.getItem(SAVED);
    if (!id) return;
    supabase.from('reports').select('*, rehabs(*)').eq('id', id).maybeSingle().then(({ data }) => {
      if (data && data.status !== 'delivered') {
        setReport(data);
        setRehab(data.rehabs);
        setStep('sent');
      }
    });
  }, []);

  // Live status for the finder: open -> accepted -> picked_up -> delivered.
  useEffect(() => {
    if (!report?.id) return;
    const ch = supabase
      .channel(`report-${report.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reports', filter: `id=eq.${report.id}` },
        (p) => setReport((r) => ({ ...r, ...p.new }))
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [report?.id]);

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setStep('working');
    try {
      const url = await uploadPhoto(file);
      setPhotoUrl(url);
      const r = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: url }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Something went wrong');
      setResult(body);
      setStep('result');
      // An animal that needs help: ask straight away who should be contacted.
      setShowHelp(body.triage.verdict === 'needs_help' && !body.triage.low_confidence);
    } catch (err) {
      setError(
        navigator.onLine
          ? `${err.message || err}`
          : 'No signal. Move somewhere with a connection and try again.'
      );
      setStep('start');
    }
  }

  async function startReport(askSecondLook = false) {
    setSecondLook(askSecondLook === true);
    setShowHelp(false);
    setHitByCar(result?.triage?.cause === 'vehicle'); // pre-ticked if the photo suggested it
    setStep('report');
    const loc = await getLocation();
    setPin({ lat: loc.lat, lng: loc.lng });
    setPinNote(
      loc.fallback
        ? 'We could not get your location. Tap the map where the animal is.'
        : 'Pin set to your location. Tap the map to move it.'
    );
  }

  async function sendReport() {
    setBusy(true);
    setError('');
    try {
      const t = result.triage;
      const [fires, rehabs] = await Promise.all([
        loadFires().catch(() => []), // NASA layer is context; never block a report on it
        loadRehabs().catch(() => []),
      ]);
      const ctx = fireContext(pin, fires);
      const match = pickRehab(pin, t.animal_type, rehabs);
      const row = {
        photo_url: photoUrl,
        lat: pin.lat,
        lng: pin.lng,
        species: t.species,
        animal_type: t.animal_type,
        age_stage: t.age_stage,
        verdict: t.verdict,
        // A nearby fire or an active weather alert raises urgency one level.
        urgency: ctx.near_fire || alerts.length ? bumpUrgency(t.urgency) : secondLook && t.urgency === 'low' ? 'medium' : t.urgency,
        ai_json: {
          triage: t,
          lens_titles: result.lens?.titles || [],
          hazards: alerts.map((a) => ({ event: a.event, category: a.category })),
          second_look: secondLook, // the finder thinks the photo check got it wrong
          finder_name: account?.name || null, // first name only; contact details never go on a report
          hit_by_vehicle: hitByCar, // the finder's own answer; feeds the road danger spots
        },
        note: note.trim() || null,
        near_fire: ctx.near_fire,
        fire_distance_km: ctx.fire_distance_km,
        rehab_id: match?.rehab.id || null,
      };
      const { data, error: dbErr } = await supabase.from('reports').insert(row).select().single();
      if (dbErr) throw dbErr;
      localStorage.setItem(SAVED, data.id);
      setReport(data);
      setRehab(match ? { ...match.rehab, km: match.km } : null);
      setStep('sent');
    } catch (err) {
      setError(`Could not send the report: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    localStorage.removeItem(SAVED);
    setStep('start');
    setPhotoUrl(null);
    setResult(null);
    setPin(null);
    setNote('');
    setReport(null);
    setRehab(null);
    setError('');
    setShowHelp(false);
    setSecondLook(false);
  }

  if (step === 'start') {
    return (
      <section className="home">
        <Fader photos={HERO_PHOTOS} className="hero">
          <div className="hero-copy">
            <h2 className="hero-title">Found an injured or sick wild animal?</h2>
            <p>Take a photo. We'll tell you what it is and whether it really needs help.</p>
            <p className="hero-more">
              If it does, a volunteer can come to you, a rescue service can handle it, or you can drive it in yourself.
            </p>
          </div>
        </Fader>

        <div className="hero-action">
          <label className="btn primary big">
            Take or choose a photo
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} hidden />
          </label>
          {error && <p className="error">{error}</p>}
          <p className="fine">
            Photos are stored at a public link. Keep people and house numbers out of the shot.
          </p>
          <p className="fine">
            {account
              ? `Signed in as ${account.name}. Your first name goes on the reports you send.`
              : 'No account needed. If you want one, create it in the My account tab, where you can also sign up to volunteer.'}
          </p>
        </div>

        <h2 className="section-title">How CritterLift works</h2>
        <ol className="story">
          {STORY.map((s, n) => (
            <li key={s.title}>
              <Fader photos={s.photos} className="story-photo" interval={3000} delay={500 + n * 700} />
              <div className="story-text">
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                {s.options && (
                  <ul className="story-options">
                    {s.options.map(([name, what]) => (
                      <li key={name}><strong>{name}.</strong> {what}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
        <h2 className="section-title">Contact a rescue service directly</h2>
        <p>
          You don't need the app to get help. If you can't reach a volunteer, or you'd rather call,
          these services can help. The app uses your location to show the ones nearest you.
        </p>
        <LocalHelp auto />

        <p className="fine">{PHOTO_CREDITS}</p>
      </section>
    );
  }

  if (step === 'working') {
    return (
      <div className="card center">
        <div className="spinner" />
        <p>Looking at your photo…</p>
      </div>
    );
  }

  if (step === 'result') {
    const t = result.triage;
    const v = VERDICT_TEXT[t.verdict];
    return (
      <section>
        {photoUrl && <img className="photo" src={photoUrl} alt="Your photo" />}
        {t.low_confidence ? (
          <div className="card warn">
            <h2>Not sure. Call a rehabber.</h2>
            <p>
              {t.is_wild_animal
                ? `This might be a ${t.species.toLowerCase()}, but the photo isn't clear enough to judge.`
                : "We couldn't find a wild animal in this photo."}{' '}
              Try a closer, well-lit photo, or call a licensed wildlife rehabilitator.
            </p>
          </div>
        ) : (
          <div className={`card ${v.tone}`}>
            <p className="species-name">{t.species}</p>
            {t.age_stage !== 'unknown' && <p className="species-age">{t.age_stage}</p>}
            <h2>{v.title}</h2>
            <p>{v.blurb}</p>
            {t.reasons.length > 0 && <List title="What we see" items={t.reasons} />}
          </div>
        )}

        {t.handling_warning && <div className="card bad"><strong>Safety:</strong> {t.handling_warning}</div>}
        {!t.low_confidence && t.do_now.length > 0 && (
          <div className="card"><List title="Do now" items={t.do_now} /></div>
        )}
        {!t.low_confidence && t.do_not.length > 0 && (
          <div className="card"><List title="Don't" items={t.do_not} /></div>
        )}

        {!t.low_confidence && t.facts?.length > 0 && (
          <div className="card facts">
            <h3>About this animal: {t.species}</h3>
            <ul>{t.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>
        )}

        {!t.low_confidence && t.verdict === 'needs_help' && (
          <button className="btn primary big" onClick={() => setShowHelp(true)}>
            Get help for this animal
          </button>
        )}
        {t.low_confidence && (
          <button className="btn primary" onClick={() => setShowHelp(true)}>
            See who to call
          </button>
        )}
        {(t.low_confidence || t.verdict !== 'needs_help') && (
          <div className="card second-look">
            <h3>Think something is wrong?</h3>
            <p>
              The photo check can make mistakes. If the animal looks hurt or sick to you, send the
              photo to nearby volunteers and a person will take a second look.
            </p>
            <button className="btn primary" onClick={() => startReport(true)}>
              Ask a volunteer to look at it
            </button>
          </div>
        )}
        {showHelp && (
          <HelpPopup
            triage={t}
            photoUrl={photoUrl}
            onVolunteers={() => startReport(false)}
            onClose={() => setShowHelp(false)}
          />
        )}
        <button className="btn" onClick={reset}>Try another photo</button>
        <p className="fine center">Identified with {result.identified_with}.</p>
      </section>
    );
  }

  if (step === 'report') {
    return (
      <section>
        <div className="card">
          <h2>Where is the animal?</h2>
          {secondLook && <p>Your photo and this location go to nearby volunteers, marked as needing a second look.</p>}
          <p className="fine">{pinNote || 'Finding your location…'}</p>
          <MapView center={pin} pin={pin} onPick={setPin} height={280} />
          <HazardCards alerts={alerts} audience="finder" />
          <label className="check hit-check">
            <input type="checkbox" checked={hitByCar} onChange={(e) => setHitByCar(e.target.checked)} />
            <span>
              <strong>This animal was hit by a car</strong>
              <span className="fine"> Tick this if you saw it happen or found it on or beside a road. It helps map dangerous roads.</span>
            </span>
          </label>
          <label className="field">
            Anything a volunteer should know? (optional)
            <textarea
              rows={3}
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Under the oak by the mailbox, in a shoebox"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary big" disabled={!pin || busy} onClick={sendReport}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
          <button className="btn" onClick={() => setStep('result')}>Back</button>
        </div>
      </section>
    );
  }

  // step === 'sent'
  return (
    <section>
      <div className={`card ${report.status === 'open' ? 'warn' : 'ok'}`}>
        <p className="eyebrow">{report.species}</p>
        <h2>{report.ai_json?.checked_ok ? 'A volunteer checked: the animal looks fine' : report.status === 'open' && report.ai_json?.second_look ? 'Waiting for a volunteer to look…' : STATUS_TEXT[report.status]}</h2>
        {report.ai_json?.checked_ok && <p>A volunteer looked at your photo and agrees it does not need rescuing. Leave it where it is. Thank you for checking.</p>}
        {report.status === 'open' && (
          <p>
            {report.ai_json?.second_look
              ? 'Your photo is with volunteers nearby who have CritterLift open. One of them will take a second look. Keep this page open.'
              : 'Your report is live. Volunteers nearby who have CritterLift open see it straight away. Keep this page open, and call a rescue service below if nobody accepts soon.'}
          </p>
        )}
        {report.near_fire && (
          <p className="tag fire">Near a recent fire detected by NASA satellites</p>
        )}
        {report.ai_json?.hazards?.map((h) => (
          <p className="tag" key={h.event}>During: {h.event}</p>
        ))}
      </div>
      {!report.ai_json?.checked_ok && <div className="card">
        <h3>Where it should go</h3>
        {rehab ? (
          <>
            <p><strong>{rehab.name}</strong>{rehab.km != null && ` · ${fmtDist(rehab.km)}`}</p>
            {rehab.hours && <p>Hours: {rehab.hours}</p>}
            {rehab.phone && <p><a href={`tel:${rehab.phone}`}>{rehab.phone}</a></p>}
          </>
        ) : (
          <p>The volunteer will take it to the nearest licensed wildlife rehabber that accepts this kind of animal.</p>
        )}
      </div>}
      {report.status === 'open' && (
        <div className="card">
          <h3>No volunteer yet?</h3>
          <p>
            You don't have to wait. These animal rescue services can help now, and your report stays
            open while you call.
          </p>
          <LocalHelp auto rabiesFirst={report.animal_type === 'rabies_vector'} />
        </div>
      )}
      <button className="btn" onClick={reset}>Start over</button>
    </section>
  );
}

function List({ title, items }) {
  return (
    <>
      <h3>{title}</h3>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </>
  );
}
