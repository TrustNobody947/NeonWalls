// Leuchtreklame: ein eigener Text als Neonschild an einer dunklen Betonwand, in vielen Schriften von Google Fonts.
// Gesunde Röhren leuchten ruhig, defekte stottern, glimmen nur schwach, brummen oder fallen ganz aus.
// Schreibschrift ist wie beim echten Neonschild eine durchgehende Röhre pro Wort, sonst ist jeder Buchstabe eine eigene Röhre.
// Sonderbuchstaben aus "Schriftarten"-Tastaturen (z. B. 𝕿𝖗𝖚𝖘𝖙) werden in normale Buchstaben umgewandelt; dabei wird
// automatisch eine passende Schrift gewählt (Fraktur → Altdeutsch, Schreibschrift-Zeichen → Schreibschrift).
// Beim Entsperren zündet das Schild Röhre für Röhre, mit dem typischen Flackern beim Einschalten.
const FALL = { 'Neon & klar': 'system-ui, Roboto, sans-serif', 'Schreibschrift': 'cursive', 'Altdeutsch': 'serif', 'Retro': 'system-ui, sans-serif', 'Technik': 'system-ui, sans-serif' };
const FONTS = [
  { g: 'Neon & klar', n: 'Tilt Neon', q: 'Tilt+Neon' },
  { g: 'Neon & klar', n: 'Comfortaa', q: 'Comfortaa:wght@400', w: 400 },
  { g: 'Neon & klar', n: 'Quicksand', q: 'Quicksand:wght@400', w: 400 },
  { g: 'Neon & klar', n: 'Varela Round', q: 'Varela+Round' },
  { g: 'Neon & klar', n: 'Poiret One', q: 'Poiret+One' },
  { g: 'Neon & klar', n: 'Josefin Sans', q: 'Josefin+Sans:wght@300', w: 300 },
  { g: 'Neon & klar', n: 'Raleway', q: 'Raleway:wght@300', w: 300 },
  { g: 'Neon & klar', n: 'Bungee Hairline', q: 'Bungee+Hairline', k: 0.85 },
  { g: 'Neon & klar', n: 'Syncopate', q: 'Syncopate', k: 0.8 },
  { g: 'Neon & klar', n: 'Righteous', q: 'Righteous' },
  { g: 'Schreibschrift', n: 'Neonderthaw', q: 'Neonderthaw', s: 1, k: 1.45 },
  { g: 'Schreibschrift', n: 'Sacramento', q: 'Sacramento', s: 1, k: 1.45 },
  { g: 'Schreibschrift', n: 'Yellowtail', q: 'Yellowtail', s: 1, k: 1.2 },
  { g: 'Schreibschrift', n: 'Pacifico', q: 'Pacifico', s: 1 },
  { g: 'Schreibschrift', n: 'Kaushan Script', q: 'Kaushan+Script', s: 1, k: 1.1 },
  { g: 'Schreibschrift', n: 'Great Vibes', q: 'Great+Vibes', s: 1, k: 1.4 },
  { g: 'Schreibschrift', n: 'Dancing Script', q: 'Dancing+Script:wght@500', w: 500, s: 1, k: 1.15 },
  { g: 'Schreibschrift', n: 'Satisfy', q: 'Satisfy', s: 1, k: 1.2 },
  { g: 'Schreibschrift', n: 'Allura', q: 'Allura', s: 1, k: 1.45 },
  { g: 'Schreibschrift', n: 'Mr Dafoe', q: 'Mr+Dafoe', s: 1, k: 1.3 },
  { g: 'Schreibschrift', n: 'Damion', q: 'Damion', s: 1, k: 1.15 },
  { g: 'Schreibschrift', n: 'Cookie', q: 'Cookie', s: 1, k: 1.3 },
  { g: 'Altdeutsch', n: 'UnifrakturMaguntia', label: 'Fraktur', q: 'UnifrakturMaguntia' },
  { g: 'Altdeutsch', n: 'UnifrakturCook', label: 'Fraktur fett', q: 'UnifrakturCook:wght@700', w: 700, o: 1 },
  { g: 'Altdeutsch', n: 'Pirata One', q: 'Pirata+One', o: 1 },
  { g: 'Altdeutsch', n: 'Grenze Gotisch', q: 'Grenze+Gotisch:wght@500', w: 500 },
  { g: 'Altdeutsch', n: 'Jacquard 24', q: 'Jacquard+24', o: 1 },
  { g: 'Altdeutsch', n: 'New Rocker', q: 'New+Rocker', o: 1 },
  { g: 'Altdeutsch', n: 'Metal Mania', q: 'Metal+Mania', o: 1 },
  { g: 'Altdeutsch', n: 'Germania One', q: 'Germania+One', o: 1 },
  { g: 'Altdeutsch', n: 'Fruktur', q: 'Fruktur', o: 1 },
  { g: 'Altdeutsch', n: 'Texturina', q: 'Texturina:wght@500', w: 500 },
  { g: 'Retro', n: 'Monoton', q: 'Monoton', k: 0.82 },
  { g: 'Retro', n: 'Codystar', q: 'Codystar', k: 0.9 },
  { g: 'Retro', n: 'Megrim', q: 'Megrim' },
  { g: 'Retro', n: 'Faster One', q: 'Faster+One', k: 0.9 },
  { g: 'Retro', n: 'Rampart One', q: 'Rampart+One', k: 0.9 },
  { g: 'Retro', n: 'Londrina Outline', q: 'Londrina+Outline' },
  { g: 'Retro', n: 'Bungee Outline', q: 'Bungee+Outline', k: 0.85 },
  { g: 'Technik', n: 'Orbitron', q: 'Orbitron:wght@500', w: 500, k: 0.85 },
  { g: 'Technik', n: 'Audiowide', q: 'Audiowide', k: 0.85, o: 1 },
  { g: 'Technik', n: 'Michroma', q: 'Michroma', k: 0.8 },
  { g: 'Technik', n: 'Major Mono Display', label: 'Major Mono', q: 'Major+Mono+Display', k: 0.85 },
  { g: 'Technik', n: 'Turret Road', q: 'Turret+Road:wght@400', w: 400 },
  { g: 'Technik', n: 'Zen Dots', q: 'Zen+Dots', k: 0.85, o: 1 },
  { g: 'Technik', n: 'Wallpoet', q: 'Wallpoet', k: 0.85, o: 1 },
  { g: 'Technik', n: 'Black Ops One', q: 'Black+Ops+One', k: 0.9, o: 1 },
];
const famOf = f => '"' + f.n + '", ' + FALL[f.g];
const fontStr = (f, size) => (f.w || 400) + ' ' + size + 'px ' + famOf(f);
const FRAKTUR_IDX = FONTS.findIndex(f => f.n === 'UnifrakturMaguntia'), SCRIPT_IDX = FONTS.findIndex(f => f.n === 'Great Vibes');
const settings = { text: 'NEON WALLS', font: 0, tube: 0, color: 0, broken: 3, flicker: 4, pos: 1 };
const controls = [
  { type: 'text', id: 'text', label: 'Text (bis 24 Zeichen)', max: 60 },
  { type: 'grid', id: 'font', label: 'Schrift', options: FONTS.map(f => ({ label: f.label || f.n, font: famOf(f), weight: f.w, group: f.g })) },
  { type: 'choice', id: 'tube', label: 'Röhre', options: ['Automatisch', 'Gefüllt', 'Umriss'] },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Pink', 'Rot', 'Orange', 'Grün', 'Blau', 'Bunt'] },
  { type: 'range', id: 'broken', label: 'Defekte Buchstaben', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'flicker', label: 'Flackern', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'pos', label: 'Position', options: ['Oben', 'Mitte', 'Unten'] },
];
const COLS = [
  { glow: [255, 45, 190], core: [255, 226, 248], dim: [125, 62, 104] },
  { glow: [255, 42, 42], core: [255, 226, 216], dim: [124, 56, 56] },
  { glow: [255, 132, 30], core: [255, 238, 206], dim: [124, 82, 50] },
  { glow: [50, 255, 120], core: [226, 255, 233], dim: [56, 112, 76] },
  { glow: [50, 160, 255], core: [223, 242, 255], dim: [56, 86, 126] },
];
const BUNT = [0, 4, 3, 2, 1];
const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
// Sonderbuchstaben: mathematische Fraktur und Schreibschrift aus dem Unicode-Block 1D400
const FRAKTUR_RE = /[\u{1D504}-\u{1D537}\u{1D56C}-\u{1D59F}]/u, SCRIPT_RE = /[\u{1D49C}-\u{1D503}]/u;

let W = 1, H = 1, dpr = 1, t = 0, ui = null;
let units = [], fs = 10, block = { x: 0, y: 0, w: 1, h: 1 }, tex = null, wall = null, wallDue = -1, mctx = null;
const fstate = {};

// Zeichen richtig zerlegen: ein sichtbares Zeichen kann aus mehreren Unicode-Teilen bestehen
function graphemes(s) {
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(s), x => x.segment); } catch (e) {}
  return Array.from(s);
}
function cleanText(raw) {
  let s = String(raw || '');
  try { s = s.normalize('NFKC'); } catch (e) {}
  s = s.replace(/\s+/g, ' ').trim();
  return graphemes(s).slice(0, 24).join('').trim();
}

// Schriften laden: Stylesheet je Schrift (ein fehlerhafter Name blockiert so nicht die anderen)
function ensureCss(i) {
  const f = FONTS[i];
  if (fstate[i] || !f) return fstate[i];
  try {
    if (!document.head || !document.fonts) return null;
    fstate[i] = new Promise(res => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + f.q + '&display=swap';
      l.onload = () => res(true); l.onerror = () => res(false);
      document.head.appendChild(l);
    });
  } catch (e) { return null; }
  return fstate[i];
}
function ensureFont(i) {
  const p = ensureCss(i), f = FONTS[i];
  if (!p) return;
  const txt = cleanText(settings.text) || 'Neon';
  p.then(ok => ok ? document.fonts.load(fontStr(f, 64), txt) : null).then(() => { if (settings.font === i) rebuild(true); }, () => {});
}

const measure = (s, size) => { mctx.font = fontStr(FONTS[settings.font], size); return mctx.measureText(s).width; };

// Text in Röhren aufteilen: Schreibschrift wortweise, sonst Zeichen für Zeichen
function layoutText() {
  units = [];
  const txt = cleanText(settings.text);
  if (!txt) return;
  const F = FONTS[settings.font] || FONTS[0], k = F.k || 1, maxW = W * 0.84, cap = Math.min(W * 0.2 * k, H * 0.12 * k);
  let lines = [txt];
  fs = Math.min(cap, maxW / Math.max(1, measure(txt, 100)) * 100);
  if (fs < W * 0.115 * k && txt.indexOf(' ') > 0) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < txt.length; i++) if (txt[i] === ' ') { const d = Math.abs(i - txt.length / 2); if (d < bd) { bd = d; best = i; } }
    lines = [txt.slice(0, best), txt.slice(best + 1)];
    fs = Math.min(cap, ...lines.map(l => maxW / Math.max(1, measure(l, 100)) * 100));
  }
  fs = Math.max(8 * dpr, fs);
  const lh = fs * (F.s ? 1.15 : 1.25), bh = lines.length * lh;
  const cy = [0.3, 0.5, 0.68][settings.pos] * H, top = clamp(cy - bh / 2, H * 0.08, H * 0.92 - bh);
  let bw = 0, word = 0;
  lines.forEach((line, li) => {
    const lw = measure(line, fs), x0 = (W - lw) / 2, base = top + li * lh + fs * 0.85;
    bw = Math.max(bw, lw);
    if (F.s) {
      let start = 0;
      for (const w of line.split(' ')) {
        if (w) units.push({ text: w, x: x0 + measure(line.slice(0, start), fs), y: base, word });
        start += w.length + 1; word++;
      }
    } else {
      let start = 0;
      for (const g of graphemes(line)) {
        if (g === ' ') word++;
        else units.push({ text: g, x: x0 + measure(line.slice(0, start), fs), y: base, word });
        start += g.length;
      }
      word++;
    }
  });
  for (const u of units) Object.assign(u, { lv: 0, tg: 0, seq: [], kind: 'ok' });
  block = { x: (W - bw) / 2, y: top, w: bw, h: bh };
}

function colorOf(u, i, nWords) {
  if (settings.color < 5) return COLS[settings.color];
  return COLS[BUNT[(nWords > 1 ? u.word : i) % BUNT.length]];
}
function makeSprites() {
  const F = FONTS[settings.font] || FONTS[0], font = fontStr(F, fs);
  const outline = settings.tube === 2 || (settings.tube === 0 && F.o);
  const nWords = units.length ? units[units.length - 1].word + 1 : 0, pad = Math.ceil(fs * 0.55), tube = Math.max(1, fs * 0.03);
  units.forEach((u, i) => {
    const C = colorOf(u, i, nWords);
    mctx.font = font;
    const mt = mctx.measureText(u.text);
    const left = isFinite(mt.actualBoundingBoxLeft) ? mt.actualBoundingBoxLeft : fs * 0.05;
    const right = isFinite(mt.actualBoundingBoxRight) ? mt.actualBoundingBoxRight : mt.width;
    const asc = isFinite(mt.actualBoundingBoxAscent) ? mt.actualBoundingBoxAscent : fs * 0.85;
    const desc = isFinite(mt.actualBoundingBoxDescent) ? mt.actualBoundingBoxDescent : fs * 0.3;
    const w = Math.ceil(Math.max(1, left + right) + pad * 2), h = Math.ceil(Math.max(1, asc + desc) + pad * 2), bx = pad + left, by = pad + asc;
    u.ox = -bx; u.oy = -by; u.col = C;
    const on = mk(w, h), x = on.getContext('2d');
    x.font = font; x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.lineCap = 'round';
    if (outline) {
      x.shadowColor = rgba(C.glow, 1); x.shadowBlur = fs * 0.4; x.strokeStyle = rgba(C.glow, 0.55); x.lineWidth = tube * 2.4; x.strokeText(u.text, bx, by);
      x.shadowBlur = fs * 0.12; x.strokeStyle = rgba(C.glow, 0.9); x.lineWidth = tube * 1.5; x.strokeText(u.text, bx, by);
      x.shadowBlur = 0; x.strokeStyle = rgba(C.core, 1); x.lineWidth = Math.max(1, tube * 0.6); x.strokeText(u.text, bx, by);
    } else {
      x.shadowColor = rgba(C.glow, 1); x.shadowBlur = fs * 0.42; x.fillStyle = rgba(C.glow, 0.5); x.fillText(u.text, bx, by);
      x.shadowBlur = fs * 0.14; x.fillStyle = rgba(C.glow, 0.85); x.fillText(u.text, bx, by);
      x.shadowBlur = 0; x.fillStyle = rgba(C.core, 1); x.fillText(u.text, bx, by);
      x.lineWidth = Math.max(1, fs * 0.02); x.strokeStyle = rgba(C.glow, 0.9); x.strokeText(u.text, bx, by);
    }
    const off = mk(w, h), y = off.getContext('2d');
    y.font = font; y.textBaseline = 'alphabetic'; y.lineJoin = 'round'; y.lineCap = 'round';
    if (outline) { y.strokeStyle = rgba(C.dim, 0.55); y.lineWidth = Math.max(1, tube * 0.9); y.strokeText(u.text, bx, by); }
    else {
      y.fillStyle = rgba(C.dim, 0.5); y.fillText(u.text, bx, by);
      y.lineWidth = Math.max(1, fs * 0.012); y.strokeStyle = 'rgba(255,255,255,0.09)'; y.strokeText(u.text, bx, by);
    }
    u.on = on; u.off = off;
  });
}

// Betonwand: einmal als graue Struktur, dann mit dem Licht des Schilds multipliziert
function vnoise(x, y) {
  const h = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function genTexture() {
  const tw = Math.max(1, W >> 2), th = Math.max(1, H >> 2), c = mk(tw, th), x = c.getContext('2d'), img = x.createImageData(tw, th), d = img.data;
  const sc = 2 / (60 * dpr);
  for (let yy = 0; yy < th; yy++) for (let xx = 0; xx < tw; xx++) {
    const n = 0.6 * vnoise(xx * sc * 2, yy * sc * 2) + 0.3 * vnoise(xx * sc * 7 + 9, yy * sc * 7) + 0.1 * vnoise(xx * sc * 25, yy * sc * 25 + 3);
    const v = (0.5 + 0.38 * n + (Math.random() - 0.5) * 0.12) * 255, p = (yy * tw + xx) * 4;
    d[p] = v; d[p + 1] = v; d[p + 2] = v * 1.02; d[p + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  tex = c;
}
function genWall() {
  if (!tex) genTexture();
  const tw = Math.max(1, W >> 1), th = Math.max(1, H >> 1);
  wall = mk(tw, th);
  const x = wall.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, tw, th);
  if (units.length) {
    let r = 0, g = 0, b = 0;
    for (const u of units) { r += u.col.glow[0]; g += u.col.glow[1]; b += u.col.glow[2]; }
    const n = units.length, col = [r / n | 0, g / n | 0, b / n | 0];
    const cx = (block.x + block.w / 2) / 2, cy = (block.y + block.h / 2) / 2, rx = (block.w * 0.62 + fs * 1.2) / 2, ry = (block.h * 0.7 + fs * 1.8) / 2;
    x.save(); x.translate(cx, cy); x.scale(rx / ry, 1);
    const gr = x.createRadialGradient(0, 0, 0, 0, 0, ry * 1.8);
    gr.addColorStop(0, rgba(col, 0.42)); gr.addColorStop(0.35, rgba(col, 0.15)); gr.addColorStop(1, rgba(col, 0));
    x.fillStyle = gr; x.fillRect(-ry * 1.8, -ry * 1.8, ry * 3.6, ry * 3.6);
    x.restore();
    x.globalCompositeOperation = 'multiply'; x.imageSmoothingEnabled = true; x.drawImage(tex, 0, 0, tw, th);
    x.globalCompositeOperation = 'source-over';
  }
}

// Defekte Röhren auswählen
function pickKinds() {
  const n = units.length, k = settings.broken > 0 ? Math.max(1, Math.round(n * settings.broken / 10 * 0.5)) : 0;
  const idx = units.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, k);
  units.forEach(u => { u.kind = 'ok'; u.seq = []; });
  for (const i of idx) units[i].kind = pick(['stutter', 'stutter', 'dead', 'dim', 'buzz']);
}
// Ablauf der Helligkeit einer Röhre als Folge von [Dauer, Helligkeit]
function nextSeq(u) {
  const fl = settings.flicker / 10, s = u.seq;
  switch (u.kind) {
    case 'stutter':
      s.push([rnd(1.2, 6) / (0.4 + fl), 1]);
      for (let k = rint(3, 12); k > 0; k--) s.push([rnd(0.02, 0.08), Math.random() < 0.5 ? rnd(0, 0.15) : rnd(0.6, 1)]);
      break;
    case 'dead':
      s.push([rnd(1.5, 7) / (0.3 + fl), 0.02]);
      if (Math.random() < 0.6) for (let k = rint(2, 8); k > 0; k--) s.push([rnd(0.03, 0.12), Math.random() < 0.55 ? rnd(0.3, 1) : 0]);
      break;
    case 'dim': s.push([rnd(0.04, 0.3), rnd(0.32, 0.5)]); break;
    case 'buzz': s.push([rnd(0.016, 0.05), rnd(0.55, 1)]); break;
    default:
      s.push([rnd(2, 9), 1]);
      if (fl > 0 && Math.random() < fl * 0.35) for (let k = rint(1, 3); k > 0; k--) s.push([rnd(0.025, 0.07), rnd(0.15, 0.6)], [rnd(0.02, 0.06), 1]);
  }
}
function ignite(slow) {
  let tt = t + 0.12;
  units.forEach(u => {
    u.lv = 0; u.seq = [[Math.max(0, tt - t), 0]];
    for (let k = rint(1, 3) + (u.kind !== 'ok' ? rint(1, 4) : 0); k > 0; k--) u.seq.push([rnd(0.03, 0.09), rnd(0.5, 1)], [rnd(0.03, 0.14), 0]);
    if (u.kind === 'dead') u.seq.push([rnd(0.3, 2), 0.02]);
    tt += slow ? rnd(0.05, 0.16) : rnd(0.01, 0.05);
  });
}

function rebuild(keepState) {
  if (!mctx) mctx = mk(4, 4).getContext('2d');
  const old = units;
  layoutText();
  if (keepState && old.length === units.length) units.forEach((u, i) => { u.kind = old[i].kind; u.seq = old[i].seq; u.lv = old[i].lv; });
  else pickKinds();
  makeSprites();
  wallDue = 0.25;
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Einschalten',
  bindUI(api) { ui = api; },
  resize(w, h, d) {
    W = w; H = h; dpr = d; tex = null;
    if (!mctx) { mctx = mk(4, 4).getContext('2d'); FONTS.forEach((_, i) => ensureCss(i)); ensureFont(settings.font); }
    rebuild(true);
  },
  newPattern() { pickKinds(); makeSprites(); wallDue = 0.01; },
  action() { ignite(true); },
  wake() { ignite(true); },
  change(id) {
    if (id === 'broken') { pickKinds(); return; }
    if (id === 'flicker') return;
    if (id === 'text') {
      // Sonderbuchstaben erkannt: passende Schriftgruppe wählen
      const raw = String(settings.text || ''), g = (FONTS[settings.font] || FONTS[0]).g;
      if (FRAKTUR_RE.test(raw) && g !== 'Altdeutsch' && FRAKTUR_IDX >= 0) { settings.font = FRAKTUR_IDX; if (ui) ui.set('font', FRAKTUR_IDX); }
      else if (SCRIPT_RE.test(raw) && g !== 'Schreibschrift' && SCRIPT_IDX >= 0) { settings.font = SCRIPT_IDX; if (ui) ui.set('font', SCRIPT_IDX); }
    }
    if (id === 'font' || id === 'text') ensureFont(settings.font);
    rebuild(id === 'pos' || id === 'color' || id === 'tube');
  },
  frame(ctx, dt) {
    t += dt;
    if (wallDue > 0) { wallDue -= dt; if (wallDue <= 0) genWall(); }
    let sum = 0;
    for (const u of units) {
      if (!u.seq.length) nextSeq(u);
      const s = u.seq[0];
      s[0] -= dt; u.tg = s[1];
      if (s[0] <= 0) u.seq.shift();
      u.lv += (u.tg - u.lv) * Math.min(1, dt * 45);
      sum += u.lv;
    }
    const avg = units.length ? sum / units.length : 0;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (wall) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(avg, 0, 1); ctx.imageSmoothingEnabled = true; ctx.drawImage(wall, 0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const u of units) ctx.drawImage(u.off, u.x + u.ox, u.y + u.oy);
    ctx.globalCompositeOperation = 'lighter';
    for (const u of units) {
      const a = u.kind === 'buzz' ? u.lv * (0.85 + 0.15 * Math.random()) : u.lv;
      if (a < 0.01) continue;
      ctx.globalAlpha = Math.min(1, a); ctx.drawImage(u.on, u.x + u.ox, u.y + u.oy);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
};
