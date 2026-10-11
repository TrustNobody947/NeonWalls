// Plasma-Bildschirm: Lichtbögen wie bei der Jakobsleiter, aber über den ganzen Bildschirm.
// "Leiter": Bögen spannen sich zwischen linkem und rechtem Bildrand, steigen auf, reißen oben ab und zünden unten neu.
// "Wandernd": die Enden gleiten am Bildrand entlang, die Bögen fegen quer übers Bild.
// "Zentrum": Bögen laufen von einem glühenden Kern zu den Rändern.
// Berührung: der Finger wird zur Elektrode, die Bögen springen auf ihn über (beim Ziehen folgen sie).
const settings = { form: 0, count: 3, speed: 5, power: 6, thick: 5, jitter: 5, after: 5, color: 0 };
const controls = [
  { type: 'choice', id: 'form', label: 'Form', options: ['Leiter', 'Wandernd', 'Zentrum'] },
  { type: 'range', id: 'count', label: 'Anzahl Bögen', min: 1, max: 8, fmt: v => String(v) },
  { type: 'range', id: 'speed', label: 'Geschwindigkeit', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'power', label: 'Intensität', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'thick', label: 'Stärke', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'jitter', label: 'Zucken', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'after', label: 'Nachleuchten', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Violett', 'Blau', 'Weiß', 'Orange', 'Grün', 'Bunt'] },
];
const COLS = [
  { core: [250, 242, 255], mid: [190, 140, 255], out: [120, 60, 255] },
  { core: [235, 248, 255], mid: [120, 190, 255], out: [40, 110, 255] },
  { core: [255, 255, 255], mid: [215, 225, 255], out: [150, 160, 255] },
  { core: [255, 246, 222], mid: [255, 170, 80], out: [255, 90, 20] },
  { core: [235, 255, 240], mid: [110, 255, 170], out: [20, 200, 110] },
];
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
const hsl = (h, l) => { const k = n => (n + h / 30) % 12, a = Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0]; };
const N = 56;

let W = 1, H = 1, dpr = 1, t = 0;
let arcs = [], temps = [], sparks = [], flash = 0, flashX = 0, flashY = 0, coreP = 0;
const finger = { x: 0, y: 0, on: false, att: 0 };

function colorsOf(a) {
  if (settings.color < 5) return COLS[settings.color];
  const h = (t * 20 + a.i * 67) % 360;
  return { core: hsl(h, 0.94), mid: hsl(h, 0.72), out: hsl(h, 0.5) };
}
function newArc(i, n) {
  return {
    i, s: n ? (i + rnd(0.1, 0.9)) / n : 0, dl: rnd(-0.02, 0.02), dr: rnd(-0.02, 0.02), sp: rnd(0.85, 1.15),
    ph: [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)], bright: 1, drop: 0,
    pa: rnd(0, 4), pb: 0, va: rnd(0.6, 1.4) * (Math.random() < 0.5 ? -1 : 1), vb: rnd(0.6, 1.4) * (Math.random() < 0.5 ? -1 : 1),
    th: (i / Math.max(1, n)) * Math.PI * 2 + rnd(-0.3, 0.3), side: Math.random() < 0.5 ? 1 : -1, hist: [], histT: 0, branches: [], att: 0, cool: 0,
  };
}
function rebuild() {
  const n = settings.count;
  arcs = [];
  for (let i = 0; i < n; i++) { const a = newArc(i, n); a.pb = a.pa + 2 + rnd(-0.5, 0.5); arcs.push(a); }
}
// Punkt auf dem Bildrand über einen Umlauf-Parameter 0..4
function perimeter(p) {
  p = ((p % 4) + 4) % 4; const k = p | 0, f = p - k, m = 0.004 * W;
  return k === 0 ? [m + f * (W - 2 * m), m] : k === 1 ? [W - m, m + f * (H - 2 * m)] : k === 2 ? [W - m - f * (W - 2 * m), H - m] : [m, H - m - f * (H - 2 * m)];
}
function edgeHit(cx, cy, th) {
  const dx = Math.cos(th), dy = Math.sin(th), m = 0.004 * W;
  let tt = 1e9;
  if (dx > 1e-6) tt = Math.min(tt, (W - m - cx) / dx); else if (dx < -1e-6) tt = Math.min(tt, (m - cx) / dx);
  if (dy > 1e-6) tt = Math.min(tt, (H - m - cy) / dy); else if (dy < -1e-6) tt = Math.min(tt, (m - cy) / dy);
  if (!(tt > 0 && tt < 1e8)) tt = Math.max(W, H);
  return [cx + dx * tt, cy + dy * tt];
}

// Bogenform: Parabel mit Wölbung, darüber mehrere weiche Wellen und feines Zucken, danach geglättet
function arcPath(a, A, B, bow, up, ph0, xs, ys) {
  const j = settings.jitter / 10, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L, ny = dx / L;
  if (up ? ny > 0 : a.side < 0) { nx = -nx; ny = -ny; }
  const cx = (A[0] + B[0]) / 2 + nx * bow * 2, cy = (A[1] + B[1]) / 2 + ny * bow * 2, ph = a.ph;
  for (let i = 0; i <= N; i++) {
    const u = i / N, m = 1 - u, env = Math.pow(Math.sin(Math.PI * u), 0.8);
    const bx = m * m * A[0] + 2 * m * u * cx + u * u * B[0], by = m * m * A[1] + 2 * m * u * cy + u * u * B[1];
    const w = 0.05 * Math.sin(6.283 * 1.5 * u + ph[0] + ph0) + 0.03 * Math.sin(6.283 * 3.2 * u + ph[1]) + 0.016 * Math.sin(6.283 * 7 * u + ph[2]);
    const d = Math.min(L, H * 0.6) * env * (w * (0.25 + j * 1.1) + (Math.random() - 0.5) * 0.006 * j);
    xs[i] = bx + nx * d; ys[i] = by + ny * d;
  }
  for (let i = 1; i < N; i++) { xs[i] = (xs[i - 1] + 2 * xs[i] + xs[i + 1]) / 4; ys[i] = (ys[i - 1] + 2 * ys[i] + ys[i + 1]) / 4; }
  return L;
}
function strokeArc(ctx, xs, ys) { ctx.beginPath(); ctx.moveTo(xs[0], ys[0]); for (let i = 1; i <= N; i++) ctx.lineTo(xs[i], ys[i]); }
function burst(x, y, n, up) {
  for (let i = 0; i < n; i++) {
    const a = up ? rnd(-Math.PI * 0.95, -Math.PI * 0.05) : rnd(0, Math.PI * 2), v = rnd(80, 420) * dpr;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.2, 0.7), age: 0 });
  }
}

// Ein Bogen (oder bei Berührung zwei Teilbögen über den Finger) für dieses Bild
function segmentsOf(a, dt) {
  const form = settings.form, spd = 0.25 + settings.speed * 0.15;
  let A, B, bow, up = false;
  if (form === 0) {
    if (a.cool > 0) { a.cool -= dt; if (a.cool <= 0) { a.s = 0; burst(0.01 * W, H * 0.96, 3, true); burst(0.99 * W, H * 0.96, 3, true); } }
    else a.s += dt * (0.05 + 0.3 * a.s) * spd * a.sp;
    a.dl = clamp(a.dl + rnd(-1, 1) * 0.003, -0.03, 0.03); a.dr = clamp(a.dr + rnd(-1, 1) * 0.003, -0.03, 0.03);
    const yl = H * (0.97 - 0.94 * clamp(a.s + a.dl, 0, 1.02)), yr = H * (0.97 - 0.94 * clamp(a.s + a.dr, 0, 1.02));
    A = [0.004 * W, yl]; B = [W * 0.996, yr]; bow = W * (0.03 + 0.1 * a.s) * (1 + 0.2 * Math.sin(t * 2.3 + a.ph[3])); up = true;
  } else if (form === 1) {
    a.pa += dt * a.va * 0.06 * spd; a.pb += dt * a.vb * 0.05 * spd;
    if (Math.abs(((a.pb - a.pa) % 4 + 4) % 4 - 2) > 1.2) a.vb = -a.vb;
    A = perimeter(a.pa); B = perimeter(a.pb); bow = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.12 * Math.sin(t * 0.4 * spd + a.ph[4]);
  } else {
    a.th += dt * 0.12 * spd * (a.va > 0 ? 1 : -1) * (0.7 + 0.3 * Math.sin(t * 0.3 + a.i));
    const C = [W / 2, H * 0.5], r = Math.min(W, H) * 0.05;
    A = [C[0] + Math.cos(a.th) * r, C[1] + Math.sin(a.th) * r]; B = edgeHit(C[0], C[1], a.th);
    bow = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.08 * Math.sin(t * 0.7 + a.ph[4]);
  }
  // Berührung: Bogen springt auf den Finger über
  a.att += ((finger.on ? 1 : 0) - a.att) * Math.min(1, dt * (finger.on ? 14 : 4));
  if (a.att > 0.02) {
    const F = [finger.x, finger.y];
    if (form === 2) { const B2 = [B[0] + (F[0] - B[0]) * a.att, B[1] + (F[1] - B[1]) * a.att]; return [[A, B2, bow * (1 - a.att), false]]; }
    const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], P = [M[0] + (F[0] - M[0]) * a.att, M[1] + (F[1] - M[1]) * a.att];
    if (form === 1) return [[A, P, bow * 0.5, false], [P, B, bow * 0.5, false]];
    return [[A, P, bow * 0.4, true], [P, B, bow * 0.4, true]];
  }
  return [[A, B, bow, up]];
}

const XS = new Float32Array(N + 1), YS = new Float32Array(N + 1);
function drawArc(ctx, C, I, xs, ys) {
  const k = 0.4 + settings.thick / 10 * 1.4, g = settings.power / 10;
  strokeArc(ctx, xs, ys);
  ctx.lineWidth = (16 + 26 * g) * dpr * k; ctx.strokeStyle = rgba(C.out, (0.025 + 0.03 * g) * I); ctx.stroke();
  ctx.lineWidth = (6 + 9 * g) * dpr * k; ctx.strokeStyle = rgba(C.mid, (0.09 + 0.08 * g) * I); ctx.stroke();
  ctx.lineWidth = (2.4 + 1.6 * g) * dpr * k; ctx.strokeStyle = rgba(C.mid, 0.55 * I); ctx.stroke();
  ctx.lineWidth = Math.max(1, 1.5 * dpr * k); ctx.strokeStyle = rgba(C.core, 0.95 * I); ctx.stroke();
}
function drawGlowDot(ctx, C, x, y, r, I) {
  const eg = ctx.createRadialGradient(x, y, 0, x, y, r);
  eg.addColorStop(0, rgba(C.core, 0.85 * I)); eg.addColorStop(0.3, rgba(C.mid, 0.35 * I)); eg.addColorStop(1, rgba(C.out, 0));
  ctx.fillStyle = eg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Entladung',
  hint: 'Tippen: Menü · Ziehen: Blitze',
  resize(w, h, d) { W = w; H = h; dpr = d; sparks = []; },
  newPattern() { rebuild(); temps = []; },
  action() {
    for (let k = rint(3, 5); k > 0; k--) {
      const a = newArc(rint(0, 99), 0); a.life = rnd(0.25, 0.6); a.age = 0;
      a.A = perimeter(rnd(0, 4)); a.B = perimeter(rnd(0, 4) + 2); temps.push(a);
    }
    flash = 1; flashX = W / 2; flashY = H / 2;
  },
  wake() {
    if (settings.form === 0) arcs.forEach((a, i) => { a.s = i * 0.08; });
    flash = 1; flashX = W / 2; flashY = settings.form === 0 ? H * 0.95 : H / 2; coreP = 1;
    burst(flashX, flashY, 12, settings.form === 0);
  },
  touch(type, x, y) {
    finger.x = x; finger.y = y;
    if (type === 'down') { finger.on = true; burst(x, y, 8, false); }
    else if (type === 'up') finger.on = false;
  },
  change(id) { if (id === 'count' || id === 'form') rebuild(); },
  frame(ctx, dt) {
    t += dt;
    if (!arcs.length) rebuild();
    const g = settings.power / 10, histLife = 0.06 + settings.after * 0.05;
    flash *= Math.exp(-dt * 12); coreP *= Math.exp(-dt * 3);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const draws = [];
    for (const a of arcs) {
      a.ph[0] += dt * (1.5) * (0.4 + settings.jitter / 10 * 1.4) * (0.6 + settings.speed * 0.08);
      for (let k = 1; k < 5; k++) a.ph[k] += dt * (1.5 + k * 2.2) * (0.4 + settings.jitter / 10 * 1.4) * (0.6 + settings.speed * 0.08);
      if (a.drop > 0) a.drop -= dt; else if (Math.random() < per(0.3 + settings.jitter * 0.12, dt)) a.drop = rnd(0.02, 0.08);
      a.bright = (a.drop > 0 ? 0.35 : 1) * (0.86 + 0.14 * Math.random());
      const segs = segmentsOf(a, dt);
      // Leiter: oben abreißen, nach kurzer Pause unten neu zünden
      if (settings.form === 0 && a.s >= 1 && a.cool <= 0 && a.att < 0.5) {
        burst(rnd(0.05, 0.95) * W, H * 0.03, rint(6, 12), true); flash = Math.max(flash, 0.5); flashX = W / 2; flashY = H * 0.03;
        a.cool = rnd(0.05, 0.45) / (0.25 + settings.speed * 0.15); a.hist = [];
      }
      a.histT -= dt; a.snap = a.histT <= 0; if (a.snap) a.histT = 0.03;
      const C = colorsOf(a);
      segs.forEach((sg, si) => {
        if (settings.form === 0 && a.cool > 0 && a.att < 0.5) return;
        arcPath(a, sg[0], sg[1], sg[2], sg[3], si * 1.7, XS, YS);
        draws.push({ a, C, xs: Float32Array.from(XS), ys: Float32Array.from(YS), A: sg[0], B: sg[1], si });
      });
    }
    // Entladungsbögen
    temps = temps.filter(a => {
      a.age += dt; if (a.age > a.life) return false;
      for (let k = 0; k < 5; k++) a.ph[k] += dt * (3 + k * 3);
      a.bright = Math.min(1, (a.life - a.age) / 0.12) * (0.8 + 0.2 * Math.random());
      arcPath(a, a.A, a.B, Math.hypot(a.B[0] - a.A[0], a.B[1] - a.A[1]) * 0.1, false, 0, XS, YS);
      draws.push({ a, C: colorsOf(a), xs: Float32Array.from(XS), ys: Float32Array.from(YS), A: a.A, B: a.B, si: 9 });
      return true;
    });
    // Umgebungslicht: ein weicher Schein um die Mitte aller Bögen
    if (draws.length) {
      let mx = 0, my = 0, br = 0;
      for (const d of draws) { mx += (d.A[0] + d.B[0]) / 2; my += (d.A[1] + d.B[1]) / 2; br += d.a.bright; }
      mx /= draws.length; my /= draws.length;
      const R = Math.max(W, H) * 0.7, ag = ctx.createRadialGradient(mx, my, 0, mx, my, R), C = draws[0].C;
      ag.addColorStop(0, rgba(C.out, Math.min(0.2, (0.03 + 0.05 * g) * br * 0.6))); ag.addColorStop(1, rgba(C.out, 0));
      ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);
    }
    // Nachleuchten: frühere Formen der Bögen, breiter und blasser
    if (settings.after > 0) for (const d of draws) if (d.si < 9 && d.a.snap) d.a.hist.push({ xs: d.xs, ys: d.ys, age: 0, b: d.a.bright });
    const k = 0.4 + settings.thick / 10 * 1.4;
    for (const a of arcs) {
      a.hist = a.hist.filter(h => (h.age += dt) < histLife);
      const C = colorsOf(a);
      for (const h of a.hist) {
        const f = 1 - h.age / histLife;
        ctx.beginPath(); ctx.moveTo(h.xs[0], h.ys[0]); for (let i = 1; i <= N; i++) ctx.lineTo(h.xs[i], h.ys[i]);
        ctx.lineWidth = (8 + 10 * g) * dpr * k * (1 + h.age * 3); ctx.strokeStyle = rgba(C.mid, 0.07 * h.b * f * f); ctx.stroke();
      }
    }
    // Bögen, Verästelungen, Fußpunkte
    for (const d of draws) {
      drawArc(ctx, d.C, d.a.bright, d.xs, d.ys);
      const a = d.a;
      if (a.branches.length < 2 && Math.random() < per(3 + settings.jitter * 0.5, dt)) a.branches.push({ s0: rnd(0.2, 0.8), ang: rnd(0.3, 0.9) * (Math.random() < 0.5 ? -1 : 1), len: rnd(0.04, 0.12), life: rnd(0.08, 0.3), age: 0, si: d.si });
      for (const br of a.branches) {
        if (br.si !== d.si) continue;
        const i0 = Math.round(br.s0 * N), x0 = d.xs[i0], y0 = d.ys[i0], i1 = Math.min(N, i0 + 1);
        const L = Math.hypot(d.B[0] - d.A[0], d.B[1] - d.A[1]), dir = Math.atan2(d.ys[i1] - y0, d.xs[i1] - x0) + br.ang, bl = Math.min(L, H * 0.5) * br.len;
        let x = x0, y = y0, an = dir;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let q = 0; q < 10; q++) { an += (Math.random() - 0.5) * 0.6; x += Math.cos(an) * bl / 10; y += Math.sin(an) * bl / 10; ctx.lineTo(x, y); }
        const fade = d.a.bright * Math.min(1, (br.life - br.age) / 0.08) * 0.8;
        ctx.lineWidth = (3 + 5 * g) * dpr * k; ctx.strokeStyle = rgba(d.C.mid, 0.07 * fade); ctx.stroke();
        ctx.lineWidth = Math.max(1, 0.8 * dpr * k); ctx.strokeStyle = rgba(d.C.core, 0.75 * fade); ctx.stroke();
      }
      const r = (7 + 10 * g) * dpr * k;
      drawGlowDot(ctx, d.C, d.A[0], d.A[1], r, d.a.bright);
      drawGlowDot(ctx, d.C, d.B[0], d.B[1], r, d.a.bright);
    }
    for (const a of arcs) a.branches = a.branches.filter(br => (br.age += dt) < br.life);
    // Kern (Form Zentrum) und Finger
    const C0 = colorsOf(arcs[0] || { i: 0 });
    if (settings.form === 2) {
      const R = Math.min(W, H) * (0.06 + coreP * 0.03) * (1 + 0.04 * Math.sin(t * 13)), x = W / 2, y = H * 0.5, cg = ctx.createRadialGradient(x, y, 0, x, y, R * 2.4);
      cg.addColorStop(0, 'rgba(255,255,255,0.95)'); cg.addColorStop(0.2, rgba(C0.core, 0.9)); cg.addColorStop(0.45, rgba(C0.mid, 0.4)); cg.addColorStop(1, rgba(C0.out, 0));
      ctx.fillStyle = cg; ctx.fillRect(x - R * 2.4, y - R * 2.4, R * 4.8, R * 4.8);
    }
    const fa = Math.max(...arcs.map(a => a.att), 0);
    if (fa > 0.02) {
      drawGlowDot(ctx, C0, finger.x, finger.y, (26 + 30 * g) * dpr * (0.8 + 0.2 * Math.random()), fa);
      if (finger.on && Math.random() < per(25, dt)) burst(finger.x, finger.y, 1, false);
    }
    // Funken
    const G = 900 * dpr;
    sparks = sparks.filter(s => {
      s.age += dt; if (s.age > s.life) return false;
      s.vy += G * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const f = 1 - s.age / s.life;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025);
      ctx.lineWidth = Math.max(1, 1.3 * dpr); ctx.strokeStyle = 'rgba(255,' + (200 + 55 * f | 0) + ',' + (150 + 100 * f | 0) + ',' + (0.9 * f).toFixed(3) + ')'; ctx.stroke();
      return true;
    });
    if (flash > 0.01) {
      const r = Math.max(W, H) * 0.7, fg = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, r);
      fg.addColorStop(0, rgba(C0.mid, 0.22 * flash * (0.5 + g))); fg.addColorStop(1, rgba(C0.out, 0));
      ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  },
};
