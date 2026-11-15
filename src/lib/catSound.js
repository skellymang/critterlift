// A cute, original cat tune for the closing screen, made in the browser with
// the Web Audio API: no audio files. A fast arcade arpeggio tune with
// synthesized "meows" on top. Plays for about half a minute.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

export function playCatSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  ctx.resume?.();
  const master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.06;

  function tone(type, midi, at, length, volume) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(NOTE(midi), t0 + at);
    gain.gain.setValueAtTime(0, t0 + at);
    gain.gain.linearRampToValueAtTime(volume, t0 + at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + at + length);
    osc.connect(gain).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + length + 0.02);
  }
  // "Meow": a buzzy voice whose pitch rises then falls, through a filter that
  // opens and closes like a mouth (m - eee - ow).
  function meow(at, base = 74, volume = 0.5) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f = osc.frequency;
    f.setValueAtTime(NOTE(base - 5), t0 + at);
    f.exponentialRampToValueAtTime(NOTE(base + 4), t0 + at + 0.13);
    f.exponentialRampToValueAtTime(NOTE(base - 3), t0 + at + 0.42);
    const mouth = ctx.createBiquadFilter();
    mouth.type = 'bandpass';
    mouth.Q.value = 5;
    mouth.frequency.setValueAtTime(600, t0 + at);
    mouth.frequency.exponentialRampToValueAtTime(2400, t0 + at + 0.14);
    mouth.frequency.exponentialRampToValueAtTime(800, t0 + at + 0.42);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0 + at);
    gain.gain.linearRampToValueAtTime(volume, t0 + at + 0.05);
    gain.gain.setValueAtTime(volume, t0 + at + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + at + 0.46);
    osc.connect(mouth).connect(gain).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + 0.5);
  }

  // A fast, happy arcade tune: bright arpeggios racing up and down like paws
  // on a keyboard, a hopping bass and a simple lead, with meows on top.
  // No drums, so it sounds nothing like the rocket's beat.
  const S = 0.085; // one sixteenth note
  const BAR = 16 * S;
  // One chord per bar: [bass note, arpeggio notes]
  const CHORDS = [
    [45, [69, 72, 76, 81]], // A minor
    [41, [69, 72, 77, 81]], // F
    [48, [67, 72, 76, 79]], // C
    [43, [67, 71, 74, 79]], // G
  ];
  // Lead over the four bars: [sixteenth, note, length in sixteenths]
  const LEAD = [
    [0, 88, 3], [4, 86, 2], [6, 84, 2], [8, 81, 6],
    [16, 84, 3], [20, 86, 2], [22, 84, 2], [24, 81, 6],
    [32, 88, 3], [36, 91, 2], [38, 88, 2], [40, 84, 6],
    [48, 86, 2], [50, 83, 2], [52, 86, 2], [54, 91, 2], [56, 86, 6],
  ];
  const UP_DOWN = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];

  for (let loop = 0; loop < 6; loop++) {
    const at = loop * 4 * BAR;
    CHORDS.forEach(([bass, arp], bar) => {
      const t = at + bar * BAR;
      UP_DOWN.forEach((i, step) => tone('square', arp[i], t + step * S, S * 0.8, 0.1));
      for (let beat = 0; beat < 4; beat++) {
        tone('triangle', bass, t + beat * 4 * S, S * 1.8, 0.6);
        tone('triangle', bass + 12, t + beat * 4 * S + 2 * S, S * 1.4, 0.4); // hop
      }
    });
    if (loop > 0) LEAD.forEach(([step, n, len]) => tone('square', n - 12, at + step * S, len * S * 0.9, 0.22));
    meow(at + BAR + 12 * S, 76, 0.5);         // end of bar two
    meow(at + 3 * BAR + 8 * S, 79, 0.5);      // two quick ones to finish the phrase
    meow(at + 3 * BAR + 12 * S, loop % 2 ? 84 : 72, 0.5);
  }

  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    try {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      setTimeout(() => ctx.close().catch(() => {}), 150);
    } catch { /* already closed */ }
  };
}
