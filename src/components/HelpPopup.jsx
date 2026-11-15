import { useEffect, useRef, useState } from 'react';
import LocalHelp from './LocalHelp.jsx';
import { getLocation } from '../lib/geo.js';

// Pops up when the photo check says an animal needs help. The finder picks who
// to contact: nearby volunteers (in the app), or a real Austin organization.
// Nothing is sent automatically; calls and messages are always the finder's tap.
export default function HelpPopup({ triage, photoUrl, onVolunteers, onClose }) {
  const sheet = useRef(null);
  const [shared, setShared] = useState('');
  const rabies = triage?.animal_type === 'rabies_vector';
  const adultDeer = triage?.animal_type === 'deer' && triage?.age_stage === 'adult';
  useEffect(() => {
    sheet.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function shareDetails() {
    const loc = await getLocation();
    const lines = [
      `I found a wild animal that seems to need help: ${triage.species}${triage.age_stage !== 'unknown' ? ` (${triage.age_stage})` : ''}.`,
      triage.reasons?.length ? `What I can see: ${triage.reasons.join(' ')}` : '',
      loc.fallback ? '' : `Location: https://www.google.com/maps?q=${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`,
      photoUrl ? `Photo: ${photoUrl}` : '',
    ].filter(Boolean);
    const text = lines.join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ text });
        setShared('');
      } else {
        await navigator.clipboard.writeText(text);
        setShared('Copied. Paste it into a text or email, or read it out on the call.');
      }
    } catch {
      /* the finder closed the share sheet */
    }
  }

  const volunteers = (
    <div className="contact">
      <h3>Volunteers near you</h3>
      <p>
        {rabies
          ? 'If animal control can\'t come, a volunteer trained to handle these animals can: they get an alert with your photo and pin and drive it to a rehabber.'
          : 'A volunteer comes to you: someone nearby gets an alert with your photo and pin, picks the animal up and drives it to a rehabber.'}
      </p>
      <button className={rabies ? 'btn' : 'btn primary'} onClick={onVolunteers}>Alert nearby volunteers</button>
    </div>
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
        ref={sheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row">
          <h2 id="help-title">Who should help this animal?</h2>
          <button className="link" onClick={onClose}>Close</button>
        </div>

        {rabies && (
          <p className="sheet-warning">
            Do not touch it. For bats, raccoons, skunks, foxes and coyotes, call animal control first (3-1-1 in Austin).
          </p>
        )}
        {adultDeer && (
          <p className="sheet-warning">
            Rescue groups and volunteers usually can't take adult deer, and an injured deer can hurt you. Stay back and call animal control (3-1-1 in Austin) or your local police non-emergency line.
          </p>
        )}

        {/* Adult deer: no volunteer pickup. Rabies animals: animal control comes first. */}
        {!adultDeer && !rabies && volunteers}

        <LocalHelp auto rabiesFirst={rabies || adultDeer} takeIt={!adultDeer} />

        {rabies && volunteers}

        <div className="contact">
          <h3>Send a message instead</h3>
          <p>Opens your phone's share menu with a ready-made message: the species, what the photo shows, your location and the photo link. Send it by text or email to whoever you reach.</p>
          <button className="btn" onClick={shareDetails}>Write the message for me</button>
          {shared && <p className="fine" role="status">{shared}</p>}
        </div>
      </div>
    </div>
  );
}
