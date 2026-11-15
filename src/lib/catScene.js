// An original 8-bit "hacker cat" for the end of the presentation: a black cat
// hammering a laptop while green code rains down and windows pop up.
// drawCat(ctx, t) is a pure function of time in ms.

export const CW = 160;
export const CH = 120;

const rand = (i) => {
  const x = Math.sin(i * 91.7 + 3.1) * 43758.5453;
  return x - Math.floor(x);
};
const px = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function codeRain(ctx, t) {
  for (let col = 0; col < 27; col++) {
    const speed = 22 + rand(col) * 38;
    const head = ((t / 1000) * speed + rand(col + 50) * 160) % (CH + 50) - 10;
    for (let k = 0; k < 9; k++) {
      const y = head - k * 6;
      if (y < -6 || y > CH) continue;
      const glyph = Math.floor(rand(col * 31 + k + Math.floor(t / 180)) * 4);
      ctx.globalAlpha = k === 0 ? 1 : Math.max(0.08, 0.7 - k * 0.08);
      const c = k === 0 ? '#d6ffe4' : '#22e36b';
      // four little block "characters"
      if (glyph === 0) { px(ctx, col * 6 + 1, y, 3, 1, c); px(ctx, col * 6 + 2, y + 1, 1, 3, c); }
      else if (glyph === 1) { px(ctx, col * 6 + 1, y, 1, 4, c); px(ctx, col * 6 + 3, y, 1, 4, c); }
      else if (glyph === 2) { px(ctx, col * 6 + 1, y, 3, 1, c); px(ctx, col * 6 + 1, y + 3, 3, 1, c); px(ctx, col * 6 + 2, y + 1, 1, 2, c); }
      else { px(ctx, col * 6 + 1, y + 1, 3, 2, c); }
    }
  }
  ctx.globalAlpha = 1;
}

function popups(ctx, t) {
  const n = Math.floor(t / 420);
  for (let k = 0; k < 5; k++) {
    const id = n - k;
    if (id < 0) continue;
    const x = 4 + Math.floor(rand(id * 7) * 104);
    const y = 4 + Math.floor(rand(id * 7 + 1) * 34);
    const w = 26 + Math.floor(rand(id * 7 + 2) * 20);
    const h = 14 + Math.floor(rand(id * 7 + 3) * 8);
    px(ctx, x, y, w, h, '#0c1a12');
    px(ctx, x, y, w, 3, k === 0 ? '#22e36b' : '#15803d');
    ctx.strokeStyle = '#22e36b';
    for (let line = 0; line < Math.floor((h - 5) / 3); line++) {
      px(ctx, x + 2, y + 5 + line * 3, 4 + Math.floor(rand(id * 13 + line) * (w - 10)), 1, '#22e36b');
    }
  }
}

function floor(ctx, t) {
  px(ctx, 0, 98, CW, CH - 98, '#04130a');
  for (let i = 0; i < 6; i++) px(ctx, 0, 98 + i * i * 0.9 + ((t / 90) % 3), CW, 1, '#0f6b33');
  for (let i = -8; i <= 8; i++) {
    ctx.fillStyle = '#0f6b33';
    for (let y = 98; y < CH; y++) ctx.fillRect(Math.round(80 + i * (6 + (y - 98) * 0.9)), y, 1, 1);
  }
}

function laptop(ctx, t) {
  // lid, leaning back, seen from the side
  for (let i = 0; i < 20; i++) px(ctx, 40 - i * 0.55, 90 - i * 1.7, 4, 2, '#d7dae2');
  for (let i = 2; i < 19; i++) px(ctx, 44 - i * 0.55, 90 - i * 1.7, 1, 2, Math.floor(t / 90 + i) % 3 ? '#22e36b' : '#d6ffe4'); // screen glow
  px(ctx, 38, 92, 50, 3, '#d7dae2'); // base
  px(ctx, 38, 95, 50, 1, '#8a8f99');
}

// The cat, facing left. Drawn twice: once slightly larger in green for a glow, then in black.
function cat(ctx, color, g, t) {
  const b = (x, y, w, h) => px(ctx, x - g, y - g, w + 2 * g, h + 2 * g, color);
  // tail, curling up behind
  b(134, 80, 10, 5); b(141, 66, 5, 16); b(138, 60, 6, 7);
  // body
  b(98, 66, 38, 30); b(94, 72, 6, 24); b(102, 62, 28, 6);
  // head
  b(80, 46, 26, 22); b(78, 52, 4, 12);
  // ears
  b(82, 40, 6, 7); b(84, 37, 3, 4); b(97, 40, 6, 7); b(99, 37, 3, 4);
  // arms reaching to the keyboard, alternating
  const beat = Math.floor(t / 110) % 2;
  b(78, 78, 22, 5); b(70, 80 + (beat ? 4 : 0), 10, 5);
  b(80, 84, 20, 5); b(66, 86 + (beat ? 0 : 3), 10, 5);
}

export function drawCat(ctx, t) {
  px(ctx, 0, 0, CW, CH, '#05070d');
  codeRain(ctx, t);
  popups(ctx, t);
  floor(ctx, t);
  laptop(ctx, t);
  cat(ctx, '#22e36b', 1, t);
  cat(ctx, '#0b0b0f', 0, t);
  // eye, with an occasional blink, and a whisker glint
  const blink = Math.floor(t / 100) % 31 === 0;
  if (!blink) { px(ctx, 84, 54, 4, 3, '#d6ffe4'); px(ctx, 85, 54, 2, 3, '#22e36b'); }
  px(ctx, 76, 60, 3, 1, '#3a3f4a');
  // paws: pale toe beans so the typing reads
  const beat = Math.floor(t / 110) % 2;
  px(ctx, 70, 82 + (beat ? 4 : 0), 4, 3, '#e8e8ee');
  px(ctx, 66, 88 + (beat ? 0 : 3), 4, 3, '#e8e8ee');
}
