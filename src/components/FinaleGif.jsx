import { useEffect, useRef, useState } from 'react';
import { CW, CH, drawCat } from '../lib/catScene.js';

// The closing clip: public/cat-hax.mp4, a short looping video. If that file is
// ever missing, the built-in 8-bit cat plays instead. (A GIPHY link pasted here
// would take priority over both.)
export const FINALE_GIF_LINK = '';
const FINALE_VIDEO = '/cat-hax.mp4';

// Turns any GIPHY link into the direct address of the GIF itself.
export function giphyGif(link) {
  const url = String(link || '').trim();
  if (!url) return '';
  if (/\.(gif|webp)(\?.*)?$/i.test(url)) return url;
  const id = url.match(/giphy\.com\/(?:gifs|embed|clips|stickers)\/(?:.*-)?([A-Za-z0-9]+)\/?(?:\?.*)?$/)?.[1];
  return id ? `https://media.giphy.com/media/${id}/giphy.gif` : '';
}

// The header button: a tiny pixel-art cat face.
export function PixelCat({ size = 22 }) {
  const rows = ['X......X', 'XX....XX', 'XXXXXXXX', 'XGXXXXGX', 'XXXXXXXX', 'XXXPPXXX', '.XXXXXX.', '..XXXX..'];
  const fill = { X: '#14201b', G: '#22e36b', P: '#f2a7b8' };
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill[c]} />))
      )}
    </svg>
  );
}

// Full-screen finale for the end of the presentation. Tap or press Esc to close.
export default function FinaleGif({ onClose }) {
  const gif = giphyGif(FINALE_GIF_LINK);
  const canvas = useRef(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const useVideo = !gif && !videoFailed;

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (gif || useVideo || !canvas.current) return;
    const ctx = canvas.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return drawCat(ctx, 2000);
    let raf;
    const start = performance.now();
    const tick = (now) => {
      drawCat(ctx, now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gif, useVideo]);

  return (
    <div className="finale" role="dialog" aria-label="Closing animation. Tap to close." onClick={onClose}>
      {gif ? (
        <img src={gif} alt="A cat typing furiously at a computer" />
      ) : useVideo ? (
        <video
          src={FINALE_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          aria-label="A cat typing furiously at a laptop"
          onError={() => setVideoFailed(true)}
        />
      ) : (
        <canvas ref={canvas} width={CW} height={CH} aria-label="An 8-bit cat typing furiously at a laptop while green code rains down" />
      )}
      <p>Thank you! Tap to close.</p>
      {gif && <p className="finale-credit">GIF via GIPHY</p>}
    </div>
  );
}
