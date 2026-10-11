// Pegelanzeige. Ein erfundener Song (Bassdrum, Snare, Hi-Hats, Bass, Melodie, Flächen) läuft im eingestellten Tempo und
// wechselt alle paar Takte zwischen Intro, Hauptteil, Breakdown, Aufbau und Drop.
// "3D schwebend": leuchtende Glasblöcke schweben als Säulen über einem schwarzen Spiegelboden. Nach oben lösen sich die
// Säulen in der Luft auf, Spitzenwerte steigen als Glut auf und verglühen, bei Schlägen sprühen Funken nach oben.
// Darunter liegt die Spiegelung im Boden mit farbigen Lichtflecken, die Kamera schwenkt langsam um die Säulen.
// Klassisch: LED-Segmente wie an einer alten Stereoanlage (Balken, Spiegel, Stereo).
// Beim Entsperren macht die Anzeige zuerst einen Selbsttest wie beim Einschalten eines Verstärkers.
//#include camera.js
const settings = { tempo: 5, gain: 6, style: 0, bands: 16, color: 0, peaks: 0, sparks: 6, cam: 5, pos: 1, after: 5, mirror: 0, video: 0 };
const bpmOf = v => 80 + (v - 1) * 8;
const controls = [
  { type: 'range', id: 'tempo', label: 'Tempo', min: 1, max: 10, fmt: v => bpmOf(v) + ' BPM' },
  { type: 'range', id: 'gain', label: 'Lautstärke', min: 1, max: 10, fmt: lvl },
  { type: 'choice', id: 'style', label: 'Anzeige', options: ['3D schwebend', 'Balken', 'Spiegel', 'Stereo'] },
  { type: 'range', id: 'bands', label: 'Bänder', min: 8, max: 32, step: 4, fmt: v => String(v) },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Klassisch', 'Cyan', 'Pink', 'Bernstein', 'Regenbogen'] },
  { type: 'choice', id: 'peaks', label: 'Spitzenwerte', options: ['An', 'Aus'] },
  { type: 'range', id: 'sparks', label: 'Funken (3D)', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'cam', label: 'Kamerafahrt (3D)', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'pos', label: 'Position', options: ['Mitte', 'Unten'] },
  { type: 'range', id: 'after', label: 'Nachleuchten', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'mirror', label: 'Spiegelung', options: ['An', 'Aus'] },
  { type: 'choice', id: 'video', label: 'Kamera-Look (3D)', options: ['An', 'Aus'] },
];
const cam = makeCamera();
const MONO = 'ui-monospace, "Roboto Mono", Menlo, monospace';
const lerpC = (a, b, k) => [a[0] + (b[0] - a[0]) * k | 0, a[1] + (b[1] - a[1]) * k | 0, a[2] + (b[2] - a[2]) * k | 0];
const hsl2rgb = (h, s, l) => {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255 | 0, f(8) * 255 | 0, f(4) * 255 | 0];
};
// Farbe eines Segments: p = Höhe im Balken (0 unten, 1 oben), b = Band (0..1)
function segColor(p, b) {
  switch (settings.color) {
    case 0: return p < 0.6 ? [60, 255, 95] : p < 0.85 ? [255, 214, 40] : [255, 52, 42];
    case 1: return p < 0.8 ? lerpC([30, 120, 255], [60, 245, 255], p / 0.8) : lerpC([60, 245, 255], [220, 255, 255], (p - 0.8) / 0.2);
    case 2: return p < 0.7 ? lerpC([150, 50, 255], [255, 50, 190], p / 0.7) : lerpC([255, 50, 190], [255, 190, 240], (p - 0.7) / 0.3);
    case 3: return p < 0.85 ? lerpC([255, 120, 10], [255, 190, 60], p / 0.85) : [255, 236, 170];
    default: return hsl2rgb((b * 300 + 340) % 360, 1, p > 0.92 ? 0.75 : 0.56);
  }
}
const ckey = c => c[0] + ',' + c[1] + ',' + c[2];

let W = 1, H = 1, dpr = 1, t = 0;
let nb = 16, nseg = 18, cells = [], unlit = null, sprites = {}, segW = 1, segH = 1, pad = 1, labels = [];
let glowLv = new Float32Array(1), floorY = -1, fx0 = 0, fx1 = 0, refl = null, rx = null;
let disp = new Float32Array(64), peak = new Float32Array(64), hold = new Float32Array(64), flut = new Float32Array(64);
let beat = 0, lastStep = -1, voices = [], song = null, test = -1, drop = 0, curSec = 'main', bed = 0, pump = 1;
const BED = { intro: 0.1, main: 0.2, break: 0.17, build: 0.2, drop: 0.28 };

// ---------- Song ----------
function newSong() {
  const prog = pick([[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 3], [0, 4, 5, 3]]);
  song = {
    prog, kickVar: Math.random() < 0.5, bassRh: pick([[0, 3, 6, 8, 11, 14], [0, 2, 4, 8, 10, 12], [0, 6, 8, 14]]),
    lead: Array.from({ length: 16 }, () => Math.random() < 0.7 ? rint(0, 7) : -1), tilt: rnd(-0.15, 0.15), barOff: pick([4, 8]),
  };
}
const SCALE = [0, 2, 3, 5, 7, 8, 10, 12];
const noteX = (deg, oct, base) => base + (SCALE[((deg % 8) + 8) % 8] + oct * 12) / 12 * 0.11;
function hit(type, vel, x, dec, w) { voices.push({ type, t0: t, vel, x: x || 0, dec, w: w || 0.05 }); }
function section(bar) { const b = (bar + song.barOff) % 32; return b < 4 ? 'intro' : b < 16 ? 'main' : b < 20 ? 'break' : b < 24 ? 'build' : 'drop'; }
function onStep(step) {
  const bar = (step / 16) | 0, s = step % 16, sec = section(bar), root = song.prog[bar % 4], bIn = ((bar + song.barOff) % 32);
  curSec = sec;
  const kick = sec === 'intro' || sec === 'main' || sec === 'drop';
  if (kick && (s % 4 === 0 || (song.kickVar && s === 14 && bar % 2))) hit('kick', 1, 0.07, 0.17, 0.07);
  if ((sec === 'main' || sec === 'drop') && (s === 4 || s === 12)) hit('snare', 0.85, 0.48, 0.18, 0.28);
  if (sec === 'build') {
    const k = bIn - 20, every = k < 1 ? 4 : k < 2 ? 2 : 1;
    if (s % every === 0) hit('snare', 0.35 + 0.15 * k + 0.04 * s / 16 * k, 0.5 + 0.03 * k, 0.1, 0.25);
  }
  if (sec !== 'break' && (s % 2 === 0 || sec === 'drop')) hit('hat', s % 4 === 2 ? 0.75 : 0.45, 0.9, 0.05, 0.08);
  if (sec === 'drop' && s % 4 === 2) hit('ohat', 0.6, 0.84, 0.22, 0.13);
  if ((sec === 'main' || sec === 'drop') && song.bassRh.indexOf(s) >= 0) hit('bass', 0.8, noteX(root, 0, 0.1), 0.22, 0.035);
  if ((sec === 'break' || sec === 'drop' || (sec === 'main' && bar % 2)) && song.lead[s] >= 0) hit('lead', 0.6, noteX(root + song.lead[s], 0, 0.36), 0.16, 0.03);
  if (s === 0 && (sec === 'break' || sec === 'intro' || sec === 'build')) hit('pad', 0.5, noteX(root, 0, 0.3), 1.6, 0.18);
}
// Pegel eines Bandes an der Frequenzstelle x (0 = tief, 1 = hoch)
function spectrum(x) {
  let v = 0;
  for (const o of voices) {
    const e = o.vel * Math.exp(-(t - o.t0) / o.dec);
    if (o.type === 'kick') { const c = o.x - Math.min(0.04, (t - o.t0) * 0.3); v += e * Math.exp(-Math.pow((x - c) / o.w, 2)) * 1.05; }
    else if (o.type === 'snare') v += e * (0.55 * Math.exp(-Math.pow((x - o.x) / o.w, 2)) + 0.25 * Math.random() * (x > 0.25 ? 1 : 0.3));
    else if (o.type === 'hat' || o.type === 'ohat') v += e * Math.exp(-Math.pow((x - o.x) / o.w, 2)) * (0.7 + 0.3 * Math.random());
    else if (o.type === 'pad') { const sw = 0.5 + 0.5 * Math.sin((t - o.t0) * 2); v += 0.32 * o.vel * Math.min(1, (t - o.t0) * 3) * Math.exp(-(t - o.t0) / o.dec) * Math.exp(-Math.pow((x - o.x) / o.w, 2)) * (0.8 + 0.2 * sw); }
    else { // tonale Stimmen mit Obertönen
      v += e * (Math.exp(-Math.pow((x - o.x) / o.w, 2)) + 0.45 * Math.exp(-Math.pow((x - o.x - 0.11) / o.w, 2)) + 0.25 * Math.exp(-Math.pow((x - o.x - 0.18) / o.w, 2)));
    }
  }
  // breites Klangbett, das im Takt der Bassdrum pumpt
  v += bed * pump * Math.exp(-Math.pow((x - 0.42) / 0.33, 2));
  return v * (1 + song.tilt * (x - 0.5) * 2);
}

// ---------- Aufbau der Anzeige ----------
function layout() {
  cells = []; labels = []; floorY = -1;
  if (settings.style === 0) { layout3(); return; }
  const st = settings.style - 1, bottom = settings.pos === 1;
  if (st === 2) { // Stereo: zwei waagerechte Reihen
    nb = 2; nseg = 30;
    const x0 = W * 0.12, x1 = W * 0.92, cw = (x1 - x0) / nseg, cy = H * (bottom ? 0.74 : 0.55), rh = Math.max(4 * dpr, H * 0.022);
    segW = cw * 0.72; segH = rh;
    for (let ch = 0; ch < 2; ch++) {
      const y = cy + (ch ? 1 : -1) * rh * 1.15 - rh / 2;
      for (let s = 0; s < nseg; s++) cells.push({ b: ch, s, x: x0 + s * cw + (cw - segW) / 2, y, p: s / (nseg - 1), red: s >= 24 });
      labels.push({ text: ch ? 'R' : 'L', x: x0 - cw * 1.1, y: y + rh / 2, align: 'right' });
    }
    for (const db of [-20, -10, -7, -5, -3, -1, 0, 1, 3]) {
      const s = Math.round((db + 24) / 28 * (nseg - 1));
      labels.push({ text: (db > 0 ? '+' : '') + db, x: x0 + s * cw + cw / 2, y: cy + rh * 2.3 + 6 * dpr, align: 'center' });
    }
    labels.push({ text: 'dB', x: x1 + cw * 0.3, y: cy + rh * 2.3 + 6 * dpr, align: 'left' });
  } else {
    nb = settings.bands;
    const x0 = W * 0.07, x1 = W * 0.93, cw = (x1 - x0) / nb;
    segW = cw * 0.76;
    if (st === 0) {
      nseg = 18;
      const y1 = H * (bottom ? 0.88 : 0.7), y0 = y1 - H * 0.36, rh = (y1 - y0) / nseg;
      segH = rh * 0.68;
      for (let b = 0; b < nb; b++) for (let s = 0; s < nseg; s++) cells.push({ b, s, x: x0 + b * cw + (cw - segW) / 2, y: y1 - (s + 1) * rh + (rh - segH) / 2, p: s / (nseg - 1) });
      floorY = y1 + rh * 0.2; fx0 = x0 - cw; fx1 = x1 + cw;
    } else {
      nseg = 11;
      const cy = H * (bottom ? 0.7 : 0.52), rh = H * 0.19 / nseg;
      segH = rh * 0.66;
      for (let b = 0; b < nb; b++) for (let s = 0; s < nseg; s++) for (const dir of [-1, 1]) {
        const off = (s + 0.5) * rh + rh * 0.15;
        cells.push({ b, s, x: x0 + b * cw + (cw - segW) / 2, y: cy + dir * off - segH / 2, p: s / (nseg - 1) });
      }
    }
  }
  pad = Math.round(Math.min(segW, segH) * 0.9 + 3 * dpr);
  sprites = {};
  for (const c of cells) c.col = settings.color === 0 && settings.style === 3 ? (c.red ? [255, 52, 42] : c.p > 0.7 ? [255, 214, 40] : [60, 255, 95]) : segColor(c.p, c.b / Math.max(1, nb - 1));
  glowLv = new Float32Array(cells.length);
  if (floorY > 0) { refl = mk(W, Math.max(2, Math.ceil(H * 0.17))); rx = refl.getContext('2d'); }
  // dunkle Segmente einmal vorzeichnen: Vertiefung im Gehäuse, dunkle Linse mit Glanz
  unlit = mk(W, H);
  const x = unlit.getContext('2d'), r = Math.min(segW, segH) * 0.22, rim = Math.max(1, Math.round(dpr * 0.9));
  const dk = (c, k, add) => 'rgb(' + Math.round(c[0] * k + add) + ',' + Math.round(c[1] * k + add) + ',' + Math.round(c[2] * k + add) + ')';
  for (const c of cells) {
    x.fillStyle = '#020202'; x.beginPath(); roundRect(x, c.x - rim, c.y - rim, segW + rim * 2, segH + rim * 2, r + rim); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(c.x + r, c.y + segH + rim * 0.4, Math.max(1, segW - r * 2), Math.max(1, rim * 0.6));
    const g = x.createLinearGradient(0, c.y, 0, c.y + segH);
    g.addColorStop(0, dk(c.col, 0.2, 14)); g.addColorStop(0.5, dk(c.col, 0.11, 5)); g.addColorStop(1, dk(c.col, 0.07, 3));
    x.fillStyle = g; x.beginPath(); roundRect(x, c.x, c.y, segW, segH, r); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.beginPath(); roundRect(x, c.x + segW * 0.12, c.y + segH * 0.1, segW * 0.76, Math.max(1, segH * 0.26), r * 0.5); x.fill();
  }
  x.font = Math.round(9 * dpr) + 'px ' + MONO; x.textBaseline = 'middle'; x.fillStyle = 'rgba(200,210,200,0.45)';
  for (const l of labels) { x.textAlign = l.align; x.fillText(l.text, l.x, l.y); }
}
function roundRect(x, a, b, w, h, r) {
  x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r); x.lineTo(a + w, b + h - r);
  x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
  x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
}
// leuchtendes Segment mit Schein, je Farbe einmal vorberechnet
function sprite(col) {
  const k = ckey(col);
  if (sprites[k]) return sprites[k];
  const c = mk(segW + pad * 2, segH + pad * 2), x = c.getContext('2d'), r = Math.min(segW, segH) * 0.22;
  const lift = q => 'rgb(' + Math.round(col[0] + (255 - col[0]) * q) + ',' + Math.round(col[1] + (255 - col[1]) * q) + ',' + Math.round(col[2] + (255 - col[2]) * q) + ')';
  const dim = q => 'rgb(' + Math.round(col[0] * q) + ',' + Math.round(col[1] * q) + ',' + Math.round(col[2] * q) + ')';
  x.shadowColor = 'rgba(' + k + ',0.9)'; x.shadowBlur = pad * 0.75;
  x.fillStyle = 'rgb(' + k + ')'; x.beginPath(); roundRect(x, pad, pad, segW, segH, r); x.fill();
  x.shadowBlur = 0;
  // gewölbte Linse: oben heller, unten satter, in der Mitte ein leuchtender Kern
  const g = x.createLinearGradient(0, pad, 0, pad + segH);
  g.addColorStop(0, lift(0.5)); g.addColorStop(0.45, 'rgb(' + k + ')'); g.addColorStop(1, dim(0.6));
  x.fillStyle = g; x.beginPath(); roundRect(x, pad, pad, segW, segH, r); x.fill();
  const rg = x.createRadialGradient(pad + segW / 2, pad + segH * 0.55, 0, pad + segW / 2, pad + segH * 0.55, Math.max(segW, segH) * 0.6);
  rg.addColorStop(0, 'rgba(255,255,255,0.32)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = rg; x.beginPath(); roundRect(x, pad, pad, segW, segH, r); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); roundRect(x, pad + segW * 0.14, pad + segH * 0.1, segW * 0.72, Math.max(1, segH * 0.22), r * 0.5); x.fill();
  sprites[k] = c;
  return c;
}

// ---------- 3D: schwebende Säulen über einem Spiegelboden ----------
// Welt: x nach rechts, y nach oben, z vom Betrachter weg. Die Säulen stehen in einer Reihe auf z = 0 und schweben über
// dem Boden (y = 0). Alle leuchtenden Teile werden addiert, deshalb ist keine Sortierung nach Tiefe nötig.
const S3 = 16, PY = 0.66, TH3 = 0.46, TD3 = 0.42, Y03 = 0.85, ROWL = 12, D3 = 15;
let px3 = 1, tw3 = 0.7, F3 = 1, CY3 = 0, OX3 = 0, camC = [0, 0, -20], camR = [1, 0, 0], camU = [0, 1, 0], camF = [0, 0, 1];
let spr3 = {}, pool3 = {}, beam3 = {}, tpx = 64, tph = 48, tm = 28, rc = null, rcx = null, rcSX = 1, rcSY = 1;
let cols3 = [], lv3 = new Float32Array(1), sparks = [], embers = [], motes = [], prevDisp = new Float32Array(64), phase3 = [];
const Q = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const rgbaC = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
const liftC = (c, q) => [c[0] + (255 - c[0]) * q, c[1] + (255 - c[1]) * q, c[2] + (255 - c[2]) * q];

function setCam(yaw, el) {
  const ty = Y03 + S3 * PY * 0.5;
  camC = [D3 * Math.sin(yaw) * Math.cos(el), ty + D3 * Math.sin(el), -D3 * Math.cos(yaw) * Math.cos(el)];
  let f = [-camC[0], ty - camC[1], -camC[2]];
  const fl = Math.hypot(f[0], f[1], f[2]); f = [f[0] / fl, f[1] / fl, f[2] / fl];
  const rl = Math.hypot(f[2], f[0]) || 1, r = [f[2] / rl, 0, -f[0] / rl];
  camF = f; camR = r; camU = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
}
function pr(x, y, z, o) {
  const vx = x - camC[0], vy = y - camC[1], vz = z - camC[2];
  const zc = vx * camF[0] + vy * camF[1] + vz * camF[2], iz = F3 / Math.max(0.5, zc);
  o[0] = OX3 + (vx * camR[0] + vy * camR[1] + vz * camR[2]) * iz;
  o[1] = CY3 - (vx * camU[0] + vy * camU[1] + vz * camU[2]) * iz;
  o[2] = iz;
  return o;
}
const YAW0 = -0.5, EL0 = 0.17;
function layout3() {
  nb = settings.bands; nseg = S3;
  px3 = ROWL / nb; tw3 = px3 * 0.7;
  lv3 = new Float32Array(nb * S3);
  cols3 = [];
  for (let b = 0; b < nb; b++) for (let s = 0; s < S3; s++) cols3.push(segColor(s / (S3 - 1), b / Math.max(1, nb - 1)));
  phase3 = Array.from({ length: nb }, () => rnd(0, 6.28));
  // Bildausschnitt: Reihe bei Grundstellung der Kamera mittig und mit Rand einpassen
  setCam(YAW0, EL0); F3 = 1; OX3 = 0; CY3 = 0;
  const a = pr(-ROWL / 2, Y03, 0, [0, 0, 0]), b = pr(ROWL / 2, Y03, 0, [0, 0, 0]);
  const span = Math.abs(b[0] - a[0]) + 2 * px3 * Math.max(a[2], b[2]);
  F3 = W * 0.9 / span;
  const a2 = pr(-ROWL / 2, Y03, 0, [0, 0, 0]), b2 = pr(ROWL / 2, Y03, 0, [0, 0, 0]);
  OX3 = W / 2 - (a2[0] + b2[0]) / 2;
  CY3 = H * (settings.pos === 1 ? 0.56 : 0.47);
  // Auflösung der Sprites: so groß wie das größte Segment auf dem Bildschirm
  const near = Math.max(a2[2], b2[2]);
  tpx = clamp(Math.ceil(near * tw3 * 1.15), 16, 180); tph = clamp(Math.ceil(tpx * TH3 / tw3), 8, 220); tm = Math.ceil(Math.max(tpx, tph) * 0.5);
  spr3 = {}; pool3 = {}; beam3 = {};
  rc = mk(Math.ceil(W / 4), Math.ceil(H / 7)); rcx = rc.getContext('2d'); rcSX = rc.width / W; rcSY = rc.height / H;
  sparks = []; embers = [];
  motes = Array.from({ length: 55 }, () => ({ x: rnd(-ROWL / 2 - 2, ROWL / 2 + 2), y: rnd(0.2, 16), z: rnd(-3, 3), vx: rnd(-0.1, 0.1), vy: rnd(-0.05, 0.12), vz: rnd(-0.1, 0.1), s: rnd(0.5, 1.4) }));
}
// Frontfläche eines leuchtenden Glasblocks mit Schein
function tile3(col) {
  const k = ckey(col);
  if (spr3[k]) return spr3[k];
  const c = mk(tpx + tm * 2, tph + tm * 2), x = c.getContext('2d'), r = Math.min(tpx, tph) * 0.14;
  x.shadowColor = rgbaC(col, 1); x.shadowBlur = tm * 0.7;
  x.fillStyle = rgbaC(col, 0.85); x.beginPath(); roundRect(x, tm, tm, tpx, tph, r); x.fill();
  x.shadowBlur = 0;
  const g = x.createLinearGradient(0, tm, 0, tm + tph);
  g.addColorStop(0, rgbaC(liftC(col, 0.45), 1)); g.addColorStop(0.5, rgbaC(col, 1)); g.addColorStop(1, rgbaC([col[0] * 0.7, col[1] * 0.7, col[2] * 0.7], 1));
  x.fillStyle = g; x.beginPath(); roundRect(x, tm, tm, tpx, tph, r); x.fill();
  const rg = x.createRadialGradient(tm + tpx / 2, tm + tph * 0.5, 0, tm + tpx / 2, tm + tph * 0.5, Math.max(tpx, tph) * 0.55);
  rg.addColorStop(0, 'rgba(255,255,255,0.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = rg; x.beginPath(); roundRect(x, tm, tm, tpx, tph, r); x.fill();
  // Lichtkante wie bei Acrylglas und feiner Glanz oben
  x.lineWidth = Math.max(1, tpx * 0.04); x.strokeStyle = rgbaC(liftC(col, 0.7), 0.95);
  x.beginPath(); roundRect(x, tm + x.lineWidth / 2, tm + x.lineWidth / 2, tpx - x.lineWidth, tph - x.lineWidth, r); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); roundRect(x, tm + tpx * 0.12, tm + tph * 0.1, tpx * 0.76, Math.max(1, tph * 0.14), r * 0.5); x.fill();
  spr3[k] = c;
  return c;
}
// Lichtfleck auf dem Boden und Lichtsäule darüber (je Farbe einmal)
function pool(col) {
  const k = ckey(col);
  if (pool3[k]) return pool3[k];
  const n = 64, c = mk(n, n), x = c.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, rgbaC(col, 0.9)); g.addColorStop(0.35, rgbaC(col, 0.35)); g.addColorStop(1, rgbaC(col, 0));
  x.fillStyle = g; x.fillRect(0, 0, n, n);
  pool3[k] = c;
  return c;
}
function beam(col) {
  const k = ckey(col);
  if (beam3[k]) return beam3[k];
  const w = 32, h = 128, c = mk(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, rgbaC(col, 0.9)); g.addColorStop(0.3, rgbaC(col, 0.35)); g.addColorStop(1, rgbaC(col, 0));
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-in';
  const hz = x.createLinearGradient(0, 0, w, 0);
  hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.5, 'rgba(0,0,0,1)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = hz; x.fillRect(0, 0, w, h);
  beam3[k] = c;
  return c;
}
// Bild (Größe sw x sh, eigentliche Fläche ab m mit Breite fw, Höhe fh) auf ein Viereck aus drei Ecken legen
function mapTo(x, p0, p1, p2, m, fw, fh, sx, sy) {
  const a = (p1[0] - p0[0]) * sx / fw, b = (p1[1] - p0[1]) * sy / fw, c = (p2[0] - p0[0]) * sx / fh, d = (p2[1] - p0[1]) * sy / fh;
  x.setTransform(a, b, c, d, p0[0] * sx - a * m - c * m, p0[1] * sy - b * m - d * m);
}
function quadFill(x, a, b, c, d) {
  x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.lineTo(d[0], d[1]); x.closePath(); x.fill();
}
// Höhe eines Segments: oben lösen sich die Säulen auf und ziehen sich etwas auseinander
const segY = (s, b) => Y03 + s * PY + 0.9 * Math.pow(Math.max(0, s / (S3 - 1) - 0.45), 2) * S3 * PY * 0.35 + 0.1 * Math.sin(t * 0.8 + phase3[b]);
const fadeUp = p => 1 - 0.86 * (p < 0.45 ? 0 : p > 1 ? 1 : (u => u * u * (3 - 2 * u))((p - 0.45) / 0.55));

function spawnSpark(b, y, power) {
  if (sparks.length > 260) return;
  const xb = (b - (nb - 1) / 2) * px3, col = cols3[b * S3 + Math.min(S3 - 1, Math.round(clamp((y - Y03) / (S3 * PY), 0, 1) * (S3 - 1)))];
  sparks.push({ x: xb + rnd(-0.5, 0.5) * tw3, y, z: rnd(-0.5, 0.5) * TD3, vx: rnd(-0.7, 0.7), vy: rnd(2.2, 5.5) * (0.6 + 0.6 * power), vz: rnd(-0.7, 0.7),
    age: 0, life: rnd(0.55, 1.4), col, sz: rnd(0.02, 0.045), ph: rnd(0, 6.28) });
}

function frame3(ctx, dt, lvTest) {
  const a = settings.cam / 10;
  setCam(YAW0 + a * (0.2 * Math.sin(t * 0.07) + 0.05 * Math.sin(t * 0.19 + 2)), EL0 + a * 0.045 * Math.sin(t * 0.09 + 1));
  const vid = settings.video === 0, mir = settings.mirror === 0, spk = settings.sparks / 10;
  const hx = tw3 / 2, hy = TH3 / 2, hz = TD3 / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (mir) { rcx.setTransform(1, 0, 0, 1, 0, 0); rcx.globalCompositeOperation = 'source-over'; rcx.globalAlpha = 1; rcx.fillStyle = '#000'; rcx.fillRect(0, 0, rc.width, rc.height); rcx.globalCompositeOperation = 'lighter'; }
  // Schein im Raum hinter den Säulen
  let sum = 0, cr = 0, cg = 0, cb = 0;
  for (let b = 0; b < nb; b++) { const c = cols3[b * S3 + 5]; sum += disp[b]; cr += c[0] * disp[b]; cg += c[1] * disp[b]; cb += c[2] * disp[b]; }
  const avg = sum / nb, hc = sum > 0 ? [cr / sum, cg / sum, cb / sum] : [0, 0, 0];
  if (avg > 0.01) {
    const m = pr(0, Y03 + S3 * PY * 0.45, 2, Q[0]), R = W * 0.75;
    const g = ctx.createRadialGradient(m[0], m[1], 0, m[0], m[1], R);
    g.addColorStop(0, rgbaC(hc, 0.16 * avg)); g.addColorStop(0.5, rgbaC(hc, 0.05 * avg)); g.addColorStop(1, rgbaC(hc, 0));
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'lighter';
  const decay = Math.exp(-dt / (0.03 + settings.after * 0.045));
  for (let b = 0; b < nb; b++) {
    const xb = (b - (nb - 1) / 2) * px3, lit = Math.floor(disp[b] * S3 + 0.25);
    const pk = settings.peaks === 0 && lvTest < 0 ? Math.min(S3 - 1, Math.floor(peak[b] * S3 - 0.25)) : -1;
    // Lichtfleck auf dem Boden unter der Säule (wird mit der Spiegelung weich gezeichnet)
    if (mir && disp[b] > 0.02) {
      const pc = cols3[b * S3 + 2], R = px3 * 1.9;
      const p0 = pr(xb - R, 0, -R, Q[0]), p1 = pr(xb + R, 0, -R, Q[1]), p2 = pr(xb - R, 0, R, Q[2]);
      rcx.globalAlpha = Math.min(1, 0.55 * disp[b]); mapTo(rcx, p0, p1, p2, 0, 64, 64, rcSX, rcSY); rcx.drawImage(pool(pc), 0, 0);
    }
    // Lichtsäule über dem Balken: das Licht verliert sich in der Luft
    if (disp[b] > 0.05) {
      const top = segY(Math.max(0, lit - 1), b) + hy, bc = cols3[b * S3 + Math.max(0, Math.min(S3 - 1, lit - 1))];
      const L = 3.5 + 3 * disp[b];
      const p0 = pr(xb - hx * 1.3, top + L, 0, Q[0]), p1 = pr(xb + hx * 1.3, top + L, 0, Q[1]), p2 = pr(xb - hx * 1.3, top, 0, Q[2]);
      ctx.globalAlpha = Math.min(1, 0.22 * Math.pow(disp[b], 1.5)); mapTo(ctx, p0, p1, p2, 0, 32, 128, 1, 1); ctx.drawImage(beam(bc), 0, 0);
    }
    for (let s = 0; s < S3; s++) {
      const ci = b * S3 + s, isPk = s === pk && pk >= lit, on = s < lit || isPk;
      const v = on ? (isPk ? 0.9 : 1) : lv3[ci] * decay;
      lv3[ci] = v;
      const p = s / (S3 - 1), fa = fadeUp(p);
      const yc = segY(s, b);
      if (v < 0.015) {
        // ausgeschaltet: nur ein Hauch von Glas im unteren Teil der Säule
        if (p < 0.5) {
          const p0 = pr(xb - hx, yc + hy, -hz, Q[0]), p1 = pr(xb + hx, yc + hy, -hz, Q[1]), p2 = pr(xb - hx, yc - hy, -hz, Q[2]);
          ctx.globalAlpha = 0.045 * (1 - p * 2); mapTo(ctx, p0, p1, p2, tm, tpx, tph, 1, 1); ctx.drawImage(tile3(cols3[ci]), 0, 0);
        }
        continue;
      }
      let al = v * fa;
      if (!on && settings.after > 0) al *= 0.75 + 0.25 * Math.random();
      if (p > 0.55) al *= 0.85 + 0.15 * Math.random();
      const col = cols3[ci];
      // Ecken: vorne oben links/rechts, vorne unten links/rechts, hinten oben links/rechts, hinten unten rechts/links
      const fTL = pr(xb - hx, yc + hy, -hz, Q[0]), fTR = pr(xb + hx, yc + hy, -hz, Q[1]), fBL = pr(xb - hx, yc - hy, -hz, Q[2]), fBR = pr(xb + hx, yc - hy, -hz, Q[3]);
      const bTL = pr(xb - hx, yc + hy, hz, Q[4]), bTR = pr(xb + hx, yc + hy, hz, Q[5]), bBR = pr(xb + hx, yc - hy, hz, Q[6]), bBL = pr(xb - hx, yc - hy, hz, Q[7]);
      // Seiten und Deckel leuchten mit, schwächer als die Front
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (camC[1] > yc + hy) { ctx.globalAlpha = al; ctx.fillStyle = rgbaC(liftC(col, 0.25), 0.55); quadFill(ctx, fTL, fTR, bTR, bTL); }
      else if (camC[1] < yc - hy) { ctx.globalAlpha = al; ctx.fillStyle = rgbaC(col, 0.35); quadFill(ctx, fBL, fBR, bBR, bBL); }
      if (camC[0] > xb + hx) { ctx.globalAlpha = al; ctx.fillStyle = rgbaC(col, 0.38); quadFill(ctx, fTR, bTR, bBR, fBR); }
      else if (camC[0] < xb - hx) { ctx.globalAlpha = al; ctx.fillStyle = rgbaC(col, 0.38); quadFill(ctx, fTL, bTL, bBL, fBL); }
      ctx.globalAlpha = al; mapTo(ctx, fTL, fTR, fBL, tm, tpx, tph, 1, 1); ctx.drawImage(tile3(col), 0, 0);
      // Spiegelung im Boden: gleiche Ansicht, aber an der Bodenebene gespiegelt, je höher desto schwächer
      if (mir) {
        const r0 = pr(xb - hx, -(yc + hy), -hz, Q[0]), r1 = pr(xb + hx, -(yc + hy), -hz, Q[1]), r2 = pr(xb - hx, -(yc - hy), -hz, Q[2]);
        rcx.globalAlpha = Math.min(1, al * 0.5 * Math.exp(-yc / 5)); mapTo(rcx, r0, r1, r2, tm, tpx, tph, rcSX, rcSY); rcx.drawImage(tile3(col), 0, 0);
      }
    }
    // Funken bei schnellem Anstieg und ab und zu bei hohem Pegel
    if (spk > 0 && lvTest < 0) {
      const jump = disp[b] - prevDisp[b], top = segY(Math.max(0, lit - 1), b) + hy;
      if (jump > 0.1) { const n = Math.floor(jump * 9 * spk + Math.random()); for (let k = 0; k < n; k++) spawnSpark(b, top, disp[b]); }
      if (Math.random() < per(spk * 2.2 * Math.pow(disp[b], 4), dt)) spawnSpark(b, top, disp[b]);
    }
    prevDisp[b] = disp[b];
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Glut: gehaltene Spitzenwerte lösen sich, steigen auf und verglühen
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.age += dt; e.vy += 0.5 * dt; e.y += e.vy * dt;
    const k = e.age / e.life;
    if (k >= 1) { embers.splice(i, 1); continue; }
    const xb = (e.b - (nb - 1) / 2) * px3, sc = 1 - 0.6 * k, ex = hx * sc, ey = hy * sc;
    const p0 = pr(xb - ex, e.y + ey, -hz, Q[0]), p1 = pr(xb + ex, e.y + ey, -hz, Q[1]), p2 = pr(xb - ex, e.y - ey, -hz, Q[2]);
    const col = k < 0.5 ? e.col : lerpC(e.col, [255, 90, 30], (k - 0.5) * 2);
    ctx.globalAlpha = (1 - k) * (1 - k) * (0.7 + 0.3 * Math.random()) * 0.9;
    mapTo(ctx, p0, p1, p2, tm, tpx, tph, 1, 1); ctx.drawImage(tile3(col), 0, 0);
    if (mir) {
      const r0 = pr(xb - ex, -(e.y + ey), -hz, Q[0]), r1 = pr(xb + ex, -(e.y + ey), -hz, Q[1]), r2 = pr(xb - ex, -(e.y - ey), -hz, Q[2]);
      rcx.globalAlpha = ctx.globalAlpha * 0.5 * Math.exp(-e.y / 5.5); mapTo(rcx, r0, r1, r2, tm, tpx, tph, rcSX, rcSY); rcx.drawImage(tile3(col), 0, 0);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Funken: steigen mit warmer Luft, werden langsamer, flackern und verglühen von weiß über die Farbe zu dunkelrot
  ctx.lineCap = 'round';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const f = sparks[i];
    f.age += dt;
    if (f.age >= f.life) { sparks.splice(i, 1); continue; }
    const dr = Math.exp(-1.4 * dt);
    f.vx = f.vx * dr + Math.sin(t * 3.1 + f.ph) * 1.2 * dt; f.vz *= dr; f.vy = f.vy * dr + 0.9 * dt;
    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    const k = f.age / f.life, P0 = pr(f.x, f.y, f.z, Q[0]);
    const col = k < 0.15 ? liftC(f.col, 0.8 - k * 4) : k < 0.6 ? f.col : lerpC(f.col, [200, 40, 10], (k - 0.6) / 0.4);
    let al = (1 - k * k) * (0.6 + 0.4 * Math.random());
    if (k > 0.7 && Math.random() < 0.25) al *= 0.2;
    const rr = Math.max(0.6, f.sz * (1 - 0.5 * k) * P0[2]);
    // Leuchtspur: so lang wie der Weg der letzten Hundertstelsekunden (wie bei einer Kamera mit Belichtungszeit)
    const P1 = pr(f.x - f.vx * 0.07, f.y - f.vy * 0.07, f.z - f.vz * 0.07, Q[2]);
    ctx.globalAlpha = al * 0.8; ctx.strokeStyle = rgbaC(col, 1); ctx.lineWidth = rr * 0.9;
    ctx.beginPath(); ctx.moveTo(P1[0], P1[1]); ctx.lineTo(P0[0], P0[1]); ctx.stroke();
    ctx.globalAlpha = al * 0.18; ctx.fillStyle = rgbaC(col, 1); ctx.beginPath(); ctx.arc(P0[0], P0[1], rr * 2.2, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = al; ctx.fillStyle = rgbaC(liftC(col, 0.7), 1); ctx.beginPath(); ctx.arc(P0[0], P0[1], rr * 0.7, 0, 6.2832); ctx.fill();
    if (mir && f.y < 9) {
      const R0 = pr(f.x, -f.y, f.z, Q[1]);
      rcx.setTransform(1, 0, 0, 1, 0, 0); rcx.globalAlpha = al * 0.45 * Math.exp(-f.y / 4);
      rcx.fillStyle = rgbaC(col, 1); rcx.beginPath(); rcx.arc(R0[0] * rcSX, R0[1] * rcSY, Math.max(0.6, rr * 1.4 * rcSX), 0, 6.2832); rcx.fill();
    }
  }
  // Staub in der Luft, nur sichtbar, wo Licht der Säulen hinfällt
  for (const m of motes) {
    m.vx += (Math.random() - 0.5) * 0.2 * dt; m.vy += (Math.random() - 0.5) * 0.2 * dt; m.vz += (Math.random() - 0.5) * 0.2 * dt;
    m.vx *= 0.995; m.vy *= 0.995; m.vz *= 0.995;
    m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
    if (m.y > 16) m.y = 0.3; if (m.y < 0.2) m.y = 15.5;
    if (m.x > ROWL / 2 + 2) m.x = -ROWL / 2 - 2; if (m.x < -ROWL / 2 - 2) m.x = ROWL / 2 + 2;
    if (Math.abs(m.z) > 3) m.vz = -m.vz;
    const b = clamp(Math.round(m.x / px3 + (nb - 1) / 2), 0, nb - 1), xb = (b - (nb - 1) / 2) * px3;
    const lit = disp[b] * S3 * PY + Y03, dy = Math.max(0, m.y - lit), near = Math.exp(-Math.abs(m.x - xb) * 0.5 - Math.abs(m.z) * 0.6 - dy * 0.35);
    const al = 0.5 * disp[b] * near;
    if (al < 0.02) continue;
    const P0 = pr(m.x, m.y, m.z, Q[0]);
    ctx.globalAlpha = Math.min(1, al); ctx.fillStyle = rgbaC(liftC(cols3[b * S3 + 4], 0.5), 1);
    ctx.beginPath(); ctx.arc(P0[0], P0[1], Math.max(0.5, 0.025 * m.s * P0[2]), 0, 6.2832); ctx.fill();
  }
  // Spiegelung weich (nach unten stärker verwischt) dazugeben
  if (mir) {
    rcx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; ctx.drawImage(rc, 0, 0, W, H);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (vid) { cam.bloom(ctx, 0.6, 1); cam.vignette(ctx, 0.5); cam.grain(ctx, 0.03, dpr); }
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Bass-Drop',
  resize(w, h, d) { W = w; H = h; dpr = d; cam.resize(w, h); if (!song) newSong(); layout(); },
  newPattern() { newSong(); voices = []; },
  action() {
    drop = 1;
    for (let k = 0; k < 6; k++) hit('kick', 1.2, 0.06, 0.4, 0.12);
    hit('snare', 1, 0.5, 0.5, 0.45); hit('ohat', 0.9, 0.85, 0.5, 0.2);
  },
  wake() { test = 0; voices = []; },
  change(id) { if (id !== 'tempo' && id !== 'gain' && id !== 'after' && id !== 'mirror' && id !== 'sparks' && id !== 'cam' && id !== 'video') layout(); },
  frame(ctx, dt) {
    t += dt;
    const bpm = bpmOf(settings.tempo), g = 0.55 + settings.gain * 0.07;
    let lv = null;
    if (test >= 0) {
      // Selbsttest: alle Segmente laufen hoch und wieder runter
      test += dt;
      const k = test < 0.6 ? test / 0.6 : test < 0.9 ? 1 : Math.max(0, 1 - (test - 0.9) / 0.5);
      lv = () => k;
      if (test > 1.5) { test = -1; beat = Math.floor(beat / 4 + 1) * 4; lastStep = Math.floor(beat * 4) - 1; }
    } else {
      beat += dt * bpm / 60;
      const step = Math.floor(beat * 4);
      if (step !== lastStep) { for (let s = lastStep + 1; s <= step; s++) if (s >= 0 && s > step - 4) onStep(s); lastStep = step; }
    }
    voices = voices.filter(o => t - o.t0 < o.dec * 6);
    bed += ((test >= 0 ? 0 : BED[curSec]) - bed) * Math.min(1, dt * 1.5);
    let ke = 0; for (const o of voices) if (o.type === 'kick') ke = Math.max(ke, Math.exp(-(t - o.t0) / 0.25));
    pump = 1 - 0.6 * ke;
    drop *= Math.exp(-dt * 2.5);
    const n = settings.style === 3 ? 2 : nb;
    let total = 0;
    if (!lv && settings.style === 3) {
      for (let i = 0; i < 16; i++) total += spectrum((i + 0.5) / 16);
      total = total / 16 * g;
    }
    for (let i = 0; i < n; i++) {
      let target;
      if (lv) target = lv(i);
      else if (settings.style === 3) {
        const pan = 1 + (i ? 1 : -1) * 0.08 * Math.sin(t * 1.3 + i) + (Math.random() - 0.5) * 0.06;
        const e = total * pan * 2.2 + drop * 0.6, db = 20 * Math.log10(Math.max(1e-4, e));
        target = clamp((db + 24) / 28, 0, 1);
      } else {
        flut[i] += (Math.random() - flut[i]) * Math.min(1, dt * 20);
        target = clamp(spectrum((i + 0.5) / nb) * g * (0.88 + 0.24 * flut[i]) + drop * (0.7 - 0.5 * i / nb), 0, 1.02);
      }
      // Anzeige-Trägheit: steigt sofort, fällt gleichmäßig
      disp[i] = target > disp[i] ? target : Math.max(target, disp[i] - dt * 1.7);
      if (disp[i] >= peak[i]) { peak[i] = disp[i]; hold[i] = 0.7; }
      else if (hold[i] > 0) {
        hold[i] -= dt;
        if (hold[i] <= 0 && settings.style === 0 && settings.peaks === 0 && test < 0) {
          // 3D: der gehaltene Spitzenwert löst sich und steigt als Glut auf
          const s = Math.min(S3 - 1, Math.floor(peak[i] * S3 - 0.25));
          if (s >= 2 && embers.length < 60) embers.push({ b: i, y: segY(s, i), vy: rnd(0.6, 1.2), age: 0, life: rnd(0.9, 1.6), col: cols3[i * S3 + s] });
          peak[i] = disp[i];
        }
      }
      else peak[i] = Math.max(0, peak[i] - dt * 0.55);
    }

    if (settings.style === 0) { frame3(ctx, dt, test); return; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(unlit, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    // Nachleuchten: ausgehende Segmente verglimmen und flimmern dabei leicht
    const decay = Math.exp(-dt / (0.03 + settings.after * 0.045));
    for (let ci = 0; ci < cells.length; ci++) {
      const c = cells[ci], lit = Math.floor(disp[c.b] * nseg + 0.25), pk = settings.peaks === 0 && test < 0 ? Math.min(nseg - 1, Math.floor(peak[c.b] * nseg - 0.25)) : -1;
      const isPk = c.s === pk && pk >= lit, on = c.s < lit || isPk;
      const v = on ? (isPk ? 0.85 : 1) : glowLv[ci] * decay;
      glowLv[ci] = v;
      if (v < 0.015) continue;
      ctx.globalAlpha = on ? v : v * (settings.after > 0 ? 0.75 + 0.25 * Math.random() : 1);
      ctx.drawImage(sprite(c.col), c.x - pad, c.y - pad);
    }
    ctx.globalAlpha = 1;
    // Spiegelung auf glänzender Fläche unter den Balken
    if (floorY > 0 && settings.mirror === 0 && refl) {
      const hh = Math.floor(Math.min(refl.height, H - floorY)), x0 = Math.max(0, fx0), w = Math.min(W, fx1) - x0;
      if (hh > 2 && w > 1) {
        rx.save(); rx.globalCompositeOperation = 'copy'; rx.globalAlpha = 1; rx.translate(0, hh); rx.scale(1, -1);
        rx.drawImage(ctx.canvas, x0, floorY - hh, w, hh, x0, 0, w, hh); rx.restore();
        rx.globalCompositeOperation = 'destination-in';
        const fg = rx.createLinearGradient(0, 0, 0, hh);
        fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(0.4, 'rgba(0,0,0,0.35)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
        rx.fillStyle = fg; rx.fillRect(x0, 0, w, hh);
        rx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.28; ctx.drawImage(refl, x0, 0, w, hh, x0, floorY, w, hh); ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};
