// Nebelkammer: Blick von oben in eine Kammer voller kaltem Alkoholnebel, seitlich beleuchtet.
// Geladene Teilchen hinterlassen Spuren aus winzigen Tröpfchen: Alphateilchen kurz und dick, Elektronen dünn und verschlungen,
// Myonen aus der Höhenstrahlung lang und gerade, manchmal mit kleinen Seitenkringeln. Die Spuren verbreitern sich, sinken und verblassen.
// Mit Magnetfeld werden Elektronenspuren zu Spiralen. Beim Entsperren rauscht ein Teilchenschauer durch.
const settings = { rate: 5, source: 0, mist: 5, field: 0, color: 0 };
const controls = [
  { type: 'range', id: 'rate', label: 'Strahlung', min: 1, max: 10, fmt: lvl },
  { type: 'choice', id: 'source', label: 'Strahlenquelle', options: ['Ohne', 'Mitte', 'Unten'] },
  { type: 'range', id: 'mist', label: 'Nebel', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'field', label: 'Magnetfeld', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'color', label: 'Licht', options: ['Weiß', 'Eisblau', 'Neon'] },
];
const SCH = [
  { a: [238, 242, 250], b: [228, 234, 245], m: [222, 228, 240], light: [200, 212, 232] },
  { a: [205, 232, 255], b: [175, 218, 255], m: [160, 205, 255], light: [110, 170, 255] },
  { a: [255, 90, 205], b: [80, 220, 255], m: [130, 255, 160], light: [170, 110, 255] },
];
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return (s - 2) * 1.73; };

let W = 1, H = 1, dpr = 1, t = 0;
let tracks = [], drops = [], fog = null, grains = [], srcPos = null;

// Körnung: so sehen die Spuren aus winzigen Tröpfchen aus
function genGrains() {
  grains = ['a', 'b', 'm'].map(k => {
    const N = 96, c = mk(N, N), x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data, col = SCH[settings.color][k];
    for (let i = 0; i < N * N; i++) {
      const r = Math.random(), v = r < 0.45 ? 0 : Math.pow((r - 0.45) / 0.55, 0.6);
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = v * 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  });
}
let patCtx = null, pats = [];
function makePatterns(ctx) {
  pats = grains.map(g => {
    const p = ctx.createPattern(g, 'repeat');
    // Tröpfchen etwas größer als ein Bildpunkt
    try { if (typeof DOMMatrix !== 'undefined' && p && p.setTransform) p.setTransform(new DOMMatrix().scale(Math.max(1, dpr * 0.55))); } catch (e) {}
    return p;
  });
  patCtx = ctx;
}

// Nebelschwaden, einmal vorberechnet (viertel Auflösung, etwas größer als der Bildschirm)
function vnoise(x, y, s) {
  const h = (a, b) => { const q = Math.sin(a * 127.1 + b * 311.7 + s * 17.3) * 43758.5453; return q - Math.floor(q); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function genFog() {
  const fw = Math.max(1, Math.round(W * 1.3 / 4)), fh = Math.max(1, Math.round(H * 1.3 / 4)), c = mk(fw, fh), x = c.getContext('2d');
  const img = x.createImageData(fw, fh), d = img.data, sc = 4 / (90 * dpr), seed = rnd(0, 100), col = SCH[settings.color].light;
  for (let yy = 0; yy < fh; yy++) for (let xx = 0; xx < fw; xx++) {
    const n = 0.55 * vnoise(xx * sc, yy * sc, seed) + 0.3 * vnoise(xx * sc * 2.3, yy * sc * 2.3, seed + 1) + 0.15 * vnoise(xx * sc * 6, yy * sc * 6, seed + 2);
    const v = Math.pow(n, 2.2), p = (yy * fw + xx) * 4;
    d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = v * 255;
  }
  x.putImageData(img, 0, 0);
  fog = c;
}

// ---------- Teilchenspuren ----------
function track(type, xs, ys, o) {
  tracks.push(Object.assign({
    type, xs, ys, n: xs.length, age: 0, form: rnd(0.05, 0.14), ox: 0, oy: 0,
    vx: rnd(-3, 3) * dpr, vy: rnd(4, 14) * dpr, w0: dpr, b: 1, life: 2,
  }, o));
}
function alpha(x, y, ang) {
  const len = rnd(28, 110) * dpr, kinkAt = rnd(0.75, 0.92), kink = rnd(-0.7, 0.7), xs = [x], ys = [y];
  let a = ang, px = x, py = y;
  for (let k = 1; k <= 6; k++) {
    if (k / 6 > kinkAt && kink) { a += kink; }
    px += Math.cos(a) * len / 6; py += Math.sin(a) * len / 6; xs.push(px); ys.push(py);
    a += gauss() * 0.02;
  }
  track('a', xs, ys, { w0: rnd(2.4, 4.4) * dpr, b: rnd(0.75, 1), life: rnd(1.8, 3.2) });
}
function beta(x, y, ang, short) {
  const len = (short ? rnd(10, 45) : rnd(90, 380)) * dpr, step = 3 * dpr, n = Math.max(3, Math.round(len / step));
  const B = settings.field / 10, q = Math.random() < 0.85 ? -1 : 1, p0 = rnd(0.5, 1.5), xs = [x], ys = [y];
  let a = ang, px = x, py = y;
  for (let k = 1; k <= n; k++) {
    const s = k / n, p = p0 * Math.pow(Math.max(0.05, 1 - s), 0.6);
    a += gauss() * (0.06 + 0.3 * s * s) + q * B * 0.004 * step / dpr / p * 3;
    px += Math.cos(a) * step; py += Math.sin(a) * step; xs.push(px); ys.push(py);
  }
  track('b', xs, ys, { w0: rnd(0.8, 1.3) * dpr * (short ? 0.85 : 1), b: rnd(0.45, 0.75), life: rnd(1.1, 2.3) });
}
function muon(ang, x, y) {
  const L = Math.hypot(W, H) * rnd(0.6, 1.2);
  if (x == null) { x = rnd(0, W); y = rnd(0, H); ang = rnd(0, Math.PI * 2); }
  const B = settings.field / 10, curve = (Math.random() < 0.5 ? -1 : 1) * B * 0.00025;
  const xs = [], ys = [];
  let a = ang, px = x - Math.cos(ang) * L / 2, py = y - Math.sin(ang) * L / 2;
  for (let k = 0; k <= 12; k++) { xs.push(px); ys.push(py); px += Math.cos(a) * L / 12; py += Math.sin(a) * L / 12; a += curve * L / 12 / dpr; }
  track('m', xs, ys, { w0: rnd(0.7, 1) * dpr, b: rnd(0.32, 0.5), life: rnd(0.9, 1.8) });
  // kleine Seitenkringel (Delta-Elektronen)
  for (let k = rint(0, 2); k > 0; k--) {
    const s = rint(1, 11);
    beta(xs[s], ys[s], ang + (Math.random() < 0.5 ? 1 : -1) * rnd(0.5, 1.4), true);
  }
}
function shower() {
  const ang = rnd(0, Math.PI * 2), nx = -Math.sin(ang), ny = Math.cos(ang), n = rint(4, 9), spread = Math.max(W, H) * 0.7;
  for (let i = 0; i < n; i++) {
    const off = rnd(-0.5, 0.5) * spread;
    muon(ang + rnd(-0.04, 0.04), W / 2 + nx * off + rnd(-30, 30) * dpr, H / 2 + ny * off + rnd(-30, 30) * dpr);
  }
  for (let i = rint(3, 7); i > 0; i--) beta(rnd(0.1, 0.9) * W, rnd(0.1, 0.9) * H, rnd(0, 6.28));
}
const SRC = [null, [0.5, 0.55], [0.5, 0.84]];

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Teilchenschauer',
  resize(w, h, d) {
    W = w; H = h; dpr = d; tracks = [];
    drops = [];
    for (let i = 0; i < 260; i++) drops.push({ x: rnd(0, W), y: rnd(0, H), v: rnd(6, 22), s: rnd(0.7, 1.6), a: rnd(0.25, 1), ph: rnd(0, 6.28) });
    genGrains(); patCtx = null; genFog();
  },
  newPattern() { tracks = []; genFog(); },
  action() { shower(); },
  wake() { shower(); },
  change(id) { if (id === 'color') { genGrains(); patCtx = null; genFog(); } },
  frame(ctx, dt) {
    t += dt;
    if (patCtx !== ctx) makePatterns(ctx);
    const S = SCH[settings.color], r = settings.rate, mist = settings.mist / 10;
    srcPos = SRC[settings.source] ? [SRC[settings.source][0] * W, SRC[settings.source][1] * H] : null;
    // neue Spuren
    if (Math.random() < per(0.25 + r * 0.1, dt)) muon();
    if (Math.random() < per(0.4 + r * 0.3, dt)) beta(rnd(-0.05, 1.05) * W, rnd(-0.05, 1.05) * H, rnd(0, 6.28));
    if (Math.random() < per(0.1 + r * 0.09, dt)) alpha(rnd(0, W), rnd(0, H), rnd(0, 6.28));
    if (srcPos && Math.random() < per(0.8 + r * 0.6, dt)) {
      const a = rnd(0, 6.28), rr = 11 * dpr;
      alpha(srcPos[0] + Math.cos(a) * rr, srcPos[1] + Math.sin(a) * rr, a + gauss() * 0.15);
    }

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // seitliches Licht und Nebel
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createLinearGradient(0, 0, W * 0.8, 0);
    lg.addColorStop(0, rgba(S.light, 0.05 + 0.07 * mist)); lg.addColorStop(1, rgba(S.light, 0));
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    if (fog && mist > 0) {
      ctx.imageSmoothingEnabled = true;
      const fx = -W * 0.15 + Math.sin(t * 0.031) * W * 0.12, fy = -H * 0.15 + Math.sin(t * 0.023 + 1) * H * 0.12;
      ctx.globalAlpha = 0.16 * mist; ctx.drawImage(fog, fx, fy, W * 1.3, H * 1.3);
      ctx.globalAlpha = 0.09 * mist; ctx.drawImage(fog, -fx - W * 0.3, -fy - H * 0.3 + Math.sin(t * 0.05) * H * 0.04, W * 1.3, H * 1.3);
    }
    // Tröpfchenregen
    const nd = Math.round(drops.length * mist);
    ctx.fillStyle = rgba(S.light, 1);
    for (let i = 0; i < nd; i++) {
      const d = drops[i];
      d.y += d.v * dpr * dt; d.x += Math.sin(t * 0.7 + d.ph) * 4 * dpr * dt;
      if (d.y > H) { d.y = -2; d.x = rnd(0, W); }
      const lx = 1 - d.x / W, a = d.a * (0.15 + 0.6 * lx * lx) * 0.6;
      if (a < 0.02) continue;
      ctx.globalAlpha = a; const s = Math.max(1, d.s * dpr * 0.8); ctx.fillRect(d.x, d.y, s, s);
    }
    // Strahlenquelle
    if (srcPos) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const R = 10 * dpr, g = ctx.createRadialGradient(srcPos[0] - R * 0.3, srcPos[1] - R * 0.3, 0, srcPos[0], srcPos[1], R);
      g.addColorStop(0, '#3a3c44'); g.addColorStop(0.7, '#16171b'); g.addColorStop(1, '#0a0a0c');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(srcPos[0], srcPos[1], R, 0, 6.2832); ctx.fill();
      ctx.lineWidth = Math.max(1, dpr * 0.8); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
    }
    // Spuren
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    tracks = tracks.filter(tr => {
      tr.age += dt; if (tr.age > tr.life) return false;
      tr.ox += (tr.vx + Math.sin(t * 0.4 + tr.xs[0] * 0.002) * 3 * dpr) * dt; tr.oy += tr.vy * dt;
      const f = tr.age < tr.form ? tr.age / tr.form : Math.pow(1 - (tr.age - tr.form) / (tr.life - tr.form), 1.3);
      const grow = 1 + 2.6 * tr.age / tr.life, side = 0.6 + 0.4 * (1 - clamp((tr.xs[0] + tr.xs[tr.n - 1]) / 2 / W, 0, 1));
      const k = tr.type === 'a' ? 0 : tr.type === 'b' ? 1 : 2, col = k === 0 ? S.a : k === 1 ? S.b : S.m, A = tr.b * f * side;
      ctx.save(); ctx.translate(tr.ox, tr.oy);
      ctx.beginPath(); ctx.moveTo(tr.xs[0], tr.ys[0]);
      for (let i = 1; i < tr.n; i++) ctx.lineTo(tr.xs[i], tr.ys[i]);
      ctx.globalAlpha = 1;
      ctx.lineWidth = tr.w0 * grow * 4.5; ctx.strokeStyle = rgba(col, 0.05 * A); ctx.stroke();
      ctx.lineWidth = tr.w0 * grow * 1.9; ctx.strokeStyle = rgba(col, 0.2 * A); ctx.stroke();
      ctx.globalAlpha = Math.min(1, A * (1.1 - 0.5 * tr.age / tr.life));
      ctx.lineWidth = tr.w0 * (0.8 + grow * 0.5); ctx.strokeStyle = pats[k]; ctx.stroke();
      ctx.restore();
      return true;
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
};
