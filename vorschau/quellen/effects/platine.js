// Neon-Platine: zufällig verlegte Leiterbahnen (gerade und 45°, teils als parallele Busse) mit Chips und
// Durchkontaktierungen. Strompulse jagen durch die Bahnen; beim Entsperren breitet sich ein Stromstoß
// von einem Chip über die ganze Platine aus.
const settings = { density: 5, pulses: 5, speed: 5, color: 0, traces: 4 };
const controls = [
  { type: 'range', id: 'density', label: 'Dichte', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'pulses', label: 'Strompulse', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'speed', label: 'Tempo', min: 1, max: 10, fmt: lvl },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Cyan', 'Grün', 'Magenta', 'Gold'] },
  { type: 'range', id: 'traces', label: 'Leiterbahnen sichtbar', min: 1, max: 10, fmt: lvl },
];
const COLS = [[0, 229, 255], [57, 255, 140], [255, 60, 220], [255, 190, 60]];
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

let W = 1, H = 1, dpr = 1, g = 10, gx = 1, gy = 1, ox = 0, oy = 0, occ = null;
let traces = [], vias = [], chips = [], pins = [], SL = null, pulses = [], surge = null, t = 0;

const cs = a => { const c = COLS[settings.color]; return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; };
function lcg(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const free = (x, y) => x >= 1 && y >= 1 && x < gx - 1 && y < gy - 1 && !occ[y * gx + x];
const mark = (x, y) => { if (x >= 0 && y >= 0 && x < gx && y < gy) occ[y * gx + x] = 1; };
const dx = x => ox + x * g + g / 2, dy = y => oy + y * g + g / 2;

function route(sx, sy, dir, rng, maxLen) {
  if (!free(sx, sy)) return null;
  let x = sx, y = sy, d = dir, seg = 0, len = 0; const pts = [[x, y]];
  mark(x, y);
  while (len < maxLen) {
    const diag = DIRS[d][0] !== 0 && DIRS[d][1] !== 0;
    if ((diag && seg >= 2 && rng() < 0.32) || (!diag && seg >= 3 && rng() < 0.13)) { pts.push([x, y]); d = (d + (rng() < 0.5 ? 1 : 7)) % 8; seg = 0; }
    const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
    if (!free(nx, ny)) break;
    if (DIRS[d][0] && DIRS[d][1] && occ[y * gx + nx] && occ[ny * gx + x]) break;
    x = nx; y = ny; mark(x, y); seg++; len++;
  }
  pts.push([x, y]);
  if (len < 3) return null;
  return pts;
}

function addTrace(pts, via0, via1) {
  const flat = [];
  for (const [x, y] of pts) { const X = dx(x), Y = dy(y); if (flat.length >= 2 && flat[flat.length - 2] === X && flat[flat.length - 1] === Y) continue; flat.push(X, Y); }
  const n = flat.length / 2, cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(flat[i * 2] - flat[i * 2 - 2], flat[i * 2 + 1] - flat[i * 2 - 1]);
  const tr = { p: new Float32Array(flat), cum, len: cum[n - 1], light: 0, hit: false, delay: 0, v0: -1, v1: -1 };
  if (via0) { tr.v0 = vias.length; vias.push({ x: flat[0], y: flat[1], flash: 0 }); }
  if (via1) { tr.v1 = vias.length; vias.push({ x: flat[(n - 1) * 2], y: flat[(n - 1) * 2 + 1], flash: 0 }); }
  traces.push(tr);
}

function build() {
  g = Math.max(6, Math.round(11 * dpr)); gx = Math.floor(W / g); gy = Math.floor(H / g);
  ox = (W - gx * g) / 2; oy = (H - gy * g) / 2; occ = new Uint8Array(gx * gy);
  traces = []; vias = []; chips = []; pins = []; pulses = []; surge = null;
  const d = settings.density / 10;
  // Chips
  const nChips = 1 + Math.round(d * 2.5);
  const labels = ['NW-26', 'NEON 2601', 'PX-7', 'GL1TCH', 'NW 404', 'KAI-01'].sort(() => Math.random() - 0.5);
  for (let k = 0, tries = 0; k < nChips && tries < 60; tries++) {
    const cw = rint(5, 9), ch = rint(4, 8), cx = rint(3, gx - cw - 4), cy = rint(5, gy - ch - 6);
    let ok = cx > 2 && cy > 2;
    for (let y = cy - 3; ok && y <= cy + ch + 2; y++) for (let x = cx - 3; x <= cx + cw + 2; x++) if (x < 0 || y < 0 || x >= gx || y >= gy || occ[y * gx + x]) { ok = false; break; }
    if (!ok) continue;
    for (let y = cy; y < cy + ch; y++) for (let x = cx; x < cx + cw; x++) mark(x, y);
    chips.push({ x: cx, y: cy, w: cw, h: ch, light: 0, label: labels[k % labels.length] });
    k++;
  }
  // Busse aus den Chip-Anschlüssen
  for (const c of chips) {
    const sides = [
      [Array.from({ length: c.w - 2 }, (_, i) => [c.x + 1 + i, c.y - 1]), 6],
      [Array.from({ length: c.w - 2 }, (_, i) => [c.x + 1 + i, c.y + c.h]), 2],
      [Array.from({ length: c.h - 2 }, (_, i) => [c.x - 1, c.y + 1 + i]), 4],
      [Array.from({ length: c.h - 2 }, (_, i) => [c.x + c.w, c.y + 1 + i]), 0],
    ];
    for (const [cells, dir] of sides) {
      const seed = rint(1, 1e9), maxLen = rint(8, 14 + Math.round(d * 40));
      for (const [x, y] of cells) {
        if (Math.random() > 0.8) continue;
        const pts = route(x, y, dir, lcg(seed), maxLen);
        if (pts) { addTrace(pts, false, true); pins.push({ x: dx(x), y: dy(y), dir }); }
      }
    }
  }
  // Busse vom Bildrand
  const groups = Math.round(4 + d * 14);
  for (let k = 0; k < groups; k++) {
    const side = rint(0, 3), n = rint(2, 5), seed = rint(1, 1e9), maxLen = rint(10, 20 + Math.round(d * 50));
    const along = side < 2 ? rint(2, gx - n - 3) : rint(2, gy - n - 3);
    for (let i = 0; i < n; i++) {
      let x, y, dir;
      if (side === 0) { x = along + i; y = 1; dir = 2; } else if (side === 1) { x = along + i; y = gy - 2; dir = 6; }
      else if (side === 2) { x = 1; y = along + i; dir = 0; } else { x = gx - 2; y = along + i; dir = 4; }
      const pts = route(x, y, dir, lcg(seed), maxLen);
      if (pts) addTrace(pts, false, true);
    }
  }
  // kurze Einzelbahnen in den Lücken
  const singles = Math.round(10 + d * 40);
  for (let k = 0; k < singles; k++) {
    const pts = route(rint(2, gx - 3), rint(2, gy - 3), rint(0, 7), Math.random, rint(4, 22));
    if (pts) addTrace(pts, true, true);
  }
  drawStatic();
}

function drawStatic() {
  SL = mk(W, H); const s = SL.getContext('2d'), vis = settings.traces / 10;
  s.lineCap = 'round'; s.lineJoin = 'round';
  s.strokeStyle = cs(0.06 + vis * 0.24); s.lineWidth = Math.max(1.5, 2.1 * dpr);
  for (const tr of traces) { const p = tr.p; s.beginPath(); s.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) s.lineTo(p[i], p[i + 1]); s.stroke(); }
  for (const v of vias) { s.beginPath(); s.arc(v.x, v.y, 3.2 * dpr, 0, Math.PI * 2); s.fillStyle = '#000'; s.fill(); s.lineWidth = 1.6 * dpr; s.strokeStyle = cs(0.1 + vis * 0.32); s.stroke(); }
  s.fillStyle = cs(0.15 + vis * 0.3);
  for (const p of pins) { const w = g * (p.dir === 0 || p.dir === 4 ? 0.55 : 0.32), h = g * (p.dir === 0 || p.dir === 4 ? 0.32 : 0.55); s.fillRect(p.x - w / 2, p.y - h / 2, w, h); }
  for (const c of chips) {
    const x = ox + c.x * g + g * 0.15, y = oy + c.y * g + g * 0.15, w = c.w * g - g * 0.3, h = c.h * g - g * 0.3;
    s.fillStyle = '#05080b'; s.fillRect(x, y, w, h);
    s.lineWidth = 1.5 * dpr; s.strokeStyle = cs(0.12 + vis * 0.26); s.strokeRect(x, y, w, h);
    s.beginPath(); s.arc(x + g * 0.6, y + g * 0.6, g * 0.18, 0, Math.PI * 2); s.fillStyle = cs(0.2 + vis * 0.2); s.fill();
    s.font = '600 ' + Math.max(8, Math.round(g * 0.8)) + 'px ui-monospace, "Roboto Mono", monospace'; s.textAlign = 'center'; s.textBaseline = 'middle';
    s.fillStyle = cs(0.18 + vis * 0.22); s.fillText(c.label, x + w / 2, y + h / 2);
  }
}

function pointAt(tr, s) {
  const cum = tr.cum, p = tr.p; s = Math.max(0, Math.min(tr.len, s));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const seg = cum[hi] - cum[lo] || 1, f = (s - cum[lo]) / seg;
  return [p[lo * 2] + (p[hi * 2] - p[lo * 2]) * f, p[lo * 2 + 1] + (p[hi * 2 + 1] - p[lo * 2 + 1]) * f];
}
function spawnPulse(tr, rev) {
  if (!tr) { if (!traces.length) return; tr = traces[rint(0, traces.length - 1)]; if (tr.len < g * 4 && Math.random() < 0.7) return; rev = Math.random() < 0.5; }
  pulses.push({ tr, rev: !!rev, s: 0 });
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Stromstoß',
  resize(w, h, d) { W = w; H = h; dpr = d; build(); },
  newPattern() { build(); },
  action() {
    const c = chips.length ? pick(chips) : null;
    const sx = c ? ox + (c.x + c.w / 2) * g : W / 2, sy = c ? oy + (c.y + c.h / 2) * g : H;
    const v = Math.max(W, H) / 1.1;
    for (const tr of traces) {
      const d0 = Math.hypot(tr.p[0] - sx, tr.p[1] - sy), n = tr.p.length, d1 = Math.hypot(tr.p[n - 2] - sx, tr.p[n - 1] - sy);
      tr.delay = Math.min(d0, d1) / v; tr.rev = d1 < d0; tr.hit = false;
    }
    for (const ch of chips) ch.delay = Math.hypot(ox + (ch.x + ch.w / 2) * g - sx, oy + (ch.y + ch.h / 2) * g - sy) / v;
    surge = { t: 0 };
  },
  wake() { this.action(); },
  change(id) { if (id === 'density') build(); else if (id === 'traces' || id === 'color') drawStatic(); },
  frame(ctx, dt) {
    t += dt;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (SL) ctx.drawImage(SL, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Stromstoß
    if (surge) {
      surge.t += dt; let pending = false;
      for (const tr of traces) if (!tr.hit) { if (surge.t >= tr.delay) { tr.hit = true; tr.light = 1; spawnPulse(tr, tr.rev); } else pending = true; }
      for (const ch of chips) if (ch.delay !== undefined && surge.t >= ch.delay && ch.delay >= 0) { ch.light = 1; ch.delay = -1; }
      if (!pending) surge = null;
    }
    if (Math.random() < per(0.4, dt) && traces.length) { const tr = traces[rint(0, traces.length - 1)]; tr.light = Math.max(tr.light, 0.6); spawnPulse(tr, Math.random() < 0.5); }
    // aufleuchtende Bahnen
    for (const tr of traces) {
      if (tr.light < 0.02) continue;
      const p = tr.p; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.lineWidth = 8 * dpr; ctx.strokeStyle = cs(0.08 * tr.light); ctx.stroke();
      ctx.lineWidth = 2.3 * dpr; ctx.strokeStyle = cs(0.6 * tr.light); ctx.stroke();
      tr.light *= Math.exp(-dt * 1.6);
    }
    for (const ch of chips) {
      if (!(ch.light > 0.02)) continue;
      const x = ox + ch.x * g + g * 0.15, y = oy + ch.y * g + g * 0.15, w = ch.w * g - g * 0.3, h = ch.h * g - g * 0.3;
      ctx.fillStyle = cs(0.12 * ch.light); ctx.fillRect(x, y, w, h);
      ctx.lineWidth = 6 * dpr; ctx.strokeStyle = cs(0.18 * ch.light); ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = 1.6 * dpr; ctx.strokeStyle = cs(0.8 * ch.light); ctx.strokeRect(x, y, w, h);
      ch.light *= Math.exp(-dt * 1.2);
    }
    // Strompulse
    if (Math.random() < per(settings.pulses * 1.4, dt)) spawnPulse();
    const v = (80 + settings.speed * 40) * dpr, tail = (24 + settings.speed * 6) * dpr;
    pulses = pulses.filter(pu => {
      pu.s += v * dt; const tr = pu.tr, at = u => pointAt(tr, pu.rev ? tr.len - u : u);
      const head = at(pu.s);
      ctx.lineWidth = 2.6 * dpr;
      let prev = at(pu.s - tail);
      for (let k = 1; k <= 8; k++) {
        const cur = at(pu.s - tail + tail * k / 8);
        ctx.strokeStyle = cs(0.85 * k / 8); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
        prev = cur;
      }
      ctx.fillStyle = cs(0.22); ctx.beginPath(); ctx.arc(head[0], head[1], 7 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(head[0], head[1], 1.8 * dpr, 0, Math.PI * 2); ctx.fill();
      if (pu.s - tail > tr.len) { const vi = pu.rev ? tr.v0 : tr.v1; if (vi >= 0) vias[vi].flash = 1; return false; }
      return true;
    });
    for (const vv of vias) {
      if (vv.flash < 0.02) continue;
      ctx.fillStyle = cs(0.5 * vv.flash); ctx.beginPath(); ctx.arc(vv.x, vv.y, 7 * dpr, 0, Math.PI * 2); ctx.fill();
      vv.flash *= Math.exp(-dt * 4);
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};
