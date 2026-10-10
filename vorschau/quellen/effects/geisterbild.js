// Eingebranntes Geisterbild: schwache Reste alter Bedienoberflächen (Statusleiste, Navigationstasten,
// Tastatur, Uhr, App-Raster), die ungleichmäßig eingebrannt sind und langsam ihre Farbe wandern lassen.
// Beim Entsperren leuchten sie kurz stärker nach (wie Bildnachleuchten bei echten Displays).
const settings = { strength: 5, tint: 0, drift: 4, amount: 1, afterglow: 6 };
const controls = [
  { type: 'range', id: 'strength', label: 'Stärke', min: 1, max: 10, fmt: lvl },
  { type: 'choice', id: 'tint', label: 'Farbe', options: ['Bunt', 'Bernstein', 'Rosa', 'Grün'] },
  { type: 'range', id: 'drift', label: 'Farbwandern', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'amount', label: 'Eingebrannte Reste', options: ['Wenig', 'Mittel', 'Viel'] },
  { type: 'range', id: 'afterglow', label: 'Nachleuchten beim Entsperren', min: 0, max: 10, fmt: lvl },
];

const GS = 0.5; // Geisterbilder in halber Auflösung: weich wie echtes Einbrennen und sparsam im Speicher
let W = 1, H = 1, dpr = 1, G1 = null, G2 = null, grain = null, grainPat = null;
let layout = null, t = 0, glow = 0, hue = 0;
const two = n => (n < 10 ? '0' : '') + n;

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}

function makeLayout() {
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const months = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  layout = {
    time: two(rint(6, 23)) + ':' + two(rint(0, 59)),
    clock: two(rint(0, 23)) + ':' + two(rint(0, 59)),
    date: pick(days) + ', ' + rint(1, 28) + '. ' + pick(months),
    battery: rnd(0.25, 0.95), nav: Math.random() < 0.6 ? 'buttons' : 'pill', notif: rint(1, 3),
    icons: Array.from({ length: 20 }, () => ({ skip: Math.random() < 0.15, label: rnd(0.45, 0.9) })),
    dock: rint(4, 5),
  };
}

function statusBar(g) {
  const d = dpr, y = 16 * d, fs = 13.5 * d;
  g.font = '600 ' + fs + 'px system-ui, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(layout.time, 20 * d, y);
  let nx = 20 * d + g.measureText(layout.time).width + 12 * d;
  for (let i = 0; i < layout.notif; i++) {
    if (i % 2 === 0) { rr(g, nx, y - 5 * d, 10 * d, 10 * d, 2.5 * d); g.fill(); }
    else { g.beginPath(); g.arc(nx + 5 * d, y, 5 * d, 0, Math.PI * 2); g.fill(); }
    nx += 16 * d;
  }
  let rx = W - 18 * d;
  const bw = 24 * d, bh = 12 * d;
  g.lineWidth = 1.6 * d; rr(g, rx - bw, y - bh / 2, bw, bh, 3 * d); g.stroke();
  g.fillRect(rx + 1 * d, y - 3 * d, 2.2 * d, 6 * d);
  g.fillRect(rx - bw + 2.5 * d, y - bh / 2 + 2.5 * d, (bw - 5 * d) * layout.battery, bh - 5 * d);
  rx -= bw + 14 * d;
  for (let i = 0; i < 4; i++) { const h = (4 + i * 3) * d; g.fillRect(rx - 22 * d + i * 5.5 * d, y + 7 * d - h, 3.5 * d, h); }
  rx -= 34 * d;
  g.lineWidth = 2 * d;
  for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(rx, y + 6 * d, i * 4.2 * d, -Math.PI * 0.78, -Math.PI * 0.22); g.stroke(); }
}

function navBar(g) {
  const d = dpr;
  if (layout.nav === 'buttons') {
    const y = H - 26 * d; g.lineWidth = 2 * d;
    let x = W * 0.25; g.beginPath(); g.moveTo(x + 6 * d, y - 7.5 * d); g.lineTo(x - 6.5 * d, y); g.lineTo(x + 6 * d, y + 7.5 * d); g.closePath(); g.stroke();
    x = W * 0.5; g.beginPath(); g.arc(x, y, 8 * d, 0, Math.PI * 2); g.stroke();
    x = W * 0.75; rr(g, x - 7 * d, y - 7 * d, 14 * d, 14 * d, 2.5 * d); g.stroke();
  } else {
    rr(g, W / 2 - 58 * d, H - 13 * d, 116 * d, 5 * d, 2.5 * d); g.fill();
  }
}

function clockFace(g) {
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = '200 ' + (W * 0.22) + 'px system-ui, sans-serif'; g.fillText(layout.clock, W / 2, H * 0.24);
  g.font = '500 ' + (W * 0.042) + 'px system-ui, sans-serif'; g.fillText(layout.date, W / 2, H * 0.24 + W * 0.085);
}

function keyboard(g) {
  const d = dpr, top = H * 0.62, bot = H * 0.915, gap = 6 * d, mx = 5 * d;
  const rows = [
    ['QWERTZUIOP'.split(''), Array(10).fill(1)],
    ['ASDFGHJKL'.split(''), Array(9).fill(1)],
    [['⇧'].concat('YXCVBNM'.split(''), ['⌫']), [1.5, 1, 1, 1, 1, 1, 1, 1, 1.5]],
    [['?123', ',', '', '.', '↵'], [1.5, 1, 5, 1, 1.5]],
  ];
  const rowH = (bot - top - gap * 3) / 4, unit = (W - 2 * mx - gap * 9) / 10;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  rows.forEach(([labels, widths], r) => {
    const total = widths.reduce((a, b) => a + b, 0) * unit + gap * (widths.length - 1);
    let x = (W - total) / 2; const y = top + r * (rowH + gap);
    widths.forEach((wu, i) => {
      const w = wu * unit;
      g.globalAlpha = 0.33; rr(g, x, y, w, rowH, 6 * d); g.fill();
      g.globalAlpha = 0.6; g.lineWidth = 1.3 * d; g.stroke();
      if (labels[i]) { g.globalAlpha = 0.95; g.font = '600 ' + (rowH * (labels[i].length > 1 ? 0.28 : 0.4)) + 'px system-ui, sans-serif'; g.fillText(labels[i], x + w / 2, y + rowH / 2); }
      x += w + gap;
    });
  });
  g.globalAlpha = 1;
}

function appGrid(g) {
  const d = dpr, top = H * 0.13, bot = H * 0.62, mx = W * 0.06, cw = (W - 2 * mx) / 4, ch = (bot - top) / 5;
  const size = Math.min(cw * 0.6, ch * 0.55);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    const ic = layout.icons[r * 4 + c]; if (ic.skip) continue;
    const x = mx + c * cw + (cw - size) / 2, y = top + r * ch;
    g.globalAlpha = 0.55; rr(g, x, y, size, size, size * 0.27); g.fill();
    g.globalAlpha = 0.5; g.fillRect(x + size * (1 - ic.label) / 2, y + size + 8 * d, size * ic.label, 3.2 * d);
  }
  const n = layout.dock, dy = H * 0.78, step = (W - 2 * mx) / n;
  for (let i = 0; i < n; i++) { g.globalAlpha = 0.6; rr(g, mx + i * step + (step - size) / 2, dy, size, size, size * 0.27); g.fill(); }
  g.globalAlpha = 0.45; g.lineWidth = 1.6 * d; rr(g, mx, H * 0.705, W - 2 * mx, 44 * d, 22 * d); g.stroke();
  g.beginPath(); g.arc(mx + 26 * d, H * 0.705 + 22 * d, 7 * d, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
}

// ungleichmäßiges Einbrennen: Maske aus weichem Rauschen
function burnMask() {
  const mw = Math.max(4, Math.round(W / 40)), mh = Math.max(4, Math.round(H / 40)), m = mk(mw, mh), mc = m.getContext('2d');
  const id = mc.createImageData(mw, mh);
  for (let i = 0; i < mw * mh; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = 140 + Math.random() * 115; }
  mc.putImageData(id, 0, 0);
  return m;
}

function layer(drawFns) {
  const c = mk(W * GS, H * GS), g = c.getContext('2d');
  g.setTransform(GS, 0, 0, GS, 0, 0);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  g.filter = 'blur(' + (1.3 * dpr) + 'px)';
  for (const f of drawFns) f(g);
  g.filter = 'none';
  g.globalCompositeOperation = 'destination-in'; g.imageSmoothingEnabled = true;
  g.drawImage(burnMask(), 0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  return c;
}

function build() {
  if (!layout) makeLayout();
  G1 = layer([statusBar, navBar]);
  const extra = [];
  if (settings.amount >= 1) extra.push(keyboard, clockFace);
  if (settings.amount >= 2) extra.push(appGrid);
  G2 = extra.length ? layer(extra) : null;
}

function makeGrain() {
  const s = 128; grain = mk(s, s); const g = grain.getContext('2d'); const id = g.createImageData(s, s);
  for (let i = 0; i < s * s; i++) { const v = Math.random() < 0.5 ? 255 : 0; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = Math.random() * 255; }
  g.putImageData(id, 0, 0); grainPat = null;
}

function tint(ctx) {
  const m = settings.tint; let h0, sat = 62, li = 66, spread;
  if (m === 0) { h0 = hue; spread = 120; }
  else if (m === 1) { h0 = 36 + Math.sin(hue * 0.03) * 8; spread = 18; sat = 80; }
  else if (m === 2) { h0 = 322 + Math.sin(hue * 0.03) * 10; spread = 22; }
  else { h0 = 110 + Math.sin(hue * 0.03) * 10; spread = 25; sat = 55; }
  const gr = ctx.createLinearGradient(0, 0, W * 0.6, H);
  gr.addColorStop(0, 'hsl(' + h0.toFixed(1) + ',' + sat + '%,' + li + '%)');
  gr.addColorStop(0.5, 'hsl(' + (h0 + spread * 0.5).toFixed(1) + ',' + sat + '%,' + li + '%)');
  gr.addColorStop(1, 'hsl(' + (h0 + spread).toFixed(1) + ',' + sat + '%,' + li + '%)');
  return gr;
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Entsperren',
  resize(w, h, d) { W = w; H = h; dpr = d; makeGrain(); if (layout) build(); },
  newPattern() { makeLayout(); hue = rnd(0, 360); build(); },
  action() { glow = 1; },
  wake() { glow = 1; },
  change(id) { if (id === 'amount') build(); },
  frame(ctx, dt) {
    t += dt; glow *= Math.exp(-dt * 0.8); hue = (hue + dt * settings.drift * 4) % 360;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const s = settings.strength / 10, ag = glow * settings.afterglow / 10;
    const a1 = clamp((0.12 + s * 0.5) * (0.9 + 0.1 * Math.sin(t * 0.37)) + ag * 0.5, 0, 1);
    const a2 = clamp((0.08 + s * 0.36) * (0.9 + 0.1 * Math.sin(t * 0.29 + 1.3)) + ag * 0.45, 0, 1);
    ctx.imageSmoothingEnabled = true;
    if (G2) { ctx.globalAlpha = a2; ctx.drawImage(G2, 0, 0, W, H); }
    if (G1) { ctx.globalAlpha = a1; ctx.drawImage(G1, 0, 0, W, H); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = tint(ctx); ctx.fillRect(0, 0, W, H);
    // feines Rauschen wie bei einem eingeschalteten Panel
    if (!grainPat) grainPat = ctx.createPattern(grain, 'repeat');
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.025 + ag * 0.04;
    const ox = Math.random() * 128 | 0, oy = Math.random() * 128 | 0;
    ctx.setTransform(1, 0, 0, 1, ox, oy); ctx.fillStyle = grainPat; ctx.fillRect(-ox, -oy, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  },
};
