// 8-bit rocket cutscene, drawn on a tiny canvas and scaled up with crisp pixels.
// drawScene(ctx, t) is a pure function of time in ms, so any frame can be drawn on its own.

export const W = 160;
export const H = 240;
export const DURATION = 5000;

const T_FLAME = 450;  // engine lights
const T_LIFT = 800;   // leaves the pad
const T_HIT = 3000;   // reaches the moon
const T_FLAG = 3600;  // pole starts rising from the crater
const T_DONE = 4800;  // flag fully unfurled

const MOON_R = 44;
const CX = 80;

const C = {
  sky: '#0b0d1e',
  star: '#ffffff',
  starDim: '#7d86b3',
  moon: '#cfd2dc',
  moonShade: '#a9adbd',
  crater: '#6f7385',
  craterDeep: '#34374a',
  ground: '#1f5c3f',
  groundDark: '#17452f',
  pad: '#8a8f99',
  w: '#f4f4f4',
  r: '#e23b2e',
  b: '#4fc3f7',
  g: '#8a8f99',
  flame1: '#ffd23f',
  flame2: '#ff7a1a',
  smoke: '#b9bcc6',
  pole: '#eeeeee',
  flag: '#1565c0',
  flagDark: '#0d47a1',
  text: '#ffffff',
};

const ROCKET = [
  '....w....',
  '...www...',
  '...www...',
  '..wwwww..',
  '..wbbbw..',
  '..wbbbw..',
  '..wwwww..',
  '..wwwww..',
  '..wwwww..',
  '.rwwwwwr.',
  'rrwwwwwrr',
  'rr.ggg.rr',
];
const SPRITE_PX = 2;
const ROCKET_H = ROCKET.length * SPRITE_PX;

// 3x5 pixel letters, only the ones the flag needs.
const FONT = {
  R: ['110', '101', '110', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  V: ['101', '101', '101', '101', '010'],
  E: ['111', '100', '110', '100', '111'],
  H: ['101', '101', '111', '101', '101'],
  A: ['010', '101', '111', '101', '101'],
  C: ['011', '100', '100', '100', '011'],
  K: ['101', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
};
const FLAG_LINES = ['RIVER', 'HACKS'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, p) => a + (b - a) * p;
const rand = (i) => {
  const x = Math.sin(i * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
};

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Filled circle drawn as one span per row, so the edge stays blocky.
function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  cx = Math.round(cx);
  cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

function drawStars(ctx, t) {
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand(i) * W);
    const y = Math.floor(rand(i + 500) * H);
    const phase = (Math.floor(t / 280) + i) % 4;
    if (phase === 0) continue; // twinkle off
    px(ctx, x, y, 1, 1, phase === 1 ? C.starDim : C.star);
  }
}

function drawMoon(ctx, cy, blasted) {
  disc(ctx, CX, cy, MOON_R, C.moon);
  disc(ctx, CX - 20, cy - 16, 7, C.moonShade);
  disc(ctx, CX + 22, cy - 4, 5, C.moonShade);
  disc(ctx, CX + 8, cy - 26, 4, C.moonShade);
  disc(ctx, CX - 26, cy + 12, 4, C.moonShade);
  if (blasted) {
    disc(ctx, CX, cy + 22, 17, C.crater);
    disc(ctx, CX - 13, cy + 12, 6, C.crater);
    disc(ctx, CX + 14, cy + 14, 5, C.crater);
    disc(ctx, CX, cy + 24, 11, C.craterDeep);
  }
}

function drawRocket(ctx, x, top, t) {
  ROCKET.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch !== '.') px(ctx, x + rx * SPRITE_PX, top + ry * SPRITE_PX, SPRITE_PX, SPRITE_PX, C[ch]);
    }
  });
  if (t >= T_FLAME) {
    const flick = Math.floor(t / 60);
    const len = 6 + Math.floor(rand(flick) * 7);
    const mid = x + 4 * SPRITE_PX;
    px(ctx, mid - 3, top + ROCKET_H, 8, len, C.flame2);
    px(ctx, mid - 1, top + ROCKET_H, 4, Math.max(2, len - 3), C.flame1);
    px(ctx, mid, top + ROCKET_H + len, 2, 2 + (flick % 2) * 2, C.flame2);
  }
}

function drawSmoke(ctx, groundY, t) {
  const age = (t - T_FLAME) / 1000;
  if (age < 0 || age > 1.6) return;
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const size = 3 + Math.floor(age * 6 + rand(i) * 3);
    const x = CX + side * (4 + age * (18 + rand(i + 40) * 30));
    const y = groundY - size + 2 - rand(i + 80) * age * 10;
    px(ctx, x - size / 2, y, size, size, C.smoke);
  }
}

function drawExplosion(ctx, x, y, t) {
  const age = (t - T_HIT) / 1000;
  if (age < 0) return;
  if (age < 0.3) {
    disc(ctx, x, y, Math.floor(6 + age * 70), age < 0.12 ? C.w : C.flame1);
    disc(ctx, x, y, Math.floor(2 + age * 45), age < 0.12 ? C.flame1 : C.flame2);
  }
  const colors = [C.flame2, C.flame1, C.w, C.moon, C.crater];
  for (let i = 0; i < 48; i++) {
    const life = 0.6 + rand(i + 300) * 0.9;
    if (age > life) continue;
    const angle = rand(i) * Math.PI * 2;
    const speed = 30 + rand(i + 100) * 95;
    const size = 2 + (i % 3 === 0 ? 1 : 0) + (i % 7 === 0 ? 1 : 0);
    px(
      ctx,
      x + Math.cos(angle) * speed * age,
      y + Math.sin(angle) * speed * age + 45 * age * age,
      size,
      size,
      colors[i % colors.length]
    );
  }
}

function drawFlag(ctx, moonCy, t) {
  const f = clamp01((t - T_FLAG) / (T_DONE - T_FLAG));
  if (f <= 0) return;
  const poleX = 57;
  const baseY = moonCy + 24;
  const poleH = Math.round(70 * clamp01(f / 0.5));
  px(ctx, poleX, baseY - poleH, 2, poleH, C.pole);
  if (poleH >= 70) px(ctx, poleX - 1, baseY - poleH - 2, 4, 2, C.flame1); // finial

  const unfurl = clamp01((f - 0.5) / 0.5);
  const FLAG_W = 48;
  const FLAG_H = 30;
  const shown = Math.round(FLAG_W * unfurl);
  if (shown <= 0) return;
  const fx = poleX + 2;
  const fy = baseY - 70 + 2;
  // The free edge waves; the edge on the pole stays still.
  const wave = (col) => Math.round(Math.sin(col / 7 - t / 260) * 2 * (col / FLAG_W));

  for (let col = 0; col < shown; col++) {
    const dy = wave(col);
    px(ctx, fx + col, fy + dy, 1, FLAG_H, C.flag);
    px(ctx, fx + col, fy + dy, 1, 1, C.flagDark);
    px(ctx, fx + col, fy + dy + FLAG_H - 1, 1, 1, C.flagDark);
  }

  FLAG_LINES.forEach((word, line) => {
    [...word].forEach((letter, li) => {
      FONT[letter].forEach((row, gy) => {
        for (let gx = 0; gx < 3; gx++) {
          if (row[gx] !== '1') continue;
          for (let sub = 0; sub < 2; sub++) {
            const col = 5 + li * 8 + gx * 2 + sub;
            if (col >= shown) continue;
            px(ctx, fx + col, fy + 4 + line * 12 + gy * 2 + wave(col), 1, 2, C.text);
          }
        }
      });
    });
  });
}

export function drawScene(ctx, t) {
  ctx.save();
  px(ctx, 0, 0, W, H, C.sky);

  // Screen shake on impact
  if (t >= T_HIT && t < T_HIT + 450) {
    const k = Math.floor(t / 40);
    ctx.translate(Math.round((rand(k) - 0.5) * 6), Math.round((rand(k + 9) - 0.5) * 6));
  }

  drawStars(ctx, t);

  const p = clamp01((t - T_LIFT) / (T_HIT - T_LIFT));
  const accel = p * p;                 // rocket and ground: slow start, fast finish
  const glide = p * p * (3 - 2 * p);   // moon eases into view
  const moonCy = Math.round(lerp(-60, 78, glide));
  const groundY = Math.round(214 + accel * 300);
  const hit = t >= T_HIT;

  drawMoon(ctx, moonCy, hit);

  if (groundY < H) {
    px(ctx, 0, groundY, W, H - groundY, C.ground);
    px(ctx, 0, groundY + 6, W, H - groundY, C.groundDark);
    px(ctx, CX - 16, groundY - 2, 32, 3, C.pad);
    drawSmoke(ctx, groundY, t);
  }

  if (!hit) {
    const rumble = t >= T_FLAME && t < T_LIFT ? Math.round(rand(Math.floor(t / 50)) * 2 - 1) : 0;
    const top = lerp(214 - 2 - ROCKET_H, 78 + 22 - 4, accel);
    drawRocket(ctx, CX - 9 + rumble, top, t);
  }

  drawFlag(ctx, moonCy, t);
  drawExplosion(ctx, CX, moonCy + 22, t);

  // White flash on the impact frame
  if (hit && t < T_HIT + 90) {
    ctx.globalAlpha = 0.85;
    px(ctx, -8, -8, W + 16, H + 16, C.w);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
