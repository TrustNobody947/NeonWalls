// Broken Screen: flackernde Farbstreifen wie bei einem kaputten Display, dazu echte Glasrisse.
// Das Handy ist an bis zu drei Stellen aufgeschlagen (zufällig direkt am Rand in einer Ecke oder an einer Kante,
// selten mitten im Glas, „Neues Muster“ würfelt neu, oder selbst angetippt: erst die Stelle, dann wohin der Riss
// laufen soll). Jeder Aufschlag sieht anders aus: schlicht, Stern, Spinnennetz oder Fächer, mit mehr oder weniger
// kurzen Strahlen, Ringen und Splittern. Von dort laufen die Risse übers Bild, auf Wunsch laufen auch Risse waagerecht
// quer über den Bildschirm. Jeder Riss endet am Rand oder an einem anderen Riss (bis zu 36). Manche haben einen
// Abzweig, an den großen hängen kleine Risse, dazu ein paar feine Haarrisse (nicht mitgezählt). Auf Wunsch werden es
// mit der Zeit mehr Risse (1–24 Stunden, am Ende großer Glitch und von vorn), oder sie wechseln von selbst.
// Glitch-Ausbrüche dauern 0,3 bis 0,8 Sekunden.
// Die Risse teilen das Display in Bruchstücke: Jedes Stück ist ein wenig versetzt und flackert für sich, die Streifen
// enden genau an der Risskante. Fällt ein Streifen in einem Stück aus, stirbt er an der Risskante (kurzes Flackern) und
// bleibt dort 30 Sekunden bis 5 Minuten weg – sobald ein Riss da ist, fehlt bei 4 Streifen einer, bei 5 zwei, mit mehr
// Streifen mehr. Ab und zu bleibt ein ganzes Stück schwarz, wie lange, stellt der Regler ein (ein paar Sekunden bis
// etwa 20 Minuten); bei etwa jedem zweiten bleiben auf einer Seite ein paar Streifen stehen.
// Nach dem Tippen auf einen Knopf verschwindet das Menü, damit man das Bild sieht (Antippen holt es zurück); beim
// Schieben eines Reglers tritt es zurück.
// Der Riss selbst: feine dunkle Bruchkante mit dünnem Glanz daneben (Licht von oben). Mal feiner und glatter, mal
// etwas kräftiger, zackiger und heller glänzend – aber immer fein.
// Auf Wunsch werden die Streifen mit der Zeit (1–24 Stunden) oder mit sinkendem Akku mehr; ist die Zeit um, gibt es
// einen großen Glitch und es geht von vorn los. Unter dem Finger flackern die Streifen, dazu kurze Druckstreifen.
// Flächenglitch (ab 5 Rissen): Das Bruchstück unter dem Finger flackert grau und blitzt dazwischen weiß wie ein
// Stroboskop (dann ist dort alles weiß, auch die Streifen), 0,3 bis 0,7 Sekunden. Kleine Stücke fast immer, große
// selten, ganz große nie; bei sehr vielen Rissen blitzt ab und zu ein Nachbarstück kurz mit.
// Eigenes Bild: liegt unter allem, zerbricht mit den Rissen (jedes Stück etwas versetzt) und lässt sich abdunkeln.
// Die Uhr ist aus Metall in 3D und liegt im Display: Beim Neigen wandert sie etwas mit, ihre Seitenwände zeigen sich
// und die Spiegelung wandert; die kaputten Streifen laufen über sie, die Risse bleiben fest im Glas.
// Mit Uhr läuft einer der Risse (zufällig welcher) mitten durch die Ziffern und weiter übers Bild; die Uhr zerfällt
// dort in Stücke.
const settings = { cracks: 3, cracksMax: 10, crackGrow: 0, crackHours: 6, impacts: 0, impact: 0, hshare: 30,
  splinter: 1, auto: 0, hours: 6, shear: 5, dark: 5, calm: 4, burst: 5, countPos: 59,
  countMax: 85, growTime: 0, growHours: 6, growBatt: 0, battTest: 0, touchFx: 1, touchFlash: 1,
  rndWake: 0, mutate: 0, bgDim: 40, clockWhere: 2, d3: 5, cy: 15, crack: 5, size: 5, date: 0, finish: 7,
  // selbst angetippt, je Aufschlag: Stelle (px, py) und Richtung (tx, ty) als Anteil von Breite und Höhe
  px: [-1, -1, -1], py: [-1, -1, -1], tx: [-1, -1, -1], ty: [-1, -1, -1] };
const countFromPos = v => Math.round(3 * Math.pow(50, v / 100));
const hoursFmt = v => v + (v == 1 ? ' Stunde' : ' Stunden');
const controls = [
  { type: 'range', id: 'cracks', label: 'Anzahl Risse (von)', min: 0, max: 36, fmt: v => v == 0 ? 'keine' : String(v), focus: true },
  { type: 'range', id: 'cracksMax', label: 'Anzahl Risse bis', min: 0, max: 36, fmt: v => String(v), focus: true },
  { type: 'choice', id: 'crackGrow', label: 'Mehr Risse mit der Zeit', options: ['Aus', 'An'] },
  { type: 'range', id: 'crackHours', label: 'Von „von“ bis „bis“ in', min: 1, max: 24, fmt: hoursFmt, focus: true },
  { type: 'info', id: 'crackInfo', text: () => crackInfo() },
  { type: 'choice', id: 'impacts', label: 'Aufschläge', options: ['1', '2', '3'] },
  { type: 'choice', id: 'impact', label: 'Aufschlagstelle', options: ['Zufällig', 'Selbst angetippt'] },
  { type: 'range', id: 'hshare', label: 'Waagerechte Risse quer übers Bild', min: 0, max: 100, step: 10, fmt: v => v + ' %', focus: true },
  { type: 'choice', id: 'splinter', label: 'Splitter am Aufschlag', options: ['Aus', 'Wenig', 'Viel'] },
  { type: 'choice', id: 'auto', label: 'Risse wechseln von selbst', options: ['Aus', 'Bei Glitches', 'Nach Stunden'] },
  { type: 'range', id: 'hours', label: 'Wechsel nach Stunden: alle', min: 1, max: 24, fmt: hoursFmt, focus: true },
  { type: 'range', id: 'shear', label: 'Versatz am Riss', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'dark', label: 'Schwarze Stellen zwischen den Rissen', min: 0, max: 10, fmt: v => darkFmt(v), focus: true },
  { type: 'range', id: 'calm', label: 'Grundflackern', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'burst', label: 'Glitch-Ausbrüche', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'countPos', label: 'Anzahl Streifen (von)', min: 0, max: 100, fmt: countFromPos, focus: true },
  { type: 'range', id: 'countMax', label: 'Anzahl Streifen bis', min: 0, max: 100, fmt: countFromPos, focus: true },
  { type: 'choice', id: 'growTime', label: 'Mehr Streifen mit der Zeit', options: ['Aus', 'An'] },
  { type: 'range', id: 'growHours', label: 'Von „von“ bis „bis“ in', min: 1, max: 24, fmt: hoursFmt, focus: true },
  { type: 'choice', id: 'growBatt', label: 'Mehr Streifen bei sinkendem Akku', options: ['Aus', 'An'] },
  { type: 'range', id: 'battTest', label: 'Akku zum Ausprobieren (nur Vorschau)', min: 0, max: 100, fmt: v => v == 0 ? 'echter Akku' : v + ' %', focus: true },
  { type: 'info', id: 'growInfo', text: growInfo },
  { type: 'choice', id: 'touchFx', label: 'Glitch unter dem Finger', options: ['Aus', 'An'] },
  { type: 'choice', id: 'touchFlash', label: 'Flächenglitch beim Berühren (ab 5 Rissen)', options: ['Aus', 'An'] },
  { type: 'choice', id: 'rndWake', label: 'Neues Muster bei jedem Einschalten', options: ['Aus', 'An'] },
  { type: 'choice', id: 'mutate', label: 'Glitches verändern das Muster', options: ['Aus', 'An'] },
  { type: 'range', id: 'bgDim', label: 'Eigenes Bild abdunkeln', min: 0, max: 90, step: 5, fmt: v => v + ' %', focus: true },
  { type: 'info', id: 'bgNote', text: () => bgImg ? '' : 'Eigenes Bild: unten auf „Bild wählen“ tippen. Es liegt dann unter Streifen und Rissen.' },
  { type: 'choice', id: 'clockWhere', label: 'Uhr zeigen', options: ['Sperrbild', 'Start', 'Beides', 'Aus'] },
  { type: 'info', id: 'clockNote', text: () => settings.clockWhere < 2 ? 'In der Vorschau ist die Uhr immer zu sehen. Als Hintergrund erscheint sie nur ' + (settings.clockWhere === 0 ? 'auf dem Sperrbildschirm.' : 'auf dem Startbildschirm.') : '' },
  { type: 'range', id: 'd3', label: '3D-Effekt der Uhr (beim Neigen)', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'cy', label: 'Höhe der Uhr (15 = wie Original)', min: 0, max: 100, fmt: v => v + ' %', focus: true },
  { type: 'range', id: 'crack', label: 'Riss durch die Uhr', min: 0, max: 10, fmt: lvl, focus: true },
  { type: 'range', id: 'size', label: 'Größe der Uhr (5 = wie Original)', min: 1, max: 10, fmt: v => String(v), focus: true },
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
const CRACKS_MAX = 36;
const SHEAR_K = 1.2 * 0.45 * 0.5;   // „Versatz am Riss“: Stärke je Stufe (noch einmal halb so stark: feiner einstellbar)
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
// Abstand des Punkts (x, y) zur Strecke a→b
function segDist(x, y, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
  const u = l2 > 0 ? clamp(((x - a[0]) * vx + (y - a[1]) * vy) / l2, 0, 1) : 0;
  return Math.hypot(x - a[0] - vx * u, y - a[1] - vy * u);
}
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
// Risse nicht, die dort selbst losgehen; jeder andere Riss, der dort vorbeiläuft, zählt; ign.host: dicht am Startpunkt
// zählt auch der Riss nicht, von dem dieser abgeht). Ergebnis: { u, ci, pos (Stelle im getroffenen Riss: Stück +
// Anteil), x, y } oder null.
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
        if (ign && (s.n0 === ign.node || s === ign.host) && Math.hypot(hx - ign.P[0], hy - ign.P[1]) < 0.006) continue;
        if (endPt && Math.hypot(hx - endPt[0], hy - endPt[1]) < 1e-7) continue;
        best = h[0]; bh = { u: h[0], ci, pos: i - 1 + h[1], x: hx, y: hy };
      }
    }
  }
  return bh;
}
// Riss wachsen lassen: kurze, fast gerade Stücke mit kleinen Knicken, die Grundrichtung wandert langsam. Endet am
// Bildrand, nach maxLen (0 = ohne) oder an einem Riss in stop. aim: Punkt, durch den er laufen soll (Uhr, Ziel).
// wk: wie stark er von Stück zu Stück knickt (0,15 fein und glatt, bis 0,21 kräftiger und unruhiger).
function grow(R, A, x, y, dir, maxLen, aim, stop, ign, wk) {
  const pts = [[x, y]];
  let base = dir, len = 0, aiming = !!aim, lastD = 1e9, hit = null;
  for (let guard = 0; guard < 400; guard++) {
    const L = 0.015 + R() * 0.045;
    base += (R() - 0.5) * 0.05;
    const wob = (R() - 0.5) * (wk || 0.15);
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
// Feine Zacken wie bei echtem Glasbruch (klein, weich zusammenhängend, quer zur Richtung; die Enden bleiben genau). Am
// Anfang und am Ende laufen die Zacken weich aus (t0, t1: Länge), damit sich Risse am selben Punkt nicht kreuzen.
// Mit A bleiben die Zacken im Bild (ein Riss, der flach auf den Rand zuläuft, darf ihn nicht vorher schon kreuzen).
// s0: so lang bleibt der Anfang ganz gerade (Risse aus demselben Aufschlag kreuzen sich dort sonst leicht).
// q: 0 = feine, ruhige Zacken; 1 = unruhiger mit öfter kleinen Sprüngen (wie die kräftigen Risse früher)
function refine(R, pts, amp, t0, t1, A, s0, q) {
  const total = polyLen(pts), out = [pts[0]];
  const qq = q || 0, keep = 0.78 - 0.2 * qq, nz = 1.1 + 0.8 * qq, jp = 0.02 + 0.025 * qq, ja = 3 + 0.8 * qq;
  let j = 0, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    if (l < 1e-12) continue;
    const n = Math.max(1, Math.round(l / 0.007));
    for (let k = 1; k < n; k++) {
      const f = k / n;
      j = j * keep + (R() - 0.5) * nz * amp;
      if (R() < jp) j += (R() - 0.5) * ja * amp;   // selten ein kleiner Sprung
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

// Aufschlag direkt am Rand: in der Ecke (Seiten e1 und e2) oder an der Kante e1 (e2 < 0). Seiten: 0 links, 1 rechts,
// 2 oben, 3 unten; at: Lage entlang der Kante; ins: Abstand zum Rand (winzig, ein kurzes Stück reißt bis an den Rand
// durch: S). Die Risse laufen nur ins Bild hinein (Fächer a0..a1, nicht ganz bis an den Rand).
function edgeImp(e1, e2, at, ins, A) {
  if (e2 >= 0) {
    const left = e1 === 0 || e2 === 0, top = e1 === 2 || e2 === 2;
    const a0 = left ? (top ? 0 : -Math.PI / 2) : (top ? Math.PI / 2 : Math.PI);
    return { P: [left ? ins : 1 - ins, top ? ins : A - ins], S: [left ? 0 : 1, top ? 0 : A], a0: a0 + 0.17, a1: a0 + Math.PI / 2 - 0.17, side: -1 };
  }
  const m = 0.24;
  if (e1 === 0) return { P: [ins, at], S: [0, at], a0: -Math.PI / 2 + m, a1: Math.PI / 2 - m, side: 0 };
  if (e1 === 1) return { P: [1 - ins, at], S: [1, at], a0: Math.PI / 2 + m, a1: 1.5 * Math.PI - m, side: 1 };
  if (e1 === 2) return { P: [at, ins], S: [at, 0], a0: m, a1: Math.PI - m, side: 2 };
  return { P: [at, A - ins], S: [at, A], a0: Math.PI + m, a1: 2 * Math.PI - m, side: 3 };
}
// Wie ein Aufschlag aussieht – jeder anders (eigener Zufall je Aufschlag, bleibt, wenn Risse dazukommen):
//  schlicht: kaum Splitter, eher kräftige Risse;  Stern: Strahlen rundum, ein, zwei Ringe;
//  Spinnennetz: viele kurze Strahlen und fast geschlossene Ringe, fein;  Fächer: Risse eng gebündelt in eine Richtung,
//  lange Strahlen dazwischen.
// p: wie oft; w: Anteil an den Rissen (im Verhältnis zu den anderen Aufschlägen); v: wie kräftig seine Risse sind
// (0 fein und glatt, 1 kräftiger, zackiger, heller); fan: wie weit sich seine Risse auffächern (Anteil); rays, rayL:
// kurze Strahlen (Zahl, Länge); rings, ringP: Ringe (Zahl, wie geschlossen); twigs, shards: kurze Sprünge und Splitter.
const IMP_TYPES = [
  { p: 0.2, w: [0.55, 0.9], v: [0.45, 1], fan: [0.6, 1], rays: [0, 2], rayL: [0.012, 0.03], rings: [0, 0], ringP: [0.3, 0.5], twigs: [1, 3], shards: [2, 5] },
  { p: 0.35, w: [0.8, 1.25], v: [0, 0.8], fan: [0.85, 1], rays: [3, 6], rayL: [0.015, 0.05], rings: [1, 2], ringP: [0.5, 0.8], twigs: [2, 5], shards: [4, 8] },
  { p: 0.25, w: [1.05, 1.6], v: [0, 0.5], fan: [0.85, 1], rays: [7, 12], rayL: [0.02, 0.06], rings: [2, 4], ringP: [0.75, 0.95], twigs: [4, 8], shards: [8, 14] },
  { p: 0.2, w: [0.7, 1.15], v: [0.3, 1], fan: [0.35, 0.6], rays: [3, 6], rayL: [0.03, 0.1], rings: [0, 1], ringP: [0.3, 0.6], twigs: [2, 4], shards: [3, 6] },
];
// „Splitter am Aufschlag“ (sp): Aus = nur die Risse, Wenig = wie oben, Viel = mehr Strahlen, Ringe und Splitter
function impactStyle(k, sp) {
  const Rs = rng(crackSeed ^ Math.imul(0x632BE5AB, k + 21)), rs = (a, b) => a + Rs() * (b - a), ri = (a, b) => a + Math.floor(Rs() * (b - a + 1));
  let u = Rs(), type = 0;
  while (type < IMP_TYPES.length - 1 && u >= IMP_TYPES[type].p) { u -= IMP_TYPES[type].p; type++; }
  const T = IMP_TYPES[type], size = rs(0.75, 1.35);
  const s = { type, size, w: rs(T.w[0], T.w[1]), v: rs(T.v[0], T.v[1]), fan: rs(T.fan[0], T.fan[1]), fanC: Rs(), rot: Rs() * 2 * Math.PI,
    rays: ri(T.rays[0], T.rays[1]), rayL: rs(T.rayL[0], T.rayL[1]) * size, ringP: rs(T.ringP[0], T.ringP[1]),
    twigs: ri(T.twigs[0], T.twigs[1]), shards: ri(T.shards[0], T.shards[1]), boost: rs(0.75, 1.4), on: sp > 0 };
  let nR = ri(T.rings[0], T.rings[1]);
  const r0 = rs(0.011, 0.019) * size, step = rs(1.55, 2.05);
  if (sp <= 0) { s.rays = 0; nR = 0; s.twigs = 0; s.shards = 0; }
  else if (sp >= 2) { s.rays = Math.round(s.rays * 1.5) + 1; nR = Math.min(5, nR + 1); s.ringP = Math.min(0.97, s.ringP + 0.1); s.twigs *= 2; s.shards *= 2; }
  s.radii = [];
  for (let n = 0, rad = r0; n < nR && rad < 0.12; n++, rad *= step) s.radii.push(rad);
  return s;
}
// Aufschläge: Lage, Fächer der Risse (a0..a1; f0..f1: der ganze mögliche Fächer), Stelle am Rand, bis zu der es
// durchreißt (S), Hauptrichtung (md), Aussehen (st)
const EDGE_NEAR = 0.07;   // so nah am Rand angetippt sitzt der Aufschlag direkt am Rand
function makeImpacts(R, A, K) {
  const r = (a, b) => a + R() * (b - a), imps = [];
  // Bereich der Uhr (mit Rand): dort landet kein Aufschlag mitten im Glas
  const cb = clockOn() && settings.crack > 0 && layer ? [lx / W - 0.06, ly / W - 0.06, (lx + layer.width) / W + 0.06, (ly + layer.height) / W + 0.06] : null;
  const bands = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bands[i], bands[j]] = [bands[j], bands[i]]; }
  for (let k = 0; k < K; k++) {
    const man = settings.impact === 1 && settings.px[k] >= 0 && settings.tx[k] >= 0;
    let imp = null;
    if (man) {
      // selbst angetippt: Aufschlag und Richtung vom Nutzer, der genaue Verlauf bleibt dem Zufall überlassen. Nah am
      // Rand angetippt sitzt er direkt am Rand (nah an einer Ecke direkt in der Ecke), die Risse laufen ins Bild hinein.
      const Px = clamp(settings.px[k], 0.012, 0.988), Py = clamp(settings.py[k], 0.006, 0.994) * A;
      const Tx = settings.tx[k], Ty = settings.ty[k] * A, far = Math.hypot(Tx - Px, Ty - Py) > 0.03;
      const md = far ? Math.atan2(Ty - Py, Tx - Px) : R() * 2 * Math.PI;
      const ds = [[Px, 0], [1 - Px, 1], [Py, 2], [A - Py, 3]].sort((u, v) => u[0] - v[0]);
      if (ds[0][0] < EDGE_NEAR) {
        const e1 = ds[0][1], e2 = ds[1][0] < EDGE_NEAR && (ds[1][1] >> 1) !== (e1 >> 1) ? ds[1][1] : -1;
        imp = edgeImp(e1, e2, e1 < 2 ? Py : Px, 0.005, A);
        const mid = (imp.a0 + imp.a1) / 2;
        imp.md = clamp(mid + angDiff(md, mid), imp.a0, imp.a1); imp.back = false;
      } else imp = { P: [Px, Py], S: null, a0: md - Math.PI, a1: md + Math.PI, md, back: true, side: -1 };
      imp.aim = far ? [Tx, Ty] : null; imp.manual = true;
    } else {
      // zufällig, gut verteilt: direkt am Rand in einer Ecke oder an einer Kante, selten mitten im Glas; mehrere
      // Aufschläge in verschiedenen Höhen
      for (let tr = 0; tr < 24; tr++) {
        const band = K === 1 ? (R() < 0.6 ? 2 : Math.floor(R() * 2)) : bands[k];
        const ty = R(), ins = r(0.002, 0.008), y = (band + r(0.1, 0.9)) / 3 * A;
        let c;
        if (ty < 0.35) {
          // Ecke: oben oder unten passend zum Drittel, in der Mitte egal
          const bottom = band === 2 ? true : band === 0 ? false : R() < 0.5, left = R() < 0.5;
          c = edgeImp(left ? 0 : 1, bottom ? 3 : 2, 0, ins, A);
        } else if (ty < 0.85) {
          // Kante: meist links oder rechts, ganz oben/unten auch an der oberen/unteren Kante
          const e = R();
          if (band !== 1 && e < 0.25) c = edgeImp(band === 2 ? 3 : 2, -1, r(0.08, 0.92), ins, A);
          else c = edgeImp(e < 0.62 ? 0 : 1, -1, y, ins, A);
        } else {
          // mitten im Glas: Risse in alle Richtungen
          c = { P: [r(0.2, 0.8), clamp(y, 0.12 * A, 0.88 * A)], S: null, a0: 0, a1: 2 * Math.PI, side: -1 };
        }
        c.md = (c.a0 + c.a1) / 2; c.back = !c.S; c.aim = null; c.manual = false;
        imp = c;
        const onClock = !c.S && cb && c.P[0] > cb[0] && c.P[0] < cb[2] && c.P[1] > cb[1] && c.P[1] < cb[3];
        if (!onClock && imps.every(o => Math.hypot(o.P[0] - c.P[0], o.P[1] - c.P[1]) > 0.38)) break;
      }
    }
    imp.full = imp.a1 - imp.a0 >= 2 * Math.PI - 1e-6;
    imp.st = impactStyle(k, settings.splinter | 0);
    imp.f0 = imp.a0; imp.f1 = imp.a1;
    // Fächer: die Risse laufen gebündelt in einen Teil des möglichen Fächers
    if (!imp.manual && !imp.full && imp.st.fan < 1) {
      const span = imp.a1 - imp.a0, w = span * imp.st.fan, c0 = imp.a0 + w / 2 + imp.st.fanC * (span - w);
      imp.a0 = c0 - w / 2; imp.a1 = c0 + w / 2; imp.md = c0;
    }
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
  // welche der (bis zu 36) Risse waagerecht quer laufen: feste Reihenfolge, auch für später dazukommende
  const hs = clamp(settings.hshare, 0, 100) / 100;
  const plan = [];
  for (let i = 0; i < CRACKS_MAX; i++) plan.push(Math.round((i + 1) * hs) > Math.round(i * hs) ? 'h' : 's');
  // Mit Uhr: einer der Risse läuft durch die Ziffern – welcher, ist Zufall (immer ausgewürfelt, damit die Reihenfolge
  // gleich bleibt): ohne „Mehr Risse mit der Zeit“ einer der sichtbaren, sonst irgendeiner bis „bis“, die Uhr bekommt
  // ihren Riss also irgendwann unterwegs. Hat schon ein anderer Riss die Uhr getroffen, braucht es keinen eigenen mehr.
  const ctx0 = r(0.3, 0.7), cty0 = r(0.3, 0.55);
  const growing = settings.crackGrow === 1 && (settings.cracksMax | 0) > (settings.cracks | 0);
  const cSpan = Math.max(1, clamp((growing ? settings.cracksMax : settings.cracks) | 0, 0, CRACKS_MAX));
  let clockDue = Math.floor(R() * cSpan);
  const clockIdx = clockDue;
  const clockAim = clockOn() && settings.crack > 0 && layer ? [(lx + layer.width * ctx0) / W, (ly + layer.height * cty0) / W] : null;
  if (!clockAim) clockDue = -1;
  const bands = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bands[i], bands[j]] = [bands[j], bands[i]]; }
  // welcher Aufschlag den nächsten Riss bekommt: nach seinem Anteil (jeder Aufschlag anders), feste Reihenfolge
  const seq = [], cw = imps.map(() => 0), tw = imps.reduce((q, m) => q + m.st.w, 0);
  for (let i = 0; i < CRACKS_MAX; i++) {
    let b = 0;
    imps.forEach((m, j) => { cw[j] += m.st.w; if (cw[j] > cw[b]) b = j; });
    cw[b] -= tw; seq.push(b);
  }

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
  // Riss fertig machen: Zacken, an einem dabei gekreuzten Riss kappen, Knoten setzen, eintragen. extra.v: wie kräftig
  // (0 fein und glatt, 1 kräftiger und zackiger)
  const finish = (coarse, n0, hit, kind, amp, ign, extra) => {
    const v = extra && extra.v || 0;
    let pts = refine(R, coarse, amp * (1 + 0.3 * v), ign ? 0.02 : 0.006, hit ? 0.012 : 0.004, A, ign ? 0.008 : 0, v);
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
    // liegt der Aufschlag genau auf einem schon vorhandenen Riss: ein Stück daneben setzen (an der Kante entlang)
    const P0 = imp.P.slice();
    for (let tr = 0; tr < 6 && distToCracks(imp.P[0], imp.P[1]) < 0.008; tr++) {
      const s = (tr % 2 ? -1 : 1) * 0.014 * (1 + (tr >> 1));
      if (imp.side === 0 || imp.side === 1) { imp.P = [P0[0], clamp(P0[1] + s, 0.02, A - 0.02)]; imp.S = [imp.S[0], imp.P[1]]; }
      else if (imp.side >= 2) { imp.P = [clamp(P0[0] + s, 0.02, 0.98), P0[1]]; imp.S = [imp.P[0], imp.S[1]]; }
      else imp.P = [clamp(imp.P[0] + (tr % 2 ? -1 : 1) * 0.012, 0.003, 0.997), clamp(imp.P[1] + 0.009, 0.003, A - 0.003)];
    }
    imp.node = addNode(imp.P[0], imp.P[1]);
    // am Rand: der Aufschlag reißt bis an den Rand durch
    if (imp.S) finish([imp.P.slice(), imp.S.slice()], imp.node, null, 'stub', 0.0007, imp, { imp: imp.k, v: imp.st.v });
  };
  // Läuft der Riss durch die Uhr (dicht am Zielpunkt in den Ziffern vorbei)?
  const reaches = (pts, aim) => { for (let i = 1; i < pts.length; i++) if (segDist(aim[0], aim[1], pts[i - 1], pts[i]) < 0.04) return true; return false; };
  // Riss vom Aufschlag aus. need: muss durch diese Stelle laufen (Uhr), sonst wird er nicht gesetzt (false). v: wie kräftig
  const spoke = (imp, dir, aim, kind, need, v) => {
    let best = null;
    for (let tr = 0; tr < 6; tr++) {
      const g = grow(R, A, imp.P[0], imp.P[1], dir + (tr ? r(-0.06, 0.06) : 0), 0, aim, divs, imp, 0.15 + 0.06 * v);
      const len = polyLen(g.pts);
      if (!best || len > best.len) best = { g, len };
      if (len > 0.08 || best.g.hit === null) break;
    }
    if (need && !reaches(best.g.pts, need)) return false;
    finish(best.g.hit ? best.g.pts : toEdge(best.g.pts, A), imp.node, best.g.hit, kind, 0.0010, imp, { imp: imp.k, dir, v });
    return true;
  };
  // Riss waagerecht quer übers Bild; mit aim auf Höhe der Uhr durch die Ziffern (false, wenn er nicht hinkommt)
  const horizontal = (j, aim, v) => {
    let best = null;
    for (let tr = 0; tr < 6; tr++) {
      if (aim && tr >= 2) break;
      const band = bands[(j + tr) % 3];
      let y = (band + r(0.12, 0.88)) / 3 * A;
      const left = R() < 0.5, dir = (left ? 0 : Math.PI) + r(-0.12, 0.12);
      if (aim) y = clamp(aim[1] + r(-0.03, 0.03), 0.02, A - 0.02);
      const x0 = left ? 0 : 1;
      if (border.some(id => Math.hypot(nodes[id][0] - x0, nodes[id][1] - y) < 0.03)) continue;
      const g = grow(R, A, x0, y, dir, 0, aim, divs, null, 0.15 + 0.06 * v);
      if (aim && !reaches(g.pts, aim)) continue;
      // gleich am Anfang an einem Riss hängen geblieben: andere Höhe nehmen
      const len = polyLen(g.pts);
      if (!best || len > best.len) best = { g, len, x0, y };
      if (aim || len > 0.45) break;
    }
    if (!best) return false;
    const n0 = borderNode(best.x0, best.y);
    finish(best.g.hit ? best.g.pts : toEdge(best.g.pts, A), n0, best.g.hit, 'h', 0.0009, null, { dir: best.x0 ? Math.PI : 0, v });
    return true;
  };
  // Riss durch die Uhr, wenn er weder vom Aufschlag noch von der Seite hinkommt: Er geht von einem Riss oder vom Rand
  // aus, und zwar von einer Stelle, von der aus kein anderer Riss im Weg liegt (die nächste Stelle des Netzes, oder
  // links, rechts, oben am Rand, wenn der Weg frei ist), läuft mitten durch die Ziffern und weiter, bis er auf einen
  // Riss oder den Rand trifft.
  const clockCrack = (aim, v) => {
    const cand = [];
    let near = null;
    divs.forEach((d, ci) => {
      for (let k = 1; k < d.pts.length; k++) {
        const a = d.pts[k - 1], b = d.pts[k], vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
        const u = l2 > 0 ? clamp(((aim[0] - a[0]) * vx + (aim[1] - a[1]) * vy) / l2, 0, 1) : 0;
        const x = a[0] + vx * u, y = a[1] + vy * u, dd = Math.hypot(aim[0] - x, aim[1] - y);
        if (!near || dd < near.d) near = { d: dd, ci, pos: k - 1 + u, x, y };
      }
    });
    if (near) cand.push(Object.assign({ w: 1.5 }, near));
    for (const [x, y, w] of [[0, aim[1], 1], [1, aim[1], 1], [aim[0], 0, 0.6]]) {
      if (border.some(id => Math.hypot(nodes[id][0] - x, nodes[id][1] - y) < 0.02)) continue;
      if (hitAny(x, y, aim[0], aim[1], divs, null, null)) continue;
      cand.push({ ci: -1, x, y, w });
    }
    if (!cand.length) return;
    let s = R() * cand.reduce((q, c) => q + c.w, 0), st = cand[cand.length - 1];
    for (const c of cand) { s -= c.w; if (s <= 0) { st = c; break; } }
    // geht er von einem Riss ab, zählt dieser dicht am Startpunkt nicht als Ende
    const ign = st.ci >= 0 ? { node: -2, P: [st.x, st.y], host: divs[st.ci] } : null;
    const g = grow(R, A, st.x, st.y, Math.atan2(aim[1] - st.y, aim[0] - st.x), 0, aim, divs, ign, 0.15 + 0.06 * v);
    if (polyLen(g.pts) < 0.01) return;
    const n0 = st.ci >= 0 ? hostNode(st) : borderNode(st.x, st.y);
    finish(g.hit ? g.pts : toEdge(g.pts, A), n0, g.hit, 'c', 0.0009, ign, { v });
  };

  let si = 0, hj = 0;
  for (let i = 0; i < N; i++) {
    // wie kräftig dieser Riss ist (eigener Zufall je Riss): vom Aufschlag nach dessen Art, sein erster etwas kräftiger;
    // waagerechte meist fein
    const Rv = rng(crackSeed ^ Math.imul(0x165667B1, i + 5)), v1 = Rv(), v2 = Rv(), vh = Math.pow(v1, 1.6) * 0.9;
    // Uhr schon von einem anderen Riss getroffen: braucht keinen eigenen mehr
    if (clockDue >= 0 && i >= clockDue && distToCracks(clockAim[0], clockAim[1]) < 0.025) clockDue = -1;
    const aimC = clockDue >= 0 && i >= clockDue ? clockAim : null;
    if (plan[i] === 'h') {
      if (aimC) { if (!horizontal(hj++, aimC, vh)) clockCrack(aimC, vh); clockDue = -1; }
      else horizontal(hj++, null, vh);
      continue;
    }
    const imp = imps[seq[si]]; si++;
    const v = clamp(imp.st.v + (v2 - 0.5) * 0.5 + (imp.chosen.length ? 0 : 0.15), 0, 1);
    if (!imp.started) startImpact(imp);
    if (imp.manual && imp.chosen.length === 0) {
      // selbst angetippt: der erste Riss läuft genau in die gewählte Richtung (die Uhr kommt dann beim nächsten dran)
      imp.chosen.push(imp.md);
      spoke(imp, imp.md, imp.aim, 'spoke', null, v);
    } else if (aimC) {
      clockDue = -1;
      const ta = Math.atan2(aimC[1] - imp.P[1], aimC[0] - imp.P[0]);
      const inFan = imp.full || Math.abs(angDiff(ta, imp.md)) <= (imp.a1 - imp.a0) / 2 + 0.17;
      if (inFan && spoke(imp, ta, aimC, 'spoke', aimC, v)) imp.chosen.push(ta);
      else { clockCrack(aimC, vh); continue; }
    } else {
      const dir = nextDir(R, imp);
      imp.chosen.push(dir);
      spoke(imp, dir, null, 'spoke', null, v);
    }
    // mitten im Glas: der erste Riss reißt auch nach hinten durch (sonst hinge er lose im Glas und teilte nichts)
    if (imp.back && !imp.backDone && imp.chosen.length) {
      imp.backDone = true; imp.backDir = imp.chosen[0] + Math.PI + r(-0.35, 0.35);
      spoke(imp, imp.backDir, null, 'back', null, v * 0.85);
    }
  }
  // Aufschläge, an denen noch kein Riss losläuft, bekommen trotzdem ihren Punkt (für Splitter und Glanz)
  for (const imp of imps) if (!imp.started) imp.node = -1;

  const regions = buildRegions(nodes, divs, border, A);
  for (const g of regions) {
    g.pathC = new Path2D(); g.pathD = new Path2D();
    g.poly.forEach((p, k) => { if (k) { g.pathC.lineTo(p[0] * Wc, p[1] * Wc); g.pathD.lineTo(p[0] * W, p[1] * W); } else { g.pathC.moveTo(p[0] * Wc, p[1] * Wc); g.pathD.moveTo(p[0] * W, p[1] * W); } });
    g.pathC.closePath(); g.pathD.closePath();
    g.dead = 0; g.dv = false; g.keep = null;
  }
  seedDead(regions, false);

  // Abzweige je Riss (eigener Zufall je Riss, damit sie bleiben, wenn Risse dazukommen): enden am Rand, nach einer
  // Weile oder an einem anderen Riss
  // Abzweige und kleine Risse sind etwas feiner als ihr Riss (bv, tv: wie kräftig, je Eintrag)
  const branches = [], bv = [];
  divs.forEach((d, i) => {
    if (d.kind === 'stub') return;
    const Rb = rng(crackSeed ^ Math.imul(0x9E3779B1, i + 1)), rb = (a, b) => a + Rb() * (b - a), v = (d.v || 0) * 0.7;
    const nB = Rb() < 0.5 ? (Rb() < 0.25 ? 2 : 1) : 0, total = polyLen(d.pts);
    for (let k = 0; k < nB; k++) {
      const at = pointAtLen(d.pts, total * rb(0.25, 0.8));
      const bd = at[2] + (Rb() < 0.5 ? -1 : 1) * rb(0.3, 0.65);
      const stop = divs.filter(o => o !== d).concat(branches.map(p => ({ pts: p })));
      branches.push(refine(Rb, grow(Rb, A, at[0], at[1], bd, rb(0.1, 0.45), null, stop, null, 0.15 + 0.06 * v).pts, 0.0009 * (1 + 0.3 * v), 0.01, 0, undefined, 0, v));
      bv.push(v);
    }
  });

  // Kleine Risse, die an den großen hängen (eigener Zufall je Riss): kurze Ästchen schräg ab, ab und zu noch einmal
  // gegabelt; wo ein Riss am Rand endet, splittert er oft kurz davor in ein, zwei kleine Risse auf
  const twigs = [], tv = [];
  divs.forEach((d, i) => {
    if (d.kind === 'stub') return;
    const Rt = rng(crackSeed ^ Math.imul(0x2545F491, i + 3)), rt = (a, b) => a + Rt() * (b - a), v = (d.v || 0) * 0.5;
    const total = polyLen(d.pts);
    if (total < 0.05) return;
    const stop = divs.filter(o => o !== d).concat(branches.map(p => ({ pts: p })));
    const twig = (x, y, dir, len) => {
      const g = grow(Rt, A, x, y, dir, len, null, stop, null, 0.15 + 0.06 * v);
      if (g.pts.length > 1 && polyLen(g.pts) > 0.004) { twigs.push(refine(Rt, g.pts, 0.0005 * (1 + 0.3 * v), 0.003, 0, undefined, 0, v)); tv.push(v); }
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

  // Haarrisse (nicht mitgezählt): sehr fein und fast gerade, laufen von einem Riss ins Glas und hören dort einfach auf,
  // ab und zu einer vom Rand aus. Sie teilen nichts. Eigener Zufall je Riss, damit sie bleiben, wenn Risse dazukommen.
  const hairs = [], hairStop = divs.concat(branches.map(p => ({ pts: p })));
  divs.forEach((d, i) => {
    if (d.kind === 'stub') return;
    const Rh = rng(crackSeed ^ Math.imul(0x7FEB352D, i + 13)), rh = (a, b) => a + Rh() * (b - a);
    const total = polyLen(d.pts);
    const add = pts => { if (pts.length > 1) { hairs.push(pts); hairStop.push({ pts }); } };
    if (Rh() < 0.4 && total > 0.08) {
      // vom Riss aus (der eigene Riss zählt nur dicht am Startpunkt nicht als Ende)
      const at = pointAtLen(d.pts, total * rh(0.12, 0.88));
      const g = grow(Rh, A, at[0], at[1], at[2] + (Rh() < 0.5 ? -1 : 1) * rh(0.45, 1.25), rh(0.05, 0.2), null, hairStop, { node: -2, P: [at[0], at[1]], host: d });
      if (polyLen(g.pts) > 0.02) add(refine(Rh, g.pts, 0.00025, 0.004, 0.003, A));
    }
    if (Rh() < 0.12) {
      // vom Rand aus
      const side = Math.floor(Rh() * 4), q = rh(0.08, 0.92);
      const x0 = side === 0 ? 0 : side === 1 ? 1 : q, y0 = side === 2 ? 0 : side === 3 ? A : q * A;
      const din = side === 0 ? 0 : side === 1 ? Math.PI : side === 2 ? Math.PI / 2 : -Math.PI / 2;
      const g = grow(Rh, A, x0, y0, din + rh(-0.6, 0.6), rh(0.04, 0.14), null, hairStop, null);
      if (polyLen(g.pts) > 0.015) add(refine(Rh, g.pts, 0.00025, 0.004, 0.003, A));
    }
  });

  // Splitternetz je Aufschlag, nach seiner Art (impactStyle): kurze Strahlen vom Aufschlag aus (nicht mitgezählt, sie
  // teilen nichts und enden an anderen Rissen oder im Glas), Ringe in Bögen zwischen benachbarten Strahlen und Rissen,
  // kurze Sprünge und kleine Glassplitter dicht am Aufschlag. Jeder Teil hat seinen eigenen Zufall, damit er bleibt,
  // wenn Risse dazukommen (nur wo ein neuer Riss genau auf einem Strahl liegt, ersetzt er ihn).
  const rays = [], rv = [], web = [], wv = [], shards = [];
  const smallStop = divs.concat(branches.map(p => ({ pts: p })), twigs.map(p => ({ pts: p })), hairs.map(p => ({ pts: p })));
  imps.forEach((imp, k) => {
    const st = imp.st, Px = imp.P[0], Py = imp.P[1];
    if (!st.on) return;
    const tag = imp.started ? imp.node : 'i' + k, ign = { node: tag, P: imp.P };
    const own = divs.filter(d => d.imp === k && (d.kind === 'spoke' || d.kind === 'back'));
    const radial = own.map(d => ({ pts: d.pts, dir: d.dir }));
    // Strahlen: über den ganzen Fächer verteilt (beim Fächer gebündelt wie seine Risse), mindestens etwa 7° auseinander
    const f0 = st.type === 3 ? imp.a0 : imp.f0, f1 = st.type === 3 ? imp.a1 : imp.f1, stop = smallStop.slice();
    const nR = Math.min(st.rays, Math.floor((imp.full ? 2 * Math.PI : f1 - f0) / 0.12));
    for (let j = 0; j < nR; j++) {
      const Rr = rng(crackSeed ^ Math.imul(0xC2B2AE35, k * 64 + j + 31)), rr = (a, b) => a + Rr() * (b - a);
      const d = imp.full ? st.rot + (j + 0.5 + rr(-0.25, 0.25)) / nR * 2 * Math.PI : f0 + (j + 0.5 + rr(-0.25, 0.25)) / nR * (f1 - f0);
      const len = st.rayL * rr(0.55, 1.5);
      if (own.some(o => Math.abs(angDiff(o.dir, d)) < 0.07)) continue;
      const g = grow(Rr, A, Px, Py, d, len, null, stop, ign, 0.12);
      if (polyLen(g.pts) < 0.006) continue;
      let pts = refine(Rr, g.pts, 0.0005, 0.012, 0.003, A, 0.006, st.v * 0.5);
      // mit den Zacken doch einen anderen Riss gekreuzt: dort enden lassen
      for (let i = 1; i < pts.length; i++) {
        const h = hitAny(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], stop, ign, null);
        if (h) { pts = pts.slice(0, i); pts.push([h.x, h.y]); break; }
      }
      if (polyLen(pts) < 0.006) continue;
      rays.push(pts); rv.push(st.v * 0.5);
      stop.push({ pts, n0: tag });
      radial.push({ pts, dir: d });
    }
    // Ringe: Bögen zwischen benachbarten Strahlen und Rissen (ob ein Bogen da ist, hängt nur an seinen beiden Enden)
    radial.sort((a, b) => angDiff(a.dir, imp.md) - angDiff(b.dir, imp.md));
    const pairs = [];
    for (let i = 0; i + 1 < radial.length; i++) pairs.push([radial[i], radial[i + 1]]);
    if (imp.full && radial.length > 2) pairs.push([radial[radial.length - 1], radial[0]]);
    st.radii.forEach((rad, n) => {
      for (const [fa, fb] of pairs) {
        const gap = Math.abs(angDiff(fb.dir, fa.dir));
        if (gap > 1.6 || gap < 0.04) continue;
        const h = hash01(fa.dir * 3.7 + n * 1.31, fb.dir * 5.3 + k * 2.17, crackSeed);
        if (h >= st.ringP) continue;
        if (polyLen(fa.pts) < rad * 1.2 || polyLen(fb.pts) < rad * 1.2) continue;
        const Rw = rng(crackSeed ^ Math.floor(h * 2147483647)), rw = (a, b) => a + Rw() * (b - a);
        const pa = pointAtLen(fa.pts, rad * rw(0.85, 1.12)), pb = pointAtLen(fb.pts, rad * rw(0.85, 1.12));
        const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, ox = mx - Px, oy = my - Py, ol = Math.hypot(ox, oy) || 1, bulge = rad * rw(-0.03, 0.14);
        web.push(refine(Rw, [[pa[0], pa[1]], [mx + ox / ol * bulge, my + oy / ol * bulge], [pb[0], pb[1]]], 0.0006, 0, 0)); wv.push(st.v * 0.3);
      }
    });
    // kurze Sprünge dicht am Aufschlag
    const Rq = rng(crackSeed ^ Math.imul(0x85EBCA6B, k + 7)), rq = (a, b) => a + Rq() * (b - a);
    for (let q = 0; q < st.twigs; q++) {
      const ang = imp.full ? Rq() * 2 * Math.PI : rq(imp.f0 - 0.1, imp.f1 + 0.1), d0 = rq(0.003, 0.028) * st.size;
      const x0 = Px + Math.cos(ang) * d0, y0 = Py + Math.sin(ang) * d0, dir = ang + rq(-0.9, 0.9), len = rq(0.005, 0.022) * st.size;
      if (x0 <= 0 || x0 >= 1 || y0 <= 0 || y0 >= A) continue;
      web.push(refine(Rq, grow(Rq, A, x0, y0, dir, len, null, null, null).pts, 0.0005, 0, 0)); wv.push(0);
    }
    // kleine Glassplitter: Dreiecke mit hellen Kanten, dicht am Aufschlag
    const Rp = rng(crackSeed ^ Math.imul(0x27D4EB2F, k + 41)), rp = (a, b) => a + Rp() * (b - a);
    for (let q = 0; q < st.shards; q++) {
      const ang = imp.full ? Rp() * 2 * Math.PI : rp(imp.f0 - 0.17, imp.f1 + 0.17), d0 = rp(0, 0.02) * st.size * (0.4 + Rp());
      const cx0 = Px + Math.cos(ang) * d0, cy0 = Py + Math.sin(ang) * d0, s0 = rp(0.0025, 0.007) * Math.sqrt(st.size), rot = Rp() * 6.3;
      const tri = [0, 1, 2].map(z => { const a = rot + z * 2.1 + rp(-0.5, 0.5), rr = s0 * rp(0.6, 1.2); return [cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr]; });
      const a = rp(0.05, 0.16), e = rp(0.25, 0.6);
      if (tri.every(p => p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < A)) shards.push({ tri, a, e });
    }
  });

  // Zeichenliste: dunkle Bruchkante (Breite w) mit Glanz, der entlang des Risses weich stärker und schwächer wird;
  // v: wie kräftig (0 fein, glatt und zart glänzend; 1 etwas breiter, zackiger, heller glänzend – aber immer fein)
  const RL = rng(crackSeed ^ 0x27D4EB2F), list = [];
  const add = (pts, w, kind, base, v) => {
    const cl = [0];
    for (let i = 1; i < pts.length; i++) cl.push(cl[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // Seite zum Licht (oben) einmal je Riss festlegen, damit der Glanz nicht hin und her springt
    const e = pts[pts.length - 1], dx = e[0] - pts[0][0], dy = e[1] - pts[0][1], l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l;
    if (ny > 0 || (Math.abs(ny) < 0.25 && nx > 0)) { nx = -nx; ny = -ny; }
    list.push({ pts, cl, w, kind, base, g: glint(RL), nx, ny, v: v || 0 });
  };
  const quer = k => k === 'h' || k === 'c';
  for (const d of divs) add(d.pts, d.kind === 'stub' ? 1.2 : quer(d.kind) ? 0.9 : 1, quer(d.kind) ? 'h' : 'spoke', 0.5 + RL() * 0.25, d.v);
  branches.forEach((b, i) => add(b, 0.8, 'branch', 0.4 + RL() * 0.25, bv[i]));
  rays.forEach((p, i) => add(p, 0.72, 'ray', 0.5 + RL() * 0.3, rv[i]));
  web.forEach((p, i) => add(p, 0.6, 'web', 0.55 + RL() * 0.35, wv[i]));
  twigs.forEach((t, i) => add(t, 0.55, 'twig', 0.45 + RL() * 0.3, tv[i]));
  for (const h of hairs) add(h, 0.42, 'hair', 0.35 + RL() * 0.3, 0);
  CR = { imps: imps.map(i => [i.P[0], i.P[1], i.st.boost]), styles: imps.map(i => i.st.type), A, divs, branches, twigs, hairs, rays, web, shards, regions, list, clockAim, clockIdx };
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
  // an den Aufschlägen ist das Glas zertrümmert und fängt mehr Licht (je Aufschlag verschieden stark)
  const boost = (x, y) => { let m = 0; for (const p of CR.imps) m = Math.max(m, p[2] * Math.exp(-Math.hypot(x - p[0], y - p[1]) / 0.05)); return 1 + 1.3 * m; };
  // 1) dunkle Bruchkante: fein, am Aufschlag etwas breiter, zum Ende hin schmaler (in Stücken gezeichnet); kräftige
  //    Risse (v) etwas breiter; Haarrisse nur ein Hauch
  for (const c of CR.list) {
    const total = c.cl[c.cl.length - 1] || 1, tip = c.kind === 'twig' || c.kind === 'hair';
    g.strokeStyle = c.kind === 'hair' ? 'rgba(0,0,0,0.7)' : '#000';
    let i0 = 0;
    while (i0 < c.pts.length - 1) {
      let i1 = i0 + 1;
      while (i1 < c.pts.length - 1 && c.cl[i1] - c.cl[i0] < 0.04) i1++;
      const f = c.kind === 'spoke' ? 1.35 - 0.6 * Math.min(1, c.cl[i0] / Math.max(0.3, total)) : c.kind === 'ray' ? 1.2 - 0.8 * c.cl[i0] / total : tip ? 1.15 - 0.75 * c.cl[i0] / total : 1;
      g.lineWidth = Math.max(1, (0.85 + 0.27 * c.v) * dpr * c.w * f);
      g.beginPath();
      for (let k = i0; k <= i1; k++) { const p = c.pts[k]; if (k === i0) g.moveTo(p[0] * W, p[1] * W); else g.lineTo(p[0] * W, p[1] * W); }
      g.stroke();
      i0 = i1;
    }
  }
  // 2) Glanz: sehr dünne helle Linie dicht an der Kante, auf der Seite zum Licht. Die Helligkeit schwankt weich;
  //    gleiche Helligkeit wird zu einem Linienzug zusammengefasst (sonst überlappen sich die Stücke zu Perlen).
  const shine = (c, side, amt) => {
    const o = dpr * (0.38 + 0.14 * c.v + (0.32 + 0.1 * c.v) * c.w) * side, al = 0.82 + 0.1 * c.v;
    g.lineWidth = Math.max(1, (0.4 + 0.12 * c.v) * dpr * (0.75 + 0.35 * c.w));
    let cur = -1, open = false;
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1], b = c.pts[i], sm = (c.cl[i - 1] + c.cl[i]) / 2;
      const v = amt(sm) * c.base * c.g(sm) * boost((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      const lv = Math.round(clamp(v, 0, 1) * 14);
      if (lv !== cur) {
        if (open) { g.stroke(); open = false; }
        cur = lv;
        if (lv > 0) {
          g.strokeStyle = 'rgba(235,242,255,' + (lv / 14 * al).toFixed(3) + ')';
          g.beginPath(); g.moveTo(a[0] * W + c.nx * o, a[1] * W + c.ny * o); open = true;
        }
      }
      if (open) g.lineTo(b[0] * W + c.nx * o, b[1] * W + c.ny * o);
    }
    if (open) g.stroke();
  };
  for (const c of CR.list) {
    // kleine Risse und Haarrisse laufen zur Spitze hin aus
    const tot = c.cl[c.cl.length - 1] || 1;
    shine(c, 1, c.kind === 'twig' ? s => Math.pow(Math.max(0, 1 - s / tot), 0.7) : c.kind === 'ray' ? s => Math.pow(Math.max(0, 1 - s / tot), 0.6) : c.kind === 'hair' ? s => Math.pow(Math.max(0, 1 - s / tot), 0.5) : () => 1);
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
  for (let i = 0; i < CR.regions.length; i++) {
    const g = CR.regions[i];
    if (X < g.x0 || X > g.x1 || Y < g.y0 || Y > g.y1) continue;
    if (pointInPoly(X, Y, g.poly)) return i;
  }
  return -1;
}
// Kleinstes Bruchstück unter der Fingerkuppe (Mitte und ein Kreis von 11 CSS-Pixeln drumherum): Für den Flächenglitch
// haben kleine Stücke Vorrang vor großen.
function smallestUnder(xc, yc) {
  let best = -1;
  for (let k = 0; k < 9; k++) {
    const a = k * Math.PI / 4, rr = k ? 11 : 0;
    const i = regionAt(xc + Math.cos(a) * rr, yc + Math.sin(a) * rr);
    if (i >= 0 && (best < 0 || CR.regions[i].area < CR.regions[best].area)) best = i;
  }
  return best;
}
function updatePresses(dt) {
  presses = [];
  // Finger zählen, wenn „Glitch unter dem Finger“ oder „Flächenglitch“ an ist (jedes auch allein)
  const fx = settings.touchFx === 1;
  if (!fx) pressLines = [];
  if (!fx && settings.touchFlash !== 1) { touches.clear(); return; }
  for (const [id, p] of touches) {
    const age = p.up >= 0 ? t - p.up : 0;
    if (age > 0.3) { touches.delete(id); continue; }
    const xc = p.x / dpr, yc = p.y / dpr, pr = { x: xc, y: yc, ri: regionAt(xc, yc), fi: -1, k: 1 - age / 0.3, down: p.up < 0 };
    // Stück für den Flächenglitch: nur neu suchen, wenn der Finger sich bewegt hat oder die Risse neu sind
    if (CR && settings.touchFlash === 1 && p.up < 0) {
      if (p.fCR !== CR || Math.hypot(xc - p.fx, yc - p.fy) > 2) { p.fCR = CR; p.fx = xc; p.fy = yc; p.fi = smallestUnder(xc, yc); }
      pr.fi = p.fi;
    }
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
// Ab und zu fällt ein ganzes Bruchstück aus und bleibt schwarz (beim Ausgehen flackert es, es stirbt; beim Angehen
// kurz). Der Regler „Schwarze Stellen zwischen den Rissen“ legt vor allem fest, wie lange: links nur ein paar Sekunden,
// in der Mitte um eine Minute, ganz rechts sehr lange (um 20 Minuten); jedes Mal anders (halb bis doppelt so lange).
// Mit dem Regler werden es auch etwas mehr Stücke (etwa 4 bis 18 %, mit vielen Streifen etwas mehr). Bei etwa jedem
// zweiten bleiben auf einer Seite ein paar Streifen stehen (am linken oder rechten Rand des Stücks, 15–40 % seiner
// Breite: dort läuft das Display noch). Bei Glitch-Ausbrüchen fallen Stücke auch kurz aus (dann ganz). Höchstens jedes
// vierte Stück, nie zwei nebeneinander. Beim Bauen der Risse sind gleich so viele schwarz wie sonst im Schnitt, beim
// Verstellen des Reglers mindestens eins – damit man es sofort sieht.
const darkMid = lv => 4 * Math.pow(300, (lv - 1) / 9);   // typische Dauer in Sekunden (Stufe 1: 4 s, 5: 50 s, 10: 20 min)
const darkLen = lv => darkMid(lv) * Math.pow(4, Math.random()) / 2;
const darkFrac = lv => (0.04 + 0.14 * (lv - 1) / 9) * (0.75 + 0.5 * clamp((baseN - 12) / 110, 0, 1));
function darkFmt(v) {
  if (v == 0) return 'aus';
  const s = darkMid(v);
  return 'ca. ' + (s < 59.5 ? Math.round(s) + ' s' : s < 600 ? String(Math.round(s / 30) / 2).replace('.', ',') + ' Min.' : Math.round(s / 60) + ' Min.');
}
function killRegion(g, len) {
  g.dead = len; g.deadT = len;
  g.keep = len > 5 && Math.random() < 0.5 ? keepBand(g) : null;
}
function updateDead(dt) {
  if (!CR) return;
  const regs = CR.regions, lv = settings.dark;
  const maxDead = Math.max(1, Math.floor(regs.length / 4));
  let nd = 0;
  for (const g of regs) if (g.dead > 0) { g.dead -= dt; if (g.dead > 0) nd++; else g.keep = null; }
  if (regs.length >= 3 && lv > 0) {
    const h = darkFrac(lv), rate = h / ((1 - h) * darkMid(lv) * 1.082);
    for (const g of regs) {
      if (g.dead > 0 || nd >= maxDead) continue;
      const sb = curBursting && (burstZone === 'all' || burstZone === g.zone);
      let len = 0;
      if (Math.random() < P(rate)) len = darkLen(lv);
      else if (sb && Math.random() < P(lv / 5 * 0.03 * burstPow)) len = rnd(0.3, 1.5);
      if (len && !g.nb.some(j => regs[j].dead > 0)) { killRegion(g, len); nd++; }
    }
  }
  // sichtbar aus? beim Aus- und Angehen kurz flackern
  for (const g of regs) g.dv = g.dead > 0 && !((g.deadT - g.dead < (g.deadT > 5 ? 0.35 : 0.16) || g.dead < 0.14) && Math.random() < 0.5);
}
// Schwarze Stücke neu verteilen: so viele, wie es sonst im Schnitt sind (mit zufälliger Restzeit); one: mindestens eins,
// das gerade erst ausgeht (beim Verstellen des Reglers)
function seedDead(regs, one) {
  const lv = settings.dark;
  for (const g of regs) { g.dead = 0; g.dv = false; g.keep = null; }
  if (lv <= 0 || regs.length < 3) return;
  const maxDead = Math.max(1, Math.floor(regs.length / 4)), h = darkFrac(lv), order = regs.map((g, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let nd = 0;
  for (const i of order) {
    const g = regs[i];
    if (nd >= maxDead || g.nb.some(j => regs[j].dead > 0)) continue;
    const first = one && nd === 0;
    if (!first && Math.random() >= h) continue;
    killRegion(g, darkLen(lv));
    if (!first) g.dead *= Math.random();
    nd++;
  }
}
// Seite eines ausgefallenen Stücks, auf der die Streifen stehen bleiben (x0..x1 als Anteil der Breite)
function keepBand(g) {
  const f = (g.x1 - g.x0) * rnd(0.15, 0.4);
  return Math.random() < 0.5 ? { x0: -1, x1: g.x0 + f } : { x0: g.x1 - f, x1: 2 };
}
// Stück ganz aus (true) oder Streifen bei x (CSS-Pixel) in einem ausgefallenen Stück, der nicht stehen bleibt
const deadAt = (g, xc) => g.dv && (!g.keep || xc / Wc < g.keep.x0 || xc / Wc > g.keep.x1);
// der ausgefallene Teil eines Stücks in Gerätepixeln (ganz oder ohne die Seite, die stehen bleibt): [x0, x1]
const deadSpan = g => !g.keep ? [-1e6, 1e6] : g.keep.x0 < 0 ? [g.keep.x1 * W, 1e6] : [-1e6, g.keep.x0 * W];

// ---------- Flächenglitch: Bruchstücke leuchten beim Berühren ----------
// Erst ab 5 Rissen und nur unter dem Finger: Von den Stücken unter der Fingerkuppe nimmt es das kleinste. Kleine
// leuchten fast immer, große selten, ganz große (ab 12 % des Bildschirms) nie. Das Stück flackert grau (die Streifen
// bleiben darüber sichtbar) und blitzt dazwischen weiß wie ein Stroboskop (dann ist dort alles weiß, auch die Streifen).
// Jedes Aufblitzen ist nach 0,3 bis 0,7 Sekunden vorbei; bleibt der Finger liegen, wird nach einer kurzen Pause neu
// gewürfelt, kommt er auf ein anderes Stück, sofort. Bei sehr vielen Rissen (ab etwa 24) blitzt ab und zu ein
// Nachbarstück kurz mit.
const FGE_MIN = 5;
let flashRegs = [], flashKey = '', flashWait = 0;
// Wie gern ein Stück aufleuchtet (nach seinem Anteil am Bildschirm)
function fgeChance(g) {
  const f = g.area / CR.A;
  return f <= 0.015 ? 1 : f >= 0.12 ? 0 : 1 - 0.9 * (f - 0.015) / 0.105;
}
function startFlash(i, life, whites) {
  let f = flashRegs.find(o => o.i === i);
  if (!f) { f = { i, a: 0, next: 0, life: 0, st: 0, w: 0, wmax: 0, c: null }; flashRegs.push(f); }
  f.life = life; f.next = 0; f.w = 0; f.wmax = whites;
}
function updateFlash(dt) {
  // laufendes Aufblitzen: grau flackern, dazwischen weiße Blitze (nie zwei direkt hintereinander), am Ende schnell aus
  for (const f of flashRegs) {
    f.life -= dt;
    if (f.life <= 0) { if (f.st === 2) f.a = 0; f.a *= Math.exp(-dt * 40); continue; }
    f.next -= dt;
    if (f.next > 0) continue;
    if (f.w < f.wmax && f.st !== 2 && (Math.random() < 0.4 || f.life < 0.12 + 0.1 * (f.wmax - f.w))) {
      f.st = 2; f.w++; f.a = rnd(0.9, 1); f.next = rnd(0.02, 0.045);
    } else if (Math.random() < 0.18) { f.st = 0; f.a = 0; f.next = rnd(0.02, 0.06); }
    else { f.st = 1; f.a = rnd(0.08, 0.5); f.next = rnd(0.03, 0.09); f.c = [rint(200, 235), rint(206, 240), rint(214, 250)]; }
  }
  flashRegs = flashRegs.filter(f => f.life > 0 || f.a > 0.01);
  flashWait -= dt;
  if (!CR) return;
  const regs = CR.regions, nC = crackCount();
  const touched = settings.touchFlash === 1 && nC >= FGE_MIN ? [...new Set(presses.filter(p => p.down && p.fi >= 0).map(p => p.fi))].sort((a, b) => a - b) : [];
  if (!touched.length) { flashKey = ''; return; }
  const key = touched.join(',');
  if (key === flashKey && flashWait > 0) return;
  flashKey = key; flashWait = rnd(1.0, 2.2);
  const busy = new Set(flashRegs.filter(f => f.life > 0).map(f => f.i)), nbP = clamp((nC - 22) / 14, 0, 1) * 0.45;
  for (const i of touched) {
    if (!regs[i] || Math.random() >= fgeChance(regs[i])) continue;
    // mit dem schnellen Ausklingen zusammen 0,3 bis 0,7 Sekunden, darin ein bis drei weiße Blitze
    startFlash(i, rnd(0.27, 0.65), rint(1, 3));
    if (Math.random() < nbP) {
      const nb = regs[i].nb.filter(j => !busy.has(j) && !touched.includes(j) && fgeChance(regs[j]) > 0);
      if (nb.length) startFlash(pick(nb), rnd(0.1, 0.25), Math.random() < 0.4 ? 1 : 0);
    }
  }
}
// white = false: graues Flackern (unter den Streifen), true: weiße Blitze (über allem außer den Rissen)
function drawFlash(ctx, white) {
  if (!CR) return;
  for (const f of flashRegs) {
    const g = CR.regions[f.i];
    if (!g || f.a <= 0.01 || (g.dv && !g.keep) || (f.st === 2) !== white) continue;
    const c = white ? [255, 255, 255] : f.c || [220, 225, 232];
    ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + f.a.toFixed(3) + ')';
    // ausgefallenes Stück: nur die Seite, auf der das Display noch läuft
    if (g.dv) { ctx.save(); ctx.beginPath(); ctx.rect(g.keep.x0 * W, 0, (g.keep.x1 - g.keep.x0) * W, H); ctx.clip(); ctx.fill(g.pathD); ctx.restore(); }
    else ctx.fill(g.pathD);
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
let drawList = [], stripeGone = 0, stripeWant = 0;
function stripeStates(dt, calm, bursting) {
  // 1) Zustand je Streifen
  const vis = [];
  const regs = CR ? CR.regions : WHOLE, multi = regs.length > 1;
  for (const L of lines) {
    // ohne Risse fällt ab und zu ein ganzer Streifen kurz aus; mit Rissen nie über den ganzen Bildschirm, dort fällt er
    // nur in einzelnen Bruchstücken aus und endet an der Risskante (unten)
    if (!multi) {
      if (L.off > 0) { L.off -= dt; if (L.off > 0) continue; }
      else if (Math.random() < (bursting ? 0.02 : P(0.03 * curG))) { L.off = rnd(0.05, bursting ? 0.4 : 1.5); continue; }
    } else L.off = 0;
    if (L.flash > 0) L.flash -= dt;
    else if (Math.random() < (bursting ? 0.25 * burstPow : P(0.12 * curG))) {
      L.flash = rnd(0.03, 0.15); L.flashCol = Math.random() < 0.5 ? pick(PAL) : L.col;
      L.bw = rnd(4, 16); L.bdx = (Math.random() < 0.5 ? -1 : 1) * rnd(1.5, 5);
      L.mask = regs.map(() => Math.random() < 0.55);
      if (!L.mask.some(Boolean)) L.mask[Math.floor(Math.random() * regs.length)] = true;
    }
    if (bursting && settings.mutate === 1 && Math.random() < 0.01) L.col = pick(PAL);
    // Grundflackern (halb so stark wie früher, der Regler bleibt)
    if (!(L.flT > 0)) { L.flT = rnd(0.03, 0.09); L.fl = 1 - calm * rnd(0, 0.225); } else L.flT -= dt;
    let x = L.x * Wc;
    if (bursting && Math.random() < 0.15) x += rnd(-3, 3);
    // abgerissen: ohne Risse bleibt der Streifen kurz nur unten ab einer zufälligen Höhe stehen. Mit Rissen nicht – dort
    // fallen Streifen nur je Bruchstück aus (lange, siehe unten), statt quer übers Bild zu verschwinden und wiederzukommen
    if (multi) L.frag = null;
    else if (!L.frag && Math.random() < (bursting ? 0.02 : P(0.02 * curG))) L.frag = { y0: rnd(0.55, 0.9) * Hc, t: rnd(0.3, 3) };
    let spans = [[0, Hc, 1]];
    if (L.frag) {
      L.frag.t -= dt;
      spans = [[L.frag.y0, Hc, 1]];
      if (Math.random() < 0.2) spans.push([L.frag.y0 - rnd(10, 60), L.frag.y0 - rnd(2, 8), 0.7]);
      if (L.frag.t <= 0) L.frag = null;
    }
    // gerade erst aufgetaucht: kurz hell aufblitzen
    const born = L.born >= 0 && t - L.born < 0.45;
    vis.push({ L, x, a: Math.max(0, Math.min(1, L.base * L.fl)), spans, born });
  }
  // 2) je Bruchstück: Versatz, Ausfälle und Farbblitze der Teilstücke
  // Fällt ein Streifen in einem Bruchstück aus, stirbt er dort an der Risskante (flackert kurz) und bleibt 30 Sekunden
  // bis 5 Minuten weg (jedes Mal anders: viele kürzer, manche richtig lang), dann kommt er flackernd wieder. Wie viele
  // gerade fehlen: sobald ein Riss da ist, bei 4 Streifen einer, bei 5 zwei, danach etwa für jeden zweiten Streifen
  // einer mehr (mit „Glitch-Ausbrüche“ etwas mehr oder weniger, höchstens 30 % der Teilstücke). Fehlt einer zu wenig,
  // stirbt nach ein paar Sekunden der nächste. Bei Ausbrüchen fallen Teilstücke auch kurz aus.
  const want = multi ? clamp(Math.round(0.5 * (baseN - 2) * clamp(curG / 0.343, 0, 1.6)), 0, 999) : 0;
  let gone = 0, segs = 0;
  const cand = [];
  drawList = regs.map((g, ri) => {
    const out = [];
    // ausgefallenes Bruchstück: bleibt schwarz (bis auf die Seite, auf der Streifen stehen bleiben)
    if (g.dv && !g.keep) return out;
    const dx = Math.round(g.s * settings.shear * SHEAR_K * dpr * jit()) / dpr;
    const lo = g.x0 * Wc - 6, hi = g.x1 * Wc + 6;
    const sb = curBursting && multi && (burstZone === 'all' || burstZone === g.zone);
    for (const v of vis) {
      const L = v.L;
      let x = v.x + dx;
      if (x < lo || x > hi || (g.dv && deadAt(g, x))) continue;
      const z = L.zones[ri] || (L.zones[ri] = { flash: 0, col: null, off: 0, die: 0, wake: 0, rest: 0, len: segLen(g, L, v.x + dx) });
      if (multi) {
        if (z.len > 4) segs++;
        if (z.rest > 0) z.rest -= curDt;
        if (z.off > 0) {
          z.off -= curDt;
          if (z.off > 0) { if (z.long) gone++; continue; }
          z.wake = z.long ? rnd(0.12, 0.3) : 0; z.rest = z.long ? rnd(10, 30) : 0;
        } else if (!(z.die > 0) && sb && Math.random() < 0.035 * burstPow) { z.off = rnd(0.2, 1.2); z.long = false; continue; }
        if (z.die > 0) { gone++; z.die -= curDt; if (z.die <= 0) { z.die = 0; z.off = 30 * Math.pow(10, Math.random()); z.long = true; continue; } }
        else if (z.len > 4 && !(z.wake > 0) && !(z.rest > 0)) cand.push(z);
        if (z.wake > 0) z.wake -= curDt;
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
      // stirbt gerade an der Risskante oder kommt wieder: flackert
      if (multi && (z.die > 0 || z.wake > 0)) a = Math.random() < 0.45 ? 0 : a * rnd(0.3, 1.5);
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
  // fehlen zu wenige: der nächste Streifen stirbt an einer Risskante (fehlt einer, im Schnitt nach 2 Sekunden). Lange
  // Teilstücke sind eher dran als kleine Ecken, damit man den Ausfall auch sieht.
  const lim = Math.min(want, Math.round(segs * 0.3));
  if (gone < lim && cand.length && Math.random() < P(0.5 * (lim - gone))) {
    let s = Math.random() * cand.reduce((q, z) => q + z.len, 0);
    for (const z of cand) { s -= z.len; if (s <= 0 || z === cand[cand.length - 1]) { z.die = rnd(0.15, 0.45); break; } }
  }
  stripeGone = gone; stripeWant = lim;
}
// Wie lang ist der Streifen (bei x, CSS-Pixel, leicht schräg wie in paintLine) in diesem Bruchstück? (0 = gar nicht)
function segLen(g, L, x) {
  if (!g.poly) return Hc;
  const k = L.tilt * Wc / Hc, x0 = x - 0.5 * L.tilt * Wc, P0 = g.poly, n = P0.length, ys = [];
  let py = P0[n - 1][1] * Wc, pf = P0[n - 1][0] * Wc - (x0 + k * py);
  for (let i = 0; i < n; i++) {
    const qy = P0[i][1] * Wc, qf = P0[i][0] * Wc - (x0 + k * qy);
    if ((pf >= 0) !== (qf >= 0)) ys.push(py + (qy - py) * (pf / (pf - qf)));
    py = qy; pf = qf;
  }
  ys.sort((a, b) => a - b);
  let len = 0;
  for (let i = 0; i + 1 < ys.length; i += 2) len += ys[i + 1] - ys[i];
  return len;
}
// je Bruchstück ausschneiden und die Streifen zeichnen
function drawStripes(bursting) {
  const regs = CR ? CR.regions : WHOLE;
  regs.forEach((g, ri) => {
    // ausgefallenes Bruchstück: bleibt schwarz (bis auf die Seite, auf der Streifen stehen bleiben)
    if (g.dv && !g.keep) return;
    const list = drawList[ri];
    const pl = pressLines.filter(q => (q.ri === ri || !CR) && !(g.dv && deadAt(g, q.L.x * Wc)));
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
// Die Normalenkarte hat doppelte Auflösung (NM_SS): Der Shader rechnet die Oberfläche vierfach je Bildschirmpixel.
const NM_SS = 2;
function onLayerBuilt(L) {
  bigPx = L.big; m3dOK = false; glowCv = null;
  if (!m3dInit()) return;
  const lw = L.lw, lh = L.lh, S2 = NM_SS, tw = lw * S2, th = lh * S2;
  const A = new Uint8ClampedArray(tw * th * 4), B = new Uint8ClampedArray(tw * th * 4);
  const put = (nm, ox, oy) => {
    for (let y = 0; y < nm.h; y++) {
      const Y = oy + y;
      if (Y < 0 || Y >= th) continue;
      for (let x = 0; x < nm.w; x++) {
        const X = ox + x;
        if (X < 0 || X >= tw) continue;
        const s = (y * nm.w + x) * 4, d = (Y * tw + X) * 4;
        if (nm.data[s + 3] > A[d + 3]) { A[d] = nm.data[s]; A[d + 1] = nm.data[s + 1]; A[d + 2] = nm.data[s + 2]; A[d + 3] = nm.data[s + 3]; }
      }
    }
  };
  // Zeichen an derselben (ganzzahligen) Stelle wie im Bild der Uhr, nur doppelt so fein
  for (const g of L.tl.list) { const nm = glyphNM(g.ch, L.big * S2, false); put(nm, Math.round(L.tx + g.x) * S2 - nm.pad, L.m * S2 - nm.pad); }
  for (const g of L.dl.list) { const nm = glyphNM(g.ch, L.small * S2, true); put(nm, Math.round(L.dx0 + g.x) * S2 - nm.pad, (L.m + L.big + L.gap) * S2 - nm.pad); }
  // je Zeile: Höhe 0..1 innerhalb der Uhrzeit bzw. des Datums (dort läuft der Horizont durch) und ob es das Datum ist;
  // dazu, ob eine Ziffer in Reichweite der Seitenwände liegt (sonst rechnet der Shader dort nichts)
  const pad = Math.ceil(L.big * 0.07 + 12 * dpr * 0.6 + 4);
  const out = new Uint8Array(tw * th);
  for (let i = 0; i < tw * th; i++) out[i] = A[i * 4 + 3] > 0 ? 0 : 1;
  const near = edt2(out, tw, th);
  const dTop = L.m + L.big + L.gap;
  for (let y = 0; y < th; y++) {
    const y1 = (y + 0.5) / S2, isD = !!L.ds && y1 >= dTop - 3;
    const v = isD ? (y1 - dTop) / L.small : (y1 - L.m) / L.big;
    const vb = clamp(v, 0, 1) * 255, db = isD ? 255 : 0;
    for (let x = 0; x < tw; x++) { const i = y * tw + x, d = i * 4; B[d] = vb; B[d + 1] = db; B[d + 2] = near[i] <= (pad + 2) * S2 ? 255 : 0; B[d + 3] = 255; }
  }
  m3dOK = m3dSetLayer(A, B, tw, th, lw, lh, pad);
  if (!m3dOK) return;
  // beim Neon der Schein: weichgezeichnete Form
  const mask = mk(tw, th), mx = mask.getContext('2d');
  if (!mx || !mx.createImageData) return;
  const id = mx.createImageData(tw, th);
  for (let i = 0; i < tw * th; i++) id.data[i * 4 + 3] = A[i * 4 + 3];
  mx.putImageData(id, 0, 0);
  const soft = (r, col) => {
    const sp = Math.ceil(r * 2.5), c = mk(lw + 2 * sp, lh + 2 * sp), x = c.getContext('2d');
    x.filter = 'blur(' + r.toFixed(1) + 'px)'; x.drawImage(mask, sp, sp, lw, lh); x.filter = 'none';
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
// keep: in einem ausgefallenen Stück nur die Seite, auf der das Display noch läuft
function drawClockPiece(ctx, g, key, calm, bands, keep) {
  const lw = CL.width, lh = CL.height;
  const z = clockZones[key] || (clockZones[key] = { off: 0, flash: 0, col: null, fl: 1, flT: 0, split: 0, sx: 0, slice: 0 });
  const sb = curBursting && (burstZone === 'all' || burstZone === (g ? g.zone : clockZone()));
  if (z.off > 0) { z.off -= curDt; if (z.off > 0) return; }
  else if (sb && Math.random() < 0.02 * burstPow) { z.off = rnd(0.04, 0.3); return; }
  if (z.flash > 0) z.flash -= curDt; else if (sb && Math.random() < 0.18 * burstPow) { z.flash = rnd(0.03, 0.15); z.col = pick(PAL); }
  if (z.split > 0) z.split -= curDt; else if (sb && Math.random() < 0.12 * burstPow) { z.split = rnd(0.04, 0.22); z.sx = rnd(2, 7) * dpr * (Math.random() < 0.5 ? -1 : 1); }
  if (z.slice > 0) z.slice -= curDt; else if (sb && Math.random() < 0.05 * burstPow) z.slice = rnd(0.05, 0.2);
  if (!(z.flT > 0)) { z.flT = rnd(0.03, 0.09); z.fl = 1 - calm * rnd(0, 0.11); } else z.flT -= curDt;
  ctx.save();
  if (g) ctx.clip(g.pathD);
  if (keep) { ctx.beginPath(); ctx.rect(keep.x0 * W, 0, (keep.x1 - keep.x0) * W, H); ctx.clip(); }
  // Versatz des Stücks: zur Seite und etwas nach unten, Stärke nach „Riss durch die Uhr“ (noch einmal halb so stark:
  // feiner einstellbar)
  const k = g ? settings.crack : 0;
  const X = CLX + (g ? Math.round(g.s * k * 0.225 * dpr * jit()) : 0), Y = CLY + (g ? Math.round(Math.abs(g.s) * k * 0.03 * dpr) : 0);
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
  // liegt die Uhr ganz in ausgefallenen Bruchstücken, bleibt sie mit ihnen schwarz (bis auf eine Seite, die noch läuft)
  if (CR && CR.regions.some(g => g.clock) && CR.regions.every(g => !g.clock || (g.dv && !g.keep))) return;
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
  if (pieces.length < 2) { const g0 = pieces[0]; drawClockPiece(ctx, null, 'ganz', calm, glitchBands(-1), g0 && g0.dv ? g0.keep : null); return; }
  for (const g of pieces) { if (g.dv && !g.keep) continue; const i = CR.regions.indexOf(g); drawClockPiece(ctx, g, i, calm, glitchBands(i), g.dv ? g.keep : null); }
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
  // nach dem Tippen auf Knöpfe das Bild zeigen (Antippen holt die Einstellungen zurück)
  showOnUse: true,
  buttons: [{ label: 'Aufschlag antippen', run: startTap }, { label: 'Bild wählen', run: pickImage, stay: true }, { label: 'Bild entfernen', run: clearBg }, { label: 'Zeitraffer', run: toggleFast }],
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
    // „Schwarze Stellen“ verstellt: gleich neu verteilen (aus: alle wieder an; sonst sofort eins, das ausgeht)
    if (id === 'dark' && CR) seedDead(CR.regions, true);
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
  dbg() {
    let segs = 0, gone = 0;
    for (const L of lines) for (const z of L.zones) if (z) { segs++; if (z.off > 0 && z.long) gone++; }
    return { presses: presses.length, pressLines: pressLines.length, lines: lines.length, m3d: m3dOK, regions: CR ? CR.regions.length : 0,
      divs: CR ? CR.divs.length : 0, hairs: CR ? CR.hairs.length : 0, rays: CR ? CR.rays.length : 0, dead: CR ? CR.regions.filter(g => g.dead > 0).length : 0,
      keep: CR ? CR.regions.filter(g => g.dead > 0 && g.keep).length : 0, styles: CR ? CR.styles : [], want: stripeWant, goneNow: stripeGone,
      flash: flashRegs.map(f => f.i + ':' + f.st), segs, gone };
  },
  // Entwicklung: Stück i für sec Sekunden ausfallen lassen (side: 0 ganz, -1 links bleibt, 1 rechts bleibt; f: Anteil)
  deadHold(i, side, sec, f) {
    const g = CR && CR.regions[i]; if (!g) return;
    g.dead = g.deadT = sec || 60; g.dv = true;
    const w = (g.x1 - g.x0) * (f || 0.3);
    g.keep = !side ? null : side < 0 ? { x0: -1, x1: g.x0 + w } : { x0: g.x1 - w, x1: 2 };
  },
  // Entwicklung: feste Neigung (null = wieder Sensor/automatisch), Zeit vorspulen
  setTilt(x, y) { if (x == null) { sens = null; sensorAt = -1e9; } else { sens = [x * 22, -y * 22]; rest = [0, 0]; sensorAt = t + 1e9; tilt = [x, y]; } },
  skip(sec) { growT += sec; autoT += sec; crackGrowT += sec; },
  // Entwicklung: Flächenglitch auf Stück i festhalten (st: 1 grau, 2 weiß) für sec Sekunden
  fgeHold(i, st, sec) { startFlash(i, sec || 2, 0); const f = flashRegs.find(o => o.i === i); f.st = st || 2; f.a = st === 1 ? 0.45 : 1; f.c = [220, 225, 232]; f.next = sec || 2; },
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
    // ausgefallene Bruchstücke: schwarz (bis auf die Seite, auf der Streifen stehen bleiben)
    if (CR) {
      ctx.fillStyle = '#000';
      for (const g of CR.regions) if (g.dv) {
        if (!g.keep) { ctx.fill(g.pathD); continue; }
        const s = deadSpan(g);
        ctx.save(); ctx.beginPath(); ctx.rect(s[0], 0, s[1] - s[0], H); ctx.clip(); ctx.fill(g.pathD); ctx.restore();
      }
    }
    stripeStates(dt, calm, bursting);
    // die Uhr gehört zum Bild des Displays: die kaputten Streifen laufen über sie, die Glasrisse über allem
    CV = null;
    if (clockOn()) { prepClock(dt); drawClock(ctx, calm); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    drawFlash(ctx, false);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    drawStripes(bursting);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // weiße Blitze des Flächenglitches: über Streifen und Uhr, unter den Rissen im Glas
    drawFlash(ctx, true);
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
