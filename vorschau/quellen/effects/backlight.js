// Kaputtes Backlight: hinter dem schwarzen Bild sitzt eine Hintergrundbeleuchtung aus vielen kleinen Zonen (wie bei Mini-LED).
// Ein paar Zonen sind defekt: sie flackern, glimmen langsam auf und ab, bleiben hängen oder fallen kurz aus.
// Dazu schimmert die Beleuchtung ungleichmäßig durch (Wolken, Lichthöfe an den Rändern), manchmal flackert eine ganze Reihe.
// Beim Entsperren läuft eine Einschaltwelle über alle Zonen.
const settings = { faulty: 4, flicker: 5, halo: 5, size: 1, color: 0 };
const faultCount = v => Math.round(1 + v * 1.8);
const controls = [
  { type: 'range', id: 'faulty', label: 'Defekte Zonen', min: 1, max: 10, fmt: v => String(faultCount(v)) },
  { type: 'range', id: 'flicker', label: 'Flackern', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'halo', label: 'Lichthöfe', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'size', label: 'Zonengröße', options: ['Klein', 'Mittel', 'Groß'] },
  { type: 'choice', id: 'color', label: 'Licht', options: ['Weiß', 'Bläulich', 'Warm', 'Bunt'] },
];
const PITCH = [22, 34, 52];
const COLS = [[[228, 238, 255]], [[120, 180, 255]], [[255, 186, 120]],
  [[255, 60, 180], [60, 200, 255], [160, 90, 255], [60, 255, 160], [255, 200, 60], [255, 90, 90]]];
const smoothstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

let W = 1, H = 1, dpr = 1, t = 0;
let cols = 1, rows = 1, pitch = 34, ox = 0, oy = 0, lev = new Float32Array(1), hueOf = new Uint8Array(1);
let sprites = [], spriteSize = 1, baseC = null, faults = [], events = [], wave = null, dip = 0, dipHold = 0;

// Eine Zone: abgerundetes Quadrat mit weichem Lichthof, in jeder Farbe einmal vorberechnet
function genSprites() {
  const N = 128, hl = settings.halo / 10, spread = 2.2 + 1.6 * hl, ch = 1 / spread;
  spriteSize = spread;
  const I = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x + 0.5) / N * 2 - 1, v = (y + 0.5) / N * 2 - 1, r = Math.hypot(u, v);
    const q = Math.pow(Math.pow(Math.abs(u), 4) + Math.pow(Math.abs(v), 4), 0.25);
    const core = smoothstep(ch * 1.08, ch * 0.62, q);
    const glow = 0.5 * Math.exp(-Math.pow(q / (ch * 1.35), 2)) + (0.08 + 0.22 * hl) * Math.exp(-Math.pow(r / 0.55, 2));
    I[y * N + x] = Math.min(1, core * 0.55 + glow) * smoothstep(1, 0.72, r);
  }
  sprites = COLS[settings.color].map(col => {
    const c = mk(N, N), x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
    for (let i = 0; i < N * N; i++) {
      const k = I[i], n = (Math.random() - 0.5) * 1.2; // leichtes Rauschen gegen Farbstufen
      d[i * 4] = col[0] * k + n; d[i * 4 + 1] = col[1] * k + n; d[i * 4 + 2] = col[2] * k + n; d[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  });
}

// Raster der Zonen
function layout() {
  pitch = PITCH[settings.size] * dpr;
  cols = Math.max(1, Math.ceil(W / pitch)); rows = Math.max(1, Math.ceil(H / pitch));
  ox = (W - cols * pitch) / 2 + pitch / 2; oy = (H - rows * pitch) / 2 + pitch / 2;
  lev = new Float32Array(cols * rows); hueOf = new Uint8Array(cols * rows);
  for (let i = 0; i < hueOf.length; i++) hueOf[i] = rint(0, 5);
}
const zx = i => ox + (i % cols) * pitch, zy = i => oy + ((i / cols) | 0) * pitch;
const spriteFor = i => sprites[settings.color === 3 ? hueOf[i] % sprites.length : 0];
function drawZone(ctx, i, a) {
  const s = pitch * spriteSize;
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.drawImage(spriteFor(i), zx(i) - s / 2, zy(i) - s / 2, s, s);
}

// ungleichmäßiges Durchschimmern: weiche Wolken und Lichthöfe an den Rändern, einmal vorberechnet
function vnoise(x, y, seed) {
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
let seed = 1, bleeds = [];
function genBase() {
  const hl = settings.halo / 10, bw = Math.max(1, Math.round(W / 2)), bh = Math.max(1, Math.round(H / 2));
  baseC = mk(bw, bh);
  const x = baseC.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, bw, bh);
  x.globalCompositeOperation = 'lighter';
  const s = pitch * spriteSize / 2;
  for (let i = 0; i < cols * rows; i++) {
    const cx = i % cols, cy = (i / cols) | 0;
    const n = vnoise(cx * 0.22, cy * 0.22, seed) * 0.7 + vnoise(cx * 0.6, cy * 0.6, seed + 3) * 0.3;
    let a = (0.004 + 0.07 * hl) * Math.pow(n, 3.2);
    if (Math.random() < 0.04) a += rnd(0.01, 0.03) * (0.3 + hl);
    if (a < 0.002) continue;
    x.globalAlpha = Math.min(1, a);
    x.drawImage(spriteFor(i), zx(i) / 2 - s / 2, zy(i) / 2 - s / 2, s, s);
  }
  // Lichthöfe an Rändern und Ecken
  const col = COLS[settings.color][0];
  for (const b of bleeds) {
    const r = b.r * Math.min(bw, bh), g = x.createRadialGradient(b.x * bw, b.y * bh, 0, b.x * bw, b.y * bh, r);
    const a = b.a * (0.15 + hl);
    g.addColorStop(0, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + Math.min(1, a).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + Math.min(1, a * 0.3).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.globalAlpha = 1; x.fillStyle = g; x.fillRect(0, 0, bw, bh);
  }
}

// defekte Zonen, meist in ein, zwei Grüppchen
function makeFaults() {
  faults = [];
  const n = Math.min(cols * rows, faultCount(settings.faulty)), used = new Set();
  const centers = []; for (let k = rint(1, 3); k > 0; k--) centers.push([rint(0, cols - 1), rint(0, rows - 1)]);
  for (let tries = 0; faults.length < n && tries < n * 30; tries++) {
    let c, r;
    if (Math.random() < 0.7) { const ce = pick(centers); c = clamp(ce[0] + Math.round(rnd(-2.5, 2.5)), 0, cols - 1); r = clamp(ce[1] + Math.round(rnd(-3, 3)), 0, rows - 1); }
    else { c = rint(0, cols - 1); r = rint(0, rows - 1); }
    const i = r * cols + c;
    if (used.has(i)) continue;
    used.add(i);
    faults.push({ i, kind: pick(['flicker', 'flicker', 'stuck', 'breath', 'buzz', 'dying']), lv: 0, hold: 0, on: true, ph: rnd(0, 6.28), per: rnd(2.5, 8), peak: rnd(0.35, 1) });
  }
}
function faultLevel(f, dt, fl) {
  switch (f.kind) {
    case 'flicker':
      f.hold -= dt * (0.3 + fl * 1.7);
      if (f.hold <= 0) { f.on = Math.random() < 0.55; f.lv = f.on ? f.peak * rnd(0.5, 1) : f.peak * rnd(0, 0.12); f.hold = Math.random() < 0.25 ? rnd(0.8, 3) : rnd(0.03, 0.35); }
      return f.lv;
    case 'stuck': return f.peak * (0.9 + 0.1 * Math.sin(t * 2.3 + f.ph));
    case 'breath': return f.peak * 0.5 * (1 - Math.cos(t * 6.283 / f.per + f.ph));
    case 'buzz':
      f.hold -= dt; if (f.hold <= 0) { f.on = Math.random() < 0.85; f.hold = f.on ? rnd(0.3, 2.2) : rnd(0.05, 0.3); }
      return f.on ? f.peak * (1 - fl * 0.55 * Math.random()) : 0.02;
    default: // 'dying': meist an, fällt plötzlich aus und kommt wieder
      f.hold -= dt; if (f.hold <= 0) { f.on = !f.on; f.hold = f.on ? rnd(1, 6) / (0.4 + fl) : rnd(0.05, 0.7); }
      f.lv += ((f.on ? f.peak : 0) - f.lv) * Math.min(1, dt * (f.on ? 5 : 30));
      return f.lv;
  }
}
// ganze Reihe, Spalte oder ein Block flackert gemeinsam
function groupEvent(strong) {
  const k = Math.random(), zs = [];
  if (k < 0.35) { const r = rint(0, rows - 1); for (let c = 0; c < cols; c++) zs.push(r * cols + c); }
  else if (k < 0.6) { const c = rint(0, cols - 1); for (let r = 0; r < rows; r++) zs.push(r * cols + c); }
  else {
    const bw = rint(2, 5), bh = rint(2, 6), c0 = rint(0, Math.max(0, cols - bw)), r0 = rint(0, Math.max(0, rows - bh));
    for (let r = r0; r < Math.min(rows, r0 + bh); r++) for (let c = c0; c < Math.min(cols, c0 + bw); c++) zs.push(r * cols + c);
  }
  events.push({ zs, left: strong ? rnd(0.6, 1.4) : rnd(0.15, 0.9), hold: 0, lv: 0, peak: strong ? rnd(0.5, 0.9) : rnd(0.2, 0.7) });
}

function rebuild(keepSeed) {
  layout(); genSprites();
  if (!keepSeed) {
    seed = rnd(0, 1000); bleeds = [];
    for (let k = rint(2, 4); k > 0; k--) {
      const e = rint(0, 3), p = rnd(0.1, 0.9);
      bleeds.push({ x: e === 0 ? p : e === 1 ? 1 : e === 2 ? p : 0, y: e === 0 ? 0 : e === 1 ? p : e === 2 ? 1 : p, r: rnd(0.25, 0.6), a: rnd(0.03, 0.08) });
    }
  }
  genBase(); makeFaults(); events = [];
}

return {
  maxDpr: 2,
  settings, controls,
  actionLabel: 'Flackern',
  resize(w, h, d) { W = w; H = h; dpr = d; rebuild(true); },
  newPattern() { rebuild(false); },
  action() { groupEvent(true); if (Math.random() < 0.5) groupEvent(true); dip = 1; dipHold = rnd(0.05, 0.2); },
  wake() {
    const e = rint(0, 3);
    wave = { t0: t, x: e === 0 ? cols / 2 : e === 1 ? -1 : e === 2 ? cols / 2 : cols, y: e === 0 ? -1 : e === 2 ? rows : rows * rnd(0.3, 0.7), v: rnd(14, 22), w: 2.2 };
    for (const f of faults) { f.on = true; f.hold = rnd(0.3, 1.2); f.lv = f.peak; }
  },
  change(id) {
    if (id === 'size') rebuild(true);
    else if (id === 'halo' || id === 'color') { genSprites(); genBase(); }
    else if (id === 'faulty') makeFaults();
  },
  frame(ctx, dt) {
    t += dt;
    const fl = settings.flicker / 10;
    lev.fill(0);
    for (const f of faults) lev[f.i] += faultLevel(f, dt, fl);
    if (Math.random() < per(0.03 + fl * 0.5, dt)) groupEvent(false);
    events = events.filter(e => {
      e.left -= dt; e.hold -= dt;
      if (e.hold <= 0) { e.lv = Math.random() < 0.6 ? e.peak * rnd(0.4, 1) : 0; e.hold = rnd(0.03, 0.25); }
      if (e.lv > 0) for (const i of e.zs) lev[i] += e.lv;
      return e.left > 0;
    });
    if (wave) {
      const front = (t - wave.t0) * wave.v, maxD = Math.hypot(cols, rows) + 8;
      for (let i = 0; i < lev.length; i++) {
        const d = Math.hypot(i % cols - wave.x, ((i / cols) | 0) - wave.y), q = (d - front) / wave.w;
        lev[i] += 0.7 * Math.exp(-q * q) + (d < front ? 0.1 * Math.exp(-(front - d) / 2.5) : 0);
      }
      if (front > maxD) wave = null;
    }
    // kurze Spannungseinbrüche lassen das ganze Durchschimmern flackern
    if (dipHold > 0) dipHold -= dt;
    else { dip *= Math.exp(-dt * 6); if (Math.random() < per(0.02 + fl * 0.08, dt)) { dip = rnd(0.4, 1); dipHold = rnd(0.03, 0.15); } }
    const baseA = clamp((0.88 + 0.12 * Math.sin(t * 0.35)) * (1 - 0.7 * (dipHold > 0 ? dip : 0)) + (dipHold > 0 ? 0 : dip * 0.4), 0, 1.4);

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = Math.min(1, baseA); ctx.drawImage(baseC, 0, 0, W, H);
    if (baseA > 1) { ctx.globalAlpha = baseA - 1; ctx.drawImage(baseC, 0, 0, W, H); }
    for (let i = 0; i < lev.length; i++) if (lev[i] > 0.004) drawZone(ctx, i, lev[i]);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
};
