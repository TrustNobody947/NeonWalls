// Testlauf einer Vorschau ohne Browser: falsche Leinwand, simulierte Zeit, alle Regler durchprobieren.
// Aufruf: node test.js <name> [frames]
const fs = require('fs');
const key = process.argv[2];
const FRAMES = +(process.argv[3] || 400);
const code = fs.readFileSync(__dirname + '/out/' + key + '.js', 'utf8');

const noop = () => {};
let drawCalls = 0;
function fakeCtx(canvas) {
  const target = {
    canvas,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }),
    createLinearGradient: () => ({ addColorStop: (o, c) => { if (!(o >= 0 && o <= 1)) throw new Error('Gradient-Stop ausserhalb 0..1: ' + o); } }),
    createRadialGradient: (...a) => { if (a.some(v => !isFinite(v)) || a[2] < 0 || a[5] < 0) throw new Error('Radialverlauf ungültig: ' + a); return { addColorStop: (o) => { if (!(o >= 0 && o <= 1)) throw new Error('Gradient-Stop ausserhalb 0..1: ' + o); } }; },
    createPattern: () => ({ setTransform: noop }),
    measureText: s => ({ width: String(s).length * 7 }),
    getTransform: () => ({ a: 1, d: 1, e: 0, f: 0 }),
  };
  const counted = new Set(['fillRect', 'stroke', 'fill', 'drawImage', 'fillText', 'strokeRect', 'putImageData', 'arc']);
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (counted.has(k)) return (...args) => {
        drawCalls++;
        for (const v of args) if (typeof v === 'number' && !isFinite(v)) throw new Error(k + ' mit ungültiger Zahl: ' + args);
      };
      return noop;
    },
    set(t, k, v) {
      if ((k === 'globalAlpha' || k === 'lineWidth') && (typeof v !== 'number' || !isFinite(v))) throw new Error(k + ' ungültig: ' + v);
      t[k] = v; return true;
    },
  });
}
function makeCanvas() {
  const c = { width: 300, height: 150, style: {}, addEventListener: noop };
  c.getContext = () => fakeCtx(c);
  return c;
}
const elements = {};
function el(id) {
  if (!elements[id]) {
    const e = id === 'c' ? makeCanvas() : {
      hidden: true, value: '0', textContent: '', className: '', style: { setProperty: noop },
      classList: { add: noop, remove: noop, toggle: noop },
      listeners: {}, addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
      appendChild: noop, insertBefore: noop, querySelector() { return el('q' + Math.random()); }, querySelectorAll: () => [],
      set innerHTML(v) {}, get innerHTML() { return ''; },
    };
    elements[id] = e;
  }
  return elements[id];
}
global.document = {
  getElementById: el, createElement: t => t === 'canvas' ? makeCanvas() : el('x' + Math.random()),
  querySelector: () => el('q' + Math.random()),
  addEventListener: noop, documentElement: {}, hidden: false,
};
global.window = { devicePixelRatio: 2.75 };
global.Path2D = class { moveTo() {} lineTo() {} closePath() {} rect() {} arc() {} };
global.innerWidth = 393; global.innerHeight = 873;
global.addEventListener = noop;
global.matchMedia = () => ({ matches: false });
global.localStorage = { getItem: () => null, setItem: noop };
let now = 0;
global.performance = { now: () => now };
let rafCb = null;
global.requestAnimationFrame = f => { rafCb = f; };
const timers = [];
global.setTimeout = (f, ms) => { timers.push([now + (ms || 0), f]); return timers.length; };
global.clearTimeout = noop;
global.setInterval = noop;

eval(code);
const { E, S } = window.__nw;

function run(n) {
  let worst = 0, total = 0;
  for (let i = 0; i < n; i++) {
    now += 16.7;
    for (let j = timers.length - 1; j >= 0; j--) if (timers[j][0] <= now) { const f = timers[j][1]; timers.splice(j, 1); f(); }
    const f = rafCb; rafCb = null;
    const t0 = process.hrtime.bigint();
    if (f) f(now);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    worst = Math.max(worst, ms); total += ms;
  }
  return { avg: total / n, worst };
}

let r = run(FRAMES);
console.log('Grundlauf     ', r.avg.toFixed(2), 'ms im Schnitt, schlimmster Frame', r.worst.toFixed(1), 'ms');
E.action(); run(120);
E.wake(); run(120);
E.newPattern(); run(60);
// zusätzliche Knöpfe und Antippen (z. B. Aufschlagstelle wählen)
if (E.buttons) for (const b of E.buttons) { b.run(); run(5); }
if (E.tap) { E.tap(300, 900); run(10); E.tap(800, 300); run(30); E.tap(5, 5); run(5); }
if (E.touch) { E.touch('down', 300, 900, 1); run(20); for (let i = 0; i < 30; i++) { E.touch('move', 300 + i * 10, 900 - i * 15, 1); run(2); } E.touch('up', 600, 450, 1); run(60); }
for (const c of E.controls) {
  if (c.type === 'info') { const t = c.text(); if (typeof t !== 'string') throw new Error('Statuszeile ohne Text: ' + c.id); continue; }
  const vals = c.type === 'range' ? [c.min, c.max, Math.round((c.min + c.max) / 2)]
    : c.type === 'text' ? ['', 'NEON WALLS', 'ÄÖÜ ß 123', '   ', 'X'.repeat(c.max || 20), '✠𝕿𝖗𝖚𝖘𝖙𝕹𝖔𝖇𝖔𝖉𝖞✠', '𝒦𝒶𝒾 🔥👍🏽', 'Kai'] : c.options.map((_, i) => i);
  for (const v of vals) { S[c.id] = v; if (E.change) E.change(c.id); if (E.release) E.release(c.id); run(40); E.action(); run(30); }
}
r = run(300);
console.log('Nach Reglern  ', r.avg.toFixed(2), 'ms im Schnitt, schlimmster Frame', r.worst.toFixed(1), 'ms');
// Größenänderung (Drehen / Vollbild)
global.innerWidth = 873; global.innerHeight = 393; const resizeEv = null;
E.resize(Math.round(873 * 2.75), Math.round(393 * 2.75), 2.75); run(60);
console.log('OK', key, 'Zeichenaufrufe gesamt:', drawCalls);
