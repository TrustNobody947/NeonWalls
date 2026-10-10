// Pixelfehler: hängende Subpixel (rot, grün, blau oder Mischungen), die teils blinken,
// Pixelwürmer, die übers Display kriechen, und ab und zu ein Pixelsturm mit Blockartefakten.
// Stürme hinterlassen manchmal neue hängende Pixel – der Schaden wächst.
const settings = { dead: 5, blink: 4, storm: 5, stormSize: 5, grain: 0 };
const controls = [
  { type: 'range', id: 'dead', label: 'Hängende Pixel', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'blink', label: 'Blinken', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'storm', label: 'Pixelstürme', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'stormSize', label: 'Sturmgröße', min: 1, max: 10, fmt: lvl },
  { type: 'choice', id: 'grain', label: 'Pixelgröße', options: ['Fein', 'Grob'] },
];

// Subpixel-Masken: 1 = Rot, 2 = Grün, 4 = Blau (Mischungen ergeben Gelb, Cyan, Magenta, Weiß)
const KINDS = [1, 1, 1, 2, 2, 2, 4, 4, 7, 7, 3, 6, 5];
const SUB = ['#ff2a2a', '#2aff4a', '#3a5cff'];
const GLOW = { 1: '#ff3030', 2: '#30ff50', 4: '#4060ff', 3: '#ffe640', 6: '#40ffff', 5: '#ff40ff', 7: '#ffffff' };
const STORM = ['#ff2a2a', '#2aff4a', '#3a5cff', '#ffffff', '#ffe640', '#40ffff', '#ff40ff', '#8a8a8a', '#ff8a00', '#202020'];

let W = 1, H = 1, dpr = 1, u = 2;
let pixels = [], storms = [], worms = [], t = 0, nextStorm = 4, flash = 0;

const unit = () => settings.grain === 0 ? Math.max(3, Math.round(dpr * 1.4)) : Math.max(5, Math.round(dpr * 3));
const snap = (v, c) => Math.floor(v / c) * c;
const target = () => { const d = settings.dead; return Math.round(d * d * 2.5 + d * 3); };
function mode() { const b = settings.blink / 10; return Math.random() < b * 0.75 ? (Math.random() < 0.7 ? 1 : 2) : 0; }
function newPixel(x, y) {
  return { x: snap(x, u), y: snap(y, u), k: pick(KINDS), mode: mode(), rate: rnd(0.3, 3), on: true, timer: rnd(0, 2), born: 0 };
}
function fill() {
  const n = target();
  const base = pixels.filter(p => !p.extra), extra = pixels.filter(p => p.extra);
  while (base.length < n) base.push(newPixel(rnd(0, W), rnd(0, H)));
  base.length = n;
  pixels = base.concat(n ? extra.slice(-40) : []);
}
function schedule() { const s = settings.storm / 10; return rnd(3, 9) * (0.4 + (1 - s) * (1 - s) * 5); }

function drawPixel(ctx, p, a) {
  const s = u, w3 = Math.max(1, Math.round(s / 3));
  ctx.fillStyle = GLOW[p.k];
  ctx.globalAlpha = 0.09 * a; ctx.fillRect(p.x - s * 2, p.y - s * 2, s * 5, s * 5);
  ctx.globalAlpha = 0.2 * a; ctx.fillRect(p.x - s, p.y - s, s * 3, s * 3);
  ctx.globalAlpha = a;
  for (let b = 0; b < 3; b++) if (p.k & (1 << b)) { ctx.fillStyle = SUB[b]; ctx.fillRect(p.x + b * w3, p.y, w3, s); }
}

function startStorm(kind) {
  const sz = settings.stormSize / 10;
  if (kind === 'sweep') {
    storms.push({ kind, y: -H * 0.12, h: H * (0.05 + sz * 0.07), v: H * rnd(0.8, 1.3), age: 0, cell: u * rint(2, 3) });
    return;
  }
  const w = W * (0.15 + sz * 0.5) * rnd(0.6, 1), h = H * (0.05 + sz * 0.22) * rnd(0.6, 1);
  const cell = Math.max(u * 2, snap(Math.sqrt(w * h / 4500), u) || u * 2);
  storms.push({ kind: 'blob', x: rnd(0, W), y: rnd(0, H), w, h, vx: rnd(-0.25, 0.25) * W, vy: rnd(-0.12, 0.12) * H, age: 0, life: rnd(0.6, 2.6), cell });
}
function leaveDamage(x, y, w, h) {
  if (!settings.dead) return;
  const m = rint(0, 3);
  for (let i = 0; i < m; i++) { const p = newPixel(x + rnd(0, w), y + rnd(0, h)); p.extra = true; pixels.push(p); }
  const extra = pixels.filter(p => p.extra);
  if (extra.length > 40) pixels.splice(pixels.indexOf(extra[0]), 1);
}
function spawnWorm() {
  const horiz = Math.random() < 0.6;
  worms.push({ x: snap(rnd(0, W), u), y: snap(rnd(0, H), u), horiz, dir: Math.random() < 0.5 ? -1 : 1, len: rint(6, 30), v: rnd(60, 260) * dpr, k: pick(KINDS), age: 0, life: rnd(1, 4) });
}

function drawStorm(ctx, s, dt) {
  s.age += dt;
  const c = s.cell;
  if (s.kind === 'sweep') {
    s.y += s.v * dt;
    const y0 = snap(s.y, c), rows = Math.ceil(s.h / c), cols = Math.ceil(W / c);
    for (let j = 0; j < rows; j++) {
      const ny = Math.abs((j + 0.5) / rows * 2 - 1), dens = (1 - ny * ny) * 0.5;
      for (let i = 0; i < cols; i++) {
        if (Math.random() > dens) continue;
        ctx.globalAlpha = 0.45 + 0.55 * Math.random(); ctx.fillStyle = STORM[(Math.random() * STORM.length) | 0];
        ctx.fillRect(i * c, y0 + j * c, c, c);
      }
    }
    if (Math.random() < 0.6) { ctx.globalAlpha = 0.6; ctx.fillStyle = pick(STORM); ctx.fillRect(0, y0 + rint(0, rows) * c, W, Math.max(1, c / 3)); }
    return s.y > H * 1.12;
  }
  s.x += s.vx * dt; s.y += s.vy * dt;
  const env = Math.min(1, s.age / 0.12) * Math.min(1, Math.max(0, s.life - s.age) / 0.35);
  const x0 = s.x - s.w / 2, y0 = s.y - s.h / 2, gx0 = snap(x0, c), gy0 = snap(y0, c);
  const cols = Math.ceil(s.w / c) + 1, rows = Math.ceil(s.h / c) + 1;
  for (let j = 0; j < rows; j++) {
    const yy = gy0 + j * c, ny = (yy + c / 2 - s.y) / (s.h / 2);
    for (let i = 0; i < cols; i++) {
      const xx = gx0 + i * c, nx = (xx + c / 2 - s.x) / (s.w / 2), r2 = nx * nx + ny * ny;
      if (r2 > 1 || Math.random() > (1 - r2) * env * 0.55) continue;
      ctx.globalAlpha = 0.5 + 0.5 * Math.random(); ctx.fillStyle = STORM[(Math.random() * STORM.length) | 0];
      ctx.fillRect(xx, yy, c, c);
    }
  }
  if (Math.random() < 0.5 * env) { // Blockartefakte wie bei kaputter Bilddekodierung
    for (let k = 0; k < 3; k++) {
      const size = c * rint(3, 8);
      ctx.globalAlpha = 0.35 * env; ctx.fillStyle = pick(STORM);
      ctx.fillRect(snap(x0 + rnd(0, s.w), c), snap(y0 + rnd(0, s.h), c), size, snap(size * rnd(0.3, 1), c) || c);
    }
  }
  if (Math.random() < 0.4 * env) { ctx.globalAlpha = 0.5 * env; ctx.fillStyle = pick(STORM); ctx.fillRect(x0, snap(y0 + rnd(0, s.h), c), s.w, Math.max(1, c / 3)); }
  if (s.age >= s.life) { leaveDamage(x0, y0, s.w, s.h); return true; }
  return false;
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Pixelsturm',
  resize(w, h, d) {
    const sx = w / W, sy = h / H; W = w; H = h; dpr = d; u = unit();
    for (const p of pixels) { p.x = snap(p.x * sx, u); p.y = snap(p.y * sy, u); }
  },
  newPattern() { pixels = []; storms = []; worms = []; u = unit(); fill(); nextStorm = rnd(2, 4); },
  action() { startStorm('sweep'); startStorm('blob'); flash = 1; spawnWorm(); spawnWorm(); },
  wake() { startStorm('sweep'); flash = 1; spawnWorm(); },
  change(id) {
    if (id === 'dead') fill();
    else if (id === 'blink') for (const p of pixels) p.mode = mode();
    else if (id === 'grain') { u = unit(); for (const p of pixels) { p.x = snap(p.x, u); p.y = snap(p.y, u); } }
    else if (id === 'storm') nextStorm = Math.min(nextStorm, schedule());
  },
  frame(ctx, dt) {
    t += dt; flash *= Math.exp(-dt * 2.2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (settings.storm > 0) { nextStorm -= dt; if (nextStorm <= 0) { startStorm('blob'); nextStorm = schedule(); } }
    if (Math.random() < per(settings.storm * 0.06 + 0.05, dt)) spawnWorm();
    // hängende Pixel
    for (const p of pixels) {
      let a = 1;
      if (p.mode === 1) { p.timer -= dt; if (p.timer <= 0) { p.on = !p.on; p.timer = (p.on ? rnd(0.2, 2.5) : rnd(0.05, 0.6)) / p.rate; } a = p.on ? 1 : 0; }
      else if (p.mode === 2) a = 0.35 + 0.65 * Math.random();
      a = Math.max(a, flash);
      if (a > 0.02) drawPixel(ctx, p, a);
    }
    // Pixelwürmer
    worms = worms.filter(w => {
      w.age += dt; const step = w.v * dt;
      if (w.horiz) w.x += step * w.dir; else w.y += step * w.dir;
      const env = Math.min(1, w.age / 0.2) * Math.min(1, Math.max(0, w.life - w.age) / 0.4);
      for (let i = 0; i < w.len; i++) {
        const a = env * (1 - i / w.len);
        const x = snap(w.horiz ? w.x - i * u * 1.5 * w.dir : w.x, u), y = snap(w.horiz ? w.y : w.y - i * u * 1.5 * w.dir, u);
        if (a > 0.03) drawPixel(ctx, { x, y, k: w.k }, a);
      }
      return w.age < w.life && w.x > -W * 0.2 && w.x < W * 1.2 && w.y > -H * 0.2 && w.y < H * 1.2;
    });
    // Stürme
    storms = storms.filter(s => !drawStorm(ctx, s, dt));
    ctx.globalAlpha = 1;
  },
};
