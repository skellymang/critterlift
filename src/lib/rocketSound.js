// An original 808-style, 8-bit soundtrack for the rocket cutscene, made in the
// browser with the Web Audio API: no audio files, no samples, no lyrics.
// 150 beats a minute, timed to rocketScene.js: count-in beeps, a trap beat as
// the rocket climbs, a sub drop on impact at 3.0s, then the beat returns under
// a fanfare as the flag goes up.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note number -> Hz
const S = 0.1; // one sixteenth note, in seconds

export function playRocketSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return () => {};
  const ctx = new Ctx();
  ctx.resume?.();
  const master = ctx.createGain();
  master.gain.value = 0.2;
  const squash = ctx.createDynamicsCompressor(); // keeps the 808 from clipping
  master.connect(squash).connect(ctx.destination);
  const t0 = ctx.currentTime + 0.06;

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  function voice(type, midi, at, length, volume, glideTo = null, glideTime = length) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(NOTE(midi), t0 + at);
    if (glideTo != null) osc.frequency.exponentialRampToValueAtTime(NOTE(glideTo), t0 + at + glideTime);
    gain.gain.setValueAtTime(0, t0 + at);
    gain.gain.linearRampToValueAtTime(volume, t0 + at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + at + length);
    osc.connect(gain).connect(master);
    osc.start(t0 + at);
    osc.stop(t0 + at + length + 0.02);
  }
  function hiss(at, length, volume, filterType, freq, freqEnd = freq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, t0 + at);
    filter.frequency.exponentialRampToValueAtTime(freqEnd, t0 + at + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + at + length);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0 + at);
    src.stop(t0 + at + length + 0.02);
  }

  // The kit
  const kick = (at) => { voice('sine', 60, at, 0.22, 1.5, 29, 0.09); voice('square', 48, at, 0.03, 0.25); };
  const sub = (at, midi, length, slideTo = null) => voice('sine', midi, at, length, 1.3, slideTo, length * 0.6); // the 808 bass
  const clap = (at) => { hiss(at, 0.16, 0.9, 'bandpass', 1500); hiss(at + 0.012, 0.12, 0.6, 'bandpass', 2300); };
  const hat = (at, volume = 0.28) => hiss(at, 0.035, volume, 'highpass', 8000);
  const lead = (at, midi, steps = 1, volume = 0.3) => voice('square', midi, at, steps * S * 0.92, volume);

  // Count-in: three beeps and a higher one at ignition
  [0, 0.22, 0.44].forEach((at) => voice('square', 69, at, 0.08, 0.4));
  voice('square', 81, 0.68, 0.12, 0.5);
  hiss(0.45, 2.55, 0.35, 'lowpass', 150, 900); // engine rumble under the beat

  // One bar of the beat, starting at `at`. A minor: A1 sub, sliding to C2 and G1.
  function bar(at, sixteenths = 16) {
    const on = (step) => step < sixteenths;
    [0, 3, 6, 10, 11].filter(on).forEach((step) => kick(at + step * S));
    [4, 12].filter(on).forEach((step) => clap(at + step * S));
    for (let step = 0; step < sixteenths; step += 2) hat(at + step * S);
    if (on(7)) [0, 1, 2].forEach((n) => hat(at + 7 * S + n * (S / 3), 0.2));        // triplet roll
    if (on(14)) [0, 1, 2, 3].forEach((n) => hat(at + 14 * S + n * (S / 2), 0.22));  // 32nd-note roll
    sub(at, 33, Math.min(6, sixteenths) * S);
    if (on(6)) sub(at + 6 * S, 33, 4 * S, 36);
    if (on(10)) sub(at + 10 * S, 31, Math.min(6, sixteenths - 10) * S);
  }

  // Bar 1 (0.8s to 2.4s) and a short pickup into the impact
  bar(0.8);
  bar(2.4, 6);
  // Lead: an original A minor pentatonic riff that climbs with the rocket
  [[0, 69, 2], [2, 72, 1], [3, 76, 2], [6, 74, 1], [7, 72, 2], [10, 76, 1], [11, 79, 2], [14, 81, 2],
   [16, 84, 1], [17, 81, 1], [18, 84, 1], [19, 88, 1], [20, 91, 2]].forEach(([step, n, len]) => lead(0.8 + step * S, n, len));

  // Impact at 3.0s: a long sub drop, a crash and a falling zap
  sub(3.0, 45, 1.0, 21);
  hiss(3.0, 0.9, 1.3, 'lowpass', 5000, 120);
  voice('square', 93, 3.0, 0.3, 0.3, 45);

  // The flag: the beat returns under a major-key fanfare
  bar(3.6);
  bar(5.2, 8);
  [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 84, 3], [10, 83, 1], [11, 84, 2], [14, 88, 2],
   [16, 91, 2], [18, 88, 2], [20, 91, 4]].forEach(([step, n, len]) => lead(3.6 + step * S, n, len, 0.32));
  [60, 67, 72, 76].forEach((n) => voice('triangle', n, 6.0, 1.2, 0.35)); // closing chord
  sub(6.0, 36, 1.2);

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
