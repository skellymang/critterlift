import { useEffect, useState } from 'react';
import AgencyList from './AgencyList.jsx';
import { findLocalHelp, savedLocalHelp, NATIONWIDE } from '../lib/localHelp.js';
import { fmtDist } from '../lib/geo.js';

// Who to contact, wherever the person is in the US.
//   auto         look up the location straight away (it may ask permission)
//   rabiesFirst  bats, raccoons, skunks, foxes, coyotes: animal control goes first
//   takeIt       also show the "take it there yourself" advice
export default function LocalHelp({ auto = false, rabiesFirst = false, takeIt = false }) {
  const [help, setHelp] = useState(() => savedLocalHelp());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function locate() {
    setBusy(true);
    setError('');
    try {
      setHelp(await findLocalHelp());
    } catch (e) {
      setError(e.message || 'Could not search for help nearby');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (auto && !help) locate();
  }, []);

  if (busy) return <div className="contact"><p>Finding help near you…</p></div>;

  if (help?.mode === 'nearby') {
    const groups = [
      { title: 'Wildlife rehabbers near you', list: help.wildlife },
      { title: 'Animal control and shelters near you', list: help.animal_control },
    ];
    if (rabiesFirst) groups.reverse();
    const nearest = help.wildlife[0];
    return (
      <>
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="local-title">{g.title}</h3>
            {g.list.length === 0 && <p className="fine">The map search found none within 75 miles.</p>}
            {g.list.map((p) => <Place key={p.name} p={p} />)}
          </div>
        ))}
        {takeIt && nearest && !rabiesFirst && (
          <div className="contact">
            <h3>Or drive it in yourself</h3>
            <p>
              You don't have to wait for anyone. Phone {nearest.name} ({fmtDist(nearest.km)} away) using
              the button above to say you are coming, then put the animal in a box with air holes and
              drive it there. Keep the box dark and quiet in the car, with no food or water.
            </p>
            <p className="fine">The call also confirms they take this kind of animal and are open.</p>
          </div>
        )}
        <div className="contact">
          <h3>Police non-emergency line</h3>
          <p>
            If the animal is a danger to people or traffic, call your local police non-emergency
            number. For an emergency, call 911.
          </p>
        </div>
        <div className="contact">
          <h3>{NATIONWIDE.name}</h3>
          <p>A nationwide directory of wildlife emergency help, if none of the places above can take it.</p>
          <a className="btn" href={NATIONWIDE.url} target="_blank" rel="noreferrer">Open {NATIONWIDE.name}</a>
        </div>
        <p className="fine">
          These places come from a live map search of your area. Call before you go to confirm they
          take wildlife.
        </p>
      </>
    );
  }

  // Austin area, location unknown, or not looked up yet: the Austin contacts.
  return (
    <>
      {help?.mode === 'unknown' && (
        <p className="fine">We couldn't get your location, so these are the Austin services.</p>
      )}
      {error && <p className="error">{error} Showing the Austin services instead.</p>}
      <AgencyList rabiesFirst={rabiesFirst} />
      {takeIt && !rabiesFirst && (
        <div className="contact">
          <h3>Or drive it in yourself</h3>
          <p>
            You don't have to wait for anyone. Phone Austin Wildlife Rescue using the button above
            to say you are coming and get the address, then put the animal in a box with air holes
            and drive it there. Keep the box dark and quiet in the car, with no food or water.
          </p>
          <p className="fine">Drop-off is 9am to 4pm daily.</p>
        </div>
      )}
    </>
  );
}

function Place({ p }) {
  return (
    <div className="contact">
      <h3>{p.name}</h3>
      <p>
        {fmtDist(p.km)} away{p.type ? `. ${p.type}` : ''}{p.open ? `. ${p.open}` : ''}
      </p>
      {p.address && <p className="fine">{p.address}</p>}
      {p.tel && <a className="btn" href={`tel:${p.tel}`}>Call {p.phone}</a>}
      <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`} target="_blank" rel="noreferrer">
        Directions
      </a>
      {p.website && <a className="btn" href={p.website} target="_blank" rel="noreferrer">Website</a>}
    </div>
  );
}
