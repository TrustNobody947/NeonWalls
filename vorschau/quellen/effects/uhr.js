// Schablonen-Uhr: kantige Metallziffern mit echter Uhrzeit und Datum, im Stil einer Sperrbildschirm-Uhr.
// Die Schrift ist nach Screenshots der Original-Uhr vermessen: nur senkrechte Balken mit 45°-Fasen auf einem Raster
// (Zeichenhöhe = 9 Rastereinheiten), Schablonen-Lücke zwischen linker und rechter Spalte, Doppelpunkt aus zwei Keilen.
// Licht von oben: weiße Fläche, hellgraue Seitenfasen, graue Unterkanten, darunter eine dunkle Kante (Tiefe).
// Über Broken Screen wird die Uhr Teil des kaputten Displays: Ein Haarriss läuft durch die Ziffern (darunter versetzt),
// auch der große Riss von Broken Screen versetzt sie, die Teilstücke flackern einzeln, und bei Glitch-Ausbrüchen
// zerfällt die Uhr kurz in Farbkanäle, verrutschte Streifen und Farbblitze. Die Farbstreifen laufen über die Uhr.
// Die Uhr lässt sich abschalten (dann bleibt nur der Hintergrund). Oberflächen: Weiß wie das Original, Metalle, Neon.
const settings = { clock: 0, bg: 0, pos: 0, size: 5, date: 0, finish: 7, crack: 5, calm: 4, burst: 5, countPos: 59, shear: 5, rndWake: 0, mutate: 0 };
const countFromPos = v => Math.round(3 * Math.pow(50, v / 100));
const controls = [
  { type: 'choice', id: 'clock', label: 'Uhr', options: ['An', 'Aus'] },
  { type: 'choice', id: 'bg', label: 'Hintergrund', options: ['Broken Screen', 'Schwarz'] },
  { type: 'choice', id: 'pos', label: 'Position', options: ['Oben', 'Mitte', 'Unten'] },
  { type: 'range', id: 'size', label: 'Größe (5 = wie Original)', min: 1, max: 10, fmt: v => String(v) },
  { type: 'choice', id: 'date', label: 'Datum', options: ['Wie Original', 'Deutsch', 'Aus'] },
  { type: 'grid', id: 'finish', label: 'Oberfläche', options: [
    { label: 'Chrom', group: 'Metall' }, { label: 'Gold', group: 'Metall' }, { label: 'Stahlblau', group: 'Metall' },
    { label: 'Roségold', group: 'Metall' }, { label: 'Schwarzchrom', group: 'Metall' }, { label: 'Kupfer', group: 'Metall' },
    { label: 'Neon leuchtend', group: 'Leuchtend' }, { label: 'Weiß', group: 'Wie Original' }] },
  { type: 'range', id: 'crack', label: 'Riss durch die Uhr', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'calm', label: 'Grundflackern', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'burst', label: 'Glitch-Ausbrüche', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'countPos', label: 'Anzahl Streifen', min: 0, max: 100, fmt: countFromPos },
  { type: 'range', id: 'shear', label: 'Versatz am Riss', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'rndWake', label: 'Neues Muster bei jedem Einschalten', options: ['Aus', 'An'] },
  { type: 'choice', id: 'mutate', label: 'Glitches verändern das Muster', options: ['Aus', 'An'] },
];
//#include uhrface.js

// ---------- Broken Screen (wie die abgenommene Version, hier in CSS-Pixeln) ----------
const PAL = [[25, 230, 25], [40, 210, 40], [200, 20, 200], [170, 0, 170], [255, 20, 20], [45, 95, 255], [20, 170, 230], [120, 40, 255], [30, 190, 120], [255, 0, 220]];
let W = 1, H = 1, dpr = 1, Wc = 1, Hc = 1, t = 0, cx = null;
let lines = [], burstT = 0, nextBurst = 8, burstZone = 'all', burstPow = 1, shear = null, curDt = 0.016, curBursting = false, curG = 0.25;
let crackLine = { y: 0.5, k: 0, f: 1 }, zones = {};
const P = rate => 1 - Math.exp(-rate * curDt);
function makeLine(x) {
  const col = Math.random() < 0.5 ? pick(PAL.slice(0, 4)) : pick(PAL);
  return { x: x == null ? rnd(0, 1) : x, tilt: Math.random() < 0.3 ? rnd(-0.012, 0.012) : 0,
    w: (q => q < 0.3 ? rnd(0.22, 0.4) : q < 0.87 ? rnd(0.5, 1.1) : rnd(1.4, 2.2))(Math.random()),
    col, base: rnd(0.55, 1), flash: 0, flashCol: null, off: 0, frag: null, dotted: Math.random() < 0.45 };
}
function newLines() {
  lines = [];
  const clusters = Array.from({ length: Math.round(rnd(2, 4)) }, () => ({ c: rnd(0.1, 0.95), s: rnd(0.03, 0.12) }));
  const n0 = countFromPos(settings.countPos);
  for (let i = 0; i < n0; i++) {
    let x;
    if (Math.random() < 0.65) { const cl = pick(clusters); x = cl.c + (Math.random() - 0.5) * 2 * cl.s; } else x = Math.random();
    lines.push(makeLine(Math.min(0.995, Math.max(0.005, x))));
  }
  for (let i = 0; i < Math.round(n0 * 0.12); i++) { const L = pick(lines); const n = makeLine(Math.min(0.995, L.x + rnd(0.004, 0.01))); n.col = pick(PAL); lines.push(n); }
}
function triggerBurst(zone) {
  burstT = Math.random() < 0.2 ? rnd(1.2, 2.4) : rnd(0.15, 1.1);
  burstPow = rnd(0.5, 1.5);
  const r = Math.random();
  burstZone = zone || (r < 0.35 ? 'all' : r < 0.65 ? 'bottom' : r < 0.85 ? 'top' : 'mid');
}
function scheduleBurst(bur) {
  if (Math.random() < 0.18 * bur) return rnd(0.3, 1.6);
  const p = Math.random() < 0.3 ? rnd(25, 60) : rnd(8, 25);
  return p * (0.5 + Math.pow(1 - bur, 2) * 4);
}
function makeShear() {
  const s = { side: Math.random() < 0.5 ? 'L' : 'R', yOuter: rnd(0.82, 0.9), yInner: rnd(0.74, 0.8), f1: (Math.random() < 0.5 ? -1 : 1) * rnd(0.8, 1.2) };
  s.y1 = xn => s.yInner + (s.side === 'L' ? 1 - xn : xn) * (s.yOuter - s.yInner);
  const bx = rnd(0.3, 0.7), by = s.y1(bx);
  const ex = Math.min(0.98, Math.max(0.02, bx + (Math.random() < 0.5 ? -1 : 1) * rnd(0.18, 0.32)));
  s.branch = { bx, by, ex, ey: by - rnd(0.22, 0.38), f: (Math.random() < 0.5 ? -1 : 1) * rnd(0.7, 1.2) };
  shear = s;
}
function makeCrack() { crackLine = { y: rnd(0.3, 0.7), k: rnd(-0.16, 0.16), f: Math.random() < 0.5 ? -1 : 1 }; zones = {}; }
function linePoints(L, x) {
  const xn = x / Wc, segs = [], s = shear, base = settings.shear * 1.2;
  let pts = [[x, 0]];
  const jit = () => burstT > 0 && Math.random() < 0.3 ? rnd(0.6, 1.8) : 1;
  const cuts = [];
  if (s && base > 0) {
    cuts.push({ y: s.y1(xn) * Hc, d: s.f1 * base * jit() });
    const b = s.branch, lo = Math.min(b.bx, b.ex), hi = Math.max(b.bx, b.ex);
    if (xn > lo && xn < hi) { const k = (xn - b.bx) / (b.ex - b.bx); cuts.push({ y: (b.by + k * (b.ey - b.by)) * Hc, d: b.f * base * jit() }); }
    cuts.sort((a, c) => a.y - c.y);
  }
  let cum = 0;
  for (const c of cuts) {
    if (c.y >= Hc - 2) continue;
    pts.push([x + cum, c.y]); segs.push(pts);
    cum += c.d; pts = [[x + cum, c.y]];
  }
  pts.push([x + cum, Hc]); segs.push(pts);
  for (const sg of segs) for (const p of sg) p[0] += L.tilt * Wc * (p[1] / Hc - 0.5);
  if (!L.tilt) for (const sg of segs) for (const p of sg) p[0] = (Math.round(p[0] * dpr - 0.5) + 0.5) / dpr;
  return segs;
}
function strokePts(segs) {
  cx.beginPath();
  for (const sg of segs) { cx.moveTo(sg[0][0], sg[0][1]); for (let i = 1; i < sg.length; i++) cx.lineTo(sg[i][0], sg[i][1]); }
  cx.stroke();
}
function paintSegs(L, pts, alpha, col) {
  const [r, g, b] = col;
  cx.lineCap = 'butt'; cx.lineJoin = 'miter';
  cx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha * 0.1 + ')';
  cx.lineWidth = Math.max(L.w * 2.5, 1.5 / dpr); cx.setLineDash([]); strokePts(pts);
  cx.strokeStyle = 'rgba(' + Math.min(255, r + 120) + ',' + Math.min(255, g + 120) + ',' + Math.min(255, b + 120) + ',' + alpha * 0.55 + ')';
  cx.lineWidth = Math.max(1 / dpr, L.w * 0.35); strokePts(pts);
  cx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  cx.lineWidth = Math.max(1, Math.round(L.w * dpr)) / dpr; strokePts(pts);
  if (L.dotted) {
    cx.strokeStyle = 'rgba(' + Math.min(255, r + 80) + ',' + Math.min(255, g + 80) + ',' + Math.min(255, b + 80) + ',' + alpha * 0.35 + ')';
    cx.lineWidth = Math.max(1 / dpr, L.w * 0.5); cx.setLineDash([1, 1.5]); strokePts(pts); cx.setLineDash([]);
  }
}
function drawLine(L, x, alpha, col, y0, y1) {
  const segs = linePoints(L, x), clip = y0 > 0 || y1 < Hc;
  if (clip) { cx.save(); cx.beginPath(); cx.rect(0, y0, Wc, y1 - y0); cx.clip(); }
  if (!L.zones) L.zones = [];
  const n = segs.length;
  segs.forEach((sg, i) => {
    const z = L.zones[i] || (L.zones[i] = { flash: 0, col: null, off: 0 });
    const sb = curBursting && n > 1 && (burstZone === 'all' || (burstZone === 'top' && i === 0) || (burstZone === 'bottom' && i === n - 1) || (burstZone === 'mid' && n === 3 && i === 1));
    if (n > 1) {
      if (z.off > 0) { z.off -= curDt; if (z.off > 0) return; }
      else if (Math.random() < (sb ? 0.035 * burstPow : P(0.05 * curG))) { z.off = rnd(0.05, sb ? 0.5 : 1.2); return; }
      if (z.flash > 0) z.flash -= curDt;
      else if (Math.random() < (sb ? 0.3 * burstPow : P(0.18 * curG))) { z.flash = rnd(0.03, 0.18); z.col = Math.random() < 0.6 ? pick(PAL) : col; }
    }
    let a = alpha, c = col;
    if (L.flash > 0 && (!L.mask || L.mask[i] !== false)) { a = Math.random() < 0.5 ? rnd(1, 1.6) : rnd(0.05, 0.3); c = L.flashCol || col; }
    else if (segs.length > 1 && z.flash > 0) { a = Math.random() < 0.5 ? rnd(1, 1.6) : rnd(0.05, 0.3); c = z.col; }
    paintSegs(L, [sg], Math.max(0, Math.min(1, a)), c);
  });
  if (clip) cx.restore();
}
function stripes(dt, calm, bursting) {
  for (const L of lines) {
    if (L.off > 0) { L.off -= dt; if (L.off > 0) continue; }
    else if (Math.random() < (bursting ? 0.02 : P(0.03 * curG))) { L.off = rnd(0.05, bursting ? 0.4 : 1.5); continue; }
    if (L.flash > 0) L.flash -= dt;
    else if (Math.random() < (bursting ? 0.25 * burstPow : P(0.12 * curG))) {
      L.flash = rnd(0.03, 0.15); L.flashCol = Math.random() < 0.5 ? pick(PAL) : L.col;
      L.mask = [Math.random() < 0.55, Math.random() < 0.55, Math.random() < 0.55];
      if (!L.mask.some(Boolean)) L.mask[Math.floor(Math.random() * 3)] = true;
    }
    if (bursting && settings.mutate === 1 && Math.random() < 0.01) L.col = pick(PAL);
    if (!(L.flT > 0)) { L.flT = rnd(0.03, 0.09); L.fl = 1 - calm * rnd(0, 0.45); } else L.flT -= dt;
    const a = Math.max(0, Math.min(1, L.base * L.fl));
    let x = L.x * Wc;
    if (bursting && Math.random() < 0.15) x += rnd(-3, 3);
    if (!L.frag && Math.random() < (bursting ? 0.02 : P(0.02 * curG))) L.frag = { y0: rnd(0.55, 0.9) * Hc, t: rnd(0.3, 3) };
    if (L.frag) {
      L.frag.t -= dt;
      drawLine(L, x, a, L.col, L.frag.y0, Hc);
      if (Math.random() < 0.2) drawLine(L, x, a * 0.7, L.col, L.frag.y0 - rnd(10, 60), L.frag.y0 - rnd(2, 8));
      if (L.frag.t <= 0) L.frag = null;
    } else drawLine(L, x, a, L.col, 0, Hc);
  }
  if (bursting && Math.random() < 0.35) {
    const tmp = makeLine(); tmp.w = rnd(0.5, 1.2);
    drawLine(tmp, tmp.x * Wc, rnd(0.6, 1), tmp.col, Math.random() < 0.5 ? 0 : rnd(0.3, 0.8) * Hc, Hc);
  }
}

// ---------- Uhr in Teilstücken zeichnen (Gerätepixel) ----------
// Halbebene unter oder über einer Geraden y = y0 + k*x
function halfPlane(ctx, y0, k, below) {
  const xa = -W, xb = 2 * W, ya = y0 + k * xa, yb = y0 + k * xb, far = below ? 4 * H + 1e4 : -4 * H - 1e4;
  ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.lineTo(xb, far); ctx.lineTo(xa, far); ctx.closePath();
}
function drawClock(ctx, calm, broken) {
  if (!layer) return;
  const lw = layer.width, lh = layer.height;
  if (!broken) { ctx.drawImage(layer, lx, ly); return; }
  // Risse: eigener Haarriss durch die Uhr und der große Riss von Broken Screen (als Gerade)
  const cuts = [];
  const jit = () => burstT > 0 && Math.random() < 0.3 ? rnd(0.6, 1.8) : 1;
  if (settings.crack > 0) {
    const yc = ly + lh * crackLine.y, k = crackLine.k * lh / lw;
    cuts.push({ y0: yc - k * (lx + lw / 2), k, dx: crackLine.f * settings.crack * 0.9 * dpr * jit(), dy: settings.crack * 0.12 * dpr });
  }
  if (shear && settings.shear > 0) {
    const ya = shear.y1(0) * H, yb = shear.y1(1) * H;
    cuts.push({ y0: ya, k: (yb - ya) / W, dx: shear.f1 * settings.shear * 1.2 * dpr * jit(), dy: 0 });
  }
  const n = cuts.length;
  for (let mask = 0; mask < (1 << n); mask++) {
    let ox = 0, oy = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { ox += cuts[i].dx; oy += cuts[i].dy; }
    // Liegt dieses Teilstück überhaupt im Bereich der Uhr?
    let hit = false;
    for (const [px, py] of [[lx, ly], [lx + lw, ly], [lx, ly + lh], [lx + lw, ly + lh], [lx + lw / 2, ly + lh / 2], [lx, ly + lh / 2], [lx + lw, ly + lh / 2]]) {
      let ok = true;
      for (let i = 0; i < n; i++) { const below = py > cuts[i].y0 + cuts[i].k * px; if (below !== !!(mask & (1 << i))) { ok = false; break; } }
      if (ok) { hit = true; break; }
    }
    if (!hit && n) {
      // auch Teilstücke prüfen, die nur zwischen den Messpunkten liegen
      let any = false;
      for (let yy = ly; yy <= ly + lh && !any; yy += lh / 8) for (let xx = lx; xx <= lx + lw && !any; xx += lw / 8) {
        let ok = true;
        for (let i = 0; i < n; i++) { const below = yy > cuts[i].y0 + cuts[i].k * xx; if (below !== !!(mask & (1 << i))) { ok = false; break; } }
        any = ok;
      }
      if (!any) continue;
    }
    const z = zones[mask] || (zones[mask] = { off: 0, flash: 0, col: null, fl: 1, flT: 0, split: 0, sx: 0, slice: 0 });
    const sb = curBursting && (burstZone === 'all' || (burstZone === 'top' && mask === 0) || (burstZone === 'bottom' && mask === (1 << n) - 1) || (burstZone === 'mid' && mask > 0 && mask < (1 << n) - 1));
    if (z.off > 0) { z.off -= curDt; if (z.off > 0) continue; }
    else if (Math.random() < (sb ? 0.02 * burstPow : P(0.025 * curG))) { z.off = rnd(0.04, sb ? 0.3 : 0.5); continue; }
    if (z.flash > 0) z.flash -= curDt; else if (Math.random() < (sb ? 0.18 * burstPow : P(0.08 * curG))) { z.flash = rnd(0.03, 0.15); z.col = pick(PAL); }
    if (z.split > 0) z.split -= curDt; else if (Math.random() < (sb ? 0.12 * burstPow : P(0.04 * curG))) { z.split = rnd(0.04, 0.22); z.sx = rnd(2, 7) * dpr * (Math.random() < 0.5 ? -1 : 1); }
    if (z.slice > 0) z.slice -= curDt; else if (sb && Math.random() < 0.05 * burstPow) z.slice = rnd(0.05, 0.2);
    if (!(z.flT > 0)) { z.flT = rnd(0.03, 0.09); z.fl = 1 - calm * rnd(0, 0.22); } else z.flT -= curDt;
    ctx.save();
    for (let i = 0; i < n; i++) { halfPlane(ctx, cuts[i].y0, cuts[i].k, !!(mask & (1 << i))); ctx.clip(); }
    const X = lx + ox, Y = ly + oy;
    ctx.globalAlpha = z.fl;
    if (z.split > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(layerC[0], X + z.sx, Y); ctx.drawImage(layerC[1], X, Y); ctx.drawImage(layerC[2], X - z.sx, Y);
    } else if (z.slice > 0) {
      const k = rint(3, 6);
      for (let s = 0; s < k; s++) {
        const sy = Math.floor(lh * s / k), sh = Math.ceil(lh / k);
        ctx.drawImage(layer, 0, sy, lw, sh, X + rnd(-1, 1) * 10 * dpr, Y + sy, lw, sh);
      }
    } else ctx.drawImage(layer, X, Y);
    if (z.flash > 0) {
      const tx = tintC.getContext('2d');
      tx.globalCompositeOperation = 'copy'; tx.drawImage(layer, 0, 0);
      tx.globalCompositeOperation = 'source-in'; tx.fillStyle = 'rgb(' + z.col + ')'; tx.fillRect(0, 0, lw, lh);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * z.fl; ctx.drawImage(tintC, X, Y);
    }
    ctx.restore();
  }
  // der Haarriss selbst: dunkle Bruchkante über den Ziffern, mit feinem Glanz
  if (settings.crack > 0 && cuts.length) {
    const c0 = cuts[0], x0 = lx - lw * 0.08, x1 = lx + lw * 1.08;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, c0.y0 + c0.k * x0); ctx.lineTo(x1, c0.y0 + c0.k * x1);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = Math.max(1, 1.6 * dpr); ctx.stroke();
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.moveTo(x0, c0.y0 + c0.k * x0 - dpr); ctx.lineTo(x1, c0.y0 + c0.k * x1 - dpr);
    ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, 0.6 * dpr); ctx.stroke();
    ctx.restore();
  }
}

return {
  maxDpr: 4,
  settings, controls,
  actionLabel: 'Glitch jetzt',
  resize(w, h, d) {
    W = w; H = h; dpr = d; Wc = W / dpr; Hc = H / dpr;
    for (const k in cache) delete cache[k];
    if (!shear) makeShear();
    buildLayer();
  },
  newPattern() { newLines(); makeShear(); makeCrack(); },
  action() { triggerBurst(); },
  wake() {
    if (settings.rndWake === 1) { newLines(); makeShear(); makeCrack(); }
    triggerBurst('all'); burstT = rnd(0.25, 0.6);
  },
  change(id) {
    if (id === 'countPos') newLines();
    if (id === 'burst') { nextBurst = scheduleBurst(settings.burst / 10); burstT = 0; }
    if (id === 'finish') for (const k in cache) delete cache[k];
    if (id === 'size' || id === 'date' || id === 'finish' || id === 'pos') buildLayer();
  },
  frame(ctx, dt) {
    t += dt; cx = ctx;
    const calm = settings.calm / 10, bur = settings.burst / 10, broken = settings.bg === 0;
    const TX = texts();
    if (stamp !== TX.time + TX.ds) buildLayer();
    if (burstT > 0) {
      burstT -= dt;
      // nach einem Glitch-Ausbruch manchmal ein neues Streifenmuster (Risse bleiben)
      if (burstT <= 0 && settings.mutate === 1 && Math.random() < 0.5) newLines();
    }
    else if (broken && bur > 0) { nextBurst -= dt; if (nextBurst <= 0) { triggerBurst(); nextBurst = scheduleBurst(bur); } }
    curDt = dt; curBursting = burstT > 0 && broken;
    curG = broken && bur > 0 ? 0.02 + 0.98 * Math.pow(bur, 1.6) : 0;
    const bursting = curBursting && burstZone === 'all';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (broken) { ctx.fillStyle = bursting && Math.random() < 0.3 ? 'rgba(0,30,10,.5)' : 'rgba(0,12,4,.6)'; ctx.fillRect(0, 0, W, H); }
    if (settings.clock === 0) drawClock(ctx, calm, broken);
    if (broken) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
      stripes(dt, calm, bursting);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  },
};
