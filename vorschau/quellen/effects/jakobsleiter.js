// Jakobsleiter: zwei Drähte, die nach oben auseinanderlaufen. Unten zündet ein Lichtbogen, die heiße Luft trägt ihn nach oben,
// er wird länger, wölbt sich, zuckt und reißt oben mit Funken ab. Dann zündet unten der nächste.
// Die Drähte glühen dort nach, wo der Bogen gerade entlanggelaufen ist.
const settings = { speed: 5, jitter: 5, glow: 6, arcs: 1, color: 0 };
const controls = [
  { type: 'range', id: 'speed', label: 'Steigtempo', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'jitter', label: 'Zucken', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'glow', label: 'Leuchten', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'arcs', label: 'Bögen gleichzeitig', min: 1, max: 3, fmt: v => String(v) },
  { type: 'choice', id: 'color', label: 'Bogenfarbe', options: ['Violett', 'Blau', 'Weiß', 'Orange', 'Grün'] },
];
const COLS = [
  { core: [250, 242, 255], mid: [190, 140, 255], out: [120, 60, 255] },
  { core: [235, 248, 255], mid: [120, 190, 255], out: [40, 110, 255] },
  { core: [255, 255, 255], mid: [215, 225, 255], out: [150, 160, 255] },
  { core: [255, 246, 222], mid: [255, 170, 80], out: [255, 90, 20] },
  { core: [235, 255, 240], mid: [110, 255, 170], out: [20, 200, 110] },
];
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
const N = 48, HN = 32;
const PX = new Float32Array(N + 1), PY = new Float32Array(N + 1);

let W = 1, H = 1, dpr = 1, t = 0;
let geo = { cx: 0.5, y0: 0.86, y1: 0.13, g0: 0.04, gt: 0.62, p: 1.4, skew: 0 };
let arcs = [], sparks = [], hist = [], cool = 0.4, flash = 0, flashV = 0, histT = 0;
const heat = [new Float32Array(HN), new Float32Array(HN)];

// Drahtform: v = 0 unten, v = 1 oben
const half = v => (geo.g0 + (geo.gt - geo.g0) * Math.pow(Math.max(0, v), geo.p)) * W / 2;
const wx = (side, v) => geo.cx * W + geo.skew * W * Math.max(0, v) + (side ? 1 : -1) * half(v);
const wy = v => (geo.y0 + (geo.y1 - geo.y0) * v) * H;

function newArc() {
  return {
    s: 0, age: 0, dl: rnd(-0.01, 0.01), dr: rnd(-0.01, 0.01), bright: 1, drop: 0,
    ph: [rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)], sp: rnd(0.85, 1.15),
  };
}
function ignite(strong) {
  arcs.push(newArc());
  flash = Math.max(flash, strong ? 1 : 0.45); flashV = 0;
}
function burst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(80, 380) * dpr;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.25, 0.8), age: 0 });
  }
}

function buildPath(a) {
  const j = settings.jitter / 10;
  const vL = clamp(a.s + a.dl, 0, 1.02), vR = clamp(a.s + a.dr, 0, 1.02);
  const Lx = wx(0, vL), Ly = wy(vL), Rx = wx(1, vR), Ry = wy(vR), len = Math.hypot(Rx - Lx, Ry - Ly) || 1;
  const bow = len * (0.1 + 0.3 * a.s) * (1 + 0.18 * Math.sin(t * 2.7 + a.ph[0]));
  const Cx = (Lx + Rx) / 2 + len * 0.1 * Math.sin(a.ph[1]), Cy = (Ly + Ry) / 2 - bow * 2;
  for (let i = 0; i <= N; i++) {
    const u = i / N, m = 1 - u, env = Math.pow(Math.sin(Math.PI * u), 0.8);
    const bx = m * m * Lx + 2 * m * u * Cx + u * u * Rx, by = m * m * Ly + 2 * m * u * Cy + u * u * Ry;
    const w = 0.05 * Math.sin(6.283 * 1.5 * u + a.ph[2]) + 0.03 * Math.sin(6.283 * 3.2 * u + a.ph[3]) + 0.016 * Math.sin(6.283 * 7 * u + a.ph[4]);
    const d = len * env * (w * (0.25 + j * 1.1) + (Math.random() - 0.5) * 0.006 * j);
    PX[i] = bx + d * 0.35; PY[i] = by + d;
  }
  // leicht glätten: ein Lichtbogen ist ein Plasmaschlauch, kein Blitz
  for (let i = 1; i < N; i++) { PX[i] = (PX[i - 1] + 2 * PX[i] + PX[i + 1]) / 4; PY[i] = (PY[i - 1] + 2 * PY[i] + PY[i + 1]) / 4; }
  return { Lx, Ly, Rx, Ry, len, vL, vR };
}
function strokePath(ctx) { ctx.beginPath(); ctx.moveTo(PX[0], PY[0]); for (let i = 1; i <= N; i++) ctx.lineTo(PX[i], PY[i]); }

function drawWires(ctx, C, light) {
  const lw = Math.max(1.5, 2.4 * dpr);
  for (let side = 0; side < 2; side++) {
    ctx.beginPath();
    ctx.moveTo(wx(side, 0), wy(-0.09));
    for (let k = 0; k <= 40; k++) { const v = k / 40 * 1.03; ctx.lineTo(wx(side, v), wy(v)); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = lw; ctx.strokeStyle = 'rgb(58,60,68)'; ctx.stroke();
    ctx.lineWidth = Math.max(1, lw * 0.35); ctx.strokeStyle = 'rgba(190,195,210,0.35)'; ctx.stroke();
    // Licht vom Bogen und nachglühende heiße Stellen
    const g = ctx.createLinearGradient(0, wy(0), 0, wy(1));
    const hs = heat[side];
    for (let k = 0; k < HN; k++) {
      const v = k / (HN - 1), h = hs[k];
      let r = 255 * h, gg = 110 * h * h + 40 * h, b = 20 * h, a = Math.min(1, h * 1.2);
      for (const L of light) {
        const q = Math.exp(-Math.pow((v - (side ? L.vR : L.vL)) / 0.12, 2)) * L.i;
        r += C.mid[0] * q; gg += C.mid[1] * q; b += C.mid[2] * q; a = Math.min(1, a + q);
      }
      g.addColorStop(v, 'rgba(' + Math.min(255, r | 0) + ',' + Math.min(255, gg | 0) + ',' + Math.min(255, b | 0) + ',' + a.toFixed(3) + ')');
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = lw * 1.1; ctx.strokeStyle = g; ctx.stroke();
    ctx.lineWidth = lw * 4; ctx.globalAlpha = 0.18; ctx.stroke(); ctx.globalAlpha = 1;
  }
  // Anschlüsse unten
  ctx.globalCompositeOperation = 'source-over';
  for (let side = 0; side < 2; side++) {
    const x = wx(side, 0), y = wy(-0.09), w = 16 * dpr, h = 0.06 * H;
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#0b0b0e'); g.addColorStop(0.45, '#26262c'); g.addColorStop(1, '#0b0b0e');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - w / 2, y, w, Math.max(1, dpr * 0.7));
  }
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Zünden',
  resize(w, h, d) {
    W = w; H = h; dpr = d;
    sparks = []; hist = [];
  },
  newPattern() {
    geo = { cx: 0.5 + rnd(-0.02, 0.02), y0: rnd(0.84, 0.87), y1: rnd(0.1, 0.16), g0: rnd(0.03, 0.05), gt: rnd(0.52, 0.7), p: rnd(1.05, 1.8), skew: rnd(-0.025, 0.025) };
    arcs = []; cool = 0.2; heat[0].fill(0); heat[1].fill(0);
  },
  action() { ignite(true); },
  wake() { arcs = []; cool = 0; ignite(true); burst(wx(0, 0), wy(0), 6); burst(wx(1, 0), wy(0), 6); },
  change(id) { if (id === 'arcs') while (arcs.length > settings.arcs) arcs.shift(); },
  frame(ctx, dt) {
    t += dt;
    const C = COLS[settings.color], g = settings.glow / 10, j = settings.jitter / 10, spd = 0.3 + settings.speed * 0.17;
    // neue Bögen unten zünden
    cool -= dt;
    if (cool <= 0 && arcs.length < settings.arcs && (!arcs.length || arcs[arcs.length - 1].s > 0.5)) ignite(false);
    // Bögen steigen, oben reißen sie ab
    const light = [];
    for (const a of arcs) {
      a.age += dt;
      a.s += dt * (0.12 + 0.5 * a.s) * spd * a.sp * (0.75 + 0.5 * Math.random());
      for (let k = 0; k < 5; k++) a.ph[k] += dt * (1.5 + k * 2.2) * (0.4 + j * 1.4) * (Math.random() < 0.5 ? 1 : 1.3);
      a.dl = clamp(a.dl + rnd(-1, 1) * 0.004, -0.035, 0.035); a.dr = clamp(a.dr + rnd(-1, 1) * 0.004, -0.035, 0.035);
      if (a.drop > 0) a.drop -= dt; else if (Math.random() < per(0.4 + j * 1.5 * a.s, dt)) a.drop = rnd(0.02, 0.08);
      a.bright = (1 - 0.35 * a.s * a.s) * (a.drop > 0 ? 0.35 : 1) * (0.86 + 0.14 * Math.random());
    }
    arcs = arcs.filter(a => {
      if (a.s < 1) return true;
      burst(wx(0, 1), wy(1), rint(4, 9)); burst(wx(1, 1), wy(1), rint(4, 9));
      flash = Math.max(flash, 0.55); flashV = 1; cool = rnd(0.06, 0.45);
      return false;
    });
    flash *= Math.exp(-dt * 14);
    // Wärme in den Drähten
    for (let side = 0; side < 2; side++) for (let k = 0; k < HN; k++) heat[side][k] *= Math.exp(-dt * 1.4);

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    // Nachleuchten der heißen Luft: die letzten Bogenformen steigen auf, werden breiter und verblassen
    histT -= dt;
    const keepHist = histT <= 0;
    if (keepHist) histT = 0.03;
    hist = hist.filter(h => (h.age += dt) < 0.4);

    const paths = [];
    for (const a of arcs) {
      const P = buildPath(a);
      paths.push([a, P, Float32Array.from(PX), Float32Array.from(PY)]);
      light.push({ vL: P.vL, vR: P.vR, i: 0.7 * a.bright });
      for (let side = 0; side < 2; side++) {
        const v = side ? P.vR : P.vL, k = clamp(Math.round(v * (HN - 1)), 0, HN - 1);
        heat[side][k] = Math.min(1, heat[side][k] + dt * 2.5);
        if (k > 0) heat[side][k - 1] = Math.min(1, heat[side][k - 1] + dt * 1.2);
      }
      if (keepHist) hist.push({ xs: Float32Array.from(PX), ys: Float32Array.from(PY), b: a.bright, age: 0 });
    }
    // Umgebungslicht
    ctx.globalCompositeOperation = 'lighter';
    for (const [a, P] of paths) {
      const mx = (P.Lx + P.Rx) / 2, my = (P.Ly + P.Ry) / 2 - P.len * 0.15, R = Math.max(W, H) * (0.35 + 0.25 * a.s);
      const ag = ctx.createRadialGradient(mx, my, 0, mx, my, R);
      ag.addColorStop(0, rgba(C.out, (0.05 + 0.06 * g) * a.bright)); ag.addColorStop(1, rgba(C.out, 0));
      ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const h of hist) {
      const f = 1 - h.age / 0.4, dy = h.age * 0.14 * H;
      ctx.beginPath(); ctx.moveTo(h.xs[0], h.ys[0] - dy * 0.3);
      for (let i = 1; i <= N; i++) ctx.lineTo(h.xs[i], h.ys[i] - dy * Math.sin(Math.PI * i / N) - dy * 0.3);
      ctx.lineWidth = (8 + 10 * g) * dpr * (1 + h.age * 4); ctx.strokeStyle = rgba(C.mid, 0.085 * h.b * f * f); ctx.stroke();
    }
    drawWires(ctx, C, light);
    // die Bögen selbst
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [a, P, xs, ys] of paths) {
      PX.set(xs); PY.set(ys);
      const I = a.bright, th = 0.75 + 0.5 * Math.min(1, a.s * 1.5);
      strokePath(ctx);
      ctx.lineWidth = (16 + 26 * g) * dpr * th; ctx.strokeStyle = rgba(C.out, 0.04 * I); ctx.stroke();
      ctx.lineWidth = (6 + 9 * g) * dpr * th; ctx.strokeStyle = rgba(C.mid, 0.13 * I); ctx.stroke();
      ctx.lineWidth = (2.4 + 1.6 * g) * dpr * th; ctx.strokeStyle = rgba(C.mid, 0.55 * I); ctx.stroke();
      ctx.lineWidth = Math.max(1, 1.5 * dpr * th); ctx.strokeStyle = rgba(C.core, 0.95 * I); ctx.stroke();
      // Fußpunkte am Draht
      for (const [x, y] of [[P.Lx, P.Ly], [P.Rx, P.Ry]]) {
        const r = (7 + 9 * g) * dpr, eg = ctx.createRadialGradient(x, y, 0, x, y, r);
        eg.addColorStop(0, rgba(C.core, 0.8 * I)); eg.addColorStop(0.3, rgba(C.mid, 0.35 * I)); eg.addColorStop(1, rgba(C.out, 0));
        ctx.fillStyle = eg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // Funken
    const G = 900 * dpr;
    sparks = sparks.filter(s => {
      s.age += dt; if (s.age > s.life) return false;
      s.vy += G * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const f = 1 - s.age / s.life;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025);
      ctx.lineWidth = Math.max(1, 1.3 * dpr); ctx.strokeStyle = 'rgba(255,' + (190 + 60 * f | 0) + ',' + (120 + 120 * f | 0) + ',' + (0.9 * f).toFixed(3) + ')'; ctx.stroke();
      return true;
    });
    // Zünd- und Abrissblitz
    if (flash > 0.01) {
      const x = (wx(0, flashV) + wx(1, flashV)) / 2, y = wy(flashV), r = Math.max(W, H) * 0.5, fg = ctx.createRadialGradient(x, y, 0, x, y, r);
      fg.addColorStop(0, rgba(C.mid, 0.25 * flash * (0.5 + g))); fg.addColorStop(1, rgba(C.out, 0));
      ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  },
};
