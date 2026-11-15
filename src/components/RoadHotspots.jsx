import { useEffect, useState } from 'react';
import { signRequestText } from '../lib/roads.js';

// Lists road danger spots and helps a resident ask the City of Austin for a
// wildlife crossing sign. The app drafts the request; the resident sends it.
export default function RoadHotspots({ spots, showExamples = false, onToggleExamples }) {
  const [open, setOpen] = useState(null);

  return (
    <div className="card">
      <h2>Road danger spots</h2>
      {spots.length === 0 && (
        <p>No real spots yet. See the map key for how a spot gets on the map.</p>
      )}
      <button className="btn" onClick={onToggleExamples}>
        {showExamples ? 'Hide the example road danger spots' : 'Show example road danger spots'}
      </button>
      {showExamples && <p className="fine">Two made-up spots are now on the map as yellow diamonds, and listed here.</p>}
      {spots.map((s) => (
        <div className="contact" key={s.id}>
          <h3>{s.count} animals hit near here {s.example && <span className="tag">Example, not real</span>}</h3>
          <p>
            {s.species.length ? `${s.species.join(', ')}. ` : ''}
            <a href={`https://www.google.com/maps?q=${s.lat.toFixed(5)},${s.lng.toFixed(5)}`} target="_blank" rel="noreferrer">
              See the spot on a map
            </a>
          </p>
          <button className="btn primary" onClick={() => setOpen(s)}>Ask the city for a crossing sign</button>
        </div>
      ))}
      {open && <SignRequest spot={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SignRequest({ spot, onClose }) {
  const [text, setText] = useState(() => signRequestText(spot));
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Copied. Paste it into the 3-1-1 request.');
    } catch {
      setNote('Could not copy. Select the text above and copy it by hand.');
    }
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: 'Wildlife crossing sign request', text });
      else await copy();
    } catch { /* share sheet closed */ }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sign-title" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 id="sign-title">Ask the city for a crossing sign</h2>
          <button className="link" onClick={onClose}>Close</button>
        </div>

        <div className="contact">
          <h3>1. Check and edit the request</h3>
          <textarea className="request-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} aria-label="Request text" />
          <button className="btn primary" onClick={copy}>Copy the request</button>
          {note && <p className="fine" role="status">{note}</p>}
        </div>

        <div className="contact">
          <h3>2. Send it to Austin 3-1-1</h3>
          <p>
            Open a new service request, choose the type <strong>Traffic Sign New</strong>, set the
            location to this spot, and paste the request into the description.
          </p>
          <a className="btn" href="https://311.austintexas.gov/" target="_blank" rel="noreferrer">Open Austin 3-1-1 online</a>
          <a className="btn" href="tel:311">Call 3-1-1</a>
          <a className="btn" href="tel:+15129742000">Outside Austin: call 512-974-2000</a>
        </div>

        <div className="contact">
          <h3>3. Get neighbors to back it</h3>
          <p>Requests carry more weight with more voices. Share the text so others can send their own.</p>
          <button className="btn" onClick={share}>Share the request</button>
        </div>

        <p className="fine">
          The city decides whether a sign goes up. Highways and frontage roads belong to the state
          (TxDOT), not the city, so a request there may be passed on or closed.
        </p>
      </div>
    </div>
  );
}
