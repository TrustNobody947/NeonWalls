// Leuchtreklame: ein eigener Text als Neonschild an einer dunklen Betonwand. Jeder Buchstabe ist eine eigene Röhre:
// gesunde leuchten ruhig, defekte stottern, glimmen nur schwach, brummen oder fallen ganz aus.
// Beim Entsperren zündet das Schild Buchstabe für Buchstabe, mit dem typischen Flackern beim Einschalten.
const settings = { text: 'NEON WALLS', font: 0, color: 0, broken: 3, flicker: 4, pos: 1 };
const controls = [
  { type: 'text', id: 'text', label: 'Text', max: 20 },
  { type: 'choice', id: 'font', label: 'Schrift', options: ['Klar', 'Schreibschrift', 'Retro'] },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Pink', 'Rot', 'Orange', 'Grün', 'Blau', 'Bunt'] },
  { type: 'range', id: 'broken', label: 'Defekte Buchstaben', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'flicker', label: 'Flackern', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'pos', label: 'Position', options: ['Oben', 'Mitte', 'Unten'] },
];
// Schriften kommen von Google Fonts; bis sie geladen sind, springt eine Systemschrift ein
const FONTS = [
  { fam: '"Tilt Neon", system-ui, Roboto, "Segoe UI", sans-serif', name: '"Tilt Neon"', k: 1 },
  { fam: '"Neonderthaw", "Segoe Script", "Brush Script MT", cursive', name: '"Neonderthaw"', k: 1.45 },
  { fam: '"Monoton", Impact, "Arial Black", sans-serif', name: '"Monoton"', k: 0.82 },
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

let W = 1, H = 1, dpr = 1, t = 0;
let letters = [], fs = 10, block = { x: 0, y: 0, w: 1, h: 1 }, tex = null, wall = null, wallDue = -1, fontTries = 0;
let kinds = [], mctx = null;

function loadFonts() {
  try {
    if (!document.head || !document.fonts || !document.createElement) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Monoton&family=Neonderthaw&family=Tilt+Neon&display=swap';
    const ready = () => Promise.all(FONTS.map(f => document.fonts.load('64px ' + f.name, 'NEON walls'))).then(() => { fontTries++; rebuild(true); }, () => {});
    l.onload = ready;
    document.head.appendChild(l);
    // Sicherheitsnetz, falls das Laden der Schriften länger dauert
    setTimeout(() => rebuild(true), 2500);
  } catch (e) {}
}

function measure(s, size) { mctx.font = size + 'px ' + FONTS[settings.font].fam; return mctx.measureText(s).width; }

function layoutText() {
  letters = [];
  const txt = String(settings.text || '').replace(/\s+/g, ' ').trim();
  if (!txt) return;
  const F = FONTS[settings.font], maxW = W * 0.84, cap = Math.min(W * 0.2 * F.k, H * 0.12 * F.k);
  let lines = [txt];
  fs = Math.min(cap, maxW / Math.max(1, measure(txt, 100)) * 100);
  if (fs < W * 0.115 * F.k && txt.indexOf(' ') > 0) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < txt.length; i++) if (txt[i] === ' ') { const d = Math.abs(i - txt.length / 2); if (d < bd) { bd = d; best = i; } }
    lines = [txt.slice(0, best), txt.slice(best + 1)];
    fs = Math.min(cap, ...lines.map(l => maxW / Math.max(1, measure(l, 100)) * 100));
  }
  fs = Math.max(8 * dpr, fs);
  const lh = fs * (settings.font === 1 ? 1.05 : 1.2), bh = lines.length * lh;
  const cy = [0.3, 0.5, 0.68][settings.pos] * H, top = clamp(cy - bh / 2, H * 0.08, H * 0.92 - bh);
  let bw = 0, li = 0, word = 0;
  for (const line of lines) {
    const lw = measure(line, fs), x0 = (W - lw) / 2, base = top + li * lh + fs * 0.82;
    bw = Math.max(bw, lw);
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === ' ') { word++; continue; }
      letters.push({ ch, x: x0 + measure(line.slice(0, i), fs), y: base, w: measure(ch, fs), word, lv: 0, tg: 0, seq: [], kind: 'ok', ig: -1 });
    }
    word++; li++;
  }
  block = { x: (W - bw) / 2, y: top, w: bw, h: bh };
}

function colorOf(L, i, nWords) {
  if (settings.color < 5) return COLS[settings.color];
  return COLS[BUNT[(nWords > 1 ? L.word : i) % BUNT.length]];
}
function makeSprites() {
  const nWords = letters.length ? letters[letters.length - 1].word + 1 : 0, F = FONTS[settings.font];
  const pad = Math.ceil(fs * 0.55), over = Math.ceil(fs * (settings.font === 1 ? 0.45 : 0.12));
  letters.forEach((L, i) => {
    const C = colorOf(L, i, nWords), w = Math.ceil(L.w + pad * 2 + over * 2), h = Math.ceil(fs * 1.6 + pad * 2);
    const bx = pad + over, by = pad + fs * 1.1;
    L.ox = -bx; L.oy = -by; L.col = C;
    const on = mk(w, h), x = on.getContext('2d');
    x.font = fs + 'px ' + F.fam; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    x.shadowColor = rgba(C.glow, 1); x.shadowBlur = fs * 0.42; x.fillStyle = rgba(C.glow, 0.5); x.fillText(L.ch, bx, by);
    x.shadowBlur = fs * 0.14; x.fillStyle = rgba(C.glow, 0.85); x.fillText(L.ch, bx, by);
    x.shadowBlur = 0; x.fillStyle = rgba(C.core, 1); x.fillText(L.ch, bx, by);
    x.lineWidth = Math.max(1, fs * 0.02); x.strokeStyle = rgba(C.glow, 0.9); x.strokeText(L.ch, bx, by);
    const off = mk(w, h), y = off.getContext('2d');
    y.font = x.font; y.textBaseline = 'alphabetic'; y.lineJoin = 'round';
    y.fillStyle = rgba(C.dim, 0.5); y.fillText(L.ch, bx, by);
    y.lineWidth = Math.max(1, fs * 0.012); y.strokeStyle = 'rgba(255,255,255,0.09)'; y.strokeText(L.ch, bx, by);
    L.on = on; L.off = off;
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
  if (letters.length) {
    let r = 0, g = 0, b = 0;
    for (const L of letters) { r += L.col.glow[0]; g += L.col.glow[1]; b += L.col.glow[2]; }
    const n = letters.length, col = [r / n | 0, g / n | 0, b / n | 0];
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

// Defekte Buchstaben auswählen
function pickKinds() {
  const n = letters.length, k = settings.broken > 0 ? Math.max(1, Math.round(n * settings.broken / 10 * 0.5)) : 0;
  kinds = letters.map(() => 'ok');
  const idx = letters.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, k);
  for (const i of idx) kinds[i] = pick(['stutter', 'stutter', 'dead', 'dim', 'buzz']);
  letters.forEach((L, i) => { L.kind = kinds[i]; L.seq = []; });
}
// Ablauf der Helligkeit eines Buchstabens als Folge von [Dauer, Helligkeit]
function nextSeq(L) {
  const fl = settings.flicker / 10, s = L.seq;
  switch (L.kind) {
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
  letters.forEach((L, i) => {
    L.lv = 0; L.seq = [[Math.max(0, tt - t), 0]];
    for (let k = rint(1, 3) + (L.kind !== 'ok' ? rint(1, 4) : 0); k > 0; k--) L.seq.push([rnd(0.03, 0.09), rnd(0.5, 1)], [rnd(0.03, 0.14), 0]);
    if (L.kind === 'dead') L.seq.push([rnd(0.3, 2), 0.02]);
    tt += slow ? rnd(0.05, 0.16) : rnd(0.01, 0.05);
  });
}

function rebuild(keepState) {
  if (!mctx) mctx = mk(4, 4).getContext('2d');
  const old = letters;
  layoutText();
  if (keepState && old.length === letters.length) letters.forEach((L, i) => { L.kind = old[i].kind; L.seq = old[i].seq; L.lv = old[i].lv; });
  else pickKinds();
  makeSprites();
  wallDue = 0.25;
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Einschalten',
  resize(w, h, d) { W = w; H = h; dpr = d; tex = null; if (!mctx) { mctx = mk(4, 4).getContext('2d'); loadFonts(); } rebuild(true); },
  newPattern() { pickKinds(); makeSprites(); wallDue = 0.01; },
  action() { ignite(true); },
  wake() { ignite(true); },
  change(id) {
    if (id === 'broken') { pickKinds(); return; }
    if (id === 'flicker') return;
    rebuild(id === 'pos' || id === 'color');
  },
  frame(ctx, dt) {
    t += dt;
    if (wallDue > 0) { wallDue -= dt; if (wallDue <= 0) genWall(); }
    let sum = 0;
    for (const L of letters) {
      if (!L.seq.length) nextSeq(L);
      const s = L.seq[0];
      s[0] -= dt; L.tg = s[1];
      if (s[0] <= 0) L.seq.shift();
      L.lv += (L.tg - L.lv) * Math.min(1, dt * 45);
      sum += L.lv;
    }
    const avg = letters.length ? sum / letters.length : 0;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (wall) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(avg, 0, 1); ctx.imageSmoothingEnabled = true; ctx.drawImage(wall, 0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const L of letters) ctx.drawImage(L.off, L.x + L.ox, L.y + L.oy);
    ctx.globalCompositeOperation = 'lighter';
    for (const L of letters) {
      const a = L.kind === 'buzz' ? L.lv * (0.85 + 0.15 * Math.random()) : L.lv;
      if (a < 0.01) continue;
      ctx.globalAlpha = Math.min(1, a); ctx.drawImage(L.on, L.x + L.ox, L.y + L.oy);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
};
