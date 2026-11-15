import { HAZARDS, untilText } from '../lib/hazards.js';

// One card per active weather alert. audience="finder" shows what to do with
// the animal in hand; otherwise it shows which animals to look out for.
export default function HazardCards({ alerts, audience = 'volunteer' }) {
  if (!alerts?.length) return null;
  return alerts.map((a) => {
    const h = HAZARDS[a.category];
    return (
      <div className="hazard" key={a.id} style={{ '--hazard': h.color }}>
        <p className="hazard-kind">
          <span className="hazard-icon" aria-hidden="true">{h.icon}</span>
          {h.label}
          {a.example && <span className="tag">Example, not a live alert</span>}
        </p>
        <h3>{a.event} {untilText(a.ends)}</h3>
        <p>{audience === 'finder' ? h.finder : h.animals}</p>
        {!a.example && <p className="fine">National Weather Service{a.area ? `, ${a.area}` : ''}</p>}
      </div>
    );
  });
}
