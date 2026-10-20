// Broken Screen: flackernde Farbstreifen wie bei einem kaputten Display, dazu echte Glasrisse.
// Das Handy ist an bis zu drei Stellen aufgeschlagen (zufällig an Ecke, Kante oder mitten im Glas, „Neues Muster“
// würfelt neu, oder selbst angetippt: erst die Stelle, dann wohin der Riss laufen soll). Von dort laufen die Risse
// sternförmig übers Bild, auf Wunsch laufen auch Risse waagerecht quer über den Bildschirm. Jeder Riss endet am Rand
// oder an einem anderen Riss (bis zu 23). Manche haben einen Abzweig, an den großen hängen kleine Risse, an den
// Aufschlägen ein kleines Splitternetz. Auf Wunsch werden es mit der Zeit mehr Risse (1–24 Stunden, am Ende großer
// Glitch und von vorn), oder sie wechseln von selbst. Glitch-Ausbrüche dauern 0,3 bis 0,8 Sekunden.
// Die Risse teilen das Display in Bruchstücke: Jedes Stück ist ein wenig versetzt und flackert für sich, die Streifen
// enden genau an der Risskante; bei vielen Streifen fällt ab und zu ein ganzes Stück für ein paar Sekunden aus.
// Der Riss selbst: dunkle Bruchkante mit feinem Glanz daneben (Licht von oben).
// Auf Wunsch werden die Streifen mit der Zeit (1–24 Stunden) oder mit sinkendem Akku mehr; ist die Zeit um, gibt es
// einen großen Glitch und es geht von vorn los. Unter dem Finger flackern die Streifen, dazu kurze Druckstreifen, und
// Bruchstücke blitzen grauweiß flackernd auf, jeweils 0,3 bis 0,7 Sekunden (nie zwei nebeneinander).
// Eigenes Bild: liegt unter allem, zerbricht mit den Rissen (jedes Stück etwas versetzt) und lässt sich abdunkeln.
// Die Uhr ist aus Metall in 3D und liegt im Display: Beim Neigen wandert sie etwas mit, ihre Seitenwände zeigen sich
// und die Spiegelung wandert; die kaputten Streifen laufen über sie, die Risse bleiben fest im Glas.
// Mit Uhr läuft ein Riss mitten durch die Ziffern und weiter übers Bild; die Uhr zerfällt dort in Stücke.
const settings = { cracks: 3, cracksMax: 10, crackGrow: 0, crackHours: 6, impacts: 0, impact: 0, hshare: 30,
  splinter: 1, auto: 0, hours: 6, shear: 5, dark: 5, calm: 4, burst: 5, countPos: 59,
  countMax: 85, growTime: 0, growHours: 6, growBatt: 0, battTest: 0, touchFx: 1, touchFlash: 1,
  rndWake: 0, mutate: 0, bgDim: 40, clockWhere: 2, d3: 5, cy: 15, crack: 5, size: 5, date: 0, finish: 7,
  // selbst angetippt, je Aufschlag: Stelle (px, py) und Richtung (tx, ty) als Anteil von Breite und Höhe
  px: [-1, -1, -1], py: [-1, -1, -1], tx: [-1, -1, -1], ty: [-1, -1, -1] };
const countFromPos = v => Math.round(3 * Math.pow(50, v / 100));
const hoursFmt = v => v + (v == 1 ? ' Stunde' : ' Stunden');
const controls = [
  { type: 'range', id: 'cracks', label: 'Anzahl Risse (von)', min: 0, max: 23, fmt: v => v == 0 ? 'keine' : String(v), focus: true },
  { type: 'range', id: 'cracksMax', label: 'Anzahl Risse bis', min: 0, max: 23, fmt: v => String(v), focus: true },
  { type: 'choice', id: 'crackGrow', label: 'Mehr Risse mit der Zeit', options: ['Aus', 'An'] },
  { type: 'range', id: 'crackHours', label: 'Von „von“ bis „bis“ in', min: 1, max: 24, fmt: hoursFmt },
  { type: 'info', id: 'crackInfo', text: () => crackInfo() },
  { type: 'choice', id: 'impacts', label: 'Aufschläge', options: ['1', '2', '3'] },
  { type: 'choice', id: 'impact', label: 'Aufschlagstelle', options: ['Zufällig', 'Selbst angetippt'] },
  { type: 'range', id: 'hshare', label: 'Waagerechte Risse quer übers Bild', min: 0, max: 100, step: 10, fmt: v => v + ' %', focus: true },
  { type: 'choice', id: 'splinter', label: 'Splitter am Aufschlag', options: ['Aus', 'Wenig', 'Viel'] },
  { type: 'choice', id: 'auto', label: 'Risse wechseln von selbst', options: ['Aus', 'Bei Glitches', 'Nach Stunden'] },
  { type: 'range', id: 'hours', label: 'Wechsel nach Stunden: alle', min: 1, max: 24, fmt: hoursFmt },
  { type: 'range', id: 'shear', label: 'Versatz am Riss', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'dark', label: 'Schwarze Stellen zwischen den Rissen', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'calm', label: 'Grundflackern', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'burst', label: 'Glitch-Ausbrüche', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'countPos', label: 'Anzahl Streifen (von)', min: 0, max: 100, fmt: countFromPos, focus: true },
  { type: 'range', id: 'countMax', label: 'Anzahl Streifen bis', min: 0, max: 100, fmt: countFromPos, focus: true },
  { type: 'choice', id: 'growTime', label: 'Mehr Streifen mit der Zeit', options: ['Aus', 'An'] },
  { type: 'range', id: 'growHours', label: 'Von „von“ bis „bis“ in', min: 1, max: 24, fmt: hoursFmt },
  { type: 'choice', id: 'growBatt', label: 'Mehr Streifen bei sinkendem Akku', options: ['Aus', 'An'] },
  { type: 'range', id: 'battTest', label: 'Akku zum Ausprobieren (nur Vorschau)', min: 0, max: 100, fmt: v => v == 0 ? 'echter Akku' : v + ' %' },
  { type: 'info', id: 'growInfo', text: growInfo },
  { type: 'choice', id: 'touchFx', label: 'Glitch unter dem Finger', options: ['Aus', 'An'] },
  { type: 'choice', id: 'touchFlash', label: 'Bruchstücke leuchten beim Berühren', options: ['Aus', 'An'] },
  { type: 'choice', id: 'rndWake', label: 'Neues Muster bei jedem Einschalten', options: ['Aus', 'An'] },
  { type: 'choice', id: 'mutate', label: 'Glitches verändern das Muster', options: ['Aus', 'An'] },
  { type: 'range', id: 'bgDim', label: 'Eigenes Bild abdunkeln', min: 0, max: 90, step: 5, fmt: v => v + ' %', focus: true },
  { type: 'info', id: 'bgNote', text: () => bgImg ? '' : 'Eigenes Bild: unten auf „Bild wählen“ tippen. Es liegt dann unter Streifen und Rissen.' },
  { type: 'choice', id: 'clockWhere', label: 'Uhr zeigen', options: ['Sperrbild', 'Start', 'Beides', 'Aus'] },
  { type: 'info', id: 'clockNote', text: () => settings.clockWhere < 2 ? 'In der Vorschau ist die Uhr immer zu sehen. Als Hintergrund erscheint sie nur ' + (settings.clockWhere === 0 ? 'auf dem Sperrbildschirm.' : 'auf dem Startbildschirm.') : '' },
  { type: 'range', id: 'd3', label: '3D-Effekt der Uhr (beim Neigen)', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'cy', label: 'Höhe der Uhr (15 = wie Original)', min: 0, max: 100, fmt: v => v + ' %' },
  { type: 'range', id: 'crack', label: 'Riss durch die Uhr', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'size', label: 'Größe der Uhr (5 = wie Original)', min: 1, max: 10, fmt: v => String(v) },
  { type: 'choice', id: 'date', label: 'Datum', options: ['Wie Original', 'Deutsch', 'Aus'] },
  { type: 'grid', id: 'finish', label: 'Oberfläche der Uhr', options: [
    { label: 'Chrom', group: 'Metall' }, { label: 'Gold', group: 'Metall' }, { label: 'Stahlblau', group: 'Metall' },
    { label: 'Roségold', group: 'Metall' }, { label: 'Schwarzchrom', group: 'Metall' }, { label: 'Kupfer', group: 'Metall' },
    { label: 'Neon leuchtend', group: 'Leuchtend' }, { label: 'Weiß', group: 'Wie Original' }] },
];
// alte Einstellungen (ein einzelner angetippter Aufschlag) übernehmen
for (const k of ['px', 'py', 'tx', 'ty']) if (!Array.isArray(settings[k])) settings[k] = [typeof settings[k] === 'number' ? settings[k] : -1, -1, -1];
//#include uhrface.js
//#include metall.js

// ---------- Streifen (wie die abgenommene Version, hier in CSS-Pixeln) ----------
const PAL = [[25, 230, 25], [40, 210, 40], [200, 20, 200], [170, 0, 170], [255, 20, 20], [45, 95, 255], [20, 170, 230], [120, 40, 255], [30, 190, 120], [255, 0, 220]];
let W = 1, H = 1, dpr = 1, Wc = 1, Hc = 1, t = 0, cx = null, frameNo = 0;
let lines = [], burstT = 0, nextBurst = 8, burstZone = 'all', burstPow = 1, curDt = 0.016, curBursting = false, curG = 0.25;
const P = rate => 1 - Math.exp(-rate * curDt);
const jit = () => burstT > 0 && Math.random() < 0.3 ? rnd(0.6, 1.8) : 1;
// Ein Streifen aus einer Zufallsquelle R (gleiche Quelle = gleiche Streifen)
function makeLineR(R, x) {
  const pk = a => a[Math.floor(R() * a.length)];
  const col = R() < 0.5 ? pk(PAL.slice(0, 4)) : pk(PAL);
  const tilt = R() < 0.3 ? -0.012 + R() * 0.024 : 0;
  const q = R(), w = q < 0.3 ? 0.22 + R() * 0.18 : q < 0.87 ? 0.5 + R() * 0.6 : 1.4 + R() * 0.8;
  return { x, tilt, w, col, base: 0.55 + R() * 0.45, flash: 0, flashCol: null, off: 0, frag: null, dotted: R() < 0.45, zones: [], born: -1 };
}
function makeLine(x) { return makeLineR(Math.random, x == null ? Math.random() : x); }

// Vorrat an Streifen in fester Reihenfolge: Sichtbar sind immer die ersten n. Kommen Streifen dazu, bleiben die
// vorhandenen, wie sie sind (das Display geht weiter kaputt, statt ein neues Muster zu zeigen).
let stripeSeed = (Math.random() * 2147483647) | 0, pool = [], baseN = 0;
const POOL = Math.round(countFromPos(100) * 1.12) + 4;
function buildPool() {
  const R = rng(stripeSeed), pk = a => a[Math.floor(R() * a.length)];
  const clusters = Array.from({ length: 2 + Math.floor(R() * 3) }, () => ({ c: 0.1 + R() * 0.85, s: 0.03 + R() * 0.09 }));
  pool = [];
  for (let i = 0; i < POOL; i++) {
    let L;
    if (i >= 3 && R() < 0.107) {
      // Doppellinie dicht neben einem schon vorhandenen Streifen
      const P0 = pool[Math.floor(R() * i)];
      L = makeLineR(R, Math.min(0.995, P0.x + 0.004 + R() * 0.006)); L.col = pk(PAL);
    } else {
      let x;
      if (R() < 0.65) { const cl = pk(clusters); x = cl.c + (R() - 0.5) * 2 * cl.s; } else x = R();
      L = makeLineR(R, clamp(x, 0.005, 0.995));
    }
    pool.push(L);
  }
  lines = [];
}

// ---------- Mehr Streifen mit der Zeit / mit sinkendem Akku ----------
let growT = 0, timeScale = 1, pendingRestart = false, battReal = null;
try {
  if (typeof navigator !== 'undefined' && navigator.getBattery) navigator.getBattery().then(b => {
    const u = () => { battReal = b.level; }; u(); b.addEventListener('levelchange', u);
  }).catch(() => {});
} catch (e) {}
const battLevel = () => settings.battTest > 0 ? settings.battTest / 100 : battReal == null ? 1 : battReal;
const growOn = () => settings.growTime === 1 || settings.growBatt === 1;
function growFrac() {
  let f = 0;
  if (settings.growTime === 1) f = Math.max(f, clamp(growT / (settings.growHours * 3600), 0, 1));
  // voller Akku = „von“, kurz vor leer (5 %) = „bis“
  if (settings.growBatt === 1) f = Math.max(f, clamp((1 - battLevel()) / 0.95, 0, 1));
  return f;
}
// Sichtbare Streifen an die gewünschte Zahl anpassen; neue blitzen beim Erscheinen kurz auf
function applyCount(birth) {
  const a = countFromPos(settings.countPos), b = countFromPos(settings.countMax);
  baseN = growOn() ? Math.round(a + (b - a) * growFrac()) : a;
  const total = Math.min(pool.length, Math.max(1, Math.round(baseN * 1.12)));
  if (total > lines.length) {
    for (let i = lines.length; i < total; i++) {
      const L = pool[i];
      L.zones = []; L.off = 0; L.frag = null; L.flash = 0; L.born = birth ? t : -1;
      lines.push(L);
    }
  } else if (total < lines.length) lines.length = total;
}
function fmtDur(s) {
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = Math.floor(s % 60);
  return h ? h + ' Std. ' + m + ' Min.' : m ? m + ' Min. ' + sec + ' s' : sec + ' s';
}
function growInfo() {
  if (!growOn()) return '';
  let s = 'Jetzt ' + baseN + ' Streifen';
  if (settings.growTime === 1) s += ' · Neustart in ' + fmtDur(Math.max(0, settings.growHours * 3600 - growT));
  if (settings.growBatt === 1) s += ' · Akku ' + Math.round(battLevel() * 100) + ' %';
  if (timeScale > 1) s += ' · Zeitraffer';
  return s;
}
function newStripes() { stripeSeed = (Math.random() * 2147483647) | 0; buildPool(); applyCount(false); }

// Glitch-Ausbruch: dauert zufällig 0,3 bis 0,8 Sekunden
function triggerBurst(zone) {
  burstT = rnd(0.3, 0.8);
  burstPow = rnd(0.5, 1.5);
  const r = Math.random();
  burstZone = zone || (r < 0.35 ? 'all' : r < 0.65 ? 'bottom' : r < 0.85 ? 'top' : 'mid');
}
function scheduleBurst(bur) {
  // manchmal gleich noch einer hinterher – mit genug Pause, dass es zwei kurze bleiben und kein langer wird
  if (Math.random() < 0.18 * bur) return rnd(0.8, 2.2);
  const p = Math.random() < 0.3 ? rnd(25, 60) : rnd(8, 25);
  return p * (0.5 + Math.pow(1 - bur, 2) * 4);
}

// ---------- Risse ----------
// Alles in Breiten-Einheiten: x von 0 bis 1, y von 0 bis A (= Höhe / Breite). Gleicher Zufallswert = gleiche Risse.
// Bis zu drei Aufschläge (zufällig an Ecke, Kante oder mitten im Glas, oder selbst angetippt), dazu auf Wunsch Risse, die
// waagerecht quer übers Bild laufen. Die Risse entstehen nacheinander: Jeder neue endet am Rand oder an einem schon
// vorhandenen Riss, wie bei echtem Glas. Kommen mit der Zeit Risse dazu, bleiben die alten also genau, wie sie sind.
// Die Risse teilen das Display in Bruchstücke (die Flächen dieses Netzes); jedes Stück kennt seine Nachbarn.
const CRACKS_MAX = 23;
const SHEAR_K = 1.2 * 0.45;   // „Versatz am Riss“: Stärke je Stufe (55 % weniger als vorher)
let crackSeed = (Math.random() * 2147483647) | 0, CR = null, crackLayer = null, clockZones = {}, crackFlash = [], shownCracks = -1;
function rng(seed) {
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; };
}
// Wie stark zufällige Risse quer statt steil laufen (0 = gleich verteilt)
const QUER = 0.55;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// Schnitt der Strecke a→b mit q→e: [Anteil entlang a→b, Anteil entlang q→e] oder null
function segHit2(ax, ay, bx, by, qx, qy, ex, ey) {
  const rX = bx - ax, rY = by - ay, sX = ex - qx, sY = ey - qy, den = rX * sY - rY * sX;
  if (Math.abs(den) < 1e-12) return null;
  const u = ((qx - ax) * sY - (qy - ay) * sX) / den, v = ((qx - ax) * rY - (qy - ay) * rX) / den;
  return u > 1e-9 && u <= 1 && v >= 0 && v <= 1 ? [u, v] : null;
}
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
// Punkt in der Entfernung d entlang des Risses, mit Richtung
function pointAtLen(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === pts.length - 1) { const f = l > 0 ? Math.min(1, d / l) : 0; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])]; }
    d -= l;
  }
  return [pts[0][0], pts[0][1], 0];
}
// Umgebendes Rechteck eines Risses (für schnelle Schnitt-Tests)
function bboxOf(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return [x0, y0, x1, y1];
}
// Rechtecke je 16 Stücke eines Risses (bei vielen Rissen viel schneller, das Ergebnis bleibt genau gleich)
const CHUNK = 16;
function chunkBoxes(pts) {
  const out = [];
  for (let i0 = 1; i0 < pts.length; i0 += CHUNK) {
    const i1 = Math.min(pts.length - 1, i0 + CHUNK - 1);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let k = i0 - 1; k <= i1; k++) { const p = pts[k]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    out.push([x0, y0, x1, y1, i0, i1]);
  }
  return out;
}
// Erster Schnitt der Strecke a→b mit einem der Risse in stop (ign: der eigene Aufschlag – dicht an ihm zählen nur die
// Risse nicht, die dort selbst losgehen; jeder andere Riss, der dort vorbeiläuft, zählt). Ergebnis: { u, ci, pos (Stelle
// im getroffenen Riss: Stück + Anteil), x, y } oder null.
function hitAny(ax, ay, bx, by, stop, ign, endPt) {
  let best = 2, bh = null;
  const mx0 = Math.min(ax, bx), mx1 = Math.max(ax, bx), my0 = Math.min(ay, by), my1 = Math.max(ay, by);
  for (let ci = 0; ci < stop.length; ci++) {
    const s = stop[ci], S = s.pts, bb = s.bb || (s.bb = bboxOf(S));
    if (bb[0] > mx1 + 1e-9 || bb[2] < mx0 - 1e-9 || bb[1] > my1 + 1e-9 || bb[3] < my0 - 1e-9) continue;
    const cb = s.cb || (s.cb = chunkBoxes(S));
    for (const c of cb) {
      if (c[0] > mx1 + 1e-9 || c[2] < mx0 - 1e-9 || c[1] > my1 + 1e-9 || c[3] < my0 - 1e-9) continue;
      for (let i = c[4]; i <= c[5]; i++) {
        const h = segHit2(ax, ay, bx, by, S[i - 1][0], S[i - 1][1], S[i][0], S[i][1]);
        if (!h || h[0] >= best) continue;
        const hx = ax + (bx - ax) * h[0], hy = ay + (by - ay) * h[0];
        if (ign && s.n0 === ign.node && Math.hypot(hx - ign.P[0], hy - ign.P[1]) < 0.006) continue;
        if (endPt && Math.hypot(hx - endPt[0], hy - endPt[1]) < 1e-7) continue;
        best = h[0]; bh = { u: h[0], ci, pos: i - 1 + h[1], x: hx, y: hy };
      }
    }
  }
  return bh;
}
// Riss wachsen lassen: kurze, fast gerade Stücke mit kleinen Knicken, die Grundrichtung wandert langsam. Endet am
// Bildrand, nach maxLen (0 = ohne) oder an einem Riss in stop. aim: Punkt, durch den er laufen soll (Uhr, Ziel).
function grow(R, A, x, y, dir, maxLen, aim, stop, ign) {
  const pts = [[x, y]];
  let base = dir, len = 0, aiming = !!aim, lastD = 1e9, hit = null;
  for (let guard = 0; guard < 400; guard++) {
    const L = 0.015 + R() * 0.045;
    base += (R() - 0.5) * 0.05;
    const wob = (R() - 0.5) * 0.22;
    if (guard > 0) dir += wob + angDiff(base, dir) * 0.35;
    if (aiming) {
      const dA = Math.hypot(aim[0] - x, aim[1] - y);
      if (dA < 0.035 || dA > lastD) { aiming = false; base = dir; }
      else { dir += angDiff(Math.atan2(aim[1] - y, aim[0] - x), dir) * 0.75; base = dir; }
      lastD = dA;
    }
    let nx = x + Math.cos(dir) * L, ny = y + Math.sin(dir) * L, end = false, k = 1, side = -1;
    if (nx < 0) { const q = -x / (nx - x); if (q < k) { k = q; side = 0; } }
    if (nx > 1) { const q = (1 - x) / (nx - x); if (q < k) { k = q; side = 1; } }
    if (ny < 0) { const q = -y / (ny - y); if (q < k) { k = q; side = 2; } }
    if (ny > A) { const q = (A - y) / (ny - y); if (q < k) { k = q; side = 3; } }
    if (side >= 0) {
      nx = x + (nx - x) * k; ny = y + (ny - y) * k; end = true;
      if (side === 0) nx = 0; else if (side === 1) nx = 1; else if (side === 2) ny = 0; else ny = A;
    }
    if (stop) {
      const bh = hitAny(x, y, nx, ny, stop, ign, null);
      if (bh) { nx = bh.x; ny = bh.y; end = true; hit = bh; }
    }
    const sl = Math.hypot(nx - x, ny - y);
    if (maxLen && sl > 0 && len + sl >= maxLen) {
      const f = (maxLen - len) / sl;
      if (f < 1 - 1e-9) hit = null;
      nx = x + (nx - x) * f; ny = y + (ny - y) * f; end = true;
    }
    len += Math.hypot(nx - x, ny - y);
    pts.push([nx, ny]); x = nx; y = ny;
    if (end) break;
  }
  return { pts, hit };
}
// Läuft ein Riss nicht bis zum Rand (sehr selten), gerade weiter bis zum Rand verlängern
function toEdge(pts, A) {
  const e = pts[pts.length - 1];
  if (e[0] <= 1e-9 || e[0] >= 1 - 1e-9 || e[1] <= 1e-9 || e[1] >= A - 1e-9 || pts.length < 2) return pts;
  const d = pts[pts.length - 2], dir = Math.atan2(e[1] - d[1], e[0] - d[0]), cx0 = Math.cos(dir), cy0 = Math.sin(dir);
  let t1 = 1e9;
  if (cx0 < -1e-9) t1 = Math.min(t1, -e[0] / cx0);
  if (cx0 > 1e-9) t1 = Math.min(t1, (1 - e[0]) / cx0);
  if (cy0 < -1e-9) t1 = Math.min(t1, -e[1] / cy0);
  if (cy0 > 1e-9) t1 = Math.min(t1, (A - e[1]) / cy0);
  let nx = clamp(e[0] + cx0 * t1, 0, 1), ny = clamp(e[1] + cy0 * t1, 0, A);
  const m = Math.min(nx, 1 - nx, ny, A - ny);
  if (m === nx) nx = 0; else if (m === 1 - nx) nx = 1; else if (m === ny) ny = 0; else ny = A;
  return pts.concat([[nx, ny]]);
}
// Feine Zacken wie bei echtem Glasbruch (klein, zusammenhängend, quer zur Richtung; die Enden bleiben genau). Am Anfang
// und am Ende laufen die Zacken weich aus (t0, t1: Länge), damit sich Risse am selben Punkt nicht kreuzen.
// Mit A bleiben die Zacken im Bild (ein Riss, der flach auf den Rand zuläuft, darf ihn nicht vorher schon kreuzen).
// s0: so lang bleibt der Anfang ganz gerade (Risse aus demselben Aufschlag kreuzen sich dort sonst leicht).
function refine(R, pts, amp, t0, t1, A, s0) {
  const total = polyLen(pts), out = [pts[0]];
  let j = 0, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    if (l < 1e-12) continue;
    const n = Math.max(1, Math.round(l / 0.007));
    for (let k = 1; k < n; k++) {
      const f = k / n;
      j = j * 0.55 + (R() - 0.5) * 2 * amp;
      if (R() < 0.05) j += (R() - 0.5) * 4 * amp;   // ab und zu ein kleiner Sprung
      const s = acc + l * f;
      let tp = 1;
      if (t0 > 0) tp = Math.min(tp, (s - (s0 || 0)) / t0);
      if (t1 > 0) tp = Math.min(tp, (total - s) / t1);
      const jj = j * clamp(tp, 0, 1);
      let px = a[0] + dx * f - dy / l * jj, py = a[1] + dy * f + dx / l * jj;
      if (A && (px < 1e-5 || px > 1 - 1e-5 || py < 1e-5 || py > A - 1e-5)) { px = a[0] + dx * f; py = a[1] + dy * f; j = 0; }
      out.push([px, py]);
    }
    out.push(b);
    acc += l;
    j *= 0.3;
  }
  return out;
}
// Weich schwankender Wert 0..1 entlang des Risses (Glanz: mal fängt die Bruchkante Licht, mal nicht)
function glint(R) {
  const f = [8 + R() * 6, 19 + R() * 14, 43 + R() * 25], p = [R() * 6.3, R() * 6.3, R() * 6.3];
  const peaks = [];
  for (let k = 0, n = 1 + Math.floor(R() * 3); k < n; k++) peaks.push([R() * 1.6, 0.012 + R() * 0.03, 0.4 + R() * 0.5]);
  return s => {
    let v = 0.5 + 0.26 * Math.sin(s * f[0] + p[0]) + 0.15 * Math.sin(s * f[1] + p[1]) + 0.09 * Math.sin(s * f[2] + p[2]);
    for (const q of peaks) { const d = (s - q[0]) / q[1]; v += q[2] * Math.exp(-d * d); }
    return clamp(v, 0, 1.4);
  };
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
// Zahl 0..1 aus einer Stelle (gleiche Stelle = gleiche Zahl): Versatz eines Bruchstücks bleibt, wenn Risse dazukommen
const hash01 = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 0.000123) * 43758.5453; return v - Math.floor(v); };

// Wie viele Hauptrisse gerade zu sehen sind (mit „Mehr Risse mit der Zeit“ wachsend)
let crackGrowT = 0, crackPending = false;
function crackCount() {
  const a = clamp(settings.cracks | 0, 0, CRACKS_MAX), b = clamp(settings.cracksMax | 0, 0, CRACKS_MAX);
  if (settings.crackGrow !== 1 || b <= a) return a;
  return Math.round(a + (b - a) * clamp(crackGrowT / (settings.crackHours * 3600), 0, 1));
}
function crackInfo() {
  if (settings.crackGrow !== 1) return '';
  const a = settings.cracks | 0, b = settings.cracksMax | 0;
  if (b <= a) return '„Bis“ ist nicht größer als „von“: Die Risse bleiben bei ' + a + '.';
  return 'Jetzt ' + crackCount() + ' Risse · Neustart in ' + fmtDur(Math.max(0, settings.crackHours * 3600 - crackGrowT)) + (timeScale > 1 ? ' · Zeitraffer' : '');
}

// Aufschläge: Lage, Fächer der Risse (a0..a1), Stelle am Rand, bis zu der es durchreißt (S), Hauptrichtung (md)
function makeImpacts(R, A, K) {
  const r = (a, b) => a + R() * (b - a), imps = [];
  const bands = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bands[i], bands[j]] = [bands[j], bands[i]]; }
  for (let k = 0; k < K; k++) {
    const man = settings.impact === 1 && settings.px[k] >= 0 && settings.tx[k] >= 0;
    let imp = null;
    if (man) {
      // selbst angetippt: Aufschlag und Richtung vom Nutzer, der genaue Verlauf bleibt dem Zufall überlassen
      const Px = clamp(settings.px[k], 0.012, 0.988), Py = clamp(settings.py[k], 0.006, 0.994) * A;
      const Tx = settings.tx[k], Ty = settings.ty[k] * A, far = Math.hypot(Tx - Px, Ty - Py) > 0.03;
      let md = far ? Math.atan2(Ty - Py, Tx - Px) : R() * 2 * Math.PI, a0, a1, S = null, back = false;
      const ed = [[Px, 0], [1 - Px, 1], [Py, 2], [A - Py, 3]].sort((u, v) => u[0] - v[0])[0];
      if (ed[0] < 0.07) {
        // nah am Rand: von dort reißt es bis zum Rand durch, die Risse laufen nur ins Bild hinein
        const e = ed[1];
        if (e === 0) { S = [0, Py]; a0 = -Math.PI / 2; a1 = Math.PI / 2; }
        else if (e === 1) { S = [1, Py]; a0 = Math.PI / 2; a1 = 1.5 * Math.PI; }
        else if (e === 2) { S = [Px, 0]; a0 = 0; a1 = Math.PI; }
        else { S = [Px, A]; a0 = Math.PI; a1 = 2 * Math.PI; }
        a0 += 0.17; a1 -= 0.17;
        const mid = (a0 + a1) / 2;
        md = clamp(mid + angDiff(md, mid), a0, a1);
      } else { a0 = md - Math.PI; a1 = md + Math.PI; back = true; }
      imp = { P: [Px, Py], S, a0, a1, md, back, aim: far ? [Tx, Ty] : null, manual: true };
    } else {
      // zufällig, gut verteilt: Ecke, Kante oder mitten im Glas; mehrere Aufschläge in verschiedenen Höhen
      for (let tr = 0; tr < 24; tr++) {
        const band = K === 1 ? (R() < 0.6 ? 2 : Math.floor(R() * 2)) : bands[k];
        const ty = R(), ins = r(0.025, 0.05), y = (band + r(0.1, 0.9)) / 3 * A;
        let c;
        if (ty < 0.3) {
          // Ecke: oben oder unten passend zum Drittel, in der Mitte egal
          const bottom = band === 2 ? true : band === 0 ? false : R() < 0.5, left = R() < 0.5;
          c = { P: [left ? ins : 1 - ins, bottom ? A - ins : ins], S: [left ? 0 : 1, bottom ? A : 0] };
          [c.a0, c.a1] = left && bottom ? [-Math.PI / 2, 0] : !left && bottom ? [Math.PI, 1.5 * Math.PI] : left ? [0, Math.PI / 2] : [Math.PI / 2, Math.PI];
        } else if (ty < 0.65) {
          // Kante: meist links oder rechts, ganz oben/unten auch an der oberen/unteren Kante
          const e = R();
          if (band !== 1 && e < 0.25) {
            const x = r(0.15, 0.85);
            c = band === 2 ? { P: [x, A - ins], S: [x, A], a0: Math.PI, a1: 2 * Math.PI } : { P: [x, ins], S: [x, 0], a0: 0, a1: Math.PI };
          } else if (e < 0.62) c = { P: [ins, y], S: [0, y], a0: -Math.PI / 2, a1: Math.PI / 2 };
          else c = { P: [1 - ins, y], S: [1, y], a0: Math.PI / 2, a1: 1.5 * Math.PI };
        } else {
          // mitten im Glas: Risse in alle Richtungen
          c = { P: [r(0.2, 0.8), clamp(y, 0.12 * A, 0.88 * A)], S: null, a0: 0, a1: 2 * Math.PI, full: true };
        }
        if (!c.full) { c.a0 += 0.17; c.a1 -= 0.17; }
        c.md = (c.a0 + c.a1) / 2; c.back = !!c.full; c.aim = null; c.manual = false;
        imp = c;
        if (imps.every(o => Math.hypot(o.P[0] - c.P[0], o.P[1] - c.P[1]) > 0.38)) break;
      }
    }
    imp.full = imp.a1 - imp.a0 >= 2 * Math.PI - 1e-6;
    imp.chosen = []; imp.started = false; imp.k = k;
    imps.push(imp);
  }
  return imps;
}
// Richtung des nächsten Risses eines Aufschlags: selbst angetippt zuerst genau dorthin, dann abwechselnd links und
// rechts daneben; sonst immer in die größte Lücke des Fächers (quer etwas häufiger)
function nextDir(R, imp) {
  const r = (a, b) => a + R() * (b - a), j = imp.chosen.length;
  const taken = imp.backDir != null ? imp.chosen.concat([imp.backDir]) : imp.chosen;
  const free = d => taken.every(c => Math.abs(angDiff(c, d)) > 0.14);
  if (imp.manual) {
    if (j === 0) return imp.md;
    const side = j % 2 ? 1 : -1, step = Math.ceil(j / 2);
    let d = imp.md + side * step * r(0.36, 0.52);
    if (!imp.full) d = clamp(d, imp.a0 + 0.06, imp.a1 - 0.06);
    if (free(d)) return d;
  }
  if (j === 0) {
    if (imp.full) return r(imp.a0, imp.a1);
    // erster Riss: irgendwo im Fächer, quer etwas häufiger
    for (let tr = 0; tr < 8; tr++) { const d = r(imp.a0, imp.a1), s = Math.sin(d); if (R() < 1 - QUER * s * s || tr === 7) return d; }
  }
  // größte Lücke (am Rand des Fächers zählt die Lücke wie gespiegelt: dort ein Drittel vom Rand weg)
  const as = taken.map(c => imp.full ? imp.a0 + ((c - imp.a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) : clamp(c, imp.a0, imp.a1)).sort((a, b) => a - b);
  const cand = [];
  if (imp.full) {
    for (let i = 0; i < as.length; i++) { const a = as[i], b = i + 1 < as.length ? as[i + 1] : as[0] + 2 * Math.PI; cand.push({ d: (a + b) / 2, g: (b - a) / 2, w: b - a }); }
  } else {
    cand.push({ d: imp.a0 + (as[0] - imp.a0) / 3, g: (as[0] - imp.a0) * 2 / 3, w: (as[0] - imp.a0) / 3 });
    for (let i = 0; i + 1 < as.length; i++) cand.push({ d: (as[i] + as[i + 1]) / 2, g: (as[i + 1] - as[i]) / 2, w: as[i + 1] - as[i] });
    const L = as[as.length - 1];
    cand.push({ d: imp.a1 - (imp.a1 - L) / 3, g: (imp.a1 - L) * 2 / 3, w: (imp.a1 - L) / 3 });
  }
  let best = cand[0], bs = -1;
  for (const c of cand) { const s = Math.sin(c.d), sc = c.g * (1 - QUER * 0.6 * s * s); if (sc > bs) { bs = sc; best = c; } }
  return best.d + (R() - 0.5) * 0.3 * best.w;
}

function makeCracks() {
  CR = null; crackLayer = null; clockZones = {};
  for (const L of lines) L.zones = [];
  const N = crackCount();
  shownCracks = N;
  if (N <= 0 || W <= 1) { buildBg(); return; }
  const R = rng(crackSeed), r = (a, b) => a + R() * (b - a), A = H / W;
  const K = clamp((settings.impacts | 0) + 1, 1, 3);
  const imps = makeImpacts(R, A, K);
  // welche der (bis zu 23) Risse waagerecht quer laufen: feste Reihenfolge, auch für später dazukommende
  const hs = clamp(settings.hshare, 0, 100) / 100;
  const plan = [];
  for (let i = 0; i < CRACKS_MAX; i++) plan.push(Math.round((i + 1) * hs) > Math.round(i * hs) ? 'h' : 's');
  // Mit Uhr: der erste Riss läuft durch die Ziffern (immer ausgewürfelt, damit die Reihenfolge gleich bleibt)
  const ctx0 = r(0.3, 0.7), cty0 = r(0.3, 0.55);
  let clockAim = clockOn() && settings.crack > 0 && layer ? [(lx + layer.width * ctx0) / W, (ly + layer.height * cty0) / W] : null;
  const bands = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bands[i], bands[j]] = [bands[j], bands[i]]; }

  // Netz: Knoten (Ecken, Enden am Rand, Aufschläge, Stellen, an denen ein Riss an einem anderen endet) und Risse dazwischen
  const nodes = [[0, 0], [1, 0], [1, A], [0, A]], border = [0, 1, 2, 3], divs = [];
  const addNode = (x, y) => { nodes.push([x, y]); return nodes.length - 1; };
  const onBorder = (x, y) => x <= 1e-9 || x >= 1 - 1e-9 || y <= 1e-9 || y >= A - 1e-9;
  const borderNode = (x, y) => {
    for (const id of border) if (Math.hypot(nodes[id][0] - x, nodes[id][1] - y) < 1e-7) return id;
    const id = addNode(x, y); border.push(id); return id;
  };
  const hostNode = h => {
    const host = divs[h.ci], last = host.pts.length - 1;
    if (h.pos <= 1e-9) return host.n0;
    if (h.pos >= last - 1e-9) return host.n1;
    for (const s of host.splits) if (Math.hypot(nodes[s.node][0] - h.x, nodes[s.node][1] - h.y) < 1e-7) return s.node;
    const id = addNode(h.x, h.y);
    host.splits.push({ pos: h.pos, node: id });
    return id;
  };
  // Riss fertig machen: Zacken, an einem dabei gekreuzten Riss kappen, Knoten setzen, eintragen
  const finish = (coarse, n0, hit, kind, amp, ign, extra) => {
    let pts = refine(R, coarse, amp, ign ? 0.02 : 0.006, hit ? 0.012 : 0.004, A, ign ? 0.008 : 0);
    pts[0] = nodes[n0].slice();
    const endPt = pts[pts.length - 1];
    let cr = null;
    for (let i = 1; i < pts.length && !cr; i++) {
      const h = hitAny(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], divs, ign, i === pts.length - 1 && hit ? endPt : null);
      if (h) cr = { i, h };
    }
    if (cr) { pts = pts.slice(0, cr.i); pts.push([cr.h.x, cr.h.y]); hit = cr.h; }
    let n1;
    if (hit) n1 = hostNode(hit);
    else { const e = pts[pts.length - 1]; n1 = onBorder(e[0], e[1]) ? borderNode(e[0], e[1]) : addNode(e[0], e[1]); }
    pts[pts.length - 1] = nodes[n1].slice();
    const d = Object.assign({ pts, n0, n1, splits: [], kind }, extra || {});
    d.bb = bboxOf(pts);
    divs.push(d);
    return d;
  };
  // Abstand eines Punkts zum nächsten Riss
  const distToCracks = (x, y) => {
    let m = 1e9;
    for (const d of divs) for (let i = 1; i < d.pts.length; i++) {
      const a = d.pts[i - 1], b = d.pts[i], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
      const t1 = l2 > 0 ? clamp(((x - a[0]) * vx + (y - a[1]) * vy) / l2, 0, 1) : 0;
      m = Math.min(m, Math.hypot(x - a[0] - vx * t1, y - a[1] - vy * t1));
    }
    return m;
  };
  const startImpact = imp => {
    imp.started = true;
    // liegt der Aufschlag genau auf einem schon vorhandenen Riss: ein Stück daneben setzen
    for (let tr = 0; tr < 6 && distToCracks(imp.P[0], imp.P[1]) < 0.008; tr++) {
      imp.P = [clamp(imp.P[0] + (tr % 2 ? -1 : 1) * 0.012, 0.01, 0.99), clamp(imp.P[1] + 0.009, 0.01, A - 0.01)];
    }
    imp.node = addNode(imp.P[0], imp.P[1]);
    // am Rand: der Aufschlag reißt bis an den Rand durch
    if (imp.S) finish([imp.P.slice(), imp.S.slice()], imp.node, null, 'stub', 0.0009, imp, { imp: imp.k });
  };
  const spoke = (imp, dir, aim, kind) => {
    let best = null;
    for (let tr = 0; tr < 6; tr++) {
      const g = grow(R, A, imp.P[0], imp.P[1], dir + (tr ? r(-0.06, 0.06) : 0), 0, aim, divs, imp);
      const len = polyLen(g.pts);
      if (!best || len > best.len) best = { g, len };
      if (len > 0.08 || best.g.hit === null) break;
    }
    finish(best.g.hit ? best.g.pts : toEdge(best.g.pts, A), imp.node, best.g.hit, kind, 0.0014, imp, { imp: imp.k, dir });
  };
  const horizontal = j => {
    let best = null;
    for (let tr = 0; tr < 6; tr++) {
      const band = bands[(j + tr) % 3];
      let y = (band + r(0.12, 0.88)) / 3 * A;
      const left = R() < 0.5, dir = (left ? 0 : Math.PI) + r(-0.12, 0.12);
      let aim = null;
      if (clockAim && tr === 0) { y = clamp(clockAim[1] + r(-0.03, 0.03), 0.02, A - 0.02); aim = clockAim; }
      const x0 = left ? 0 : 1;
      if (border.some(id => Math.hypot(nodes[id][0] - x0, nodes[id][1] - y) < 0.03)) continue;
      const g = grow(R, A, x0, y, dir, 0, aim, divs, null);
      // gleich am Anfang an einem Riss hängen geblieben: andere Höhe nehmen
      const len = polyLen(g.pts);
      if (!best || len > best.len) best = { g, len, x0, y, aim };
      if (len > 0.45) break;
    }
    if (!best) return;
    if (best.aim) clockAim = null;
    const n0 = borderNode(best.x0, best.y);
    finish(best.g.hit ? best.g.pts : toEdge(best.g.pts, A), n0, best.g.hit, 'h', 0.0012, null, { dir: best.x0 ? Math.PI : 0 });
  };

  let si = 0, hj = 0;
  for (let i = 0; i < N; i++) {
    if (plan[i] === 'h') { horizontal(hj++); continue; }
    const imp = imps[si % K]; si++;
    if (!imp.started) startImpact(imp);
    let dir, aim = null;
    if (imp.manual && imp.chosen.length === 0) { dir = imp.md; aim = imp.aim; }
    else if (clockAim && imp.k === 0 && imp.chosen.length === 0) {
      const ta = Math.atan2(clockAim[1] - imp.P[1], clockAim[0] - imp.P[0]);
      const inFan = imp.full || Math.abs(angDiff(ta, imp.md)) <= (imp.a1 - imp.a0) / 2 + 0.17;
      dir = inFan ? ta : nextDir(R, imp);
      if (inFan) { aim = clockAim; clockAim = null; }
    } else dir = nextDir(R, imp);
    imp.chosen.push(dir);
    spoke(imp, dir, aim, 'spoke');
    // mitten im Glas: der erste Riss reißt auch nach hinten durch (sonst hinge er lose im Glas und teilte nichts)
    if (imp.back && !imp.backDone) {
      imp.backDone = true; imp.backDir = imp.chosen[0] + Math.PI + r(-0.35, 0.35);
      spoke(imp, imp.backDir, null, 'back');
    }
  }
  // Aufschläge, an denen noch kein Riss losläuft, bekommen trotzdem ihren Punkt (für Splitter und Glanz)
  for (const imp of imps) if (!imp.started) imp.node = -1;

  const regions = buildRegions(nodes, divs, border, A);
  for (const g of regions) {
    g.pathC = new Path2D(); g.pathD = new Path2D();
    g.poly.forEach((p, k) => { if (k) { g.pathC.lineTo(p[0] * Wc, p[1] * Wc); g.pathD.lineTo(p[0] * W, p[1] * W); } else { g.pathC.moveTo(p[0] * Wc, p[1] * Wc); g.pathD.moveTo(p[0] * W, p[1] * W); } });
    g.pathC.closePath(); g.pathD.closePath();
    g.dead = 0; g.dv = false;
  }

  // Abzweige je Riss (eigener Zufall je Riss, damit sie bleiben, wenn Risse dazukommen): enden am Rand, nach einer
  // Weile oder an einem anderen Riss
  const branches = [];
  divs.forEach((d, i) => {
    if (d.kind === 'stub') return;
    const Rb = rng(crackSeed ^ Math.imul(0x9E3779B1, i + 1)), rb = (a, b) => a + Rb() * (b - a);
    const nB = Rb() < 0.5 ? (Rb() < 0.25 ? 2 : 1) : 0, total = polyLen(d.pts);
    for (let k = 0; k < nB; k++) {
      const at = pointAtLen(d.pts, total * rb(0.25, 0.8));
      const bd = at[2] + (Rb() < 0.5 ? -1 : 1) * rb(0.3, 0.65);
      const stop = divs.filter(o => o !== d).concat(branches.map(p => ({ pts: p })));
      branches.push(refine(Rb, grow(Rb, A, at[0], at[1], bd, rb(0.1, 0.45), null, stop, null).pts, 0.0012, 0.01, 0));
    }
  });

  // Kleine Risse, die an den großen hängen (eigener Zufall je Riss): kurze Ästchen schräg ab, ab und zu noch einmal
  // gegabelt; wo ein Riss am Rand endet, splittert er oft kurz davor in ein, zwei kleine Risse auf
  const twigs = [];
  divs.forEach((d, i) => {
    if (d.kind === 'stub') return;
    const Rt = rng(crackSeed ^ Math.imul(0x2545F491, i + 3)), rt = (a, b) => a + Rt() * (b - a);
    const total = polyLen(d.pts);
    if (total < 0.05) return;
    const stop = divs.filter(o => o !== d).concat(branches.map(p => ({ pts: p })));
    const twig = (x, y, dir, len) => {
      const g = grow(Rt, A, x, y, dir, len, null, stop, null);
      if (g.pts.length > 1 && polyLen(g.pts) > 0.004) twigs.push(refine(Rt, g.pts, 0.0007, 0.003, 0));
      return g.pts;
    };
    const n = Math.min(5, Math.floor(total * rt(0.8, 2.2) + Rt()));
    for (let k = 0; k < n; k++) {
      const at = pointAtLen(d.pts, total * rt(0.06, 0.94));
      const p = twig(at[0], at[1], at[2] + (Rt() < 0.5 ? -1 : 1) * rt(0.35, 1.0), rt(0.015, 0.06));
      if (Rt() < 0.3 && p.length > 2) {
        const e = p[p.length - 1], q = p[p.length - 2];
        twig(e[0], e[1], Math.atan2(e[1] - q[1], e[0] - q[0]) + (Rt() < 0.5 ? -1 : 1) * rt(0.4, 0.9), rt(0.006, 0.02));
      }
    }
    const e = d.pts[d.pts.length - 1];
    if ((e[0] <= 1e-6 || e[0] >= 1 - 1e-6 || e[1] <= 1e-6 || e[1] >= A - 1e-6) && Rt() < 0.6) {
      const back = pointAtLen(d.pts, Math.max(0, total - rt(0.012, 0.035)));
      const m = Rt() < 0.4 ? 2 : 1;
      for (let k = 0; k < m; k++) twig(back[0], back[1], back[2] + (k ? -1 : 1) * rt(0.3, 0.75), rt(0.015, 0.05));
    }
  });

  // Splitternetz je Aufschlag: Querrisse in Bögen zwischen benachbarten Rissen, kurze Sprünge, kleine Glassplitter
  const web = [], shards = [], sp = settings.splinter;
  if (sp > 0) imps.forEach((imp, k) => {
    const Rw = rng(crackSeed ^ Math.imul(0x85EBCA6B, k + 7)), rw = (a, b) => a + Rw() * (b - a);
    const Px = imp.P[0], Py = imp.P[1];
    const fan = divs.filter(d => d.imp === k && (d.kind === 'spoke' || d.kind === 'back')).sort((a, b) => angDiff(a.dir, imp.md) - angDiff(b.dir, imp.md));
    const radii = sp === 1 ? [rw(0.014, 0.022), rw(0.032, 0.05)] : [rw(0.01, 0.016), rw(0.024, 0.034), rw(0.042, 0.06), rw(0.07, 0.1)];
    const pairs = [];
    for (let i = 0; i + 1 < fan.length; i++) pairs.push([fan[i], fan[i + 1]]);
    if (imp.full && fan.length > 2) pairs.push([fan[fan.length - 1], fan[0]]);
    for (const rad of radii) for (const [fa, fb] of pairs) {
      if (Rw() > (sp === 1 ? 0.7 : 0.88) || Math.abs(angDiff(fb.dir, fa.dir)) > 1.6) continue;
      if (polyLen(fa.pts) < rad * 1.3 || polyLen(fb.pts) < rad * 1.3) continue;
      const pa = pointAtLen(fa.pts, rad * rw(0.85, 1.15)), pb = pointAtLen(fb.pts, rad * rw(0.85, 1.15));
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, ox = mx - Px, oy = my - Py, ol = Math.hypot(ox, oy) || 1, bulge = rad * rw(0.02, 0.15);
      web.push(refine(Rw, [[pa[0], pa[1]], [mx + ox / ol * bulge, my + oy / ol * bulge], [pb[0], pb[1]]], 0.0009, 0, 0));
    }
    const nT = (sp === 1 ? 2 + Math.floor(Rw() * 3) : 6 + Math.floor(Rw() * 5)) + (imp.started ? 0 : 3);
    for (let q = 0; q < nT; q++) {
      const ang = rw(imp.a0 - 0.17, imp.a1 + 0.17), d0 = rw(0.004, sp === 1 ? 0.03 : 0.05);
      const x0 = Px + Math.cos(ang) * d0, y0 = Py + Math.sin(ang) * d0;
      if (x0 <= 0 || x0 >= 1 || y0 <= 0 || y0 >= A) continue;
      web.push(refine(Rw, grow(Rw, A, x0, y0, ang + rw(-0.9, 0.9), rw(0.006, 0.025), null, null, null).pts, 0.0008, 0, 0));
    }
    // kleine Glassplitter: Dreiecke mit hellen Kanten, dicht am Aufschlag
    const nS = sp === 1 ? 5 + Math.floor(Rw() * 4) : 14 + Math.floor(Rw() * 8);
    for (let q = 0; q < nS; q++) {
      const ang = rw(imp.a0 - 0.17, imp.a1 + 0.17), d0 = rw(0, sp === 1 ? 0.018 : 0.03) * (0.4 + Rw());
      const cx0 = Px + Math.cos(ang) * d0, cy0 = Py + Math.sin(ang) * d0, s0 = rw(0.0025, 0.007), rot = Rw() * 6.3;
      const tri = [0, 1, 2].map(z => { const a = rot + z * 2.1 + rw(-0.5, 0.5), rr = s0 * rw(0.6, 1.2); return [cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr]; });
      if (tri.every(p => p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < A)) shards.push({ tri, a: rw(0.05, 0.16), e: rw(0.25, 0.6) });
    }
  });

  // Zeichenliste: dunkle Bruchkante (Breite w) mit Glanz, der entlang des Risses weich stärker und schwächer wird
  const RL = rng(crackSeed ^ 0x27D4EB2F), list = [];
  const add = (pts, w, kind, base) => {
    const cl = [0];
    for (let i = 1; i < pts.length; i++) cl.push(cl[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // Seite zum Licht (oben) einmal je Riss festlegen, damit der Glanz nicht hin und her springt
    const e = pts[pts.length - 1], dx = e[0] - pts[0][0], dy = e[1] - pts[0][1], l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l;
    if (ny > 0 || (Math.abs(ny) < 0.25 && nx > 0)) { nx = -nx; ny = -ny; }
    list.push({ pts, cl, w, kind, base, g: glint(RL), nx, ny });
  };
  for (const d of divs) add(d.pts, d.kind === 'stub' ? 1.2 : d.kind === 'h' ? 0.9 : 1, d.kind === 'h' ? 'h' : 'spoke', 0.5 + RL() * 0.25);
  for (const b of branches) add(b, 0.8, 'branch', 0.4 + RL() * 0.25);
  for (const w of web) add(w, 0.65, 'web', 0.55 + RL() * 0.35);
  for (const t of twigs) add(t, 0.55, 'twig', 0.45 + RL() * 0.3);
  CR = { imps: imps.map(i => i.P), A, divs, branches, twigs, web, shards, regions, list };
  updateClockPieces();
  renderCracks();
  buildBg();
}

// Bruchstücke = Flächen des Netzes aus Rissen und Rand. Jeder Riss wird an den Stellen geteilt, an denen andere Risse
// an ihm enden; dann läuft man um jede Fläche herum (an jedem Knoten die nächste Kante im Uhrzeigersinn).
function buildRegions(nodes, divs, border, A) {
  const edges = [];
  for (const d of divs) {
    const cuts = [{ pos: 0, node: d.n0 }].concat(d.splits.slice().sort((a, b) => a.pos - b.pos), [{ pos: d.pts.length - 1, node: d.n1 }]);
    for (let k = 0; k + 1 < cuts.length; k++) {
      const c0 = cuts[k], c1 = cuts[k + 1];
      if (c0.node === c1.node) continue;
      const pts = [nodes[c0.node].slice()];
      for (let q = Math.floor(c0.pos) + 1; q < c1.pos - 1e-9; q++) pts.push(d.pts[q]);
      pts.push(nodes[c1.node].slice());
      edges.push({ a: c0.node, b: c1.node, pts, border: false });
    }
  }
  const per = id => { const x = nodes[id][0], y = nodes[id][1]; return y <= 1e-7 ? x : x >= 1 - 1e-7 ? 1 + y : y >= A - 1e-7 ? 1 + A + (1 - x) : 2 + A + (A - y); };
  const bs = border.slice().sort((u, v) => per(u) - per(v));
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i], b = bs[(i + 1) % bs.length];
    edges.push({ a, b, pts: [nodes[a].slice(), nodes[b].slice()], border: true });
  }
  const outs = new Map();
  const addOut = (n, h) => { let l = outs.get(n); if (!l) outs.set(n, l = []); l.push(h); };
  edges.forEach((e, ei) => {
    const p = e.pts, last = p.length - 1;
    let i1 = 1; while (i1 < last && Math.hypot(p[i1][0] - p[0][0], p[i1][1] - p[0][1]) < 1e-9) i1++;
    let j1 = last - 1; while (j1 > 0 && Math.hypot(p[j1][0] - p[last][0], p[j1][1] - p[last][1]) < 1e-9) j1--;
    addOut(e.a, { e: ei, fw: true, ang: Math.atan2(p[i1][1] - p[0][1], p[i1][0] - p[0][0]) });
    addOut(e.b, { e: ei, fw: false, ang: Math.atan2(p[j1][1] - p[last][1], p[j1][0] - p[last][0]) });
  });
  for (const l of outs.values()) l.sort((u, v) => u.ang - v.ang);
  const seen = new Uint8Array(edges.length * 2), key = h => h.e * 2 + (h.fw ? 0 : 1), faces = [];
  for (const l of outs.values()) for (const h0 of l) {
    if (seen[key(h0)]) continue;
    const poly = [], used = [];
    let h = h0, guard = 0;
    do {
      seen[key(h)] = 1; used.push(h.e);
      const e = edges[h.e], p = h.fw ? e.pts : e.pts.slice().reverse();
      for (let q = 0; q < p.length - 1; q++) poly.push(p[q]);
      const v = h.fw ? e.b : e.a, l2 = outs.get(v);
      const ti = l2.findIndex(o => o.e === h.e && o.fw !== h.fw);
      h = l2[(ti + l2.length - 1) % l2.length];
    } while (h !== h0 && ++guard < 20000);
    let ar = 0;
    for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; ar += p[0] * q[1] - q[0] * p[1]; }
    faces.push({ poly, used, area: ar / 2 });
  }
  // die Fläche außen herum (läuft den Rand andersherum entlang) weglassen
  let bi = 0;
  faces.forEach((f, i) => { if (Math.abs(f.area) > Math.abs(faces[bi].area)) bi = i; });
  const regions = [], fr = new Map();
  faces.forEach((f, i) => {
    if (i === bi || Math.abs(f.area) < 1e-7 || Math.sign(f.area) === Math.sign(faces[bi].area)) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, gx = 0, gy = 0, a2 = 0;
    for (let k = 0; k < f.poly.length; k++) {
      const p = f.poly[k], q = f.poly[(k + 1) % f.poly.length], cr = p[0] * q[1] - q[0] * p[1];
      a2 += cr; gx += (p[0] + q[0]) * cr; gy += (p[1] + q[1]) * cr;
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    }
    const cx0 = gx / (3 * a2), cy0 = gy / (3 * a2);
    fr.set(i, regions.length);
    regions.push({ poly: f.poly, area: Math.abs(f.area), x0, x1, y0, y1, cx: cx0, cy: cy0, zone: cy0 < A / 3 ? 'top' : cy0 > 2 * A / 3 ? 'bottom' : 'mid', s: 0, nb: [], used: f.used });
  });
  // Nachbarn: Stücke, die sich eine Risskante teilen
  const byEdge = new Map();
  regions.forEach((g, gi) => { for (const e of g.used) if (!edges[e].border) { const l = byEdge.get(e) || []; l.push(gi); byEdge.set(e, l); } });
  for (const l of byEdge.values()) if (l.length === 2 && l[0] !== l[1]) {
    if (!regions[l[0]].nb.includes(l[1])) regions[l[0]].nb.push(l[1]);
    if (!regions[l[1]].nb.includes(l[0])) regions[l[1]].nb.push(l[0]);
  }
  // Versatz der Stücke: Richtung und Stärke aus der Lage (bleibt gleich, solange das Stück bleibt); das größte bleibt stehen
  let big = 0;
  regions.forEach((g, i) => {
    const h = hash01(g.cx, g.cy, crackSeed);
    g.s = (h < 0.5 ? -1 : 1) * (0.6 + 0.6 * hash01(g.cy, g.cx, crackSeed + 7));
    if (g.area > regions[big].area) big = i;
  });
  if (regions.length) regions[big].s = 0;
  return regions;
}

// Welche Bruchstücke liegen im Bereich der Uhr?
function updateClockPieces() {
  if (!CR) return;
  for (const g of CR.regions) {
    g.clock = false;
    if (!layer) continue;
    for (let yy = 0; yy <= 8 && !g.clock; yy++) for (let xx = 0; xx <= 8 && !g.clock; xx++) {
      if (pointInPoly((lx + layer.width * xx / 8) / W, (ly + layer.height * yy / 8) / W, g.poly)) g.clock = true;
    }
  }
}
// Die Risse ändern sich nicht: einmal in eine eigene Ebene zeichnen
function renderCracks() {
  crackLayer = null;
  if (!CR) return;
  crackLayer = mk(W, H);
  const g = crackLayer.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  // an den Aufschlägen ist das Glas zertrümmert und fängt mehr Licht
  const boost = (x, y) => { let m = 0; for (const p of CR.imps) m = Math.max(m, Math.exp(-Math.hypot(x - p[0], y - p[1]) / 0.05)); return 1 + 1.3 * m; };
  // 1) dunkle Bruchkante: am Aufschlag breiter, zum Ende hin schmaler (in Stücken gezeichnet)
  g.strokeStyle = '#000';
  for (const c of CR.list) {
    const total = c.cl[c.cl.length - 1] || 1;
    let i0 = 0;
    while (i0 < c.pts.length - 1) {
      let i1 = i0 + 1;
      while (i1 < c.pts.length - 1 && c.cl[i1] - c.cl[i0] < 0.04) i1++;
      const f = c.kind === 'spoke' ? 1.35 - 0.6 * Math.min(1, c.cl[i0] / Math.max(0.3, total)) : c.kind === 'twig' ? 1.15 - 0.75 * c.cl[i0] / total : 1;
      g.lineWidth = Math.max(1, 1.25 * dpr * c.w * f);
      g.beginPath();
      for (let k = i0; k <= i1; k++) { const p = c.pts[k]; if (k === i0) g.moveTo(p[0] * W, p[1] * W); else g.lineTo(p[0] * W, p[1] * W); }
      g.stroke();
      i0 = i1;
    }
  }
  // 2) Glanz: dünne helle Linie knapp neben der Kante, auf der Seite zum Licht. Die Helligkeit schwankt weich;
  //    gleiche Helligkeit wird zu einem Linienzug zusammengefasst (sonst überlappen sich die Stücke zu Perlen).
  const shine = (c, side, amt) => {
    const o = dpr * (0.55 + 0.45 * c.w) * side;
    g.lineWidth = Math.max(1, 0.55 * dpr * (0.75 + 0.35 * c.w));
    let cur = -1, open = false;
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i], sm = (c.cl[i - 1] + c.cl[i]) / 2;
      const v = amt(sm) * c.base * c.g(sm) * boost((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      const lv = Math.round(clamp(v, 0, 1) * 14);
      if (lv !== cur) {
        if (open) { g.stroke(); open = false; }
        cur = lv;
        if (lv > 0) {
          g.strokeStyle = 'rgba(235,242,255,' + (lv / 14 * 0.7).toFixed(3) + ')';
          g.beginPath(); g.moveTo(a[0] * W + c.nx * o, a[1] * W + c.ny * o); open = true;
        }
      }
      if (open) g.lineTo(b[0] * W + c.nx * o, b[1] * W + c.ny * o);
    }
    if (open) g.stroke();
  };
  for (const c of CR.list) {
    // kleine Risse laufen zur Spitze hin aus
    const tot = c.cl[c.cl.length - 1] || 1;
    shine(c, 1, c.kind === 'twig' ? s => Math.pow(Math.max(0, 1 - s / tot), 0.7) : () => 1);
    // breite Risse am Aufschlag: auch die andere Kante fängt etwas Licht
    if (c.kind === 'spoke') shine(c, -1, s => 0.6 * Math.max(0, 1 - s / 0.18));
  }
  // 3) kleine Glassplitter am Aufschlag
  for (const s of CR.shards) {
    g.beginPath(); s.tri.forEach((p, i) => i ? g.lineTo(p[0] * W, p[1] * W) : g.moveTo(p[0] * W, p[1] * W)); g.closePath();
    g.fillStyle = 'rgba(220,230,245,' + s.a.toFixed(3) + ')'; g.fill();
    g.strokeStyle = 'rgba(240,246,255,' + s.e.toFixed(3) + ')'; g.lineWidth = Math.max(1, 0.5 * dpr); g.stroke();
  }
}

// ---------- Finger auf dem Glas ----------
// Unter dem Finger flackern und glitchen die Streifen (nur im Bruchstück, auf dem der Finger liegt), dazu tauchen
// kurz Druckstreifen auf wie bei einem echten kaputten Display. Mehrere Finger gehen auch.
const touches = new Map();
let presses = [], pressLines = [];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
function regionAt(xc, yc) {
  if (!CR) return 0;
  const X = xc / Wc, Y = yc / Wc;
  for (let i = 0; i < CR.regions.length; i++) if (pointInPoly(X, Y, CR.regions[i].poly)) return i;
  return -1;
}
function updatePresses(dt) {
  presses = [];
  // Finger zählen, wenn „Glitch unter dem Finger“ oder „Bruchstücke leuchten beim Berühren“ an ist (jedes auch allein)
  const fx = settings.touchFx === 1;
  if (!fx) pressLines = [];
  if (!fx && settings.touchFlash !== 1) { touches.clear(); return; }
  for (const [id, p] of touches) {
    const age = p.up >= 0 ? t - p.up : 0;
    if (age > 0.3) { touches.delete(id); continue; }
    const xc = p.x / dpr, yc = p.y / dpr, pr = { x: xc, y: yc, ri: regionAt(xc, yc), k: 1 - age / 0.3, down: p.up < 0 };
    presses.push(pr);
    if (fx && p.up < 0 && Math.random() < P(14) && pressLines.length < 24) {
      const L = makeLine(clamp((xc + gauss() * 9) / Wc, 0.002, 0.998));
      L.w = rnd(0.4, 1.3);
      pressLines.push({ L, ri: pr.ri, t: rnd(0.08, 0.45), col: Math.random() < 0.5 ? pick(PAL) : L.col });
    }
  }
  pressLines = pressLines.filter(q => (q.t -= dt) > 0);
}

// ---------- Schwarze Bruchstücke ----------
// Bei vielen Streifen fällt ab und zu ein ganzes Bruchstück für ein paar Sekunden aus (beim Aus- und Angehen flackert
// es kurz). Höchstens jedes vierte Stück, nie zwei nebeneinander.
function updateDead(dt) {
  if (!CR) return;
  const regs = CR.regions, many = clamp((baseN - 12) / 110, 0, 1), dk = settings.dark / 5;
  const maxDead = Math.max(1, Math.floor(regs.length / 4));
  let nd = 0;
  for (const g of regs) if (g.dead > 0) { g.dead -= dt; if (g.dead > 0) nd++; }
  if (regs.length >= 3 && dk > 0) for (const g of regs) {
    if (g.dead > 0 || nd >= maxDead) continue;
    const sb = curBursting && (burstZone === 'all' || burstZone === g.zone);
    const rate = dk * (0.0015 + 0.02 * many) * (sb ? 4 : 1);
    if (Math.random() < P(rate) && !g.nb.some(j => regs[j].dead > 0)) {
      g.dead = rnd(1, 4.5) * (0.6 + 0.8 * many); g.deadT = g.dead; nd++;
    }
  }
  // sichtbar aus? beim Aus- und Angehen kurz flackern
  for (const g of regs) g.dv = g.dead > 0 && !((g.deadT - g.dead < 0.16 || g.dead < 0.14) && Math.random() < 0.5);
}

// ---------- Bruchstücke leuchten beim Berühren ----------
// Das Stück unter dem Finger und ein, zwei weitere blitzen grauweiß flackernd auf wie ein gedrücktes, kaputtes
// Display – nie zwei, die nebeneinander liegen. Jedes Aufblitzen ist nach 0,3 bis 0,7 Sekunden vorbei; bleibt der Finger
// liegen, blitzt es nach einer kurzen Pause wieder auf, kommt er auf ein anderes Stück, sofort.
let flashRegs = [], flashKey = '', flashWait = 0;
function updateFlash(dt) {
  // laufendes Aufblitzen: flackert bis zum Ende seiner Zeit, dann schnell aus
  for (const f of flashRegs) {
    f.life -= dt;
    if (f.life <= 0) { f.a *= Math.exp(-dt * 40); continue; }
    f.next -= dt;
    if (f.next <= 0) { f.next = rnd(0.03, 0.09); f.a = Math.random() < 0.18 ? 0 : rnd(0.08, 0.5); f.c = [rint(200, 235), rint(206, 240), rint(214, 250)]; }
  }
  flashRegs = flashRegs.filter(f => f.life > 0 || f.a > 0.01);
  flashWait -= dt;
  if (!CR) return;
  const regs = CR.regions;
  const touched = settings.touchFlash === 1 ? [...new Set(presses.filter(p => p.down && p.ri >= 0).map(p => p.ri))].sort((a, b) => a - b) : [];
  if (!touched.length) { flashKey = ''; return; }
  const key = touched.join(',');
  if (key === flashKey && flashWait > 0) return;
  // neues Aufblitzen: die berührten Stücke und 0–2 weitere, die weder an ihnen noch an noch leuchtenden liegen
  flashKey = key; flashWait = rnd(1.0, 2.2);
  const set = touched.slice(), busy = flashRegs.filter(f => f.life > 0).map(f => f.i);
  const others = regs.map((_, i) => i).filter(i => !set.includes(i) && !busy.includes(i)).sort(() => Math.random() - 0.5);
  let extra = rint(0, 2);
  for (const i of others) {
    if (extra <= 0) break;
    if (set.concat(busy).some(j => regs[j].nb.includes(i))) continue;
    set.push(i); extra--;
  }
  for (const i of set) {
    let f = flashRegs.find(o => o.i === i);
    if (!f) { f = { i, a: 0, next: 0, life: 0 }; flashRegs.push(f); }
    f.life = rnd(0.27, 0.65); f.next = 0;   // mit dem schnellen Ausklingen zusammen 0,3 bis 0,7 Sekunden
  }
}
function drawFlash(ctx) {
  if (!CR) return;
  for (const f of flashRegs) {
    const g = CR.regions[f.i];
    if (!g || f.a <= 0.01 || g.dv) continue;
    const c = f.c || [220, 225, 232];
    ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + f.a.toFixed(3) + ')';
    ctx.fill(g.pathD);
  }
}

// ---------- Eigenes Bild ----------
// Liegt unter allem, zerbricht mit den Rissen (jedes Bruchstück so versetzt wie die Streifen) und lässt sich abdunkeln.
// Die Vorschau merkt sich das Bild (verkleinert) im Browser.
const IMG_KEY = 'nw-brokenscreen-bild';
let bgImg = null, bgLayer = null;
function buildBg() {
  bgLayer = null;
  if (!bgImg || W <= 1) return;
  const c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const sc = Math.max(W / bgImg.width, H / bgImg.height), iw = bgImg.width * sc, ih = bgImg.height * sc, ix = (W - iw) / 2, iy = (H - ih) / 2;
  if (CR && CR.regions.length > 1) {
    for (const r of CR.regions) {
      g.save(); g.clip(r.pathD);
      g.drawImage(bgImg, ix + Math.round(r.s * settings.shear * SHEAR_K * dpr), iy, iw, ih);
      g.restore();
    }
  } else g.drawImage(bgImg, ix, iy, iw, ih);
  g.fillStyle = 'rgba(0,0,0,' + (settings.bgDim / 100).toFixed(2) + ')'; g.fillRect(0, 0, W, H);
  bgLayer = c;
}
function setBg(src, store) {
  if (typeof Image === 'undefined') return;
  const im = new Image();
  im.onload = () => {
    const k = Math.min(1, 1600 / Math.max(im.width, im.height));
    const c = mk(im.width * k, im.height * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    bgImg = c;
    if (store) {
      try { localStorage.setItem(IMG_KEY, c.toDataURL('image/jpeg', 0.85)); }
      catch (e) { if (api) api.toast('Das Bild ist zu groß zum Merken. Es bleibt, bis die Vorschau neu geladen wird.', 5000); }
    }
    buildBg();
  };
  im.src = src;
}
function pickImage() {
  if (typeof document === 'undefined') return;
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  // im Dokument (unsichtbar), damit jeder Browser die Bildauswahl öffnet
  inp.style.display = 'none';
  if (document.body && document.body.appendChild) document.body.appendChild(inp);
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (inp.remove) inp.remove();
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { setBg(rd.result, true); if (api) api.toast('Bild gesetzt. Mit „Eigenes Bild abdunkeln“ stellst du ein, wie hell es ist.', 5000); };
    rd.readAsDataURL(f);
  };
  if (typeof inp.click === 'function') inp.click();
}
function clearBg() {
  bgImg = null; bgLayer = null;
  try { localStorage.removeItem(IMG_KEY); } catch (e) {}
  if (api) api.toast('Eigenes Bild entfernt.', 3000);
}
try { if (typeof localStorage !== 'undefined') { const d = localStorage.getItem(IMG_KEY); if (d) setBg(d, false); } } catch (e) {}

// ---------- Neue Risse mit der Zeit ----------
// Kommt ein Riss dazu, springt er mit einem kurzen Glitch ins Glas und blitzt hell auf.
function syncCracks() {
  const n = crackCount();
  if (n === shownCracks) return;
  const before = CR ? CR.divs.length : 0, grew = shownCracks >= 0 && n > shownCracks;
  makeCracks();
  if (grew && CR) {
    for (const d of CR.divs.slice(before)) crackFlash.push({ pts: d.pts, t0: t });
    triggerBurst('all'); burstT = rnd(0.2, 0.45);
  }
}
function drawCrackFlash(ctx) {
  crackFlash = crackFlash.filter(f => t - f.t0 < 0.6);
  for (const f of crackFlash) {
    const k = 1 - (t - f.t0) / 0.6;
    ctx.strokeStyle = 'rgba(240,246,255,' + (0.9 * k * k).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, (1 + 2.5 * k) * dpr);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    f.pts.forEach((p, i) => i ? ctx.lineTo(p[0] * W, p[1] * W) : ctx.moveTo(p[0] * W, p[1] * W));
    ctx.stroke();
  }
}

// ---------- Streifen zeichnen: je Bruchstück ausgeschnitten und versetzt ----------
// Bereich der Uhr in diesem Bild (CSS-Pixel, großzügig): dort verdecken die Streifen die Uhr
let CV = null;
function paintLine(L, x, y0, y1, alpha, col) {
  const [r, g, b] = col;
  let xa = x + L.tilt * Wc * (y0 / Hc - 0.5), xb = x + L.tilt * Wc * (y1 / Hc - 0.5);
  if (!L.tilt) xa = xb = (Math.round(x * dpr - 0.5) + 0.5) / dpr;   // senkrechte Streifen aufs Pixelraster
  const seg = () => { cx.beginPath(); cx.moveTo(xa, y0); cx.lineTo(xb, y1); cx.stroke(); };
  cx.lineCap = 'butt';
  // Über der Uhr ist diese Spalte des Displays kaputt: erst schwarz, dann der Streifen darauf. So liegt er wirklich
  // über der Uhr und sieht genauso aus wie auf dem schwarzen Grund (statt nur durchzuschimmern).
  if (CV && y1 > CV[1] && y0 < CV[3]) {
    const n = Math.max(1, Math.round(L.w * dpr)), xm = (xa + xb) / 2;
    if (xm + n / dpr > CV[0] && xm - n / dpr < CV[2]) {
      const ya = Math.max(y0, CV[1]), yb = Math.min(y1, CV[3]);
      const ea = L.tilt ? x + L.tilt * Wc * (ya / Hc - 0.5) : xa, eb = L.tilt ? x + L.tilt * Wc * (yb / Hc - 0.5) : xa;
      cx.globalCompositeOperation = 'source-over'; cx.strokeStyle = '#000'; cx.setLineDash([]);
      // gerade Breiten liegen halb auf den Nachbarpixeln: dort ganz abdecken, sonst bleibt ein heller Rand
      cx.lineWidth = (n % 2 === 0 ? n + 1 : n) / dpr;
      cx.beginPath(); cx.moveTo(ea, ya); cx.lineTo(eb, yb); cx.stroke();
      cx.globalCompositeOperation = 'lighter';
    }
  }
  cx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha * 0.1 + ')';
  cx.lineWidth = Math.max(L.w * 2.5, 1.5 / dpr); cx.setLineDash([]); seg();
  cx.strokeStyle = 'rgba(' + Math.min(255, r + 120) + ',' + Math.min(255, g + 120) + ',' + Math.min(255, b + 120) + ',' + alpha * 0.55 + ')';
  cx.lineWidth = Math.max(1 / dpr, L.w * 0.35); seg();
  cx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  cx.lineWidth = Math.max(1, Math.round(L.w * dpr)) / dpr; seg();
  if (L.dotted) {
    cx.strokeStyle = 'rgba(' + Math.min(255, r + 80) + ',' + Math.min(255, g + 80) + ',' + Math.min(255, b + 80) + ',' + alpha * 0.35 + ')';
    cx.lineWidth = Math.max(1 / dpr, L.w * 0.5); cx.setLineDash([1, 1.5]); seg(); cx.setLineDash([]);
  }
}
const WHOLE = [{ zone: 'all', s: 0, x0: -1, x1: 2, pathC: null, whole: true }];
// Was in diesem Bild gezeichnet wird: je Bruchstück eine Liste {L, x, a, c, spans, fl}. fl: Streifen glitcht gerade
// (Farbe, Breite und Verschiebung des Glitches, damit die Uhr an genau dieser Stelle mitglitcht).
let drawList = [];
function stripeStates(dt, calm, bursting) {
  // 1) Zustand je Streifen
  const vis = [];
  const regs = CR ? CR.regions : WHOLE, multi = regs.length > 1;
  for (const L of lines) {
    if (L.off > 0) { L.off -= dt; if (L.off > 0) continue; }
    else if (Math.random() < (bursting ? 0.02 : P(0.03 * curG))) { L.off = rnd(0.05, bursting ? 0.4 : 1.5); continue; }
    if (L.flash > 0) L.flash -= dt;
    else if (Math.random() < (bursting ? 0.25 * burstPow : P(0.12 * curG))) {
      L.flash = rnd(0.03, 0.15); L.flashCol = Math.random() < 0.5 ? pick(PAL) : L.col;
      L.bw = rnd(4, 16); L.bdx = (Math.random() < 0.5 ? -1 : 1) * rnd(1.5, 5);
      L.mask = regs.map(() => Math.random() < 0.55);
      if (!L.mask.some(Boolean)) L.mask[Math.floor(Math.random() * regs.length)] = true;
    }
    if (bursting && settings.mutate === 1 && Math.random() < 0.01) L.col = pick(PAL);
    if (!(L.flT > 0)) { L.flT = rnd(0.03, 0.09); L.fl = 1 - calm * rnd(0, 0.45); } else L.flT -= dt;
    let x = L.x * Wc;
    if (bursting && Math.random() < 0.15) x += rnd(-3, 3);
    // abgerissene Stücke: mit Rissen bleibt der Streifen nur in einzelnen Bruchstücken stehen (endet also genau am
    // Riss), ohne Risse nur unten ab einer zufälligen Höhe
    if (!L.frag && Math.random() < (bursting ? 0.02 : P(0.02 * curG))) {
      L.frag = { y0: rnd(0.55, 0.9) * Hc, t: rnd(0.3, 3), keep: null };
      if (multi) {
        L.frag.keep = regs.map(g => Math.random() < (g.zone === 'bottom' ? 0.6 : 0.25));
        if (!L.frag.keep.some(Boolean)) L.frag.keep[Math.floor(Math.random() * regs.length)] = true;
      }
    }
    let spans = [[0, Hc, 1]], keep = null;
    if (L.frag) {
      L.frag.t -= dt;
      if (L.frag.keep) keep = L.frag.keep;
      else {
        spans = [[L.frag.y0, Hc, 1]];
        if (Math.random() < 0.2) spans.push([L.frag.y0 - rnd(10, 60), L.frag.y0 - rnd(2, 8), 0.7]);
      }
      if (L.frag.t <= 0) L.frag = null;
    }
    // gerade erst aufgetaucht: kurz hell aufblitzen
    const born = L.born >= 0 && t - L.born < 0.45;
    vis.push({ L, x, a: Math.max(0, Math.min(1, L.base * L.fl)), spans, keep, born });
  }
  // 2) je Bruchstück: Versatz, Ausfälle und Farbblitze der Teilstücke
  // bei vielen Streifen fallen Teilstücke öfter und länger aus
  const many = clamp((baseN - 12) / 110, 0, 1);
  drawList = regs.map((g, ri) => {
    const out = [];
    // ganz ausgefallenes Bruchstück: bleibt schwarz
    if (g.dv) return out;
    const dx = Math.round(g.s * settings.shear * SHEAR_K * dpr * jit()) / dpr;
    const lo = g.x0 * Wc - 6, hi = g.x1 * Wc + 6;
    const sb = curBursting && multi && (burstZone === 'all' || burstZone === g.zone);
    for (const v of vis) {
      const L = v.L;
      let x = v.x + dx;
      if (x < lo || x > hi || (v.keep && !v.keep[ri])) continue;
      const z = L.zones[ri] || (L.zones[ri] = { flash: 0, col: null, off: 0 });
      if (multi) {
        // zwischen den Rissen fällt ein Streifen ab und zu für eine Weile aus
        if (z.off > 0) { z.off -= curDt; if (z.off > 0) continue; }
        else if (Math.random() < (sb ? 0.035 * burstPow : P(0.05 * curG * (1 + 1.2 * many)))) { z.off = rnd(0.2, sb ? 1.2 : 2.2 + 2.3 * many); continue; }
        if (z.flash > 0) z.flash -= curDt;
        else if (Math.random() < (sb ? 0.3 * burstPow : P(0.18 * curG))) {
          z.flash = rnd(0.03, 0.18); z.col = Math.random() < 0.6 ? pick(PAL) : L.col;
          z.bw = rnd(4, 16); z.bdx = (Math.random() < 0.5 ? -1 : 1) * rnd(1.5, 5);
        }
      }
      let a = v.a, c = L.col, fl = null;
      if (L.flash > 0 && (!L.mask || L.mask[ri] !== false)) { a = Math.random() < 0.5 ? rnd(1, 1.6) : rnd(0.05, 0.3); c = L.flashCol || L.col; fl = { col: c, w: L.bw, dx: L.bdx }; }
      else if (multi && z.flash > 0) { a = Math.random() < 0.5 ? rnd(1, 1.6) : rnd(0.05, 0.3); c = z.col; fl = { col: c, w: z.bw, dx: z.bdx }; }
      if (v.born) { a = Math.random() < 0.6 ? rnd(1, 1.6) : rnd(0.1, 0.4); if (Math.random() < 0.3) c = pick(PAL); }
      // Finger auf diesem Bruchstück, genau über dem Streifen
      if (settings.touchFx === 1) for (const pr of presses) {
        if ((pr.ri !== ri && CR) || Math.abs(x - pr.x) > 16 + L.w * 4) continue;
        a = Math.random() < 0.5 ? rnd(0.9, 1.6) : rnd(0.05, 0.5);
        if (Math.random() < 0.4) c = pick(PAL);
        x += rnd(-1.5, 1.5) * pr.k;
        fl = { col: c, w: rnd(4, 14), dx: rnd(-4, 4) };
        break;
      }
      out.push({ L, x, a, c, spans: v.spans, fl });
    }
    return out;
  });
}
// je Bruchstück ausschneiden und die Streifen zeichnen
function drawStripes(bursting) {
  const regs = CR ? CR.regions : WHOLE;
  regs.forEach((g, ri) => {
    // ausgefallenes Bruchstück: bleibt ganz schwarz
    if (g.dv) return;
    const list = drawList[ri];
    const pl = pressLines.filter(q => q.ri === ri || !CR);
    if ((!list || !list.length) && !pl.length) return;
    if (g.pathC) { cx.save(); cx.clip(g.pathC); }
    if (list) for (const d of list) for (const sp of d.spans) paintLine(d.L, d.x, sp[0], sp[1], Math.max(0, Math.min(1, d.a * sp[2])), d.c);
    for (const q of pl) paintLine(q.L, q.L.x * Wc, 0, Hc, rnd(0.3, 1), Math.random() < 0.2 ? pick(PAL) : q.col);
    if (g.pathC) cx.restore();
  });
  // während Ausbrüchen tauchen kurz neue Streifen auf
  if (bursting && Math.random() < 0.35) {
    const tmp = makeLine(); tmp.w = rnd(0.5, 1.2);
    paintLine(tmp, tmp.x * Wc, Math.random() < 0.5 ? 0 : rnd(0.3, 0.8) * Hc, Hc, rnd(0.6, 1), tmp.col);
  }
}

// ---------- Metall-Uhr in 3D: Normalenkarte, Neigung ----------
const clockOn = () => settings.clockWhere !== 3;
let m3dOK = false, bigPx = 0, glowCv = null;
// wird von buildLayer (uhrface.js) aufgerufen, sobald sich die Uhr ändert (jede Minute, Einstellungen, Größe)
function onLayerBuilt(L) {
  bigPx = L.big; m3dOK = false; glowCv = null;
  if (!m3dInit()) return;
  const lw = L.lw, lh = L.lh;
  const A = new Uint8ClampedArray(lw * lh * 4), B = new Uint8ClampedArray(lw * lh * 4);
  const put = (nm, ox, oy) => {
    for (let y = 0; y < nm.h; y++) {
      const Y = oy + y;
      if (Y < 0 || Y >= lh) continue;
      for (let x = 0; x < nm.w; x++) {
        const X = ox + x;
        if (X < 0 || X >= lw) continue;
        const s = (y * nm.w + x) * 4, d = (Y * lw + X) * 4;
        if (nm.data[s + 3] > A[d + 3]) { A[d] = nm.data[s]; A[d + 1] = nm.data[s + 1]; A[d + 2] = nm.data[s + 2]; A[d + 3] = nm.data[s + 3]; }
      }
    }
  };
  for (const g of L.tl.list) { const nm = glyphNM(g.ch, L.big, false); put(nm, Math.round(L.tx + g.x) - nm.pad, L.m - nm.pad); }
  for (const g of L.dl.list) { const nm = glyphNM(g.ch, L.small, true); put(nm, Math.round(L.dx0 + g.x) - nm.pad, L.m + L.big + L.gap - nm.pad); }
  // je Zeile: Höhe 0..1 innerhalb der Uhrzeit bzw. des Datums (dort läuft der Horizont durch) und ob es das Datum ist;
  // dazu, ob eine Ziffer in Reichweite der Seitenwände liegt (sonst rechnet der Shader dort nichts)
  const pad = Math.ceil(L.big * 0.07 + 12 * dpr * 0.6 + 4);
  const out = new Uint8Array(lw * lh);
  for (let i = 0; i < lw * lh; i++) out[i] = A[i * 4 + 3] > 0 ? 0 : 1;
  const near = edt2(out, lw, lh);
  const dTop = L.m + L.big + L.gap;
  for (let y = 0; y < lh; y++) {
    const isD = !!L.ds && y >= dTop - 3;
    const v = isD ? (y + 0.5 - dTop) / L.small : (y + 0.5 - L.m) / L.big;
    const vb = clamp(v, 0, 1) * 255, db = isD ? 255 : 0;
    for (let x = 0; x < lw; x++) { const i = y * lw + x, d = i * 4; B[d] = vb; B[d + 1] = db; B[d + 2] = near[i] <= pad + 2 ? 255 : 0; B[d + 3] = 255; }
  }
  m3dOK = m3dSetLayer(A, B, lw, lh, pad);
  if (!m3dOK) return;
  // beim Neon der Schein: weichgezeichnete Form
  const mask = mk(lw, lh), mx = mask.getContext('2d');
  if (!mx || !mx.createImageData) return;
  const id = mx.createImageData(lw, lh);
  for (let i = 0; i < lw * lh; i++) id.data[i * 4 + 3] = A[i * 4 + 3];
  mx.putImageData(id, 0, 0);
  const soft = (r, col) => {
    const sp = Math.ceil(r * 2.5), c = mk(lw + 2 * sp, lh + 2 * sp), x = c.getContext('2d');
    x.filter = 'blur(' + r.toFixed(1) + 'px)'; x.drawImage(mask, sp, sp); x.filter = 'none';
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return { c, sp };
  };
  const F = FIN[settings.finish] || FIN[0];
  if (F.neon) glowCv = soft(Math.max(3, L.big * 0.1), 'rgb(' + F.neon + ')');
}
// Neigung: vom Neigungssensor (relativ zur Haltung, die sich langsam nachführt) oder ohne Sensor sanft von selbst
let tilt = [0, 0], sens = null, rest = null, sensorAt = -1e9, tiltHintDone = false;
if (typeof addEventListener === 'function') addEventListener('deviceorientation', e => {
  if (e.beta == null || e.gamma == null) return;
  sens = [e.gamma, e.beta]; sensorAt = t;
  if (!rest) rest = sens.slice();
});
function updateTilt(dt) {
  let tx, ty;
  if (sens && t - sensorAt < 1.5) {
    const k = 1 - Math.exp(-dt / 4);
    rest[0] += (sens[0] - rest[0]) * k; rest[1] += (sens[1] - rest[1]) * k;
    tx = clamp((sens[0] - rest[0]) / 22, -1, 1); ty = clamp((rest[1] - sens[1]) / 22, -1, 1);
  } else { tx = 0.75 * Math.sin(t * 0.7); ty = 0.5 * Math.sin(t * 0.5 + 1); }
  const s = 1 - Math.exp(-dt * 9);
  tilt[0] += (tx - tilt[0]) * s; tilt[1] += (ty - tilt[1]) * s;
}
// Aktuelles Bild der Uhr (CL) und seine Lage (CLX, CLY) in Gerätepixeln
let CL = null, CLX = 0, CLY = 0;
function prepClock(dt) {
  CL = null;
  if (!layer) return;
  updateTilt(dt);
  const k3 = settings.d3 / 10, T = [tilt[0] * k3, tilt[1] * k3], amp = 12 * dpr;
  // die Uhr liegt im Display, tiefer als die Streifen: sie wandert mit dem Blick (Parallax), ihr Sockel noch etwas
  // mehr – so zeigen sich die Seitenwände der Ziffern auf der Seite, von der man schaut
  const ox = amp * T[0] * 0.6, oy = amp * T[1] * 0.6;
  const ix = Math.floor(ox), iy = Math.floor(oy);
  if (m3dOK) {
    const depth = Math.max(1, bigPx * (0.026 + 0.04 * k3));
    M3D.sub = [ox - ix, oy - iy];
    CL = m3dRender(settings.finish, T, [amp * T[0] * 0.4, depth + amp * T[1] * 0.4], 0.3, FIN[settings.finish] || FIN[0]);
    CLX = lx - M3D.pad + ix; CLY = ly - M3D.pad + iy;
  } else { CL = layer; CLX = lx + Math.round(ox); CLY = ly + Math.round(oy); }
}

// ---------- Uhr in Bruchstücken (Gerätepixel) ----------
// Die Uhr glitcht nur dort, wo gerade auch die Streifen glitchen: bei einem Ausbruch in ihrem Bereich als Ganzes
// (Farbkanäle, verrutschte Zeilen, Farbblitz, kurzer Ausfall), sonst nur in einem schmalen Band um jeden Streifen, der
// gerade aufblitzt – dort verrutscht sie ein Stück zur Seite und nimmt seine Farbe an.
const tintCache = new Map();
let tintSrc = null, tintFrame = -1, chanC = null, chanFrame = -1;
function tinted(col) {
  if (tintSrc !== CL || (CL !== layer && tintFrame !== frameNo)) { tintCache.clear(); tintSrc = CL; tintFrame = frameNo; }
  const key = col.join(',');
  let c = tintCache.get(key);
  if (!c) {
    c = mk(CL.width, CL.height);
    const x = c.getContext('2d');
    x.drawImage(CL, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgb(' + key + ')'; x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
  }
  return c;
}
// Farbkanäle einzeln (für den Farbversatz bei Glitches)
function chan(i) {
  if (CL === layer && layerC.length) return layerC[i];
  if (chanFrame !== frameNo || !chanC || chanC[0].width !== CL.width || chanC[0].height !== CL.height) {
    chanFrame = frameNo;
    chanC = [[255, 0, 0], [0, 255, 0], [0, 0, 255]].map((col, k) => {
      const c = chanC && chanC[k].width === CL.width && chanC[k].height === CL.height ? chanC[k] : mk(CL.width, CL.height), y = c.getContext('2d');
      y.globalCompositeOperation = 'copy'; y.drawImage(CL, 0, 0);
      y.globalCompositeOperation = 'source-in'; y.fillStyle = 'rgb(' + col + ')'; y.fillRect(0, 0, c.width, c.height);
      y.globalCompositeOperation = 'multiply'; y.drawImage(CL, 0, 0);
      y.globalCompositeOperation = 'source-over';
      return c;
    });
  }
  return chanC[i];
}
function clockZone() {
  const c = (ly + layer.height / 2) / H;
  return c < 1 / 3 ? 'top' : c > 2 / 3 ? 'bottom' : 'mid';
}
function drawClockPiece(ctx, g, key, calm, bands) {
  const lw = CL.width, lh = CL.height;
  const z = clockZones[key] || (clockZones[key] = { off: 0, flash: 0, col: null, fl: 1, flT: 0, split: 0, sx: 0, slice: 0 });
  const sb = curBursting && (burstZone === 'all' || burstZone === (g ? g.zone : clockZone()));
  if (z.off > 0) { z.off -= curDt; if (z.off > 0) return; }
  else if (sb && Math.random() < 0.02 * burstPow) { z.off = rnd(0.04, 0.3); return; }
  if (z.flash > 0) z.flash -= curDt; else if (sb && Math.random() < 0.18 * burstPow) { z.flash = rnd(0.03, 0.15); z.col = pick(PAL); }
  if (z.split > 0) z.split -= curDt; else if (sb && Math.random() < 0.12 * burstPow) { z.split = rnd(0.04, 0.22); z.sx = rnd(2, 7) * dpr * (Math.random() < 0.5 ? -1 : 1); }
  if (z.slice > 0) z.slice -= curDt; else if (sb && Math.random() < 0.05 * burstPow) z.slice = rnd(0.05, 0.2);
  if (!(z.flT > 0)) { z.flT = rnd(0.03, 0.09); z.fl = 1 - calm * rnd(0, 0.22); } else z.flT -= curDt;
  ctx.save();
  if (g) ctx.clip(g.pathD);
  // Versatz des Stücks: zur Seite und etwas nach unten, Stärke nach „Riss durch die Uhr“ (halb so stark wie früher)
  const k = g ? settings.crack : 0;
  const X = CLX + (g ? Math.round(g.s * k * 0.45 * dpr * jit()) : 0), Y = CLY + (g ? Math.round(Math.abs(g.s) * k * 0.06 * dpr) : 0);
  // Bänder glitchender Streifen über der Uhr: dort wird die Uhr gleich verrutscht gezeichnet, also hier aussparen
  const bs = [];
  for (const b of bands) {
    const bx = b.x * dpr, bw = Math.max(2, b.w * dpr);
    if (bx + bw / 2 < X || bx - bw / 2 > X + lw || bs.length >= 10) continue;
    bs.push({ x0: bx - bw / 2, x1: bx + bw / 2, b });
  }
  if (bs.length) {
    // Außenrechteck im Uhrzeigersinn, Bänder gegen den Uhrzeigersinn: Löcher auch bei Überlappung
    const p = new Path2D();
    p.rect(X - 8, Y - 8, lw + 16, lh + 16);
    for (const q of bs) { p.moveTo(q.x0, Y - 2); p.lineTo(q.x0, Y + lh + 2); p.lineTo(q.x1, Y + lh + 2); p.lineTo(q.x1, Y - 2); p.closePath(); }
    ctx.save(); ctx.clip(p);
  }
  ctx.globalAlpha = z.fl;
  if (z.split > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(chan(0), X + z.sx, Y); ctx.drawImage(chan(1), X, Y); ctx.drawImage(chan(2), X - z.sx, Y);
  } else if (z.slice > 0) {
    const n = rint(3, 6);
    for (let s = 0; s < n; s++) {
      const sy = Math.floor(lh * s / n), sh = Math.ceil(lh / n);
      ctx.drawImage(CL, 0, sy, lw, sh, X + rnd(-1, 1) * 10 * dpr, Y + sy, lw, sh);
    }
  } else ctx.drawImage(CL, X, Y);
  if (z.flash > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * z.fl; ctx.drawImage(tinted(z.col), X, Y);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (bs.length) ctx.restore();
  // einzelne Streifen glitchen: in ihrem Band verrutscht die Uhr und nimmt ihre Farbe an
  for (const q of bs) {
    ctx.save();
    ctx.beginPath(); ctx.rect(q.x0, Y - 2, q.x1 - q.x0, lh + 4); ctx.clip();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = z.fl; ctx.drawImage(CL, X + q.b.dx * dpr, Y);
    ctx.globalAlpha = 0.55 * z.fl; ctx.drawImage(tinted(q.b.col), X + q.b.dx * dpr, Y);
    ctx.restore();
  }
  ctx.restore();
}
// glitchende Streifen eines Bruchstücks (ri) bzw. aller Stücke im Bereich der Uhr (ri = -1)
function glitchBands(ri) {
  const out = [];
  const regs = CR ? CR.regions : WHOLE;
  regs.forEach((g, i) => {
    if (ri >= 0 ? i !== ri : (CR && !g.clock)) return;
    for (const d of drawList[i] || []) if (d.fl) out.push({ x: d.x, w: d.fl.w, dx: d.fl.dx, col: d.fl.col });
  });
  return out;
}
function drawClock(ctx, calm) {
  if (!CL) return;
  // liegt die Uhr ganz in ausgefallenen Bruchstücken, bleibt sie mit ihnen schwarz
  if (CR && CR.regions.some(g => g.clock) && CR.regions.every(g => !g.clock || g.dv)) return;
  // Bereich der Uhr samt Platz für versetzte Bruchstücke und verrutschte Zeilen (für die Streifen darüber)
  const M = 30 * dpr;
  CV = [(CLX - M) / dpr, (CLY - M) / dpr, (CLX + CL.width + M) / dpr, (CLY + CL.height + M) / dpr];
  // beim Neon der Schein
  ctx.globalCompositeOperation = 'source-over';
  if (glowCv && CL !== layer) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8;
    ctx.drawImage(glowCv.c, CLX + M3D.pad - glowCv.sp, CLY + M3D.pad - glowCv.sp);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const pieces = CR && settings.crack > 0 ? CR.regions.filter(g => g.clock) : [];
  if (pieces.length < 2) { drawClockPiece(ctx, null, 'ganz', calm, glitchBands(-1)); return; }
  for (const g of pieces) { if (g.dv) continue; const i = CR.regions.indexOf(g); drawClockPiece(ctx, g, i, calm, glitchBands(i)); }
}

// ---------- Aufschlag antippen, Risse von selbst wechseln ----------
let api = null, tapStep = 0, tapP = [], autoT = 0;
function newCracks() { crackSeed = (Math.random() * 2147483647) | 0; makeCracks(); autoT = 0; }
const nImpacts = () => clamp((settings.impacts | 0) + 1, 1, 3);
function tapAsk() {
  if (!api) return;
  const K = nImpacts(), k = Math.floor((tapStep - 1) / 2) + 1;
  if (tapStep % 2 === 1) api.toast(K === 1 ? 'Tippe auf die Stelle, an der das Handy aufgeschlagen ist.' : 'Tippe auf die Stelle des ' + k + '. Aufschlags (von ' + K + ').', 60000);
  else api.toast(K === 1 ? 'Und jetzt dorthin tippen, wohin der Riss laufen soll.' : 'Und jetzt dorthin tippen, wohin der Riss vom ' + k + '. Aufschlag laufen soll.', 60000);
}
function startTap() {
  tapStep = 1; tapP = [];
  if (api) api.hideSheet();
  tapAsk();
}
function toggleFast() {
  timeScale = timeScale > 1 ? 1 : 1200;
  if (api) api.toast(timeScale > 1 ? 'Zeitraffer an: 1 Stunde vergeht in 3 Sekunden (für „Mehr Streifen/Risse mit der Zeit“ und „Risse wechseln nach Stunden“).' : 'Zeitraffer aus.', 5000);
}

return {
  maxDpr: 4,
  settings, controls,
  actionLabel: 'Glitch jetzt',
  buttons: [{ label: 'Aufschlag antippen', run: startTap }, { label: 'Bild wählen', run: pickImage }, { label: 'Bild entfernen', run: clearBg }, { label: 'Zeitraffer', run: toggleFast }],
  bindUI(a) { api = a; },
  // Antippen im Auswahlmodus: je Aufschlag erst die Stelle, dann die Richtung des Risses
  tap(x, y) {
    if (!tapStep) return false;
    tapP.push([clamp(x / W, 0, 1), clamp(y / H, 0, 1)]);
    const K = nImpacts();
    if (tapP.length < 2 * K) { tapStep++; tapAsk(); return true; }
    tapStep = 0;
    const px = [-1, -1, -1], py = [-1, -1, -1], tx = [-1, -1, -1], ty = [-1, -1, -1];
    for (let k = 0; k < K; k++) { px[k] = tapP[2 * k][0]; py[k] = tapP[2 * k][1]; tx[k] = tapP[2 * k + 1][0]; ty[k] = tapP[2 * k + 1][1]; }
    if (api) { api.set('px', px); api.set('py', py); api.set('tx', tx); api.set('ty', ty); api.set('impact', 1); }
    else { settings.px = px; settings.py = py; settings.tx = tx; settings.ty = ty; settings.impact = 1; }
    tapP = [];
    newCracks();
    if (api) api.toast('Fertig! „Neues Muster“ zeigt einen anderen Verlauf, unter „Aufschlagstelle“ geht es zurück auf Zufall.', 5000);
    return true;
  },
  // Finger auf dem Glas (Gerätepixel)
  touch(type, x, y, id) {
    if (type === 'up') { const p = touches.get(id); if (p) p.up = t; return; }
    const p = touches.get(id);
    if (p && p.up < 0) { p.x = x; p.y = y; } else touches.set(id, { x, y, up: -1 });
  },
  resize(w, h, d) {
    W = w; H = h; dpr = d; Wc = W / dpr; Hc = H / dpr;
    for (const k in cache) delete cache[k];
    for (const k in nmCache) delete nmCache[k];
    buildLayer();
    makeCracks();
  },
  newPattern() { newStripes(); growT = 0; pendingRestart = false; crackGrowT = 0; crackPending = false; crackSeed = (Math.random() * 2147483647) | 0; shownCracks = -1; makeCracks(); autoT = 0; },
  action() { triggerBurst(); if (settings.auto === 1 && burstZone === 'all') newCracks(); },
  wake() {
    if (settings.rndWake === 1) { newStripes(); newCracks(); }
    triggerBurst('all'); burstT = rnd(0.25, 0.6);
  },
  change(id) {
    if (id === 'countPos' || id === 'countMax' || id === 'growBatt' || id === 'battTest' || id === 'growHours') applyCount(true);
    if (id === 'growTime') { growT = 0; pendingRestart = false; applyCount(true); }
    if (id === 'burst') { nextBurst = scheduleBurst(settings.burst / 10); burstT = 0; }
    if (id === 'finish') for (const k in cache) delete cache[k];
    if (id === 'size' || id === 'date' || id === 'finish' || id === 'cy') buildLayer();
    if (id === 'cy') updateClockPieces();
    if (id === 'crackGrow') { crackGrowT = 0; crackPending = false; }
    if (id === 'cracks' || id === 'cracksMax' || id === 'crackGrow' || id === 'crackHours' || id === 'hshare' || id === 'splinter' ||
        id === 'clockWhere' || id === 'crack' || id === 'size' || id === 'date') makeCracks();
    if (id === 'shear' || id === 'bgDim') buildBg();
    // „Selbst angetippt“ ohne angetippte Stellen: gleich antippen lassen
    const tapped = () => { for (let k = 0; k < nImpacts(); k++) if (!(settings.px[k] >= 0 && settings.tx[k] >= 0)) return false; return true; };
    if (id === 'impact') { if (settings.impact === 1 && !tapped()) startTap(); else { tapStep = 0; newCracks(); } }
    if (id === 'impacts') { if (settings.impact === 1 && !tapped()) startTap(); else { tapStep = 0; makeCracks(); } }
    if (id === 'auto' || id === 'hours') autoT = 0;
  },
  // Regler losgelassen: Höhe der Uhr fertig verschoben, jetzt erst den Riss neu durch die Uhr legen
  release(id) { if (id === 'cy') makeCracks(); },
  // zum Ausprobieren in der Entwicklung: bestimmter Zufallswert für die Risse
  seed(v) { crackSeed = v | 0; makeCracks(); },
  info() { return CR; },
  dbg() { return { presses: presses.length, pressLines: pressLines.length, lines: lines.length, m3d: m3dOK, regions: CR ? CR.regions.length : 0, divs: CR ? CR.divs.length : 0, dead: CR ? CR.regions.filter(g => g.dead > 0).length : 0, flash: flashRegs.length }; },
  // Entwicklung: feste Neigung (null = wieder Sensor/automatisch), Zeit vorspulen
  setTilt(x, y) { if (x == null) { sens = null; sensorAt = -1e9; } else { sens = [x * 22, -y * 22]; rest = [0, 0]; sensorAt = t + 1e9; tilt = [x, y]; } },
  skip(sec) { growT += sec; autoT += sec; crackGrowT += sec; },
  // Entwicklung: alle Streifen kurz aufblitzen lassen
  flashAll(n) { lines.slice(0, n || lines.length).forEach(L => { L.flash = 0.2; L.flashCol = pick(PAL); L.bw = 10; L.bdx = 4; L.mask = null; }); },
  frame(ctx, dt) {
    t += dt; cx = ctx; frameNo++;
    const calm = settings.calm / 10, bur = settings.burst / 10;
    const TX = texts();
    if (stamp !== TX.time + TX.ds) { buildLayer(); updateClockPieces(); }
    if (burstT > 0) {
      burstT -= dt;
      // nach einem Glitch-Ausbruch manchmal ein neues Streifenmuster (Risse bleiben)
      if (burstT <= 0 && settings.mutate === 1 && Math.random() < 0.5 && !pendingRestart) newStripes();
    }
    else if (bur > 0) {
      nextBurst -= dt;
      if (nextBurst <= 0) {
        triggerBurst(); nextBurst = scheduleBurst(bur);
        // Risse wechseln mit großen Glitch-Ausbrüchen
        if (settings.auto === 1 && burstZone === 'all') newCracks();
      }
    }
    // Risse wechseln nach Stunden
    if (settings.auto === 2) { autoT += dt * timeScale; if (autoT >= settings.hours * 3600) newCracks(); }
    // Mehr Streifen mit der Zeit: am Ende großer Glitch, danach geht es mit wenigen Streifen von vorn los
    if (settings.growTime === 1 && !pendingRestart) {
      growT += dt * timeScale;
      if (growT >= settings.growHours * 3600) {
        pendingRestart = true; triggerBurst('all'); burstT = rnd(1.2, 1.6); burstPow = 1.5;
        if (settings.auto === 1) newCracks();
      }
    }
    if (pendingRestart && burstT <= 0) { pendingRestart = false; growT = 0; newStripes(); }
    // Mehr Risse mit der Zeit: am Ende großer Glitch, danach ein neues Rissmuster mit wenigen Rissen
    if (settings.crackGrow === 1 && settings.cracksMax > settings.cracks && !crackPending) {
      crackGrowT += dt * timeScale;
      if (crackGrowT >= settings.crackHours * 3600) { crackPending = true; triggerBurst('all'); burstT = rnd(1.2, 1.6); burstPow = 1.5; }
    }
    if (crackPending && burstT <= 0) { crackPending = false; crackGrowT = 0; crackSeed = (Math.random() * 2147483647) | 0; shownCracks = -1; }
    syncCracks();
    applyCount(true);
    curDt = dt; curBursting = burstT > 0;
    curG = bur > 0 ? 0.02 + 0.98 * Math.pow(bur, 1.6) : 0;
    const bursting = curBursting && burstZone === 'all';
    updatePresses(dt);
    updateFlash(dt);
    updateDead(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (bgLayer) ctx.drawImage(bgLayer, 0, 0);
    else { ctx.fillStyle = bursting && Math.random() < 0.3 ? 'rgba(0,30,10,.5)' : 'rgba(0,12,4,.6)'; ctx.fillRect(0, 0, W, H); }
    // ausgefallene Bruchstücke: schwarz
    if (CR) { ctx.fillStyle = '#000'; for (const g of CR.regions) if (g.dv) ctx.fill(g.pathD); }
    stripeStates(dt, calm, bursting);
    // die Uhr gehört zum Bild des Displays: die kaputten Streifen laufen über sie, die Glasrisse über allem
    CV = null;
    if (clockOn()) { prepClock(dt); drawClock(ctx, calm); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    drawFlash(ctx);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    drawStripes(bursting);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (crackLayer) ctx.drawImage(crackLayer, 0, 0);
    drawCrackFlash(ctx);
    // beim Antippen: Markierungen der schon gewählten Aufschlagstellen (Kreis) und Richtungen (Punkt mit Linie)
    if (tapStep > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.5 * dpr;
      for (let i = 0; i < tapP.length; i++) {
        const mx = tapP[i][0] * W, my = tapP[i][1] * H;
        if (i % 2 === 0) {
          ctx.beginPath(); ctx.arc(mx, my, 10 * dpr, 0, 2 * Math.PI); ctx.stroke();
          ctx.beginPath(); ctx.arc(mx, my, 2 * dpr, 0, 2 * Math.PI); ctx.fill();
        } else {
          const q = tapP[i - 1];
          ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.beginPath(); ctx.moveTo(q[0] * W, q[1] * H); ctx.lineTo(mx, my); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    // einmal sagen, ob der Neigungssensor in der Vorschau ankommt
    if (!tiltHintDone && t > 2.5 && clockOn() && settings.d3 > 0 && api) {
      tiltHintDone = true;
      api.toast(t - sensorAt < 1.5 ? 'Neige das Handy: Die Uhr bewegt sich in 3D.' : 'In dieser Vorschau kommt der Neigungssensor nicht an. Die Uhr schwenkt deshalb von selbst hin und her, in der App folgt sie dem Handy.', 6000);
    }
  },
};
