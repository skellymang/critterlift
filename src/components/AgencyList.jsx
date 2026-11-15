import { CONTACTS } from '../lib/contacts.js';

// Call and message buttons for the real Austin agencies. rabiesFirst puts the
// city's 3-1-1 line at the top (bats, raccoons, skunks, foxes, coyotes).
export default function AgencyList({ rabiesFirst = false }) {
  const contacts = [...CONTACTS].sort((a, b) =>
    rabiesFirst ? (b.bestForRabies ? 1 : 0) - (a.bestForRabies ? 1 : 0) : 0
  );
  return contacts.map((c) => (
    <div className="contact" key={c.id}>
      <h3>{c.name}</h3>
      <p>{c.what}</p>
      <p className="fine">{c.note}</p>
      {c.tel && <a className="btn" href={`tel:${c.tel}`}>Call {c.phone}</a>}
      {c.altTel && <a className="btn" href={`tel:${c.altTel}`}>Outside Austin: call {c.altPhone}</a>}
      {c.messageUrl && <a className="btn" href={c.messageUrl} target="_blank" rel="noreferrer">{c.messageLabel}</a>}
      {c.url && <a className="btn" href={c.url} target="_blank" rel="noreferrer">Open their website</a>}
    </div>
  ));
}
