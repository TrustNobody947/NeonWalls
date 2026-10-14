// Schablonen-Uhr: Schrift, Oberflächen und Uhr-Ebene (gemeinsam für uhr.js und brokenscreen.js).
// Erwartet im Effekt: settings (finish, size, date, pos), W, H (Gerätepixel) sowie mk, clamp aus dem Rahmen.
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
// face: Verlauf über die Zeichenhöhe; lit/mid/shade: Fasen oben/seitlich/unten; side: Tiefe (nah, fern); date: Datumszeile
const FIN = [
  { face: [[0, '#ffffff'], [0.4, '#e4e7ed'], [0.49, '#a2a7b1'], [0.56, '#d6dae2'], [1, '#aab0ba']], lit: [255, 255, 255], mid: [196, 201, 210], shade: [62, 66, 74], side: [hex('#55595f'), hex('#141518')], date: [212, 216, 222] },
  { face: [[0, '#fff8de'], [0.4, '#f1d37e'], [0.49, '#9e7924'], [0.56, '#e7c56b'], [1, '#b68b2f']], lit: [255, 248, 220], mid: [214, 176, 90], shade: [86, 60, 16], side: [hex('#6a4e18'), hex('#1c1405')], date: [232, 196, 112] },
  { face: [[0, '#f2f8ff'], [0.4, '#bfd4ee'], [0.49, '#5f7995'], [0.56, '#aac3e0'], [1, '#7189a6']], lit: [240, 248, 255], mid: [150, 175, 205], shade: [28, 42, 60], side: [hex('#2c3d52'), hex('#0b1119')], date: [172, 196, 226] },
  // Roségold
  { face: [[0, '#fff1ea'], [0.4, '#f0bba6'], [0.49, '#99604e'], [0.56, '#e5aa94'], [1, '#b67b67']], lit: [255, 240, 232], mid: [218, 162, 142], shade: [92, 50, 40], side: [hex('#6e4135'), hex('#1d100b')], date: [232, 176, 156] },
  // Schwarzchrom: dunkler Spiegel, nur die Kanten blitzen hell
  { face: [[0, '#a4aab4'], [0.4, '#3b3e46'], [0.49, '#0b0c0f'], [0.56, '#2d3038'], [1, '#14161a']], lit: [225, 230, 240], mid: [74, 78, 88], shade: [6, 7, 9], side: [hex('#26282d'), hex('#040405')], date: [118, 124, 134] },
  // Kupfer
  { face: [[0, '#fff0de'], [0.4, '#e99b62'], [0.49, '#8a4a22'], [0.56, '#da8b52'], [1, '#a95d2c']], lit: [255, 236, 214], mid: [206, 130, 82], shade: [80, 36, 14], side: [hex('#6a3516'), hex('#1c0c04')], date: [222, 146, 98] },
  // Neon leuchtend: helle Fläche mit Schein, wie eine Leuchtröhre in Ziffernform
  { neon: [40, 225, 255], face: [[0, '#ffffff'], [0.45, '#e6fdff'], [1, '#a8f1ff']], lit: [255, 255, 255], mid: [176, 242, 255], shade: [52, 168, 205], side: [hex('#0d4b5d'), hex('#021116')], date: [196, 246, 255] },
  // Weiß wie das Original: matte weiße Fläche, Fasen hellgrau, Unterkanten grau, dunkle Kante darunter; Datum flach hellgrau
  { face: [[0, '#ffffff'], [1, '#ffffff']], lit: [255, 255, 255], mid: [220, 221, 222], shade: [172, 174, 178], side: [[60, 64, 68], [24, 26, 28]], date: [218, 218, 218] },
];
const mixC = (a, b, k) => [a[0] + (b[0] - a[0]) * k | 0, a[1] + (b[1] - a[1]) * k | 0, a[2] + (b[2] - a[2]) * k | 0];
const rgbS = c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

// ---------- Schrift: Balken mit 45°-Fasen auf dem Raster der Original-Uhr ----------
// Einheiten: Zeichenhöhe GH = 153 (9 × 17). Zweispaltige Zeichen: linke Spalte 0..BW, rechte Spalte XR..CW.
const GH = 153, BW = 18.5, GAP = 15, CW = 2 * BW + GAP, CH = 17, XR = BW + GAP, XM = (CW - BW) / 2;
// Balken in einer Spalte von y0 bis y1; Fase oben/unten links ('l'), rechts ('r') oder gerade ('-')
function bar(x0, y0, y1, top, bot, w) {
  const x1 = x0 + (w || BW);
  return [[x0, y0 + (top === 'l' ? CH : 0)], [x1, y0 + (top === 'r' ? CH : 0)], [x1, y1 - (bot === 'r' ? CH : 0)], [x0, y1 - (bot === 'l' ? CH : 0)]];
}
// Balken über die ganze Höhe mit spitzer Kerbe in der Mitte (rechte Spalte von 3 und 8, linke Spalte von 8)
const notchR = x0 => [[x0, 0], [x0 + BW, CH], [x0 + BW, 62], [x0 + 3.5, 76.5], [x0 + BW, 91], [x0 + BW, GH - CH], [x0, GH]];
const notchL = x0 => [[x0, CH], [x0 + BW, 0], [x0 + BW, GH], [x0, GH - CH], [x0, 91], [x0 + BW - 3.5, 76.5], [x0, 62]];
// waagerechter Balken mit schräg abgeschnittenem rechtem Ende (E, F)
const hbar = y0 => [[0, y0], [CW - BW, y0], [CW, y0 + BW], [0, y0 + BW]];
const M3 = BW + GAP; // Abstand der Balken bei M und W (drei Balken)
const GLYPHS = {
  '0': [bar(0, 0, GH, 'l', 'l'), bar(XR, 0, GH, 'r', 'r')],
  '1': [bar(XM, 0, GH, 'l', 'l')],
  '2': [bar(0, 0, 52, 'l', 'l'), bar(0, 85, GH, 'l', '-'), bar(XR, 0, 85, 'r', 'r'), bar(XR, 118, GH, 'r', '-')],
  '3': [bar(0, 0, 52, 'l', 'l'), bar(0, 101, GH, 'l', 'l'), notchR(XR)],
  '4': [bar(0, 0, 102, 'l', 'l'), bar(XR, 0, GH, 'l', 'l')],
  '5': [bar(0, 0, 85, '-', 'l'), bar(0, 101, GH, 'l', 'l'), bar(XR, 0, 35, '-', 'r'), bar(XR, 68, GH, 'r', 'r')],
  '6': [bar(0, 0, GH, 'l', 'l'), bar(XR, 0, 35, 'r', '-'), bar(XR, 68, GH, 'r', 'r')],
  '7': [bar(0, 0, 35, '-', 'r'), bar(XR, 0, GH, '-', 'r')],
  '8': [notchL(0), notchR(XR)],
  '9': [bar(0, 0, 85, 'l', 'l'), bar(0, 118, GH, '-', 'l'), bar(XR, 0, GH, 'r', 'r')],
  ':': [[[0, 17], [28.5, 0], [28.5, 52], [0, 35]], [[0, 118], [28.5, 101], [28.5, GH], [0, 136]]],
  '.': [[[0, GH - 17], [16, GH - 17], [16, GH], [0, GH]]],
  'A': [bar(0, 0, GH, 'l', '-'), bar(XR, 0, GH, 'r', '-')],
  'D': [bar(0, 0, GH, '-', '-'), bar(XR, 0, GH, 'r', 'r')],
  'E': [hbar(0), hbar(66), hbar(GH - BW)],
  'F': [hbar(0), [[0, 66], [CW - BW, 66], [CW, 66 + BW], [BW, 66 + BW], [BW, GH], [0, GH]]],
  'H': [bar(0, 0, GH, '-', '-'), bar(XR, 0, GH, '-', '-'), [[BW, 68], [XR, 85], [BW, 85]]],
  'I': [bar(0, 0, GH, '-', '-')],
  'M': [bar(0, 0, GH, 'l', '-'), bar(M3, 0, GH, '-', '-'), bar(2 * M3, 0, GH, 'r', '-')],
  'N': [bar(0, 0, GH, '-', '-'), bar(XR, 0, GH, 'r', '-')],
  'O': [bar(0, 0, GH, 'l', 'l'), bar(XR, 0, GH, 'r', 'r')],
  'R': [bar(0, 0, GH, 'l', '-'), [[XR, 0], [CW, CH], [CW, 66], [XR + 1, 84], [CW, 84], [CW, GH], [XR, GH]]],
  'S': [bar(0, 0, 85, 'l', 'l'), bar(0, 102, GH, 'l', 'l'), bar(XR, 0, 51, 'r', 'r'), bar(XR, 68, GH, 'r', 'r')],
  'T': [[[0, 0], [CW, 0], [CW, BW], [XM + BW, BW], [XM + BW, GH], [XM, GH], [XM, BW], [0, BW]]],
  'U': [[[0, 0], [BW, 0], [BW, GH - CH], [XR, GH - CH], [XR, 0], [CW, 0], [CW, GH - CH], [XR, GH], [BW, GH], [0, GH - CH]]],
  'W': [bar(0, 0, GH, '-', 'l'), bar(M3, 0, GH, '-', '-'), bar(2 * M3, 0, GH, '-', 'r')],
};
// Zeichen mit Tintengrenzen (x0..x1) für die Datumszeile mit Proportionalschrift
function glyph(ch) {
  const S = GLYPHS[ch] || [];
  let x0 = 0, x1 = 0;
  if (S.length) { x0 = 1e9; x1 = -1e9; for (const p of S) for (const q of p) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); } }
  // Breite: Ziffern immer eine volle Zelle (die 1 steht mittig darin), sonst bis zum rechten Rand der Form
  return { S, x0, x1, w: ch >= '0' && ch <= '9' ? CW : x1 };
}
// Fläche: Verlaufsfarbe in der Höhe v (0 oben, 1 unten)
function faceAt(F, v) {
  const st = F.face;
  if (v <= st[0][0]) return hex(st[0][1]);
  for (let i = 1; i < st.length; i++) if (v <= st[i][0]) return mixC(hex(st[i - 1][1]), hex(st[i][1]), (v - st[i - 1][0]) / (st[i][0] - st[i - 1][0]));
  return hex(st[st.length - 1][1]);
}
// Ein Teilstück mit Fasen einfärben: jedes Pixel bekommt die Farbe der nächsten Kante, wenn es näher als die Fasenbreite
// an ihr liegt (Licht von oben: Oberkanten hell, Seiten mittel, Unterkanten dunkel), sonst die Flächenfarbe.
function shadePoly(x, P, F, bev, top, hPx) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of P) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
  const bx = Math.floor(x0) - 1, by = Math.floor(y0) - 1, bw = Math.ceil(x1) - bx + 2, bh = Math.ceil(y1) - by + 2;
  const t = mk(bw, bh), tx = t.getContext('2d');
  tx.beginPath(); tx.moveTo(P[0][0] - bx, P[0][1] - by);
  for (let i = 1; i < P.length; i++) tx.lineTo(P[i][0] - bx, P[i][1] - by);
  tx.closePath(); tx.fillStyle = '#fff'; tx.fill();
  const id = tx.getImageData(0, 0, bw, bh), d = id.data, n = P.length, E = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    if (L2 < 1e-6) continue;
    const lam = dx / Math.sqrt(L2);
    E.push([a[0], a[1], dx, dy, L2, lam > 0 ? mixC(F.mid, F.lit, lam) : mixC(F.mid, F.shade, -lam)]);
  }
  const rows = [];
  for (let yy = 0; yy < bh; yy++) rows.push(faceAt(F, (by + yy + 0.5 - top) / hPx));
  for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
    const o = (yy * bw + xx) * 4;
    if (!d[o + 3]) continue;
    const px = bx + xx + 0.5, py = by + yy + 0.5;
    let best = 1e18, col = null;
    for (const e of E) {
      let k = ((px - e[0]) * e[2] + (py - e[1]) * e[3]) / e[4];
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const qx = e[0] + e[2] * k - px, qy = e[1] + e[3] * k - py, dd = qx * qx + qy * qy;
      if (dd < best) { best = dd; col = e[5]; }
    }
    const fc = rows[yy], m = clamp((Math.sqrt(best) - bev + 0.5), 0, 1);
    d[o] = col[0] + (fc[0] - col[0]) * m; d[o + 1] = col[1] + (fc[1] - col[1]) * m; d[o + 2] = col[2] + (fc[2] - col[2]) * m;
  }
  tx.putImageData(id, 0, 0);
  x.drawImage(t, bx, by);
}
// Zeichen als fertiges Bild: Uhrzeit mit Fasen und Tiefe, Datum flach (wie beim Original)
const cache = {};
function sprite(ch, hPx, flat) {
  const key = settings.finish + '|' + ch + '|' + hPx + '|' + (flat ? 1 : 0);
  if (cache[key]) return cache[key];
  const F = FIN[settings.finish] || FIN[0], gl = glyph(ch), u = hPx / GH;
  const depth = flat ? 0 : Math.max(1, Math.round(hPx * 0.026));
  const pad = depth + 3 + (F.neon ? Math.round(hPx * (flat ? 0.45 : 0.3)) : 0), bev = Math.max(1, hPx * 0.026);
  const cw = Math.max(1, Math.ceil(gl.w * u + pad * 2)), chh = Math.max(1, Math.ceil(hPx + pad * 2 + depth));
  const c = mk(cw, chh), x = c.getContext('2d');
  const S = gl.S.map(p => p.map(q => [pad + q[0] * u, pad + q[1] * u]));
  const path = (ox, oy) => { x.beginPath(); for (const p of S) { x.moveTo(p[0][0] + ox, p[0][1] + oy); for (let i = 1; i < p.length; i++) x.lineTo(p[i][0] + ox, p[i][1] + oy); x.closePath(); } };
  if (S.length && F.neon) {
    // Schein: weich und weit, dann eng und kräftig
    for (const [b, a] of [[hPx * 0.24, 0.45], [hPx * 0.07, 0.75]]) {
      x.save(); x.shadowColor = 'rgba(' + F.neon + ',1)'; x.shadowBlur = b; x.fillStyle = 'rgba(' + F.neon + ',' + a + ')';
      path(0, 0); x.fill(); x.restore();
    }
  }
  if (S.length && flat) { path(0, 0); x.fillStyle = rgbS(F.date); x.fill(); }
  else if (S.length) {
    // Tiefe: dieselbe Form mehrfach nach unten versetzt, dunkler je tiefer
    for (let k = depth; k >= 1; k--) { path(0, k); x.fillStyle = rgbS(mixC(F.side[0], F.side[1], (k - 1) / Math.max(1, depth - 1))); x.fill(); }
    for (const p of S) shadePoly(x, p, F, bev, pad, hPx);
  }
  const s = { c, pad };
  cache[key] = s;
  return s;
}

// ---------- Uhr-Ebene ----------
// Abstände wie beim Original (Einheiten der Zeichenhöhe 153): Ziffernzellen 52 breit im Abstand 102, der Doppelpunkt
// mittig in der Zelle dazwischen; Datumszeile 42 hoch, 51 unter der Uhrzeit, Proportionalschrift mit 39 Abstand,
// 50 um den Punkt und 350 zwischen Datum und Wochentag.
const EN = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'], DE = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
const two = v => (v < 10 ? '0' : '') + v;
let layer = null, layerC = [], tintC = null, lx = 0, ly = 0, stamp = '', layerKey = '';
function texts() {
  const d = new Date(), time = two(d.getHours()) + ':' + two(d.getMinutes());
  const ds = settings.date === 0 ? d.getFullYear() + '.' + two(d.getMonth() + 1) + '.' + two(d.getDate()) + ' ' + EN[d.getDay()]
    : settings.date === 1 ? DE[d.getDay()] + ' ' + two(d.getDate()) + '.' + two(d.getMonth() + 1) + '.' + d.getFullYear() : '';
  return { time, ds };
}
function timeLine(str, hPx) {
  const u = hPx / GH, list = [];
  let i = 0;
  for (const ch of str) {
    const g = glyph(ch), cell = i * 102;
    list.push({ ch, s: sprite(ch, hPx, false), x: (cell + (CW - g.w) / 2) * u });
    i++;
  }
  return { list, w: Math.max(0, (i - 1) * 102 + CW) * u };
}
function dateLine(str, hPx) {
  const u = hPx / GH, list = [];
  let x = 0, prev = null;
  for (const ch of str) {
    if (ch === ' ') { if (prev) x += 350 - 39; prev = ' '; continue; }
    if (prev) x += ch === '.' || prev === '.' ? 50 : 39;
    const g = glyph(ch);
    list.push({ ch, s: sprite(ch, hPx, true), x: (x - g.x0) * u });
    x += g.x1 - g.x0; prev = ch;
  }
  return { list, w: x * u };
}
function buildLayer() {
  const T = texts(), F = FIN[settings.finish] || FIN[0];
  const big = Math.max(12, Math.round(H * 0.0628 * (0.6 + 0.08 * settings.size))), small = Math.max(7, Math.round(big * 42 / 153));
  const tl = timeLine(T.time, big), dl = T.ds ? dateLine(T.ds, small) : { list: [], w: 0 };
  const gap = T.ds ? Math.round(big * 51 / 153) : 0, m = Math.round(big * (F.neon ? 0.34 : 0.12)) + 4;
  const lw = Math.ceil(Math.max(tl.w, dl.w) + m * 2), lh = Math.ceil(big + gap + (T.ds ? small : 0) + m * 2);
  layer = mk(lw, lh);
  const x = layer.getContext('2d');
  const tx = (lw - tl.w) / 2, dx0 = (lw - dl.w) / 2;
  for (const g of tl.list) x.drawImage(g.s.c, Math.round(tx + g.x - g.s.pad), m - g.s.pad);
  for (const g of dl.list) x.drawImage(g.s.c, Math.round(dx0 + g.x - g.s.pad), m + big + gap - g.s.pad);
  // Kopien je Farbkanal für den Farbversatz bei Glitches, und eine Fläche zum Einfärben
  layerC = [[255, 0, 0], [0, 255, 0], [0, 0, 255]].map(col => {
    const c = mk(lw, lh), y = c.getContext('2d');
    y.drawImage(layer, 0, 0); y.globalCompositeOperation = 'source-in'; y.fillStyle = 'rgb(' + col + ')'; y.fillRect(0, 0, lw, lh);
    y.globalCompositeOperation = 'multiply'; y.drawImage(layer, 0, 0); return c;
  });
  tintC = mk(lw, lh);
  // „Oben“ wie beim Original: Uhr und Datum zusammen mittig bei 14,66 % der Bildschirmhöhe.
  // Mit Höhenregler (settings.cy, Prozent der Bildschirmhöhe) frei wählbar.
  const cy = (settings.cy != null ? settings.cy / 100 : [0.1466, 0.42, 0.66][settings.pos]) * H;
  lx = Math.round(W / 2 - lw / 2); ly = Math.round(clamp(cy - lh / 2, H * 0.03, H * 0.97 - lh));
  stamp = T.time + T.ds;
  layerKey = [settings.size, settings.date, settings.finish, settings.pos, settings.cy, W, H].join('|');
  // Effekte können zusätzlich etwas aus dem Aufbau rechnen (z. B. die Metall-Uhr in 3D)
  if (typeof onLayerBuilt === 'function') onLayerBuilt({ big, small, gap, m, lw, lh, tx, dx0, tl, dl, ds: T.ds });
}
