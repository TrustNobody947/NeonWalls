// Pegelanzeige: LED-Segmente wie an einer alten Stereoanlage. Ein erfundener Song (Bassdrum, Snare, Hi-Hats, Bass, Melodie, Flächen)
// läuft im eingestellten Tempo und wechselt alle paar Takte zwischen Intro, Hauptteil, Breakdown, Aufbau und Drop.
// Dunkle Segmente bleiben schwach sichtbar, oben halten kleine Spitzenwerte kurz die Stellung.
// Beim Entsperren macht die Anzeige zuerst einen Selbsttest wie beim Einschalten eines Verstärkers.
const settings = { tempo: 5, gain: 6, style: 0, bands: 16, color: 0, peaks: 0, pos: 1 };
const bpmOf = v => 80 + (v - 1) * 8;
const controls = [
  { type: 'range', id: 'tempo', label: 'Tempo', min: 1, max: 10, fmt: v => bpmOf(v) + ' BPM' },
  { type: 'range', id: 'gain', label: 'Lautstärke', min: 1, max: 10, fmt: lvl },
  { type: 'choice', id: 'style', label: 'Anzeige', options: ['Balken', 'Spiegel', 'Stereo'] },
  { type: 'range', id: 'bands', label: 'Bänder', min: 8, max: 32, step: 4, fmt: v => String(v) },
  { type: 'choice', id: 'color', label: 'Farbe', options: ['Klassisch', 'Cyan', 'Pink', 'Bernstein', 'Regenbogen'] },
  { type: 'choice', id: 'peaks', label: 'Spitzenwerte', options: ['An', 'Aus'] },
  { type: 'choice', id: 'pos', label: 'Position', options: ['Mitte', 'Unten'] },
];
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
  cells = []; labels = [];
  const st = settings.style, bottom = settings.pos === 1;
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
  for (const c of cells) c.col = settings.color === 0 && settings.style === 2 ? (c.red ? [255, 52, 42] : c.p > 0.7 ? [255, 214, 40] : [60, 255, 95]) : segColor(c.p, c.b / Math.max(1, nb - 1));
  // dunkle Segmente einmal vorzeichnen
  unlit = mk(W, H);
  const x = unlit.getContext('2d'), r = Math.min(segW, segH) * 0.18;
  for (const c of cells) {
    x.fillStyle = 'rgba(' + ckey(c.col) + ',0.09)';
    x.beginPath(); roundRect(x, c.x, c.y, segW, segH, r); x.fill();
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
  const c = mk(segW + pad * 2, segH + pad * 2), x = c.getContext('2d'), r = Math.min(segW, segH) * 0.18;
  x.shadowColor = 'rgba(' + k + ',0.9)'; x.shadowBlur = pad * 0.75;
  x.fillStyle = 'rgb(' + k + ')'; x.beginPath(); roundRect(x, pad, pad, segW, segH, r); x.fill();
  x.shadowBlur = 0;
  const g = x.createLinearGradient(0, pad, 0, pad + segH);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); roundRect(x, pad, pad, segW, segH, r); x.fill();
  sprites[k] = c;
  return c;
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Bass-Drop',
  resize(w, h, d) { W = w; H = h; dpr = d; if (!song) newSong(); layout(); },
  newPattern() { newSong(); voices = []; },
  action() {
    drop = 1;
    for (let k = 0; k < 6; k++) hit('kick', 1.2, 0.06, 0.4, 0.12);
    hit('snare', 1, 0.5, 0.5, 0.45); hit('ohat', 0.9, 0.85, 0.5, 0.2);
  },
  wake() { test = 0; voices = []; },
  change(id) { if (id !== 'tempo' && id !== 'gain') layout(); },
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
    const n = settings.style === 2 ? 2 : nb;
    let total = 0;
    if (!lv && settings.style === 2) {
      for (let i = 0; i < 16; i++) total += spectrum((i + 0.5) / 16);
      total = total / 16 * g;
    }
    for (let i = 0; i < n; i++) {
      let target;
      if (lv) target = lv(i);
      else if (settings.style === 2) {
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
      else if (hold[i] > 0) hold[i] -= dt; else peak[i] = Math.max(0, peak[i] - dt * 0.55);
    }

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(unlit, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cells) {
      const lit = Math.floor(disp[c.b] * nseg + 0.25), pk = settings.peaks === 0 && test < 0 ? Math.min(nseg - 1, Math.floor(peak[c.b] * nseg - 0.25)) : -1;
      if (c.s < lit || (c.s === pk && pk >= lit)) {
        ctx.globalAlpha = c.s === pk && pk >= lit ? 0.85 : 1;
        ctx.drawImage(sprite(c.col), c.x - pad, c.y - pad);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
};
