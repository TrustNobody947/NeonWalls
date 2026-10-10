// Röhrenmonitor: Leuchtphosphor mit Nachleuchten, Bildzeilen, Flimmern, Brummbalken, Bildlauf und
// Zeilenrissen. Anzeige wahlweise Oszilloskop, Terminal oder Radar. Beim Entsperren schaltet sich die
// Röhre ein: erst eine Lichtlinie, dann klappt das Bild auf.
const settings = { content: 0, color: 0, scan: 6, persist: 6, flicker: 4, glitch: 4 };
const controls = [
  { type: 'choice', id: 'content', label: 'Anzeige', options: ['Oszilloskop', 'Terminal', 'Radar'] },
  { type: 'choice', id: 'color', label: 'Leuchtfarbe', options: ['Grün', 'Bernstein', 'Blau', 'Weiß'] },
  { type: 'range', id: 'scan', label: 'Bildzeilen', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'persist', label: 'Nachleuchten', min: 1, max: 10, fmt: lvl },
  { type: 'range', id: 'flicker', label: 'Flimmern', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'glitch', label: 'Bildstörungen', min: 0, max: 10, fmt: lvl },
];
const COLS = [[60, 255, 110], [255, 176, 40], [90, 175, 255], [225, 235, 255]];

let W = 1, H = 1, dpr = 1, t = 0, P = null, pc = null, Q = null, qc = null, pw = 1, ph = 1;
let vign = null, scanTile = null, scanPat = null, noiseTile = null, noisePat = null;
let roll = { on: false, age: 0, dur: 1 }, slices = [], power = -1;
let osc = { a0: 3, b0: 2 };
let term = { lines: [], cur: '', target: '', pause: 0, acc: 0 };
let radar = { ang: 0, blips: [] };

const col = a => { const c = COLS[settings.color]; return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (+a).toFixed(3) + ')'; };
const easeOut = q => 1 - Math.pow(1 - q, 3);
const easeInOut = q => q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
const hex = n => Array.from({ length: n }, () => '0123456789ABCDEF'[rint(0, 15)]).join('');

const LINES = [
  () => 'PRÜFE ZEILE ' + rint(1, 2400) + ' ... OK',
  () => 'SPEICHER ' + rint(256, 4096) + 'K FREI',
  () => 'FEHLER 0x' + hex(4) + ': PIXEL ' + rint(0, 1080) + '/' + rint(0, 2400) + ' HÄNGT',
  () => 'HOCHSPANNUNG ' + rnd(24.5, 25.5).toFixed(2) + ' kV  STABIL',
  () => 'ABLENKUNG H ' + rnd(15.6, 15.8).toFixed(3) + ' kHz  V ' + rint(49, 61) + ' Hz',
  () => hex(4) + ': ' + Array.from({ length: 8 }, () => hex(2)).join(' '),
  () => hex(4) + ': ' + Array.from({ length: 8 }, () => hex(2)).join(' '),
  () => '> STARTE DIAGNOSE ...',
  () => 'SIGNAL ' + pick(['GUT', 'SCHWACH', 'RAUSCHEN', 'VERLOREN']) + '  PEGEL ' + rint(10, 99) + '%',
  () => 'ENTMAGNETISIERUNG ... FERTIG',
  () => 'KANAL ' + rint(1, 99) + '  SYNC ' + pick(['OK', 'INSTABIL', 'SUCHE']),
];

function resetContent() {
  if (pc) { pc.globalCompositeOperation = 'source-over'; pc.fillStyle = '#000'; pc.fillRect(0, 0, pw, ph); }
  term = { lines: ['NEON-OS 2.6  BILDSCHIRMTEST', ''], cur: '', target: pick(LINES)(), pause: 0.4, acc: 0 };
  radar.blips = Array.from({ length: rint(5, 8) }, () => ({ r: rnd(0.15, 0.95), a: rnd(0, 6.283), vr: rnd(-0.03, 0.03), va: rnd(-0.05, 0.05) }));
  osc = { a0: rnd(2, 4), b0: rnd(1.5, 3) };
}

function drawOsc(dt) {
  const cx = pw / 2, cy = ph * 0.45, A = pw * 0.36, B = Math.min(ph * 0.2, A * 1.15);
  const a = osc.a0 + 1.5 * Math.sin(t * 0.05), b = osc.b0 + Math.sin(t * 0.037 + 1.3), d = t * 0.55;
  pc.lineWidth = Math.max(1, 0.75 * dpr); pc.strokeStyle = col(0.5); pc.lineJoin = 'round';
  pc.beginPath();
  for (let i = 0; i <= 420; i++) { const u = i / 420 * Math.PI * 4, x = cx + A * Math.sin(a * u + d), y = cy + B * Math.sin(b * u); i ? pc.lineTo(x, y) : pc.moveTo(x, y); }
  pc.stroke();
  // heller Strahlkopf
  const u0 = (t * 1.7) % (Math.PI * 4);
  pc.lineWidth = Math.max(1.5, 1.2 * dpr); pc.strokeStyle = col(0.95); pc.beginPath();
  for (let i = 0; i <= 16; i++) { const u = u0 - 0.16 + i * 0.01, x = cx + A * Math.sin(a * u + d), y = cy + B * Math.sin(b * u); i ? pc.lineTo(x, y) : pc.moveTo(x, y); }
  pc.stroke();
}

function drawTerm(dt) {
  const fs = Math.max(6, Math.round(12.5 * dpr * 0.5)), lh = fs * 1.4, mx = pw * 0.06, top = ph * 0.1;
  const rows = Math.max(3, Math.floor(ph * 0.8 / lh));
  if (term.pause > 0) term.pause -= dt;
  else {
    term.acc += dt * 38;
    while (term.acc >= 1) {
      term.acc -= 1;
      if (term.cur.length < term.target.length) term.cur += term.target[term.cur.length];
      else { term.lines.push(term.cur); term.cur = ''; term.target = pick(LINES)(); term.pause = rnd(0.08, 0.7); term.acc = 0; break; }
    }
    while (term.lines.length > rows - 1) term.lines.shift();
  }
  pc.font = fs + 'px ui-monospace, "Roboto Mono", Menlo, monospace'; pc.textBaseline = 'top'; pc.textAlign = 'left';
  pc.fillStyle = col(0.8);
  term.lines.forEach((l, i) => pc.fillText(l, mx, top + i * lh));
  const y = top + term.lines.length * lh;
  pc.fillText(term.cur, mx, y);
  if ((t * 2.2) % 1 < 0.55) { const w = pc.measureText(term.cur).width; pc.fillRect(mx + w + fs * 0.1, y, fs * 0.55, fs * 0.95); }
}

function drawRadar(dt) {
  const cx = pw / 2, cy = ph * 0.48, R = Math.min(pw, ph) * 0.42, prev = radar.ang;
  radar.ang = (radar.ang + dt * 1.15) % (Math.PI * 2);
  // überstrichene Fläche seit dem letzten Bild füllen, damit die Spur lückenlos bleibt
  let a0 = prev, a1 = radar.ang; if (a1 < a0) a1 += Math.PI * 2;
  pc.fillStyle = col(0.55); pc.beginPath(); pc.moveTo(cx, cy); pc.arc(cx, cy, R, a0 - 0.004, a1); pc.closePath(); pc.fill();
  pc.lineWidth = Math.max(1.5, 1.1 * dpr); pc.strokeStyle = col(0.95);
  pc.beginPath(); pc.moveTo(cx, cy); pc.lineTo(cx + Math.cos(radar.ang) * R, cy + Math.sin(radar.ang) * R); pc.stroke();
  for (const b of radar.blips) {
    b.r += b.vr * dt; b.a += b.va * dt;
    if (b.r < 0.08 || b.r > 0.98) { b.r = rnd(0.2, 0.9); b.a = rnd(0, 6.283); }
    let da = radar.ang - ((b.a % 6.283) + 6.283) % 6.283; if (da < 0) da += 6.283;
    const step = (radar.ang - prev + 6.283) % 6.283;
    if (da <= step + 0.001) {
      const x = cx + Math.cos(b.a) * b.r * R, y = cy + Math.sin(b.a) * b.r * R, r = 2.4 * dpr * 0.5 + 1;
      pc.fillStyle = col(1); pc.beginPath(); pc.arc(x, y, r, 0, Math.PI * 2); pc.fill();
      pc.fillStyle = col(0.3); pc.beginPath(); pc.arc(x, y, r * 2.6, 0, Math.PI * 2); pc.fill();
    }
  }
}

function drawStatic(ctx, br) {
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.lineWidth = Math.max(1, dpr * 0.8);
  if (settings.content === 0) {
    const x0 = W * 0.07, x1 = W * 0.93, cy = H * 0.45, hh = (x1 - x0) * 0.4, y0 = cy - hh, y1 = cy + hh;
    ctx.strokeStyle = col(0.07 * br); ctx.beginPath();
    for (let i = 0; i <= 10; i++) { const x = x0 + (x1 - x0) * i / 10; ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let j = 0; j <= 8; j++) { const y = y0 + (y1 - y0) * j / 8; ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    ctx.strokeStyle = col(0.13 * br); ctx.beginPath();
    for (let i = 0; i <= 50; i++) { const x = x0 + (x1 - x0) * i / 50; ctx.moveTo(x, cy - 3 * dpr); ctx.lineTo(x, cy + 3 * dpr); }
    for (let j = 0; j <= 40; j++) { const y = y0 + (y1 - y0) * j / 40; ctx.moveTo(W / 2 - 3 * dpr, y); ctx.lineTo(W / 2 + 3 * dpr, y); }
    ctx.stroke();
  } else if (settings.content === 2) {
    const cx = W / 2, cy = H * 0.48, R = Math.min(W, H) * 0.42;
    ctx.strokeStyle = col(0.1 * br); ctx.beginPath();
    for (let k = 1; k <= 4; k++) { ctx.moveTo(cx + R * k / 4, cy); ctx.arc(cx, cy, R * k / 4, 0, Math.PI * 2); }
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.strokeStyle = col(0.16 * br); ctx.beginPath();
    for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2, l = k % 6 === 0 ? 12 : 5; ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R - l * dpr), cy + Math.sin(a) * (R - l * dpr)); }
    ctx.stroke();
  }
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Einschalten',
  resize(w, h, d) {
    W = w; H = h; dpr = d;
    pw = Math.max(1, Math.round(W * 0.5)); ph = Math.max(1, Math.round(H * 0.5));
    P = mk(pw, ph); pc = P.getContext('2d'); Q = mk(Math.max(1, W / 8 | 0), Math.max(1, H / 8 | 0)); qc = Q.getContext('2d');
    vign = mk(256, 256); const vc = vign.getContext('2d'), vg = vc.createRadialGradient(128, 128, 50, 128, 128, 182);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.55, 'rgba(0,0,0,0.08)'); vg.addColorStop(1, 'rgba(0,0,0,0.9)');
    vc.fillStyle = vg; vc.fillRect(0, 0, 256, 256);
    const lp = Math.max(3, Math.round(d * 1.5)); scanTile = mk(4, lp); const sc = scanTile.getContext('2d');
    sc.fillStyle = '#000'; sc.fillRect(0, lp - Math.max(1, Math.round(lp * 0.45)), 4, Math.max(1, Math.round(lp * 0.45)));
    noiseTile = mk(96, 96); const nc = noiseTile.getContext('2d'), id = nc.createImageData(96, 96);
    for (let i = 0; i < 96 * 96; i++) { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = Math.random() < 0.15 ? Math.random() * 255 : 0; }
    nc.putImageData(id, 0, 0); scanPat = null; noisePat = null;
    resetContent();
  },
  newPattern() { resetContent(); },
  action() { power = 0; },
  wake() { power = 0; },
  change(id) { if (id === 'content') resetContent(); },
  frame(ctx, dt) {
    t += dt;
    const g = settings.glitch / 10, fk = settings.flicker / 10;
    // Phosphor nachleuchten lassen
    const k = (0.36 - settings.persist * 0.032) * 60 * (settings.content === 2 ? 0.35 : 1);
    pc.globalCompositeOperation = 'source-over'; pc.fillStyle = 'rgba(0,0,0,' + (1 - Math.exp(-k * dt)).toFixed(4) + ')'; pc.fillRect(0, 0, pw, ph);
    pc.globalCompositeOperation = 'lighter';
    if (settings.content === 0) drawOsc(dt); else if (settings.content === 1) drawTerm(dt); else drawRadar(dt);
    pc.globalCompositeOperation = 'source-over';

    // Störungen planen
    if (!roll.on && Math.random() < per(g * 0.05, dt)) roll = { on: true, age: 0, dur: rnd(0.5, 1.1) };
    if (Math.random() < per(g * 0.25, dt)) slices.push({ y: rnd(0, H), h: rnd(0.01, 0.06) * H, dx: (Math.random() < 0.5 ? -1 : 1) * rnd(4, 24) * dpr, life: rnd(0.05, 0.25) });
    let oy = 0;
    if (roll.on) { roll.age += dt; const q = Math.min(1, roll.age / roll.dur); oy = H * easeInOut(q); if (q >= 1) { roll.on = false; oy = 0; } }
    if (g > 0 && Math.random() < per(g * 1.5, dt)) oy += rnd(-2, 2) * dpr;

    let br = 1 - fk * 0.12 * (0.5 + 0.5 * Math.sin(t * 59)) - fk * 0.05 * Math.random();
    if (Math.random() < per(fk * 0.6, dt)) br *= 0.75;

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = col(0.022); ctx.fillRect(0, 0, W, H);
    drawStatic(ctx, br);
    ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = br; ctx.drawImage(P, 0, oy, W, H); if (oy > 0) ctx.drawImage(P, 0, oy - H, W, H);
    qc.globalCompositeOperation = 'copy'; qc.drawImage(P, 0, 0, Q.width, Q.height);
    ctx.globalAlpha = 0.45 * br; ctx.drawImage(Q, 0, oy, W, H); if (oy > 0) ctx.drawImage(Q, 0, oy - H, W, H);
    // Brummbalken
    const hb = H * 0.22, hy = (((t * 0.09) % 1.25) - 0.125) * H, hg = ctx.createLinearGradient(0, hy, 0, hy + hb);
    hg.addColorStop(0, col(0)); hg.addColorStop(0.5, col(0.04 * (1 + fk))); hg.addColorStop(1, col(0));
    ctx.globalAlpha = 1; ctx.fillStyle = hg; ctx.fillRect(0, hy, W, hb);
    // Zeilenrisse
    ctx.globalCompositeOperation = 'source-over';
    slices = slices.filter(s => { s.life -= dt; ctx.drawImage(ctx.canvas, 0, s.y, W, s.h, s.dx, s.y, W, s.h); return s.life > 0; });
    // Bildzeilen, Rauschen, Randabschattung
    if (!scanPat) scanPat = ctx.createPattern(scanTile, 'repeat');
    if (!noisePat) noisePat = ctx.createPattern(noiseTile, 'repeat');
    if (settings.scan > 0) { ctx.globalAlpha = settings.scan / 10 * 0.6; ctx.fillStyle = scanPat; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.02 + g * 0.03;
    const nx = rint(0, 95), ny = rint(0, 95);
    ctx.setTransform(1, 0, 0, 1, nx, ny); ctx.fillStyle = noisePat; ctx.fillRect(-nx, -ny, W, H); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(vign, 0, 0, W, H);
    // Einschalten der Röhre
    if (power >= 0) {
      power += dt; const p = power, cy = H / 2;
      if (p < 0.14) {
        const lw = W * easeOut(p / 0.14);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = col(0.25); ctx.fillRect(W / 2 - lw / 2, cy - 10 * dpr, lw, 20 * dpr);
        ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(W / 2 - lw / 2, cy - 1.5 * dpr, lw, 3 * dpr);
      } else if (p < 0.5) {
        const q = (p - 0.14) / 0.36, bh = Math.max(3 * dpr, H * easeOut(q));
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Math.max(0, cy - bh / 2)); ctx.fillRect(0, cy + bh / 2, W, Math.max(0, H - cy - bh / 2));
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col(0.35 * (1 - q)); ctx.fillRect(0, cy - bh / 2, W, bh);
      } else if (p < 1.1) {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col(0.12 * (1 - (p - 0.5) / 0.6)); ctx.fillRect(0, 0, W, H);
      } else power = -1;
      ctx.globalCompositeOperation = 'source-over';
    }
  },
};
