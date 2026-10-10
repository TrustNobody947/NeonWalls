// Plasma-Blitze: Lichtbögen wie in einer Plasmakugel. Jeder Bogen läuft vom leuchtenden Kern zum Bildrand,
// schlängelt sich in weichen Wellen, zuckt fein und verästelt sich an den Enden.
// Beim Entsperren gibt es eine Entladung mit zusätzlichen Bögen und einem kurzen Aufblitzen.
const settings = { bolts: 6, color: 0, jitter: 6, glow: 6, wander: 4, core: 0 };
const controls = [
  { type: 'range', id: 'bolts', label: 'Anzahl Blitze', min: 1, max: 12, fmt: v => String(v) },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Violett', 'Blau', 'Pink', 'Grün', 'Bunt'] },
  { type: 'range', id: 'jitter', label: 'Zucken', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'glow', label: 'Leuchten', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'wander', label: 'Wandern', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'core', label: 'Kern', options: ['Mitte', 'Unten', 'Ohne'] },
];
const HUES = [282, 218, 318, 140];

let W = 1, H = 1, dpr = 1, t = 0, bolts = [], temps = [], discharge = 0, corePulse = 0, rc = 10;
const N = 56;
const PX = new Float32Array(N + 1), PY = new Float32Array(N + 1);

function makeBolt(i, n, temp) {
  const mode = settings.core;
  let th0;
  if (mode === 1) th0 = -Math.PI + 0.3 + (Math.PI - 0.6) * ((i + rnd(0.2, 0.8)) / n);
  else th0 = (i + rnd(0.15, 0.85)) / n * Math.PI * 2;
  return {
    i, th0, pa0: rnd(0, 4), pb0: rnd(0, 4),
    w1: rnd(0.08, 0.2), w2: rnd(0.2, 0.45), p1: rnd(0, 6.28), p2: rnd(0, 6.28),
    ph: [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)], amp: [rnd(0.7, 1.2), rnd(0.35, 0.65), rnd(0.15, 0.3)], fr: [rnd(1.2, 1.8), rnd(2.6, 3.4), rnd(5, 6.5)],
    fl: rnd(0, 6.28), drop: 0, branches: [], temp: !!temp, life: temp ? rnd(0.25, 0.5) : 0, age: 0,
  };
}
function rebuild() { const n = settings.bolts; bolts = []; for (let i = 0; i < n; i++) bolts.push(makeBolt(i, n)); }

function corePos() {
  const m = settings.core;
  if (m === 1) return [W / 2, H + rc * 0.55];
  return [W / 2, H * 0.46];
}
// Punkt auf dem Bildrand in Richtung th, von (cx, cy) aus gesehen
function edgeHit(cx, cy, th) {
  const dx = Math.cos(th), dy = Math.sin(th), m = 0.004 * W;
  let tt = 1e9;
  if (dx > 1e-6) tt = Math.min(tt, (W - m - cx) / dx); else if (dx < -1e-6) tt = Math.min(tt, (m - cx) / dx);
  if (dy > 1e-6) tt = Math.min(tt, (H - m - cy) / dy); else if (dy < -1e-6) tt = Math.min(tt, (m - cy) / dy);
  if (!(tt > 0 && tt < 1e8)) tt = Math.max(W, H);
  return [cx + dx * tt, cy + dy * tt];
}
// Punkt auf dem Bildrand über einen Umlauf-Parameter 0..4
function perimeter(p) {
  p = ((p % 4) + 4) % 4; const k = p | 0, f = p - k;
  return k === 0 ? [f * W, 0] : k === 1 ? [W, f * H] : k === 2 ? [W - f * W, H] : [0, H - f * H];
}

function hueOf(b) {
  if (settings.color === 4) return (t * 25 + b.i * 360 / Math.max(1, settings.bolts)) % 360;
  return HUES[settings.color];
}

function buildPath(b, A, B, dt) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const wv = 0.3 + settings.wander * 0.12, j = settings.jitter / 10;
  for (let k = 0; k < 3; k++) b.ph[k] += dt * (0.8 + k * 0.9) * wv * 2.2;
  for (let i = 0; i <= N; i++) {
    const s = i / N, env = Math.pow(Math.sin(Math.PI * s), 0.7);
    let w = 0; for (let k = 0; k < 3; k++) w += b.amp[k] * Math.sin(Math.PI * s * b.fr[k] + b.ph[k]);
    const off = w * L * 0.06 * env + (Math.random() - 0.5) * L * 0.012 * j * (0.2 + s) * env;
    PX[i] = A[0] + dx * s + nx * off; PY[i] = A[1] + dy * s + ny * off;
  }
  return L;
}

function strokePts(ctx, xs, ys, n) {
  ctx.beginPath(); ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i <= n; i++) ctx.lineTo(xs[i], ys[i]);
}

const BXs = new Float32Array(15), BYs = new Float32Array(15);
function drawBolt(ctx, b, A, B, dt, boost) {
  const L = buildPath(b, A, B, dt), h = hueOf(b), g = settings.glow / 10;
  b.fl += dt * rnd(10, 26);
  if (b.drop > 0) b.drop -= dt; else if (Math.random() < per(0.35, dt)) b.drop = rnd(0.04, 0.14);
  let I = (0.78 + 0.22 * Math.sin(b.fl)) * (b.drop > 0 ? 0.18 : 1) * boost;
  if (b.temp) I *= Math.min(1, (b.life - b.age) / 0.15) * 1.3;
  const gr = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
  gr.addColorStop(0, 'hsla(' + ((h + 25) % 360) + ',100%,86%,' + Math.min(1, 0.55 * I).toFixed(3) + ')');
  gr.addColorStop(1, 'hsla(' + h + ',100%,62%,' + Math.min(1, 0.4 * I).toFixed(3) + ')');
  strokePts(ctx, PX, PY, N);
  ctx.lineWidth = (14 + g * 26) * dpr; ctx.strokeStyle = 'hsla(' + h + ',100%,55%,' + (0.022 * I).toFixed(4) + ')'; ctx.stroke();
  ctx.lineWidth = (5 + g * 10) * dpr; ctx.strokeStyle = 'hsla(' + h + ',100%,60%,' + (0.07 * I).toFixed(4) + ')'; ctx.stroke();
  ctx.lineWidth = (1.6 + g * 1.6) * dpr; ctx.strokeStyle = gr; ctx.stroke();
  ctx.lineWidth = Math.max(1, 0.9 * dpr); ctx.strokeStyle = 'hsla(' + h + ',100%,95%,' + Math.min(1, 0.85 * I).toFixed(3) + ')'; ctx.stroke();
  // Verästelungen an den äußeren Enden
  if (b.branches.length < 2 && Math.random() < per(6, dt)) b.branches.push({ s0: rnd(0.45, 0.9), ang: rnd(0.25, 0.75) * (Math.random() < 0.5 ? -1 : 1), len: rnd(0.08, 0.25), life: rnd(0.12, 0.55), age: 0 });
  b.branches = b.branches.filter(br => {
    br.age += dt; if (br.age > br.life) return false;
    const i0 = Math.round(br.s0 * N), x0 = PX[i0], y0 = PY[i0];
    const i1 = Math.min(N, i0 + 1), dir = Math.atan2(PY[i1] - y0, PX[i1] - x0) + br.ang, bl = L * br.len;
    let x = x0, y = y0, a = dir;
    for (let k = 0; k <= 14; k++) { BXs[k] = x; BYs[k] = y; a += (Math.random() - 0.5) * 0.5; x += Math.cos(a) * bl / 14; y += Math.sin(a) * bl / 14; }
    const fade = I * Math.min(1, (br.life - br.age) / 0.1) * 0.8;
    strokePts(ctx, BXs, BYs, 14);
    ctx.lineWidth = (3 + g * 6) * dpr; ctx.strokeStyle = 'hsla(' + h + ',100%,60%,' + (0.06 * fade).toFixed(4) + ')'; ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.7 * dpr); ctx.strokeStyle = 'hsla(' + h + ',100%,90%,' + (0.7 * fade).toFixed(3) + ')'; ctx.stroke();
    return true;
  });
  // Auftreffpunkt am Rand
  const er = (10 + g * 22) * dpr, eg = ctx.createRadialGradient(B[0], B[1], 0, B[0], B[1], er);
  eg.addColorStop(0, 'hsla(' + h + ',100%,85%,' + Math.min(1, 0.45 * I).toFixed(3) + ')'); eg.addColorStop(1, 'hsla(' + h + ',100%,50%,0)');
  ctx.fillStyle = eg; ctx.fillRect(B[0] - er, B[1] - er, er * 2, er * 2);
}

function endpoints(b, C) {
  const wv = 0.2 + settings.wander * 0.25, m = settings.core;
  if (m === 2) {
    const pa = b.pa0 + 0.25 * Math.sin(t * b.w1 * wv + b.p1);
    const pb = pa + 2 + 0.6 * Math.sin(t * b.w2 * wv + b.p2) + (b.pb0 - 2) * 0.15;
    return [perimeter(pa), perimeter(pb)];
  }
  const th = b.th0 + 0.35 * Math.sin(t * b.w1 * wv + b.p1) + 0.2 * Math.sin(t * b.w2 * wv + b.p2);
  return [[C[0] + Math.cos(th) * rc * 0.7, C[1] + Math.sin(th) * rc * 0.7], edgeHit(C[0], C[1], th)];
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Entladung',
  resize(w, h, d) { W = w; H = h; dpr = d; rc = Math.min(W, H) * 0.065; },
  newPattern() { rebuild(); temps = []; },
  action() { discharge = 1; corePulse = 1; for (let k = 0; k < 6; k++) temps.push(makeBolt(rint(0, 99), 1, true)); },
  wake() { this.action(); },
  change(id) { if (id === 'bolts' || id === 'core') rebuild(); },
  frame(ctx, dt) {
    t += dt; discharge *= Math.exp(-dt * 3); corePulse *= Math.exp(-dt * 2.5);
    const C = corePos(), base = HUES[settings.color === 4 ? 0 : settings.color], hb = settings.color === 4 ? (t * 25) % 360 : base;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // schwaches Umgebungsleuchten
    if (settings.core !== 2) {
      const ar = Math.max(W, H) * 0.55, ag = ctx.createRadialGradient(C[0], C[1], 0, C[0], C[1], ar);
      ag.addColorStop(0, 'hsla(' + hb + ',100%,45%,' + (0.055 + 0.06 * discharge).toFixed(3) + ')'); ag.addColorStop(1, 'hsla(' + hb + ',100%,30%,0)');
      ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);
    }
    if (Math.random() < per(0.12, dt)) temps.push(makeBolt(rint(0, 99), 1, true));
    const boost = 1 + discharge * 0.7;
    for (const b of bolts) { const [A, B] = endpoints(b, C); drawBolt(ctx, b, A, B, dt, boost); }
    temps = temps.filter(b => {
      b.age += dt; if (b.age > b.life) return false;
      const th = b.th0 + rnd(-0.02, 0.02), A = settings.core === 2 ? perimeter(b.pa0) : [C[0] + Math.cos(th) * rc * 0.7, C[1] + Math.sin(th) * rc * 0.7];
      const B = settings.core === 2 ? perimeter(b.pa0 + 2) : edgeHit(C[0], C[1], th);
      drawBolt(ctx, b, A, B, dt, boost); return true;
    });
    // Kern
    if (settings.core !== 2) {
      const r = rc * (1 + 0.05 * Math.sin(t * 13) + corePulse * 0.35), R = r * 2.6;
      const cg = ctx.createRadialGradient(C[0], C[1], 0, C[0], C[1], R);
      cg.addColorStop(0, 'rgba(255,255,255,0.95)'); cg.addColorStop(0.2, 'hsla(' + hb + ',100%,88%,0.9)');
      cg.addColorStop(0.42, 'hsla(' + hb + ',100%,62%,0.45)'); cg.addColorStop(1, 'hsla(' + hb + ',100%,40%,0)');
      ctx.fillStyle = cg; ctx.fillRect(C[0] - R, C[1] - R, R * 2, R * 2);
    }
    if (discharge > 0.01) { ctx.fillStyle = 'hsla(' + hb + ',100%,60%,' + (0.12 * discharge).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';
  },
};
