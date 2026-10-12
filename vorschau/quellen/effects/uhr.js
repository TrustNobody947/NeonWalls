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
    list.push({ s: sprite(ch, hPx, false), x: (cell + (CW - g.w) / 2) * u });
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
    list.push({ s: sprite(ch, hPx, true), x: (x - g.x0) * u });
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
  // „Oben“ wie beim Original: Uhr und Datum zusammen mittig bei 14,66 % der Bildschirmhöhe
  const cy = [0.1466, 0.42, 0.66][settings.pos] * H;
  lx = Math.round(W / 2 - lw / 2); ly = Math.round(clamp(cy - lh / 2, H * 0.03, H * 0.97 - lh));
  stamp = T.time + T.ds;
  layerKey = [settings.size, settings.date, settings.finish, settings.pos, W, H].join('|');
}

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
