import { useEffect, useState } from 'react';

// A photo frame that fades from one photo to the next. Photos that fail to
// load are dropped from the rotation; if none load, the frame's own gradient
// shows. People who ask for reduced motion get the first photo, held still.
export default function Fader({ photos, className = '', interval = 2800, delay = 0, children }) {
  const [failed, setFailed] = useState(() => new Set());
  const [active, setActive] = useState(0);
  const usable = photos.filter((p) => !failed.has(p.src));

  useEffect(() => {
    if (usable.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let timer;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        if (!document.hidden) setActive((i) => i + 1);
      }, interval);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [usable.length, interval, delay]);

  const current = usable.length ? active % usable.length : 0;

  return (
    <div className={`fader ${className}`}>
      {usable.map((p, i) => (
        <img
          key={p.src}
          className={i === current ? 'on' : ''}
          src={p.src}
          alt={p.alt}
          aria-hidden={i === current ? undefined : true}
          loading={i === 0 ? 'eager' : 'lazy'}
          onError={() => setFailed((f) => new Set(f).add(p.src))}
        />
      ))}
      {usable.length > 1 && (
        <div className="fader-dots" aria-hidden="true">
          {usable.map((p, i) => <i key={p.src} className={i === current ? 'on' : ''} />)}
        </div>
      )}
      {children}
    </div>
  );
}
