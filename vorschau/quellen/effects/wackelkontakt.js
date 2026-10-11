// Wackelkontakt: ein loses Displaykabel. Meist ist das Bild ruhig und schwarz, nur ein paar schwache Linien zittern.
// Dann verliert das Kabel kurz den Kontakt und das Bild reißt in waagerechten Störstreifen auf: bunte Datenzeilen,
// Blockfehler, Rauschen, Farbversatz, manchmal eine ganze gestörte Bildhälfte. Danach bleiben kurz einzelne Linien hängen.
// 3D: Die Störstreifen springen ein Stück aus dem Bildschirm heraus (perspektivisch größer, mit leuchtenden Seitenwänden
// und Schatten auf dem Bild darunter), und einzelne Bruchstücke fliegen auf den Betrachter zu und verschwinden.
const settings = { rate: 5, power: 6, split: 5, depth: 5, idle: 4, pal: 0 };
const controls = [
  { type: 'range', id: 'rate', label: 'Wackeln', min: 0, max: 10, fmt: v => v == 0 ? 'nur beim Entsperren' : lvl(v) },
  { type: 'range', id: 'power', label: 'Heftigkeit', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'split', label: 'Farbversatz', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'depth', label: 'Tiefe (3D)', min: 0, max: 10, fmt: v => v == 0 ? 'flach' : lvl(v) },
  { type: 'range', id: 'idle', label: 'Ruhe-Rauschen', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'pal', label: 'Störfarben', options: ['Bunt', 'Neon', 'Grün', 'Weiß'] },
];
const PALS = [
  [[255, 45, 200], [40, 230, 255], [255, 235, 60], [70, 255, 130], [245, 245, 255], [255, 60, 70], [80, 110, 255]],
  [[255, 45, 200], [40, 230, 255], [170, 90, 255], [255, 150, 240], [120, 255, 255]],
  [[60, 255, 120], [40, 255, 215], [190, 255, 200], [120, 255, 60], [30, 200, 140]],
  [[255, 255, 255], [200, 205, 215], [150, 155, 165], [235, 240, 255]],
];
const rgb = (c, b) => 'rgb(' + ((c[0] * (b == null ? 1 : b)) | 0) + ',' + ((c[1] * (b == null ? 1 : b)) | 0) + ',' + ((c[2] * (b == null ? 1 : b)) | 0) + ')';
const TW = 1024, TH = 384, NW = 256, NH = 96;

let W = 1, H = 1, dpr = 1, t = 0;
let tex = null, texC = null, noise = null;
let burst = null, after = -1, idle = [], stuck = [], roll = null, rollWait = 4, frags = [];

// Streifen-Textur: jede Zeile eine Datenzeile mit Segmenten, Strichen oder Rauschen; dazu je eine Kopie pro Farbkanal
function genTextures() {
  const pal = PALS[settings.pal];
  const c = mk(TW, TH), x = c.getContext('2d'), img = x.createImageData(TW, TH), d = img.data, RW = TW * 4;
  const put = (p, col, b) => {
    const r = col[0] * b, g = col[1] * b, bb = col[2] * b;
    if (r > d[p]) d[p] = r; if (g > d[p + 1]) d[p + 1] = g; if (bb > d[p + 2]) d[p + 2] = bb;
  };
  for (let y = 0; y < TH; y++) {
    const o = y * RW;
    if (y > 0 && Math.random() < 0.3) { // Zeile davor leicht versetzt wiederholen: ergibt dickere Balken
      const sh = rint(-5, 5);
      for (let xx = 0; xx < TW; xx++) {
        const s = o - RW + (((xx + sh) % TW + TW) % TW) * 4, p = o + xx * 4;
        d[p] = d[s]; d[p + 1] = d[s + 1]; d[p + 2] = d[s + 2];
      }
      continue;
    }
    const r = Math.random();
    if (r < 0.44) continue;
    if (r < 0.8) {
      const n = rint(1, 5);
      for (let k = 0; k < n; k++) {
        const col = pick(pal), b = rnd(0.3, 1), x0 = rint(0, TW - 1), dash = Math.random() < 0.3 ? rint(2, 10) : 0;
        const len = Math.min(TW, 3 + Math.floor(-Math.log(1 - Math.random()) * 150));
        for (let i = 0; i < len; i++) { if (dash && ((i / dash) | 0) & 1) continue; put(o + ((x0 + i) % TW) * 4, col, b); }
      }
    } else if (r < 0.94) {
      const col = pick(pal), dens = rnd(0.1, 0.55), b0 = rnd(0.4, 1);
      for (let xx = 0; xx < TW; xx++) if (Math.random() < dens) put(o + xx * 4, Math.random() < 0.5 ? col : pick(pal), b0 * Math.random());
    } else {
      const col = pick(pal), b = rnd(0.45, 1);
      for (let xx = 0; xx < TW; xx++) put(o + xx * 4, col, b);
    }
  }
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  x.putImageData(img, 0, 0);
  tex = c;
  texC = [[255, 0, 0], [0, 255, 0], [0, 0, 255]].map(m => {
    const cc = mk(TW, TH), xc = cc.getContext('2d');
    xc.drawImage(c, 0, 0); xc.globalCompositeOperation = 'multiply'; xc.fillStyle = rgb(m); xc.fillRect(0, 0, TW, TH);
    return cc;
  });
  const nc = mk(NW, NH), nx = nc.getContext('2d'), ni = nx.createImageData(NW, NH), nd = ni.data;
  for (let i = 0; i < NW * NH; i++) {
    const v = Math.pow(Math.random(), 2.2), col = Math.random() < 0.6 ? [235, 240, 255] : pick(pal);
    nd[i * 4] = col[0] * v; nd[i * 4 + 1] = col[1] * v; nd[i * 4 + 2] = col[2] * v; nd[i * 4 + 3] = 255;
  }
  nx.putImageData(ni, 0, 0); noise = nc;
}

// Ruhige Linien zwischen den Störungen
function makeIdle() {
  const full = Math.random() < 0.45, len = full ? W : rnd(0.08, 0.6) * W;
  return {
    y: Math.round(rnd(0.02, 0.98) * H), x0: full ? 0 : rnd(0, W - len), len, col: rgb(pick(PALS[settings.pal])),
    a: rnd(0.3, 0.9), th: Math.random() < 0.3 ? 2 : 1, life: rnd(3, 14), age: 0, hold: 0, on: true, lv: 1,
  };
}
function syncIdle() {
  const n = Math.round(settings.idle * 0.7);
  while (idle.length > n) idle.pop();
  while (idle.length < n) { const l = makeIdle(); l.age = rnd(0, l.life * 0.8); idle.push(l); }
}
function drawIdle(ctx, dt) {
  const iv = settings.idle / 10;
  if (iv <= 0) return;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < idle.length; i++) {
    const l = idle[i];
    l.age += dt; if (l.age > l.life) { idle[i] = makeIdle(); continue; }
    l.hold -= dt; if (l.hold <= 0) { l.on = Math.random() < 0.82; l.lv = rnd(0.55, 1); l.hold = rnd(0.03, 0.7); }
    const fade = Math.min(1, l.age / 0.5, (l.life - l.age) / 0.5), a = l.a * (0.15 + 0.85 * iv) * fade * (l.on ? l.lv : 0.12);
    if (a < 0.004) continue;
    ctx.globalAlpha = a; ctx.fillStyle = l.col; ctx.fillRect(l.x0, l.y, l.len, l.th * Math.max(1, Math.round(dpr * 0.5)));
  }
  // ab und zu läuft ein schwaches Störband langsam durchs Bild
  if (!roll) { rollWait -= dt * (0.3 + iv); if (rollWait <= 0) roll = { y: 0, h: rnd(8, 40) * dpr, v: rnd(0.05, 0.16) * H, a: rnd(0.4, 1) }; }
  if (roll) {
    roll.y += roll.v * dt;
    if (roll.y > H + roll.h) { roll = null; rollWait = rnd(5, 16); }
    else {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.12 * iv * roll.a;
      ctx.drawImage(noise, rnd(0, NW * 0.6), rnd(0, NH - 12), NW * 0.4, 12, 0, roll.y - roll.h, W, roll.h);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

// Eine Störung: was in diesem Moment (für ein paar Bilder) zu sehen ist
function makeLayout(P, first, flashOk) {
  const pal = PALS[settings.pal], L = { bands: [], blocks: [], flash: null, half: null, vy: 0 };
  const yc = rnd(0.08, 0.92) * H, spread = Math.random() < 0.35 ? H : rnd(0.1, 0.45) * H;
  const nb = Math.max(1, Math.round(rnd(0.4, 1) * (1 + P * 7))), maxCs = settings.split * 2.6 * dpr;
  for (let i = 0; i < nb; i++) {
    const h = Math.max(1, Math.round(rnd(1.5, 6 + 70 * P * P * rnd(0.3, 1)) * dpr));
    const k = Math.random() < 0.25 ? rnd(2, 6) : rnd(0.8, 1.3), tw = Math.min(TW, TW / k);
    L.bands.push({
      y: Math.round(clamp(yc + rnd(-0.5, 0.5) * spread, -h * 0.5, H - h * 0.5)), h, kind: Math.random() < 0.2 ? 1 : 0,
      sy: rint(0, TH - 2), sh: Math.max(1, Math.round(h / (dpr * rnd(0.7, 1.6)))),
      tx: rnd(0, TW - tw), tw, xo: Math.random() < 0.5 ? 0 : rnd(-0.22, 0.22) * W,
      cs: maxCs * rnd(0.3, 1) * (Math.random() < 0.5 ? -1 : 1), a: rnd(0.5, 1), z: Math.pow(Math.random(), 1.3),
    });
  }
  if (Math.random() < 0.15 + 0.35 * P) { // Blockfehler wie bei kaputtem Videosignal
    const bs = Math.max(2, Math.round(rnd(6, 22) * dpr)), rows = rint(1, 3 + Math.round(P * 4));
    const y0 = Math.round(clamp(yc + rnd(-0.3, 0.3) * spread, 0, Math.max(0, H - bs * rows))), fill = rnd(0.15, 0.6);
    for (let r = 0; r < rows; r++) {
      const end = Math.random() < 0.5 ? W : rnd(0.4, 1) * W;
      for (let x = Math.random() < 0.5 ? 0 : rint(0, Math.round(W * 0.5)); x < end; x += bs)
        if (Math.random() < fill) { const col = pick(pal), br = rnd(0.15, 0.9); L.blocks.push({ x, y: y0 + r * bs, s: bs, c: rgb(col, br), d: rgb(col, br * 0.35) }); }
    }
  }
  if (Math.random() < 0.06 + 0.14 * P) { // untere oder obere Bildhälfte verliert den Takt
    const k = rnd(1, 3), tw = TW / k;
    L.half = { y: rnd(0.25, 0.8) * H, up: Math.random() < 0.3, sy: rint(0, Math.round(TH * 0.4)), tx: rnd(0, TW - tw), tw, a: rnd(0.3, 0.65), cs: maxCs * rnd(0.3, 1) };
  }
  if (flashOk && (first || Math.random() < 0.05 + 0.14 * P)) L.flash = { c: rgb(pick(pal)), a: first ? 0.26 : rnd(0.05, 0.1 + 0.16 * P) };
  if (Math.random() < 0.3) L.vy = rnd(-1, 1) * H * rnd(0.4, 2.5);
  L.zb = rnd(0.3, 1); L.born = t;
  return L;
}

function drawTex(ctx, sx, sy, sw, sh, x, y, w, h, cs) {
  if (Math.abs(cs) < 0.5) { ctx.drawImage(tex, sx, sy, sw, sh, x, y, w, h); return; }
  ctx.drawImage(texC[0], sx, sy, sw, sh, x + cs, y, w, h);
  ctx.drawImage(texC[1], sx, sy, sw, sh, x, y, w, h);
  ctx.drawImage(texC[2], sx, sy, sw, sh, x - cs, y, w, h);
}

// Herausspringen: Abstand vom Bildschirm z (0..1) vergrößert perspektivisch um die Bildmitte
const popAt = (v, c, sc) => c + (v - c) * sc;
function popNow(L) {
  const u = Math.min(1, (t - L.born) / 0.06), v = u - 1;
  return 1 + 2.4 * v * v * v + 1.4 * v * v; // schnell raus, leicht übers Ziel, zurück
}
function drawLayout(ctx, L, dt) {
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'lighter';
  const Dd = settings.depth / 10, pop = popNow(L), cx = W / 2, cy = H / 2;
  if (L.flash) { ctx.globalAlpha = L.flash.a; ctx.fillStyle = L.flash.c; ctx.fillRect(0, 0, W, H); }
  if (L.half) {
    const hf = L.half, y0 = hf.up ? 0 : hf.y, hh = hf.up ? hf.y : H - hf.y, rows = Math.min(TH - hf.sy, Math.max(1, Math.round(hh / (dpr * 1.3))));
    if (Math.random() < 0.3) hf.sy = rint(0, Math.round(TH * 0.4));
    ctx.globalAlpha = hf.a * rnd(0.75, 1);
    drawTex(ctx, hf.tx, hf.sy, hf.tw, rows, rnd(-2, 2) * dpr, y0, W, hh, hf.cs);
  }
  for (const b of L.bands) {
    b.y += L.vy * dt;
    if (b.y > H) b.y -= H + b.h; else if (b.y < -b.h) b.y += H + b.h;
    if (Math.random() < 0.25) b.sy = (b.sy + rint(1, 3)) % (TH - 1);
    const x = b.xo + rnd(-1.5, 1.5) * dpr, sh = Math.max(1, Math.min(b.sh, TH - b.sy));
    // springt heraus und kommt danach noch ein Stück näher
    const z = b.z * Dd * pop, sc = 1 + 0.2 * z + 0.45 * b.z * Dd * Math.min(0.2, t - L.born);
    const nh = b.kind === 1 ? Math.max(1, Math.min(NH - 1, Math.round(b.h / (dpr * 1.5)))) : 0, nsx = rnd(0, NW * 0.7), nsy = rint(0, Math.max(0, NH - nh));
    const put = (k, a, split) => {
      const X = popAt(x, cx, k), Y = popAt(b.y, cy, k), w = W * k, h = b.h * k;
      ctx.globalAlpha = Math.min(1, a);
      if (b.kind === 1) ctx.drawImage(noise, nsx, nsy, NW * 0.3, nh, X, Y, w, h);
      else if (split) drawTex(ctx, b.tx, b.sy, b.tw, sh, X, Y, w, h, b.cs * (1 + z));
      else ctx.drawImage(tex, b.tx, b.sy, b.tw, sh, X, Y, w, h);
    };
    if (z > 0.06) {
      // Lücke, wo der Streifen herausgesprungen ist, und sein Schatten auf dem Bild darunter
      // (beides nur sichtbar, wo dort gerade etwas leuchtet)
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000';
      ctx.globalAlpha = Math.min(0.7, 0.7 * z); ctx.fillRect(0, b.y, W, b.h);
      ctx.globalAlpha = Math.min(0.45, 0.45 * z); ctx.fillRect(0, b.y + z * 16 * dpr, W, b.h * 1.15);
      ctx.globalCompositeOperation = 'lighter';
      // leuchtende Seitenwände zwischen Bildschirm und Vorderfläche
      ctx.imageSmoothingEnabled = true;
      for (let k = 1; k <= 3; k++) { const f = k / 4; put(1 + 0.2 * z * f, b.a * 0.2 * (1.2 - f), false); }
      // Lichtschein um den herausgesprungenen Streifen: er leuchtet jetzt vor dem Glas
      if (z > 0.25 && b.kind === 0) {
        const X = popAt(x, cx, sc), Y = popAt(b.y, cy, sc), h = b.h * sc;
        ctx.globalAlpha = 0.12 * z; ctx.drawImage(tex, b.tx, b.sy, b.tw, sh, X, Y - h * 1.5, W * sc, h * 4);
      }
      ctx.imageSmoothingEnabled = false;
    }
    put(sc, b.a, true);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const zb = L.zb * Dd * pop, sb = 1 + 0.2 * zb;
  for (const k of L.blocks) {
    if (zb > 0.06) {
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.55, 0.55 * zb).toFixed(3) + ')'; ctx.fillRect(k.x + zb * 8 * dpr, k.y + zb * 14 * dpr, k.s, k.s);
      const m = 1 + 0.1 * zb; ctx.fillStyle = k.d; ctx.fillRect(popAt(k.x, cx, m), popAt(k.y, cy, m), k.s * m, k.s * m);
    }
    ctx.fillStyle = k.c; ctx.fillRect(popAt(k.x, cx, sb), popAt(k.y, cy, sb), k.s * sb, k.s * sb);
  }
}

// Bruchstücke, die aus dem Bildschirm auf den Betrachter zufliegen
function spawnFrags(P) {
  const Dd = settings.depth / 10;
  if (Dd <= 0 || !tex) return;
  const n = Math.round(rnd(0, 2 + 4 * P) * Dd);
  for (let i = 0; i < n && frags.length < 14; i++) {
    const w = rnd(0.06, 0.3) * W, h = rnd(3, 26) * dpr, sw = rnd(20, 160);
    frags.push({ x: rnd(0, W - w), y: rnd(0.05, 0.95) * H, w, h, sx: rnd(0, TW - sw), sy: rint(0, TH - 4), sw, sh: Math.max(1, h / (dpr * 1.4)),
      z: 0, vz: rnd(2.5, 5.5), rot: 0, vr: rnd(-1.2, 1.2), age: 0, life: rnd(0.22, 0.45), a: rnd(0.6, 1), cs: settings.split * rnd(1, 3) * dpr });
  }
}
function drawFrags(ctx, dt) {
  if (!frags.length) return;
  const cx = W / 2, cy = H / 2;
  ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
  frags = frags.filter(f => {
    f.age += dt; if (f.age >= f.life) return false;
    f.z += f.vz * dt; f.rot += f.vr * dt;
    const k = f.age / f.life;
    // drei Abzüge entlang des Flugwegs: Bewegungsunschärfe
    for (let j = 2; j >= 0; j--) {
      const zz = Math.max(0, f.z - j * f.vz * 0.012), sc = 1 + 0.35 * zz * zz;
      const mx = popAt(f.x + f.w / 2, cx, sc), my = popAt(f.y + f.h / 2, cy, sc);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(f.rot * zz * 0.4);
      ctx.globalAlpha = f.a * (1 - k) * (1 - k) * (j ? 0.25 : 1);
      if (j === 0) drawTex(ctx, f.sx, f.sy, f.sw, f.sh, -f.w * sc / 2, -f.h * sc / 2, f.w * sc, f.h * sc, f.cs * (1 + zz));
      else ctx.drawImage(tex, f.sx, f.sy, f.sw, f.sh, -f.w * sc / 2, -f.h * sc / 2, f.w * sc, f.h * sc);
      ctx.restore();
    }
    return true;
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function startBurst(P, dur, first) { burst = { left: dur, P, hold: 0, L: null, on: false, first: !!first, flashes: 0 }; if (Math.random() < 0.35 + 0.6 * P) spawnFrags(P); }
function endBurst() {
  const pal = PALS[settings.pal];
  if (Math.random() < 0.55) for (let k = rint(1, 2); k > 0; k--) {
    const full = Math.random() < 0.6, len = full ? W : rnd(0.2, 0.8) * W;
    stuck.push({ y: Math.round(rnd(0.03, 0.97) * H), x0: full ? 0 : rnd(0, W - len), len, col: rgb(pick(pal)), a: rnd(0.45, 0.9), life: rnd(1.2, 5), age: 0, th: rint(1, 2) * Math.max(1, Math.round(dpr * 0.5)) });
  }
  if (Math.random() < 0.45) after = rnd(0.12, 1.1);
}
function stepBurst(ctx, dt) {
  const b = burst;
  b.left -= dt; b.hold -= dt;
  if (b.hold <= 0) {
    b.on = b.first || Math.random() < 0.7;
    b.hold = b.on ? rnd(0.017, 0.14) : rnd(0.02, 0.16);
    if (b.on) {
      b.L = makeLayout(b.P * rnd(0.55, 1), b.first, b.flashes < 2); if (b.L.flash) b.flashes++; b.first = false;
      if (Math.random() < 0.12 * b.P) spawnFrags(b.P * 0.5);
    }
  }
  if (b.on && b.L) drawLayout(ctx, b.L, dt);
  if (b.left <= 0) { burst = null; endBurst(); }
}
function drawStuck(ctx, dt) {
  ctx.globalCompositeOperation = 'lighter';
  stuck = stuck.filter(s => {
    s.age += dt; if (s.age > s.life) return false;
    const a = s.a * Math.min(1, (s.life - s.age) / 0.8) * (Math.random() < 0.06 ? 0.2 : 1);
    ctx.globalAlpha = a; ctx.fillStyle = s.col; ctx.fillRect(s.x0, s.y, s.len, s.th);
    return true;
  });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
const powerNow = () => {
  let P = settings.power / 10 * rnd(0.6, 1);
  if (Math.random() < 0.12) P = Math.min(1, P + 0.35);
  return P;
};

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Wackeln',
  resize(w, h, d) { W = w; H = h; dpr = d; idle = []; stuck = []; syncIdle(); },
  newPattern() { genTextures(); idle = []; syncIdle(); stuck = []; },
  action() { const P = Math.min(1, settings.power / 10 + rnd(0, 0.3)); startBurst(P, rnd(0.3, 0.6) + P * rnd(0.1, 0.4), Math.random() < 0.5); after = -1; },
  wake() { startBurst(Math.min(1, settings.power / 10 + 0.25), rnd(0.45, 0.8), true); after = -1; },
  change(id) {
    if (id === 'pal') { genTextures(); idle = []; syncIdle(); }
    if (id === 'idle') syncIdle();
  },
  frame(ctx, dt) {
    t += dt;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    drawIdle(ctx, dt);
    if (!burst) {
      if (after > 0) { after -= dt; if (after <= 0) startBurst(powerNow() * rnd(0.4, 0.8), rnd(0.06, 0.3)); }
      else if (settings.rate > 0 && Math.random() < per(0.033 * Math.pow(45, (settings.rate - 1) / 9), dt)) {
        const P = powerNow(); startBurst(P, rnd(0.1, 0.3) + P * rnd(0.15, 0.8));
      }
    }
    if (burst) stepBurst(ctx, dt);
    drawStuck(ctx, dt);
    drawFrags(ctx, dt);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
};
