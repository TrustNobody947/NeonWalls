// Ghost Touch: ein unsichtbarer Finger bedient das Handy. Sichtbar gemacht wie mit der Entwickleroption
// "Zeigerposition": Fadenkreuz durch jeden Finger, Spuren mit Messpunkten und oben die Messwerte (P, X, Y, Xv, Yv, Prs, Size).
// Dazu kommen Geistertipper wie bei einem defekten Touchscreen: hektische, kurze Berührungen immer an derselben Stelle.
// Beim Entsperren wischt der Geist nach oben und tippt eine PIN ein.
const settings = { rate: 6, fingers: 3, trails: 5, fault: 4, cross: 0, info: 0, color: 1 };
const trailLife = v => v == 0 ? 0.5 : 1 + v * 2.5;
const controls = [
  { type: 'range', id: 'rate', label: 'Berührungen', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'fingers', label: 'Finger höchstens', min: 1, max: 5, fmt: v => String(v) },
  { type: 'range', id: 'trails', label: 'Spuren bleiben', min: 0, max: 10, fmt: v => v == 0 ? 'kaum' : Math.round(trailLife(v)) + ' s' },
  { type: 'range', id: 'fault', label: 'Geistertipper', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'cross', label: 'Fadenkreuz', options: ['An', 'Aus'] },
  { type: 'choice', id: 'info', label: 'Messwerte oben', options: ['An', 'Aus'] },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Original', 'Cyan', 'Pink', 'Grün', 'Weiß'] },
];
// Farbschemata; "Original" hält sich an die Farben der echten Android-Anzeige
const SCHEMES = [
  { path: [0, 96, 255], cross: [40, 60, 235], dot: [255, 255, 255], vel: [255, 0, 0], ring: [255, 255, 255], tap: [255, 255, 255], hb: 'rgba(255,255,255,0.5)', ht: '#000', lvl: 'rgba(255,0,0,0.75)', glow: 0.5 },
  { path: [79, 195, 255], cross: [79, 195, 255], dot: [225, 247, 255], vel: [255, 79, 216], ring: [180, 235, 255], tap: [79, 195, 255], hb: 'rgba(79,195,255,0.16)', ht: 'rgb(175,232,255)', lvl: 'rgba(255,79,216,0.55)', glow: 1 },
  { path: [255, 79, 216], cross: [255, 79, 216], dot: [255, 225, 248], vel: [79, 195, 255], ring: [255, 185, 240], tap: [255, 79, 216], hb: 'rgba(255,79,216,0.16)', ht: 'rgb(255,192,242)', lvl: 'rgba(79,195,255,0.55)', glow: 1 },
  { path: [61, 255, 106], cross: [61, 255, 106], dot: [215, 255, 225], vel: [255, 225, 60], ring: [170, 255, 190], tap: [61, 255, 106], hb: 'rgba(61,255,106,0.14)', ht: 'rgb(175,255,195)', lvl: 'rgba(255,225,60,0.5)', glow: 1 },
  { path: [228, 234, 244], cross: [200, 208, 222], dot: [255, 255, 255], vel: [255, 70, 70], ring: [255, 255, 255], tap: [228, 234, 244], hb: 'rgba(228,234,244,0.14)', ht: 'rgb(235,240,248)', lvl: 'rgba(255,70,70,0.55)', glow: 0.7 },
];
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
const FONT = 'Roboto, system-ui, -apple-system, "Segoe UI", sans-serif';

let W = 1, H = 1, dpr = 1, t = 0;
let ptrs = [], trails = [], maxP = 0, zone = { x: 0.5, y: 0.7, a: 0 };
const info = { x: 0, y: 0, dx: 0, dy: 0, vx: 0, vy: 0, prs: 0, size: 0, moving: false };

// Ein Finger: at = Startzeit, dur = Dauer, fn(u) liefert die Position für u = 0..1
function finger(at, dur, fn, o) {
  o = o || {};
  ptrs.push({ at, dur: Math.max(0.03, dur), fn, prs0: o.prs || rnd(0.3, 0.7), size0: o.size || rnd(0.025, 0.06), jit: (o.jit == null ? 0.35 : o.jit) * dpr,
    x: 0, y: 0, x0: 0, y0: 0, vx: 0, vy: 0, prs: 0, size: 0, down: false, done: false, trail: null, ph: rnd(0, 6.28) });
}
const cssX = v => v * dpr;
const inX = f => clamp(f, 0.06, 0.94) * W, inY = f => clamp(f, 0.12, 0.94) * H;
const smooth = u => u * u * (3 - 2 * u);
function catmull(pts, u) {
  const n = pts.length - 1, f = clamp(u, 0, 1) * n, i = Math.min(n - 1, f | 0), s = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const q = k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * s + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * s * s + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * s * s * s);
  return [q(0), q(1)];
}

// ---------- Gesten ----------
function tap(at, x, y, dur, o) { finger(at, dur || rnd(0.06, 0.14), () => [x, y], o); }
function swipe(at, dir) {
  dir = dir || pick(['up', 'up', 'up', 'down', 'left', 'right']);
  const len = rnd(0.25, 0.5), bend = rnd(-0.06, 0.06);
  let x0, y0, x1, y1;
  if (dir === 'up' || dir === 'down') {
    x0 = inX(rnd(0.25, 0.75)); x1 = x0 + rnd(-0.08, 0.08) * W;
    const ya = rnd(0.45, 0.85), yb = ya - len;
    if (dir === 'up') { y0 = inY(ya); y1 = inY(yb); } else { y0 = inY(yb); y1 = inY(ya); }
  } else {
    y0 = inY(rnd(0.3, 0.8)); y1 = y0 + rnd(-0.05, 0.05) * H;
    const xa = rnd(0.7, 0.9), xb = xa - rnd(0.4, 0.6);
    if (dir === 'left') { x0 = inX(xa); x1 = inX(xb); } else { x0 = inX(xb); x1 = inX(xa); }
  }
  const mx = (x0 + x1) / 2 + bend * W, my = (y0 + y1) / 2 + bend * H * 0.5, dur = rnd(0.14, 0.36);
  finger(at, dur, u => { const e = smooth(u), a = 1 - e; return [a * a * x0 + 2 * a * e * mx + e * e * x1, a * a * y0 + 2 * a * e * my + e * e * y1]; });
  return dur;
}
function drag(at) {
  const k = rint(3, 6), cx = rnd(0.2, 0.8), cy = rnd(0.25, 0.85), sp = rnd(0.12, 0.35), pts = [];
  for (let i = 0; i < k; i++) pts.push([inX(cx + rnd(-1, 1) * sp), inY(cy + rnd(-1, 1) * sp * 0.8)]);
  let L = 0; for (let i = 1; i < k; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const dur = clamp(L / (rnd(220, 650) * dpr), 0.6, 3.2);
  finger(at, dur, u => catmull(pts, smooth(u) * 0.3 + u * 0.7), { jit: 0.5 });
}
function circle(at) {
  const cx = inX(rnd(0.25, 0.75)), cy = inY(rnd(0.3, 0.8)), r = cssX(rnd(30, 90)), turns = rnd(0.9, 2), a0 = rnd(0, 6.28), s = Math.random() < 0.5 ? 1 : -1;
  finger(at, rnd(0.7, 1.5) * turns, u => { const a = a0 + s * u * turns * 6.283, rr = r * (1 + 0.12 * Math.sin(u * 9)); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]; }, { jit: 0.4 });
}
function pinch(at, n) {
  const cx = inX(rnd(0.3, 0.7)), cy = inY(rnd(0.35, 0.75)), a = rnd(0, 3.14), out = Math.random() < 0.5;
  const d0 = cssX(out ? rnd(20, 50) : rnd(110, 170)), d1 = cssX(out ? rnd(110, 170) : rnd(20, 50)), dur = rnd(0.45, 0.9);
  for (let i = 0; i < n; i++) {
    const ai = a + i * 6.283 / n + rnd(-0.15, 0.15), lag = i * rnd(0.01, 0.05);
    finger(at + lag, dur - lag * 0.5, u => { const d = d0 + (d1 - d0) * smooth(u); return [cx + Math.cos(ai) * d, cy + Math.sin(ai) * d]; });
  }
}
function multiTap(at, n) {
  const cx = rnd(0.3, 0.7), cy = rnd(0.35, 0.8);
  for (let i = 0; i < n; i++) tap(at + rnd(0, 0.04), inX(cx + rnd(-0.12, 0.12)), inY(cy + rnd(-0.06, 0.06)), rnd(0.08, 0.16));
}
function fling(at) {
  const dir = pick(['up', 'up', 'down']), n = rint(2, 4);
  let tt = at;
  for (let i = 0; i < n; i++) tt += swipe(tt, dir) + rnd(0.12, 0.35);
}
// Geistertipper: viele kurze Berührungen an einer Stelle, manchmal entlang einer Linie wie an einem Riss
function storm(strength) {
  const s = clamp(strength, 0.2, 1), cx = clamp(zone.x + rnd(-0.06, 0.06), 0.08, 0.92) * W, cy = clamp(zone.y + rnd(-0.05, 0.05), 0.14, 0.92) * H;
  const n = rint(5, 8 + Math.round(s * 20)), spread = cssX(rnd(8, 40)), line = Math.random() < 0.4, ca = Math.cos(zone.a), sa = Math.sin(zone.a);
  let tt = t + 0.05;
  for (let i = 0; i < n; i++) {
    let x, y;
    if (line) { const r = rnd(-1, 1) * spread * 4, q = rnd(-1, 1) * spread * 0.25; x = cx + ca * r - sa * q; y = cy + sa * r + ca * q; }
    else { const r = spread * Math.sqrt(-2 * Math.log(1 - Math.random() * 0.999)) * 0.7, a = rnd(0, 6.28); x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r; }
    tap(tt, x, y, rnd(0.025, 0.09), { prs: rnd(0.05, 0.35), size: rnd(0.01, 0.03), jit: 1.2 });
    tt += Math.random() < 0.25 ? rnd(0.15, 0.4) : rnd(0.02, 0.09);
    if (settings.fingers > 1 && Math.random() < 0.2) tt -= rnd(0.01, 0.04);
  }
  // manchmal bleibt danach ein zitternder Dauerdruck hängen
  if (Math.random() < 0.35 * s + 0.1) {
    const x = cx + rnd(-1, 1) * spread, y = cy + rnd(-1, 1) * spread;
    finger(tt + 0.05, rnd(0.8, 2.6), u => [x + Math.sin(u * 40) * cssX(1.5), y + Math.cos(u * 33) * cssX(1.5)], { prs: rnd(0.1, 0.3), jit: 2.2 });
  }
}
// Entsperren: nach oben wischen, dann eine PIN tippen
function unlock() {
  ptrs = [];
  const x0 = inX(rnd(0.42, 0.58));
  finger(t + 0.05, 0.32, u => { const e = smooth(u); return [x0 + e * rnd(-2, 2) * dpr, H * (0.93 - 0.5 * e)]; }, { jit: 0.2 });
  const cols = [0.24, 0.5, 0.76], rows = [0.5, 0.6, 0.7, 0.8], n = rint(4, 6);
  let tt = t + 0.65;
  for (let i = 0; i < n; i++) {
    const d = rint(0, 9), c = d === 0 ? 1 : (d - 1) % 3, r = d === 0 ? 3 : ((d - 1) / 3) | 0;
    tap(tt, W * cols[c] + rnd(-6, 6) * dpr, H * rows[r] + rnd(-6, 6) * dpr, rnd(0.07, 0.12));
    tt += rnd(0.2, 0.42);
  }
}
function randomGesture() {
  const f = settings.fingers, at = t + 0.02, r = Math.random();
  if (r < 0.24) tap(at, inX(rnd(0, 1)), inY(rnd(0, 1)));
  else if (r < 0.31) { const x = inX(rnd(0, 1)), y = inY(rnd(0, 1)); tap(at, x, y); tap(at + rnd(0.13, 0.2), x + rnd(-3, 3) * dpr, y + rnd(-3, 3) * dpr); }
  else if (r < 0.38) tap(at, inX(rnd(0, 1)), inY(rnd(0, 1)), rnd(0.6, 1.4), { jit: 0.6 });
  else if (r < 0.56) swipe(at);
  else if (r < 0.68) drag(at);
  else if (r < 0.75) circle(at);
  else if (r < 0.82) fling(at);
  else if (r < 0.92 && f >= 2) pinch(at, Math.min(f, Math.random() < 0.8 ? 2 : rint(2, f)));
  else if (f >= 2) multiTap(at, rint(2, f));
  else swipe(at);
}

// ---------- Zeichnen ----------
function drawTrails(ctx, S) {
  const life = trailLife(settings.trails), lw = Math.max(1, Math.round(dpr * 0.8)), ds = Math.max(1, Math.round(dpr * 1.2));
  ctx.globalCompositeOperation = 'lighter';
  trails = trails.filter(tr => {
    const a = tr.end < 0 ? 1 : 1 - (t - tr.end) / life;
    if (a <= 0) return false;
    const n = tr.xs.length;
    if (n > 1) {
      ctx.beginPath(); ctx.moveTo(tr.xs[0], tr.ys[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(tr.xs[i], tr.ys[i]);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.lineWidth = lw * 5; ctx.strokeStyle = rgba(S.path, 0.1 * a * S.glow); ctx.stroke();
      ctx.lineWidth = lw; ctx.strokeStyle = rgba(S.path, 0.85 * a); ctx.stroke();
    }
    ctx.fillStyle = rgba(S.dot, 0.75 * a);
    for (let i = 0; i < n; i++) ctx.fillRect(tr.xs[i] - ds / 2, tr.ys[i] - ds / 2, ds, ds);
    if (tr.ring) { // Tipper hinterlassen einen kleinen Ring
      ctx.lineWidth = lw; ctx.strokeStyle = rgba(S.path, 0.7 * a);
      ctx.beginPath(); ctx.arc(tr.xs[n - 1], tr.ys[n - 1], tr.ring * (1.5 - 0.5 * a), 0, 6.2832); ctx.stroke();
    }
    return true;
  });
}
function drawPointer(ctx, S, p) {
  const lw = Math.max(1, Math.round(dpr * 0.75)), x = p.x, y = p.y;
  ctx.globalCompositeOperation = 'lighter';
  if (settings.cross === 0) {
    ctx.fillStyle = rgba(S.cross, 0.6);
    ctx.fillRect(0, Math.round(y), W, lw); ctx.fillRect(Math.round(x), 0, lw, H);
  }
  // Berührungsfläche wie bei "Fingertipps anzeigen"
  const r = cssX(16 + p.size * 220), g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  g.addColorStop(0, rgba(S.tap, 0.22 + p.prs * 0.12)); g.addColorStop(0.6, rgba(S.tap, 0.1)); g.addColorStop(1, rgba(S.tap, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
  ctx.lineWidth = lw; ctx.strokeStyle = rgba(S.ring, 0.75);
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.82, p.ph, 0, 6.2832); ctx.stroke();
  // Geschwindigkeit als Strich (wie in der echten Anzeige)
  const k = 0.06;
  ctx.strokeStyle = rgba(S.vel, 0.9); ctx.lineWidth = Math.max(1, Math.round(dpr));
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + p.vx * k, y + p.vy * k); ctx.stroke();
  ctx.fillStyle = rgba(S.dot, 0.95); const d = Math.max(2, Math.round(dpr * 2.2)); ctx.fillRect(x - d / 2, y - d / 2, d, d);
}
function drawInfo(ctx, S, active) {
  const fs = Math.round(10 * dpr), hh = Math.round(fs * 1.55), top = Math.round(38 * dpr), cw = W / 7, pad = Math.round(3 * dpr);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = S.hb;
  for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(i * cw), top, Math.round(cw) - 1, hh);
  ctx.fillStyle = S.lvl;
  ctx.fillRect(Math.round(5 * cw), top, Math.max(0, (cw - 1) * clamp(info.prs, 0, 1)), hh);
  ctx.fillRect(Math.round(6 * cw), top, Math.max(0, (cw - 1) * clamp(info.size * 4, 0, 1)), hh);
  ctx.fillStyle = S.ht; ctx.font = fs + 'px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const f1 = v => v.toFixed(1), f3 = v => v.toFixed(3);
  const txt = ['P: ' + active + ' / ' + maxP,
    info.moving ? 'dX: ' + f1(info.dx) : 'X: ' + f1(info.x), info.moving ? 'dY: ' + f1(info.dy) : 'Y: ' + f1(info.y),
    'Xv: ' + f3(info.vx / 1000), 'Yv: ' + f3(info.vy / 1000), 'Prs: ' + info.prs.toFixed(2), 'Size: ' + info.size.toFixed(2)];
  for (let i = 0; i < 7; i++) ctx.fillText(txt[i], Math.round(i * cw) + pad, top + hh / 2 + 0.5, Math.max(1, cw - pad * 2));
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Geistertipper',
  resize(w, h, d) { W = w; H = h; dpr = d; ptrs = []; trails = []; },
  newPattern() {
    trails = []; ptrs = [];
    zone = { x: rnd(0.15, 0.85), y: Math.random() < 0.5 ? rnd(0.7, 0.9) : rnd(0.3, 0.7), a: rnd(-0.6, 0.6) + (Math.random() < 0.3 ? 1.57 : 0) };
  },
  action() { storm(Math.max(0.5, settings.fault / 10)); },
  wake() { unlock(); },
  change(id) { if (id === 'fingers') ptrs = ptrs.filter(p => p.down); },
  frame(ctx, dt) {
    t += dt;
    const S = SCHEMES[settings.color];
    // neue Gesten nur, wenn gerade kein Finger unterwegs ist
    if (!ptrs.length) {
      if (settings.fault > 0 && Math.random() < per(0.02 * Math.pow(15, (settings.fault - 1) / 9), dt)) storm(settings.fault / 10);
      else if (Math.random() < per(0.05 * Math.pow(30, (settings.rate - 1) / 9), dt)) randomGesture();
    }
    // Finger bewegen
    let active = 0;
    for (const p of ptrs) {
      if (!p.down) {
        if (t < p.at) continue;
        const q = p.fn(0); p.down = true; p.x = p.x0 = q[0]; p.y = p.y0 = q[1];
        if (!ptrs.some(o => o !== p && o.down && !o.done)) maxP = 0;
        p.trail = { xs: [p.x], ys: [p.y], end: -1 }; trails.push(p.trail);
      }
      const u = Math.min(1, (t - p.at) / p.dur), q = p.fn(u);
      const x = q[0] + rnd(-1, 1) * p.jit, y = q[1] + rnd(-1, 1) * p.jit, idt = 1 / Math.max(dt, 1e-3);
      p.vx = p.vx * 0.55 + (x - p.x) * idt * 0.45; p.vy = p.vy * 0.55 + (y - p.y) * idt * 0.45;
      p.x = x; p.y = y;
      const env = Math.min(1, u * p.dur / 0.04, (1 - u) * p.dur / 0.05 + 0.15);
      p.prs = clamp(p.prs0 * (0.85 + 0.15 * Math.sin(t * 7 + p.ph)) * env, 0, 1); p.size = p.size0 * (0.9 + 0.1 * env);
      if (p.trail.xs.length < 900) { p.trail.xs.push(x); p.trail.ys.push(y); }
      if (u >= 1) {
        p.done = true; p.trail.end = t;
        if (Math.hypot(x - p.x0, y - p.y0) < 6 * dpr) p.trail.ring = cssX(9 + p.size * 120);
      }
      else active++;
      info.x = x; info.y = y; info.dx = x - p.x0; info.dy = y - p.y0; info.vx = p.vx; info.vy = p.vy; info.prs = p.prs; info.size = p.size;
      info.moving = Math.hypot(info.dx, info.dy) > 3 * dpr;
    }
    ptrs = ptrs.filter(p => !p.done);
    maxP = Math.max(maxP, active);
    if (!active) { info.vx *= Math.exp(-dt * 8); info.vy *= Math.exp(-dt * 8); info.moving = false; }

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    drawTrails(ctx, S);
    for (const p of ptrs) if (p.down) drawPointer(ctx, S, p);
    if (settings.info === 0) drawInfo(ctx, S, active);
    ctx.globalCompositeOperation = 'source-over';
  },
};
