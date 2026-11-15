import { useEffect, useRef, useState } from 'react';
import { W, H, DURATION, drawScene } from '../lib/rocketScene.js';
import { playRocketSound } from '../lib/rocketSound.js';

// Full-screen 8-bit cutscene: rocket launches, hits the moon, and a
// RIVER HACKS flag rises from the crater.
//   autoStart  false: waits on the launch pad until tapped (so a room can watch).
//              true: starts at once (used by the header button, which is itself a tap).
//   autoClose  dismisses itself shortly after the flag is up.
// Once running, a tap or Esc closes it.
export default function RocketLaunch({ onClose, autoClose = false, autoStart = false }) {
  const canvas = useRef(null);
  const [started, setStarted] = useState(autoStart);

  // Waiting on the pad: one still frame.
  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (!started) drawScene(ctx, 0);
  }, [started]);

  // Running: animation, soundtrack and the optional auto-close.
  useEffect(() => {
    if (!started) return;
    const ctx = canvas.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const stopSound = playRocketSound();
    const closer = autoClose ? setTimeout(onClose, DURATION + 2400) : null; // lets the music finish

    let raf;
    // People who ask for less motion get the final frame, held still.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      drawScene(ctx, DURATION);
    } else {
      const start = performance.now();
      const tick = (now) => {
        drawScene(ctx, now - start); // keeps running past the end so the flag waves
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(closer);
      stopSound();
    };
  }, [started]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if ((e.key === 'Enter' || e.key === ' ') && !started) setStarted(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, started]);

  return (
    <div
      onClick={() => (started ? onClose() : setStarted(true))}
      role="dialog"
      aria-label={started ? 'Rocket launch animation. Tap to close.' : 'Rocket on the launch pad. Tap to launch.'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: '#0b0d1e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <canvas
        ref={canvas}
        width={W}
        height={H}
        style={{
          height: 'min(84dvh, 150vw)',
          aspectRatio: `${W} / ${H}`,
          imageRendering: 'pixelated',
        }}
      />
      <p
        className={started ? '' : 'launch-prompt'}
        style={{ color: started ? '#7d86b3' : '#ffd23f', font: `${started ? 14 : 20}px monospace`, margin: '10px 0 0' }}
      >
        {!started ? 'TAP TO LAUNCH' : autoClose ? 'TAP TO SKIP' : 'TAP TO CLOSE'}
      </p>
      {!started && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ marginTop: 6, background: 'none', border: 0, color: '#7d86b3', font: '13px monospace', cursor: 'pointer', padding: 8 }}
        >
          SKIP
        </button>
      )}
    </div>
  );
}
