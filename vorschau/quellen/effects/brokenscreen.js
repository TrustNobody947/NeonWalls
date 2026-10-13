// Broken Screen: flackernde Farbstreifen wie bei einem kaputten Display, dazu echte Glasrisse.
// Das Handy ist an einer Ecke oder Kante aufgeschlagen (zufällig, „Neues Muster“ würfelt neu) oder an einer selbst
// angetippten Stelle (zweites Antippen: wohin der Riss laufen soll). Von dort laufen die Risse sternförmig quer übers
// ganze Bild, manche mit Abzweig, an der Aufschlagstelle ein kleines Splitternetz. Auf Wunsch wechseln die Risse von
// selbst (bei Glitch-Ausbrüchen oder alle paar Stunden).
// Die Risse teilen das Display in Bruchstücke: Jedes Stück ist ein wenig versetzt und flackert für sich, die Streifen
// enden genau an der Risskante. Der Riss selbst: dunkle Bruchkante mit feinem Glanz daneben (Licht von oben).
// Mit Uhr läuft ein Riss mitten durch die Ziffern und weiter übers ganze Bild; die Uhr zerfällt dort in Stücke.
const settings = { cracks: 3, impact: 0, splinter: 1, auto: 0, hours: 6, shear: 5, calm: 4, burst: 5, countPos: 59,
  rndWake: 0, mutate: 0, clock: 0, crack: 5, pos: 0, size: 5, date: 0, finish: 7,
  // selbst angetippt: Aufschlag (px, py) und Richtung (tx, ty) als Anteil von Breite und Höhe
  px: -1, py: -1, tx: -1, ty: -1 };
const countFromPos = v => Math.round(3 * Math.pow(50, v / 100));
const controls = [
  { type: 'range', id: 'cracks', label: 'Anzahl Risse', min: 0, max: 6, fmt: v => v == 0 ? 'keine' : String(v) },
  { type: 'choice', id: 'impact', label: 'Aufschlagstelle', options: ['Zufällig', 'Selbst angetippt'] },
  { type: 'choice', id: 'splinter', label: 'Splitter am Aufschlag', options: ['Aus', 'Wenig', 'Viel'] },
  { type: 'choice', id: 'auto', label: 'Risse wechseln von selbst', options: ['Aus', 'Bei Glitches', 'Nach Stunden'] },
  { type: 'range', id: 'hours', label: 'Wechsel nach Stunden: alle', min: 1, max: 24, fmt: v => v + (v == 1 ? ' Stunde' : ' Stunden') },
  { type: 'range', id: 'shear', label: 'Versatz am Riss', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'calm', label: 'Grundflackern', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'burst', label: 'Glitch-Ausbrüche', min: 0, max: 10, fmt: lvl },
  { type: 'range', id: 'countPos', label: 'Anzahl Streifen', min: 0, max: 100, fmt: countFromPos },
  { type: 'choice', id: 'rndWake', label: 'Neues Muster bei jedem Einschalten', options: ['Aus', 'An'] },
  { type: 'choice', id: 'mutate', label: 'Glitches verändern das Muster', options: ['Aus', 'An'] },
  { type: 'choice', id: 'clock', label: 'Uhr', options: ['An', 'Aus'] },
  { type: 'range', id: 'crack', label: 'Riss durch die Uhr', min: 0, max: 10, fmt: lvl },
  { type: 'choice', id: 'pos', label: 'Position der Uhr', options: ['Oben', 'Mitte', 'Unten'] },
  { type: 'range', id: 'size', label: 'Größe der Uhr (5 = wie Original)', min: 1, max: 10, fmt: v => String(v) },
  { type: 'choice', id: 'date', label: 'Datum', options: ['Wie Original', 'Deutsch', 'Aus'] },
  { type: 'grid', id: 'finish', label: 'Oberfläche der Uhr', options: [
    { label: 'Chrom', group: 'Metall' }, { label: 'Gold', group: 'Metall' }, { label: 'Stahlblau', group: 'Metall' },
    { label: 'Roségold', group: 'Metall' }, { label: 'Schwarzchrom', group: 'Metall' }, { label: 'Kupfer', group: 'Metall' },
    { label: 'Neon leuchtend', group: 'Leuchtend' }, { label: 'Weiß', group: 'Wie Original' }] },
];
//#include uhrface.js

// ---------- Streifen (wie die abgenommene Version, hier in CSS-Pixeln) ----------
const PAL = [[25, 230, 25], [40, 210, 40], [200, 20, 200], [170, 0, 170], [255, 20, 20], [45, 95, 255], [20, 170, 230], [120, 40, 255], [30, 190, 120], [255, 0, 220]];
let W = 1, H = 1, dpr = 1, Wc = 1, Hc = 1, t = 0, cx = null;
let lines = [], burstT = 0, nextBurst = 8, burstZone = 'all', burstPow = 1, curDt = 0.016, curBursting = false, curG = 0.25;
const P = rate => 1 - Math.exp(-rate * curDt);
const jit = () => burstT > 0 && Math.random() < 0.3 ? rnd(0.6, 1.8) : 1;
function makeLine(x) {
  const col = Math.random() < 0.5 ? pick(PAL.slice(0, 4)) : pick(PAL);
  return { x: x == null ? rnd(0, 1) : x, tilt: Math.random() < 0.3 ? rnd(-0.012, 0.012) : 0,
    w: (q => q < 0.3 ? rnd(0.22, 0.4) : q < 0.87 ? rnd(0.5, 1.1) : rnd(1.4, 2.2))(Math.random()),
    col, base: rnd(0.55, 1), flash: 0, flashCol: null, off: 0, frag: null, dotted: Math.random() < 0.45, zones: [] };
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

// ---------- Risse ----------
// Alles in Breiten-Einheiten: x von 0 bis 1, y von 0 bis A (= Höhe / Breite). Gleicher Zufallswert = gleiche Risse.
let crackSeed = (Math.random() * 2147483647) | 0, CR = null, crackLayer = null, clockZones = {};
function rng(seed) {
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; };
}
// Wie stark zufällige Risse quer statt steil laufen (0 = gleich verteilt)
const QUER = 0.55;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
// Schnitt der Strecke a→b mit c→d: Anteil entlang a→b, sonst -1
function segHit(ax, ay, bx, by, qx, qy, ex, ey) {
  const rX = bx - ax, rY = by - ay, sX = ex - qx, sY = ey - qy, den = rX * sY - rY * sX;
  if (Math.abs(den) < 1e-12) return -1;
  const u = ((qx - ax) * sY - (qy - ay) * sX) / den, v = ((qx - ax) * rY - (qy - ay) * rX) / den;
  return u > 1e-6 && u <= 1 && v >= 0 && v <= 1 ? u : -1;
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
// Riss wachsen lassen: fast gerade, mit kleinen Knicken, bis zum Bildrand, bis maxLen oder bis zu einem anderen Riss.
// aim: Punkt, durch den er laufen soll (Uhr).
function grow(R, A, x, y, dir, maxLen, aim, stopAt) {
  const pts = [[x, y]];
  let base = dir, len = 0, aiming = !!aim, lastD = 1e9;
  for (let guard = 0; guard < 400; guard++) {
    // kurze, fast gerade Stücke mit kleinen Knicken; die Grundrichtung wandert langsam (leichte Krümmung)
    const L = 0.015 + R() * 0.045;
    base += (R() - 0.5) * 0.08;
    dir += (R() - 0.5) * 0.34 + angDiff(base, dir) * 0.35;
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
    if (stopAt) {
      let best = 2;
      for (const S of stopAt) for (let i = 1; i < S.length; i++) {
        const u = segHit(x, y, nx, ny, S[i - 1][0], S[i - 1][1], S[i][0], S[i][1]);
        if (u >= 0 && u < best) best = u;
      }
      if (best <= 1) { nx = x + (nx - x) * best; ny = y + (ny - y) * best; end = true; }
    }
    const sl = Math.hypot(nx - x, ny - y);
    if (maxLen && len + sl >= maxLen) { const f = (maxLen - len) / sl; nx = x + (nx - x) * f; ny = y + (ny - y) * f; end = true; }
    len += Math.hypot(nx - x, ny - y);
    pts.push([nx, ny]); x = nx; y = ny;
    if (end) break;
  }
  return pts;
}
// Feine Zacken wie bei echtem Glasbruch: jede Strecke in kurze Stücke, quer dazu ein kleiner, zusammenhängender
// Zickzack-Versatz (Enden bleiben genau)
function refine(R, pts, amp) {
  const out = [pts[0]];
  let j = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(l / 0.007));
    for (let k = 1; k < n; k++) {
      const f = k / n;
      j = j * 0.55 + (R() - 0.5) * 2 * amp;
      if (R() < 0.08) j += (R() - 0.5) * 4 * amp;   // ab und zu ein kleiner Sprung
      out.push([a[0] + dx * f - dy / l * j, a[1] + dy * f + dx / l * j]);
    }
    out.push(b);
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
// Richtungen im Fächer a0..a1: gleichmäßig verteilt, waagerechte Richtungen etwas häufiger (k = Stärke, 0 = gleich)
function fanDirs(R, a0, a1, N, k) {
  const M = 240, cum = [0];
  for (let i = 1; i <= M; i++) { const sn = Math.sin(a0 + (a1 - a0) * (i - 0.5) / M); cum.push(cum[i - 1] + 1 - k * sn * sn); }
  const out = [];
  for (let i = 0; i < N; i++) {
    const u = clamp((i + 0.5 + (R() - 0.5) * 0.64) / N, 0, 1) * cum[M];
    let j = 1;
    while (j < M && cum[j] < u) j++;
    const f = clamp((u - cum[j - 1]) / Math.max(1e-9, cum[j] - cum[j - 1]), 0, 1);
    out.push(a0 + (a1 - a0) * (j - 1 + f) / M);
  }
  return out;
}
function crosses(c, list, Px, Py) {
  for (const S of list) for (let i = 1; i < c.length; i++) for (let j = 1; j < S.length; j++) {
    const u = segHit(c[i - 1][0], c[i - 1][1], c[i][0], c[i][1], S[j - 1][0], S[j - 1][1], S[j][0], S[j][1]);
    if (u >= 0) {
      const x = c[i - 1][0] + (c[i][0] - c[i - 1][0]) * u, y = c[i - 1][1] + (c[i][1] - c[i - 1][1]) * u;
      if (Math.hypot(x - Px, y - Py) > 0.006) return true;
    }
  }
  return false;
}
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function makeCracks() {
  CR = null; crackLayer = null; clockZones = {};
  for (const L of lines) L.zones = [];
  const N = settings.cracks | 0;
  if (N <= 0 || W <= 1) return;
  const R = rng(crackSeed), r = (a, b) => a + R() * (b - a), A = H / W;
  // Px/Py: Aufschlag knapp im Glas. Sx/Sy: Stelle am Rand, bis zu der die Aufschlagstelle durchreißt (null = mitten im
  // Glas, dann reißt es nach hinten bis zum Rand). a0..a1: Richtungen ins Bild hinein.
  const ins = r(0.025, 0.05);
  let Px, Py, Sx = null, Sy = null, a0, a1, dirs, md = 0, back = false, aim = null, aimIdx = -1;
  const manual = settings.impact === 1 && settings.px >= 0 && settings.tx >= 0;
  if (manual) {
    // selbst angetippt: Aufschlag und Richtung vom Nutzer, der genaue Verlauf bleibt dem Zufall überlassen
    Px = clamp(settings.px, 0.012, 0.988); Py = clamp(settings.py, 0.006, 0.994) * A;
    const Tx = settings.tx, Ty = settings.ty * A, far = Math.hypot(Tx - Px, Ty - Py) > 0.03;
    md = far ? Math.atan2(Ty - Py, Tx - Px) : R() * 2 * Math.PI;
    const ed = [[Px, 0], [1 - Px, 1], [Py, 2], [A - Py, 3]].sort((u, v) => u[0] - v[0])[0];
    if (ed[0] < 0.07) {
      const e = ed[1];
      if (e === 0) { Sx = 0; Sy = Py; a0 = -Math.PI / 2; a1 = Math.PI / 2; }
      else if (e === 1) { Sx = 1; Sy = Py; a0 = Math.PI / 2; a1 = 1.5 * Math.PI; }
      else if (e === 2) { Sx = Px; Sy = 0; a0 = 0; a1 = Math.PI; }
      else { Sx = Px; Sy = A; a0 = Math.PI; a1 = 2 * Math.PI; }
      a0 += 0.17; a1 -= 0.17;
    } else { a0 = md - Math.PI; a1 = md + Math.PI; back = true; }
    const mid = (a0 + a1) / 2;
    md = mid + angDiff(md, mid);
    // Fächer um die angetippte Richtung: je mehr Risse, desto breiter
    const spread = Math.min(a1 - a0, 0.45 + 0.4 * N) * (back ? 0.85 : 1);
    const c0 = spread >= a1 - a0 - 1e-6 ? mid : clamp(md, a0 + spread / 2, a1 - spread / 2);
    dirs = fanDirs(R, c0 - spread / 2, c0 + spread / 2, N, 0);
    // der Riss, der der angetippten Richtung am nächsten ist, läuft genau dorthin
    aimIdx = 0;
    dirs.forEach((v, i) => { if (Math.abs(v - md) < Math.abs(dirs[aimIdx] - md)) aimIdx = i; });
    dirs[aimIdx] = clamp(md, a0, a1);
    if (far) aim = [Tx, Ty]; else aimIdx = -1;
  } else {
    // zufällig: halb so oft an einer Ecke (unten etwas häufiger als oben) wie an einer Kante (meist links oder rechts,
    // seltener unten oder oben). Die Risse laufen etwas häufiger quer als steil.
    if (R() < 0.5) {
      const c = R() < 0.6 ? (R() < 0.5 ? 0 : 1) : (R() < 0.5 ? 2 : 3);   // 0 unten links, 1 unten rechts, 2 oben links, 3 oben rechts
      const left = c === 0 || c === 2, bottom = c < 2;
      Px = left ? ins : 1 - ins; Py = bottom ? A - ins : ins; Sx = left ? 0 : 1; Sy = bottom ? A : 0;
      [a0, a1] = c === 0 ? [-Math.PI / 2, 0] : c === 1 ? [Math.PI, 1.5 * Math.PI] : c === 2 ? [0, Math.PI / 2] : [Math.PI / 2, Math.PI];
    } else {
      const e = R();
      if (e < 0.38) { Px = ins; Py = r(0.12, 0.9) * A; Sx = 0; Sy = Py; a0 = -Math.PI / 2; a1 = Math.PI / 2; }
      else if (e < 0.76) { Px = 1 - ins; Py = r(0.12, 0.9) * A; Sx = 1; Sy = Py; a0 = Math.PI / 2; a1 = 1.5 * Math.PI; }
      else if (e < 0.9) { Px = r(0.15, 0.85); Py = A - ins; Sx = Px; Sy = A; a0 = Math.PI; a1 = 2 * Math.PI; }
      else { Px = r(0.15, 0.85); Py = ins; Sx = Px; Sy = 0; a0 = 0; a1 = Math.PI; }
    }
    a0 += 0.17; a1 -= 0.17;   // kein Riss direkt an der Kante entlang
    dirs = fanDirs(R, a0, a1, N, QUER);
    md = (a0 + a1) / 2;
    // Mit Uhr: ein Riss läuft durch die Ziffern (der nächstliegende wird dorthin gelenkt)
    if (settings.clock === 0 && settings.crack > 0 && layer) {
      const tx = (lx + layer.width * r(0.3, 0.7)) / W, ty = (ly + layer.height * r(0.3, 0.55)) / W;
      const d = angDiff(Math.atan2(ty - Py, tx - Px), md);
      if (Math.abs(d) <= (a1 - a0) / 2 + 0.17) {
        const ta = md + d;
        let best = 1e9;
        dirs.forEach((v, i) => { if (Math.abs(v - ta) < best) { best = Math.abs(v - ta); aimIdx = i; } });
        dirs[aimIdx] = ta; aim = [tx, ty];
      }
    }
  }
  // Hauptrisse vom Aufschlag bis zum Rand (der durch die Uhr zuerst), ohne sich zu kreuzen
  const order = dirs.map((_, i) => i);
  if (aimIdx >= 0) { order.splice(aimIdx, 1); order.unshift(aimIdx); }
  const spokes = [];
  for (const i of order) {
    let pts = null;
    for (let tr = 0; tr < 8 && !pts; tr++) {
      const c = grow(R, A, Px, Py, dirs[i] + (tr ? r(-0.06, 0.06) : 0), 0, i === aimIdx ? aim : null, null);
      if (!crosses(c, spokes.map(s => s.coarse), Px, Py)) pts = c;
    }
    if (!pts) pts = grow(() => 0.5, A, Px, Py, dirs[i], 0, null, null);   // notfalls ganz gerade
    spokes.push({ coarse: pts, dir: dirs[i] });
  }
  for (const s of spokes) s.pts = refine(R, s.coarse, 0.0019);
  if (Sx !== null) {
    // die Aufschlagstelle reißt bis an den Rand durch
    spokes.push({ pts: refine(R, [[Px, Py], [Sx, Sy]], 0.0012), stub: true, coarse: [[Px, Py], [Sx, Sy]], dir: Math.atan2(Sy - Py, Sx - Px) });
  } else if (back) {
    // Aufschlag mitten im Glas: nach hinten reißt es ebenfalls bis zum Rand
    const bd = md + Math.PI + r(-0.35, 0.35);
    let pts = null;
    for (let tr = 0; tr < 8 && !pts; tr++) {
      const c = grow(R, A, Px, Py, bd + (tr ? r(-0.25, 0.25) : 0), 0, null, null);
      if (!crosses(c, spokes.map(o => o.coarse), Px, Py)) pts = c;
    }
    if (!pts) pts = grow(() => 0.5, A, Px, Py, bd, 0, null, null);
    spokes.push({ coarse: pts, pts: refine(R, pts, 0.0019), dir: bd });
  }

  // Abzweige: enden am Rand, nach einer Weile oder an einem anderen Riss
  const branches = [];
  for (const s of spokes) {
    if (s.stub) continue;
    const nB = R() < 0.55 ? (R() < 0.25 ? 2 : 1) : 0;
    const total = polyLen(s.pts);
    for (let k = 0; k < nB; k++) {
      const at = pointAtLen(s.pts, total * r(0.25, 0.8));
      const bd = at[2] + (R() < 0.5 ? -1 : 1) * r(0.3, 0.65);
      const others = spokes.filter(o => o !== s).map(o => o.pts).concat(branches);
      branches.push(refine(R, grow(R, A, at[0], at[1], bd, r(0.12, 0.55), null, others), 0.0016));
    }
  }

  // Splitternetz am Aufschlag: Querrisse in Bögen zwischen benachbarten Hauptrissen, kurze Sprünge, kleine Glassplitter
  const web = [], shards = [];
  const sp = settings.splinter;
  if (sp > 0) {
    const fan = spokes.filter(s => !s.stub).sort((a, b) => angDiff(a.dir, md) - angDiff(b.dir, md));
    const radii = sp === 1 ? [r(0.014, 0.022), r(0.032, 0.05)] : [r(0.01, 0.016), r(0.024, 0.034), r(0.042, 0.06), r(0.07, 0.1)];
    for (const rad of radii) for (let i = 0; i + 1 < fan.length; i++) {
      if (R() > (sp === 1 ? 0.7 : 0.88) || Math.abs(angDiff(fan[i + 1].dir, fan[i].dir)) > 1.6) continue;
      const pa = pointAtLen(fan[i].pts, rad * r(0.85, 1.15)), pb = pointAtLen(fan[i + 1].pts, rad * r(0.85, 1.15));
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, ox = mx - Px, oy = my - Py, ol = Math.hypot(ox, oy) || 1, bulge = rad * r(0.02, 0.15);
      web.push(refine(R, [[pa[0], pa[1]], [mx + ox / ol * bulge, my + oy / ol * bulge], [pb[0], pb[1]]], 0.0009));
    }
    const nT = sp === 1 ? 2 + Math.floor(R() * 3) : 6 + Math.floor(R() * 5);
    for (let k = 0; k < nT; k++) {
      const ang = r(a0 - 0.17, a1 + 0.17), d0 = r(0.004, sp === 1 ? 0.03 : 0.05);
      const x0 = Px + Math.cos(ang) * d0, y0 = Py + Math.sin(ang) * d0;
      if (x0 <= 0 || x0 >= 1 || y0 <= 0 || y0 >= A) continue;
      web.push(refine(R, grow(R, A, x0, y0, ang + r(-0.9, 0.9), r(0.006, 0.025), null, null), 0.0008));
    }
    // kleine Glassplitter: Dreiecke mit hellen Kanten, dicht am Aufschlag
    const nS = sp === 1 ? 5 + Math.floor(R() * 4) : 14 + Math.floor(R() * 8);
    for (let k = 0; k < nS; k++) {
      const ang = r(a0 - 0.17, a1 + 0.17), d0 = r(0, sp === 1 ? 0.018 : 0.03) * (0.4 + R());
      const cx0 = Px + Math.cos(ang) * d0, cy0 = Py + Math.sin(ang) * d0, s0 = r(0.0025, 0.007), rot = R() * 6.3;
      const tri = [0, 1, 2].map(q => { const a = rot + q * 2.1 + r(-0.5, 0.5), rr = s0 * r(0.6, 1.2); return [cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr]; });
      if (tri.every(p => p[0] > 0 && p[0] < 1 && p[1] > 0 && p[1] < A)) shards.push({ tri, a: r(0.05, 0.16), e: r(0.25, 0.6) });
    }
  }

  // Bruchstücke: zwischen je zwei benachbarten Rissen (sortiert nach ihrem Endpunkt am Rand, im Uhrzeigersinn)
  const T = 2 + 2 * A;
  const per = (x, y) => y <= 1e-7 ? x : x >= 1 - 1e-7 ? 1 + y : y >= A - 1e-7 ? 1 + A + (1 - x) : 2 + A + (A - y);
  const corners = [[1, 0, 1], [1, A, 1 + A], [0, A, 2 + A], [0, 0, 0]];
  const ends = spokes.map(s => { const e = s.pts[s.pts.length - 1]; return { s, t: per(e[0], e[1]) }; }).sort((a, b) => a.t - b.t);
  const regions = [];
  for (let i = 0; i < ends.length; i++) {
    const a = ends[i], b = ends[(i + 1) % ends.length];
    const ta = a.t, tb = b.t > ta ? b.t : b.t + T;
    const poly = a.s.pts.slice(), inc = [];
    for (const c of corners) for (const off of [0, T]) { const ct = c[2] + off; if (ct > ta + 1e-9 && ct < tb - 1e-9) inc.push([ct, c[0], c[1]]); }
    inc.sort((u, v) => u[0] - v[0]);
    for (const c of inc) poly.push([c[1], c[2]]);
    for (let k = b.s.pts.length - 1; k >= 1; k--) poly.push(b.s.pts[k]);
    let area = 0, gx = 0, gy = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k], q = poly[(k + 1) % poly.length], cr = p[0] * q[1] - q[0] * p[1];
      area += cr; gx += (p[0] + q[0]) * cr; gy += (p[1] + q[1]) * cr;
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    }
    const cy = Math.abs(area) > 1e-9 ? gy / (3 * area) : (y0 + y1) / 2;
    regions.push({ poly, area: Math.abs(area / 2), x0, x1, y0, y1, zone: cy < A / 3 ? 'top' : cy > 2 * A / 3 ? 'bottom' : 'mid', s: 0 });
  }
  // Versatz der Stücke: abwechselnd nach links und rechts, das größte Stück bleibt, wo es ist
  regions.forEach((g, i) => { g.s = (i % 2 ? -1 : 1) * r(0.6, 1.2); });
  regions.reduce((m, g) => g.area > m.area ? g : m, regions[0]).s = 0;
  for (const g of regions) {
    g.pathC = new Path2D(); g.pathD = new Path2D();
    g.poly.forEach((p, k) => { if (k) { g.pathC.lineTo(p[0] * Wc, p[1] * Wc); g.pathD.lineTo(p[0] * W, p[1] * W); } else { g.pathC.moveTo(p[0] * Wc, p[1] * Wc); g.pathD.moveTo(p[0] * W, p[1] * W); } });
    g.pathC.closePath(); g.pathD.closePath();
  }

  // Zeichenliste: dunkle Bruchkante (Breite w) mit Glanz, der entlang des Risses weich stärker und schwächer wird
  const list = [];
  const add = (pts, w, kind, base) => {
    const cl = [0];
    for (let i = 1; i < pts.length; i++) cl.push(cl[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    // Seite zum Licht (oben) einmal je Riss festlegen, damit der Glanz nicht hin und her springt
    const e = pts[pts.length - 1], dx = e[0] - pts[0][0], dy = e[1] - pts[0][1], l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l;
    if (ny > 0 || (Math.abs(ny) < 0.25 && nx > 0)) { nx = -nx; ny = -ny; }
    list.push({ pts, cl, w, kind, base, g: glint(R), nx, ny });
  };
  for (const s of spokes) add(s.pts, s.stub ? 1.2 : 1, 'spoke', r(0.5, 0.75));
  for (const b of branches) add(b, 0.8, 'branch', r(0.4, 0.65));
  for (const w of web) add(w, 0.65, 'web', r(0.55, 0.9));
  CR = { P: [Px, Py], A, spokes, branches, web, shards, regions, list };
  updateClockPieces();
  renderCracks();
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
  const Px = CR.P[0], Py = CR.P[1];
  // am Aufschlag ist das Glas zertrümmert und fängt mehr Licht
  const boost = (x, y) => 1 + 1.3 * Math.exp(-Math.hypot(x - Px, y - Py) / 0.05);
  // 1) dunkle Bruchkante: am Aufschlag breiter, zum Ende hin schmaler (in Stücken gezeichnet)
  g.strokeStyle = '#000';
  for (const c of CR.list) {
    const total = c.cl[c.cl.length - 1] || 1;
    let i0 = 0;
    while (i0 < c.pts.length - 1) {
      let i1 = i0 + 1;
      while (i1 < c.pts.length - 1 && c.cl[i1] - c.cl[i0] < 0.04) i1++;
      const f = c.kind === 'spoke' ? 1.35 - 0.6 * Math.min(1, c.cl[i0] / Math.max(0.3, total)) : 1;
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
    shine(c, 1, () => 1);
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

// ---------- Streifen zeichnen: je Bruchstück ausgeschnitten und versetzt ----------
function paintLine(L, x, y0, y1, alpha, col) {
  const [r, g, b] = col;
  let xa = x + L.tilt * Wc * (y0 / Hc - 0.5), xb = x + L.tilt * Wc * (y1 / Hc - 0.5);
  if (!L.tilt) xa = xb = (Math.round(x * dpr - 0.5) + 0.5) / dpr;   // senkrechte Streifen aufs Pixelraster
  const seg = () => { cx.beginPath(); cx.moveTo(xa, y0); cx.lineTo(xb, y1); cx.stroke(); };
  cx.lineCap = 'butt';
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
    vis.push({ L, x, a: Math.max(0, Math.min(1, L.base * L.fl)), spans, keep });
  }
  // 2) je Bruchstück: Versatz, Ausfälle und Farbblitze der Teilstücke
  drawList = regs.map((g, ri) => {
    const out = [];
    const dx = Math.round(g.s * settings.shear * 1.2 * dpr * jit()) / dpr;
    const lo = g.x0 * Wc - 6, hi = g.x1 * Wc + 6;
    const sb = curBursting && multi && (burstZone === 'all' || burstZone === g.zone);
    for (const v of vis) {
      const L = v.L, x = v.x + dx;
      if (x < lo || x > hi || (v.keep && !v.keep[ri])) continue;
      const z = L.zones[ri] || (L.zones[ri] = { flash: 0, col: null, off: 0 });
      if (multi) {
        // zwischen den Rissen fällt ein Streifen ab und zu für eine Weile aus
        if (z.off > 0) { z.off -= curDt; if (z.off > 0) continue; }
        else if (Math.random() < (sb ? 0.035 * burstPow : P(0.05 * curG))) { z.off = rnd(0.15, sb ? 0.8 : 2.2); continue; }
        if (z.flash > 0) z.flash -= curDt;
        else if (Math.random() < (sb ? 0.3 * burstPow : P(0.18 * curG))) {
          z.flash = rnd(0.03, 0.18); z.col = Math.random() < 0.6 ? pick(PAL) : L.col;
          z.bw = rnd(4, 16); z.bdx = (Math.random() < 0.5 ? -1 : 1) * rnd(1.5, 5);
        }
      }
      let a = v.a, c = L.col, fl = null;
      if (L.flash > 0 && (!L.mask || L.mask[ri] !== false)) { a = Math.random() < 0.5 ? rnd(1, 1.6) : rnd(0.05, 0.3); c = L.flashCol || L.col; fl = { col: c, w: L.bw, dx: L.bdx }; }
      else if (multi && z.flash > 0) { a = Math.random() < 0.5 ? rnd(1, 1.6) : rnd(0.05, 0.3); c = z.col; fl = { col: c, w: z.bw, dx: z.bdx }; }
      out.push({ L, x, a, c, spans: v.spans, fl });
    }
    return out;
  });
}
// je Bruchstück ausschneiden und die Streifen zeichnen
function drawStripes(bursting) {
  const regs = CR ? CR.regions : WHOLE;
  regs.forEach((g, ri) => {
    const list = drawList[ri];
    if (!list || !list.length) return;
    if (g.pathC) { cx.save(); cx.clip(g.pathC); }
    for (const d of list) for (const sp of d.spans) paintLine(d.L, d.x, sp[0], sp[1], Math.max(0, Math.min(1, d.a * sp[2])), d.c);
    if (g.pathC) cx.restore();
  });
  // während Ausbrüchen tauchen kurz neue Streifen auf
  if (bursting && Math.random() < 0.35) {
    const tmp = makeLine(); tmp.w = rnd(0.5, 1.2);
    paintLine(tmp, tmp.x * Wc, Math.random() < 0.5 ? 0 : rnd(0.3, 0.8) * Hc, Hc, rnd(0.6, 1), tmp.col);
  }
}

// ---------- Uhr in Bruchstücken (Gerätepixel) ----------
// Die Uhr glitcht nur dort, wo gerade auch die Streifen glitchen: bei einem Ausbruch in ihrem Bereich als Ganzes
// (Farbkanäle, verrutschte Zeilen, Farbblitz, kurzer Ausfall), sonst nur in einem schmalen Band um jeden Streifen, der
// gerade aufblitzt – dort verrutscht sie ein Stück zur Seite und nimmt seine Farbe an.
const tintCache = new Map();
let tintFor = null;
function tinted(col) {
  if (tintFor !== layer) { tintCache.clear(); tintFor = layer; }
  const key = col.join(',');
  let c = tintCache.get(key);
  if (!c) {
    c = mk(layer.width, layer.height);
    const x = c.getContext('2d');
    x.drawImage(layer, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgb(' + key + ')'; x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
  }
  return c;
}
function clockZone() {
  const c = (ly + layer.height / 2) / H;
  return c < 1 / 3 ? 'top' : c > 2 / 3 ? 'bottom' : 'mid';
}
function drawClockPiece(ctx, g, key, calm, bands) {
  const lw = layer.width, lh = layer.height;
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
  // Versatz des Stücks: zur Seite und etwas nach unten, Stärke nach „Riss durch die Uhr“
  const k = g ? settings.crack : 0;
  const X = lx + (g ? Math.round(g.s * k * 0.9 * dpr * jit()) : 0), Y = ly + (g ? Math.round(Math.abs(g.s) * k * 0.12 * dpr) : 0);
  ctx.globalAlpha = z.fl;
  if (z.split > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(layerC[0], X + z.sx, Y); ctx.drawImage(layerC[1], X, Y); ctx.drawImage(layerC[2], X - z.sx, Y);
  } else if (z.slice > 0) {
    const n = rint(3, 6);
    for (let s = 0; s < n; s++) {
      const sy = Math.floor(lh * s / n), sh = Math.ceil(lh / n);
      ctx.drawImage(layer, 0, sy, lw, sh, X + rnd(-1, 1) * 10 * dpr, Y + sy, lw, sh);
    }
  } else ctx.drawImage(layer, X, Y);
  if (z.flash > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * z.fl; ctx.drawImage(tinted(z.col), X, Y);
  }
  // einzelne Streifen glitchen: in ihrem Band verrutscht die Uhr und nimmt ihre Farbe an
  let nb = 0;
  for (const b of bands) {
    const bx = b.x * dpr, bw = Math.max(2, b.w * dpr);
    if (bx + bw / 2 < X || bx - bw / 2 > X + lw || ++nb > 10) continue;
    ctx.save();
    ctx.beginPath(); ctx.rect(bx - bw / 2, Y - 2, bw, lh + 4); ctx.clip();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(bx - bw / 2, Y, bw, lh);
    ctx.globalAlpha = z.fl; ctx.drawImage(layer, X + b.dx * dpr, Y);
    ctx.globalAlpha = 0.55 * z.fl; ctx.drawImage(tinted(b.col), X + b.dx * dpr, Y);
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
  if (!layer) return;
  const pieces = CR && settings.crack > 0 ? CR.regions.filter(g => g.clock) : [];
  if (pieces.length < 2) { drawClockPiece(ctx, null, 'ganz', calm, glitchBands(-1)); return; }
  for (const g of pieces) { const i = CR.regions.indexOf(g); drawClockPiece(ctx, g, i, calm, glitchBands(i)); }
}

// ---------- Aufschlag antippen, Risse von selbst wechseln ----------
let api = null, tapStep = 0, tapP = null, autoT = 0;
function newCracks() { crackSeed = (Math.random() * 2147483647) | 0; makeCracks(); autoT = 0; }
function startTap() {
  tapStep = 1; tapP = null;
  if (api) { api.hideSheet(); api.toast('Tippe auf die Stelle, an der das Handy aufgeschlagen ist.', 60000); }
}

return {
  maxDpr: 4,
  settings, controls,
  actionLabel: 'Glitch jetzt',
  buttons: [{ label: 'Aufschlag antippen', run: startTap }],
  bindUI(a) { api = a; },
  // Antippen im Auswahlmodus: erst die Aufschlagstelle, dann die Richtung des Risses
  tap(x, y) {
    if (!tapStep) return false;
    const fx = clamp(x / W, 0, 1), fy = clamp(y / H, 0, 1);
    if (tapStep === 1) {
      tapP = [fx, fy]; tapStep = 2;
      if (api) api.toast('Und jetzt dorthin tippen, wohin der Riss laufen soll.', 60000);
      return true;
    }
    tapStep = 0;
    if (api) { api.set('px', tapP[0]); api.set('py', tapP[1]); api.set('tx', fx); api.set('ty', fy); api.set('impact', 1); }
    else { settings.px = tapP[0]; settings.py = tapP[1]; settings.tx = fx; settings.ty = fy; settings.impact = 1; }
    tapP = null;
    newCracks();
    if (api) api.toast('Fertig! „Neues Muster“ zeigt einen anderen Verlauf, unter „Aufschlagstelle“ geht es zurück auf Zufall.', 5000);
    return true;
  },
  resize(w, h, d) {
    W = w; H = h; dpr = d; Wc = W / dpr; Hc = H / dpr;
    for (const k in cache) delete cache[k];
    buildLayer();
    makeCracks();
  },
  newPattern() { newLines(); newCracks(); },
  action() { triggerBurst(); if (settings.auto === 1 && burstZone === 'all') newCracks(); },
  wake() {
    if (settings.rndWake === 1) { newLines(); newCracks(); }
    triggerBurst('all'); burstT = rnd(0.25, 0.6);
  },
  change(id) {
    if (id === 'countPos') newLines();
    if (id === 'burst') { nextBurst = scheduleBurst(settings.burst / 10); burstT = 0; }
    if (id === 'finish') for (const k in cache) delete cache[k];
    if (id === 'size' || id === 'date' || id === 'finish' || id === 'pos') buildLayer();
    if (id === 'cracks' || id === 'splinter' || id === 'clock' || id === 'crack' || id === 'size' || id === 'date' || id === 'pos') makeCracks();
    // „Selbst angetippt“ ohne angetippte Stelle: gleich antippen lassen
    if (id === 'impact') { if (settings.impact === 1 && !(settings.px >= 0 && settings.tx >= 0)) startTap(); else { tapStep = 0; newCracks(); } }
    if (id === 'auto' || id === 'hours') autoT = 0;
  },
  // zum Ausprobieren in der Entwicklung: bestimmter Zufallswert für die Risse
  seed(v) { crackSeed = v | 0; makeCracks(); },
  info() { return CR; },
  // Entwicklung: alle Streifen kurz aufblitzen lassen
  flashAll(n) { lines.slice(0, n || lines.length).forEach(L => { L.flash = 0.2; L.flashCol = pick(PAL); L.bw = 10; L.bdx = 4; L.mask = null; }); },
  frame(ctx, dt) {
    t += dt; cx = ctx;
    const calm = settings.calm / 10, bur = settings.burst / 10;
    const TX = texts();
    if (stamp !== TX.time + TX.ds) { buildLayer(); updateClockPieces(); }
    if (burstT > 0) {
      burstT -= dt;
      // nach einem Glitch-Ausbruch manchmal ein neues Streifenmuster (Risse bleiben)
      if (burstT <= 0 && settings.mutate === 1 && Math.random() < 0.5) { newLines(); }
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
    if (settings.auto === 2) { autoT += dt; if (autoT >= settings.hours * 3600) newCracks(); }
    curDt = dt; curBursting = burstT > 0;
    curG = bur > 0 ? 0.02 + 0.98 * Math.pow(bur, 1.6) : 0;
    const bursting = curBursting && burstZone === 'all';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = bursting && Math.random() < 0.3 ? 'rgba(0,30,10,.5)' : 'rgba(0,12,4,.6)'; ctx.fillRect(0, 0, W, H);
    stripeStates(dt, calm, bursting);
    if (settings.clock === 0) drawClock(ctx, calm);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
    drawStripes(bursting);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    // Glasrisse über allem
    if (crackLayer) ctx.drawImage(crackLayer, 0, 0);
    // beim Antippen: Markierung der gewählten Aufschlagstelle, bis die Richtung angetippt ist
    if (tapStep === 2 && tapP) {
      const mx = tapP[0] * W, my = tapP[1] * H;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(mx, my, 10 * dpr, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(mx, my, 2 * dpr, 0, 2 * Math.PI); ctx.fillStyle = '#fff'; ctx.fill();
    }
  },
};
