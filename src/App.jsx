import { useRef, useState } from 'react';
import { configured } from './lib/supabase.js';
import Finder from './pages/Finder.jsx';
import Volunteer from './pages/Volunteer.jsx';
import RiskMap from './pages/RiskMap.jsx';
import FireCalendar from './pages/FireCalendar.jsx';
import RocketLaunch from './components/RocketLaunch.jsx';
import FinaleGif, { PixelCat } from './components/FinaleGif.jsx';
import { playCatSound } from './lib/catSound.js';

const TABS = [
  { id: 'finder', label: 'Found an animal' },
  { id: 'volunteer', label: 'My account' },
  { id: 'map', label: 'Risk map' },
  { id: 'fires', label: 'Fire calendar' },
];

export default function App() {
  const [tab, setTab] = useState(() => location.hash.slice(1) || 'finder');
  // On open, the rocket waits on its pad until someone taps it, so a whole room can watch.
  // The header button launches it straight away.
  const [rocket, setRocket] = useState(
    () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  const [autoClose, setAutoClose] = useState(true);
  const [finale, setFinale] = useState(false);
  // The cat tune starts inside the tap itself, which is what phones require
  // before they will play sound.
  const stopCat = useRef(null);
  const openFinale = () => { stopCat.current?.(); stopCat.current = playCatSound(); setFinale(true); };
  const closeFinale = () => { stopCat.current?.(); stopCat.current = null; setFinale(false); };
  const go = (id) => {
    location.hash = id;
    setTab(id);
  };

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand"><img src="/logo.svg" alt="" width="30" height="30" />CritterLift</h1>
        <div className="top-buttons">
          <button className="rocket-btn cat-btn" onClick={openFinale} aria-label="Play the closing cat animation">
            <PixelCat />
          </button>
          <button className="rocket-btn" onClick={() => { setAutoClose(false); setRocket(true); }} aria-label="Launch the rocket">
            🚀
          </button>
        </div>
      </header>
      {finale && <FinaleGif onClose={closeFinale} />}
      {rocket && <RocketLaunch autoClose={autoClose} autoStart={!autoClose} onClose={() => setRocket(false)} />}

      <main>
        {!configured ? (
          <div className="card bad">
            <h2>Setup needed</h2>
            <p>
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your
              environment, then reload. See the README.
            </p>
          </div>
        ) : tab === 'volunteer' ? (
          <Volunteer />
        ) : tab === 'map' ? (
          <RiskMap />
        ) : tab === 'fires' ? (
          <FireCalendar />
        ) : (
          <Finder />
        )}
      </main>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
