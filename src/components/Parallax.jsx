import { useEffect, useRef, useState } from 'react';

// A photo that drifts slower than the page as you scroll. The image is 30%
// taller than its frame and slides inside it. If the photo can't load, the
// frame's own gradient shows instead, so nothing looks broken offline.
export default function Parallax({ photo, className = '', strength = 0.2, children }) {
  const frame = useRef(null);
  const img = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const place = () => {
      raf = 0;
      const el = frame.current;
      if (!el || !img.current) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > window.innerHeight + 50) return; // off screen
      const fromCenter = r.top + r.height / 2 - window.innerHeight / 2;
      const limit = r.height * 0.15;
      const y = Math.max(-limit, Math.min(limit, -fromCenter * strength));
      img.current.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(place); };
    place();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [failed, strength]);

  return (
    <div ref={frame} className={`parallax ${className}`}>
      {!failed && (
        <img
          ref={img}
          className="parallax-img"
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {children}
    </div>
  );
}
