// LCD-Tintenfleck: schwarze Flecken mit schillernden Rändern, die sich langsam ausbreiten.
// Das Feld wird in niedriger Auflösung berechnet (Metaballs + Verzerrung + Adern) und weich hochskaliert.
const settings = { size: 6, count: 3, growth: 4, shimmer: 6, cracks: 5 };
const controls = [
  { type: 'range', id: 'size', label: 'Größe der Flecken', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'count', label: 'Anzahl Flecken', min: 1, max: 5, fmt: v => String(v) },
  { type: 'range', id: 'growth', label: 'Ausbreiten', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'shimmer', label: 'Farbschimmer', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'cracks', label: 'Risslinien', min: 0, max: 10, fmt: lvl },
];

let W = 1, H = 1, dpr = 1, cell = 4, gw = 1, gh = 1;
let buf = null, bctx = null, img = null, px = null;
let nA = null, nB = null, veins = null, bgc = null;
let blobs = [], cracks = [], t = 0, pulse = 0, hueKick = 0, hueKickT = 0, fn = 0;
let prevBox = [0, 0, 0, 0];
const BLACK = (255 << 24) >>> 0;

// Farbkreis-Tabelle (volle Sättigung)
const LR = new Float32Array(360), LG = new Float32Array(360), LB = new Float32Array(360);
for (let h = 0; h < 360; h++) {
  const f = n => { const k = (n + h / 60) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); };
  LR[h] = f(5); LG[h] = f(3); LB[h] = f(1);
}
const byte = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const pack = (r, g, b) => ((255 << 24) | (byte(b) << 16) | (byte(g) << 8) | byte(r)) >>> 0;

// Wertrauschen mit mehreren Oktaven, Werte grob in -1..1
function vnoise(w, h, sc, oct) {
  const out = new Float32Array(w * h); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const s = Math.max(1.5, sc / Math.pow(2, o)), lw = Math.ceil(w / s) + 2, lh = Math.ceil(h / s) + 2;
    const lat = new Float32Array(lw * lh);
    for (let i = 0; i < lat.length; i++) lat[i] = Math.random() * 2 - 1;
    for (let y = 0; y < h; y++) {
      const fy = y / s, iy = fy | 0, ty = fy - iy, sy = ty * ty * (3 - 2 * ty), r0 = iy * lw, r1 = r0 + lw;
      for (let x = 0; x < w; x++) {
        const fx = x / s, ix = fx | 0, tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
        const a = lat[r0 + ix], b = lat[r0 + ix + 1], c = lat[r1 + ix], d = lat[r1 + ix + 1];
        const top = a + (b - a) * sx, bot = c + (d - c) * sx;
        out[y * w + x] += amp * (top + (bot - top) * sy);
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function makeFields() {
  nA = vnoise(gw, gh, 22, 3); nB = vnoise(gw, gh, 22, 3);
  const vn = vnoise(gw, gh, 14, 2); veins = new Float32Array(gw * gh);
  for (let i = 0; i < vn.length; i++) { const v = 1 - Math.min(1, Math.abs(vn[i]) * 2.2); veins[i] = v * v * v; }
  // Hintergrund: eingeschaltetes, aber dunkles Display mit leichter Wolkigkeit und Lichthof am unteren Rand
  const cl = vnoise(gw, gh, 70, 2); bgc = new Uint32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    const e = Math.max(0, (y / gh - 0.9) / 0.1);
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x, v = 6 + cl[i] * 5 + e * 7;
      bgc[i] = pack(v * 0.85, v * 0.9, v * 1.35 + 2);
    }
  }
}

function makeCracks() {
  cracks = []; const base = Math.min(W, H);
  for (const b of blobs) {
    if (b.par) continue;
    const cx = b.nx * W, cy = b.ny * H, m = rint(3, 6);
    for (let i = 0; i < m; i++) {
      let a = rnd(0, 6.283), x = cx, y = cy; const pts = [x, y]; const L = base * rnd(0.12, 0.42) * b.rs; let len = 0;
      while (len < L) {
        const st = rnd(5, 16) * dpr; a += rnd(-0.35, 0.35);
        x += Math.cos(a) * st; y += Math.sin(a) * st; pts.push(x, y); len += st;
        if (Math.random() < 0.06) { // Abzweig
          let ba = a + rnd(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1), bx = x, by = y; const bp = [bx, by];
          const bl = L * rnd(0.1, 0.3); let l2 = 0;
          while (l2 < bl) { const s2 = rnd(4, 12) * dpr; ba += rnd(-0.4, 0.4); bx += Math.cos(ba) * s2; by += Math.sin(ba) * s2; bp.push(bx, by); l2 += s2; }
          cracks.push({ p: bp, w: 0.6, ph: rnd(0, 6.283) });
        }
      }
      cracks.push({ p: pts, w: 1, ph: rnd(0, 6.283) });
    }
    for (let i = 0; i < 10; i++) { // feine Splitter am Einschlagpunkt
      const a = rnd(0, 6.283), l = rnd(4, 14) * dpr;
      cracks.push({ p: [cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l], w: 0.5, ph: rnd(0, 6.283) });
    }
  }
}

function radii() {
  const base = Math.min(W, H) * (0.07 + settings.size * 0.028);
  const g = settings.growth;
  const grow = g === 0 ? 1 : 1 - Math.exp(-t * (0.01 + g * 0.012));
  const gf = 0.55 + 0.45 * grow, pk = 1 + 0.1 * pulse;
  for (const b of blobs) if (!b.par) { b.r = base * b.rs * gf * (1 + 0.025 * Math.sin(t * b.sp + b.ph)) * pk; b.x = b.nx * W; b.y = b.ny * H; }
  for (const b of blobs) if (b.par) {
    const p = b.par; b.r = base * b.rs * gf * (1 + 0.05 * Math.sin(t * b.sp + b.ph)) * pk;
    b.x = p.x + b.ox * p.r * 1.05; b.y = p.y + b.oy * p.r * 1.05;
  }
}

let BX = new Float32Array(0), BY = new Float32Array(0), BR = new Float32Array(0);
function compute() {
  const n = blobs.length; if (!n) return;
  if (BX.length !== n) { BX = new Float32Array(n); BY = new Float32Array(n); BR = new Float32Array(n); }
  let avg = 0;
  for (let k = 0; k < n; k++) { const b = blobs[k]; BX[k] = b.x; BY[k] = b.y; BR[k] = b.r * b.r; avg += b.r; }
  avg /= n;
  const amp = avg * 0.22, ca = Math.cos(t * 0.11), sa = Math.sin(t * 0.11);
  const sh = settings.shimmer / 10;
  const hueBase = Math.sin(t * (0.15 + sh * 0.5)) * 30 * sh + hueKick;
  // nur den Bereich um die Flecken neu berechnen
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const b of blobs) { const R = b.r * 2.3 + amp; x0 = Math.min(x0, b.x - R); y0 = Math.min(y0, b.y - R); x1 = Math.max(x1, b.x + R); y1 = Math.max(y1, b.y + R); }
  const bx0 = clamp(Math.floor(x0 / cell), 0, gw), by0 = clamp(Math.floor(y0 / cell), 0, gh);
  const bx1 = clamp(Math.ceil(x1 / cell), 0, gw), by1 = clamp(Math.ceil(y1 / cell), 0, gh);
  const ux0 = Math.min(bx0, prevBox[0]), uy0 = Math.min(by0, prevBox[1]), ux1 = Math.max(bx1, prevBox[2]), uy1 = Math.max(by1, prevBox[3]);
  prevBox = [bx0, by0, bx1, by1];
  for (let y = uy0; y < uy1; y++) {
    const inY = y >= by0 && y < by1, cy = (y + 0.5) * cell;
    for (let x = ux0; x < ux1; x++) {
      const i = y * gw + x;
      if (!inY || x < bx0 || x >= bx1) { px[i] = bgc[i]; continue; }
      const na = nA[i], nb = nB[i], ox = na * ca + nb * sa, oy = nb * ca - na * sa;
      const X = (x + 0.5) * cell + ox * amp, Y = cy + oy * amp;
      let f = 0;
      for (let k = 0; k < n; k++) { const dx = X - BX[k], dy = Y - BY[k]; f += BR[k] / (dx * dx + dy * dy + 1); }
      f *= 0.78 + 0.55 * veins[i];
      if (f >= 1) {
        const e = f - 1;
        if (e < 0.25) { const k2 = 1 - e / 0.25; px[i] = pack(16 * k2, 2 * k2, 30 * k2); } else px[i] = BLACK;
      } else if (f > 0.42) {
        // Farbsaum: innen Violett über Blau, Cyan, Grün, Gelb bis Rot nach außen, wie ein Ölfilm
        const tt = (f - 0.42) / 0.58;
        let h = (290 - (1 - tt) * 300 + hueBase + ox * 25) % 360; if (h < 0) h += 360; const hi = h | 0;
        const br = Math.pow(Math.sin(Math.PI * Math.pow(tt, 0.8)), 0.9) * 0.95;
        const q = (tt - 0.86) / 0.035, hl = Math.exp(-q * q) * 0.55; // heller Rand kurz vor dem Schwarz
        const bg = bgc[i], r0 = bg & 255, g0 = (bg >>> 8) & 255, b0 = (bg >>> 16) & 255;
        let r = r0 + (LR[hi] * 255 - r0) * br, gg = g0 + (LG[hi] * 255 - g0) * br, bb = b0 + (LB[hi] * 255 - b0) * br;
        r += (255 - r) * hl; gg += (255 - gg) * hl; bb += (255 - bb) * hl;
        px[i] = pack(r, gg, bb);
      } else px[i] = bgc[i];
    }
  }
  bctx.putImageData(img, 0, 0);
}

const SAUM = [['rgba(255,70,110,', 0.8, 0.55], ['rgba(70,220,255,', -0.8, 0.55], ['rgba(255,255,255,', 0, 1]];

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Entsperren',
  resize(w, h, d) {
    W = w; H = h; dpr = d;
    cell = Math.max(2, Math.round(d * 1.4)); gw = Math.ceil(W / cell); gh = Math.ceil(H / cell);
    buf = mk(gw, gh); bctx = buf.getContext('2d'); img = bctx.createImageData(gw, gh);
    px = new Uint32Array(img.data.buffer);
    makeFields(); px.set(bgc); prevBox = [0, 0, gw, gh];
    if (blobs.length) makeCracks();
  },
  newPattern() {
    blobs = [];
    for (let k = 0; k < settings.count; k++) {
      const main = { nx: rnd(0.15, 0.85), ny: rnd(0.12, 0.88), rs: k === 0 ? 1 : rnd(0.45, 0.8), ph: rnd(0, 6.283), sp: rnd(0.4, 0.9) };
      blobs.push(main);
      const m = rint(1, 3);
      for (let j = 0; j < m; j++) {
        const a = rnd(0, 6.283), d = rnd(0.5, 0.9);
        blobs.push({ par: main, ox: Math.cos(a) * d, oy: Math.sin(a) * d, rs: main.rs * rnd(0.18, 0.38), ph: rnd(0, 6.283), sp: rnd(0.5, 1.2) });
      }
    }
    t = 0; prevBox = [0, 0, gw, gh]; makeCracks();
  },
  action() { pulse = 1; hueKickT = 110; },
  wake() { pulse = 1; hueKickT = 110; },
  change(id) { if (id === 'count') this.newPattern(); },
  frame(ctx, dt) {
    t += dt; fn++;
    pulse *= Math.exp(-dt * 1.6);
    hueKick += (hueKickT - hueKick) * Math.min(1, dt * 2.5); hueKickT *= Math.exp(-dt * 0.8);
    radii();
    if (fn % 2 === 1) compute();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, gw * cell, gh * cell);
    const cr = settings.cracks / 10;
    if (cr > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const c of cracks) {
        const a = cr * (0.32 + 0.1 * Math.sin(t * 2.3 + c.ph)) * c.w * (1 + pulse * 0.8), p = c.p;
        ctx.lineWidth = Math.max(1, dpr * 0.7 * c.w);
        for (const [col, off, k] of SAUM) {
          ctx.strokeStyle = col + (a * k).toFixed(3) + ')';
          const o = off * dpr;
          ctx.beginPath(); ctx.moveTo(p[0] + o, p[1]);
          for (let j = 2; j < p.length; j += 2) ctx.lineTo(p[j] + o, p[j + 1]);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  },
};
