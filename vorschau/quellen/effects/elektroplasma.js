// Elektro-Plasma: Nachbau der alten Plasma-Live-Wallpaper-App (Version 2.7.0) nach dem Video vom Original.
// Bild: leuchtende, zuckende Höhenlinien eines bewegten Rauschfelds (3D-Simplex in mehreren Lagen) mit hellem Kern,
// farbigem Schein und schwachem Dunst dazwischen. Gerechnet als Shader (WebGL) in reduzierter Auflösung.
// Einstellungen wie im Original: Farbe aus Voreinstellungen oder eigene Farbe, Farbwechsel (fest, Zufall, Wechsel,
// Akku, Neigung, Kompass), Geschwindigkeit, Komplexität, Symmetrie, Berührung und komplexe Bewegung.
// Berührung: unter dem Finger wölbt sich das Feld auf; dort entstehen dünne, glatte Ringe um den Finger.
const settings = { color: 0, cr: 80, cg: 170, cb: 255, mode: 0, speed: 78, complexity: 3, glow: 5, sym: 0, touch: 1, move: 0 };
const PRESETS = [
  { label: 'Elektroblau', rgb: [40, 92, 255] },
  { label: 'Hellgrün', rgb: [30, 255, 96] },
  { label: 'Lila', rgb: [118, 64, 255] },
  { label: 'Dunkelrot', rgb: [225, 26, 12] },
  { label: 'Feuer', rgb: [255, 112, 16] },
  { label: 'Gelb', rgb: [242, 224, 40] },
  { label: 'Weiß', rgb: [226, 232, 255] },
];
const CUSTOM = PRESETS.length;
// Farblisten für Wechsel, Akku (leer → voll) und Kompass (Norden → einmal herum)
const CYCLE = PRESETS.slice(0, 6).map(p => p.rgb);
const BATTERY = [[255, 30, 20], [245, 220, 40], [40, 255, 80], [40, 92, 255]];
const COMPASS = [[255, 30, 20], [245, 220, 40], [40, 255, 80], [30, 230, 255], [40, 92, 255], [170, 60, 255]];
const LEVELS = ['sehr einfach', 'einfach', 'mittel', 'komplex', 'sehr komplex'];
const FREQ = [1.8, 2.4, 3.1, 4.0, 5.2];
const controls = [
  { type: 'grid', id: 'color', label: 'Farbe', options: PRESETS.map(p => ({ label: p.label, group: 'Voreinstellungen' })).concat([{ label: 'Eigene Farbe', group: 'Eigene' }]) },
  { type: 'range', id: 'cr', label: 'Eigene Farbe: Rot', min: 0, max: 255, fmt: v => String(v) },
  { type: 'range', id: 'cg', label: 'Eigene Farbe: Grün', min: 0, max: 255, fmt: v => String(v) },
  { type: 'range', id: 'cb', label: 'Eigene Farbe: Blau', min: 0, max: 255, fmt: v => String(v) },
  { type: 'grid', id: 'mode', label: 'Farbwechsel', options: ['Fest', 'Zufall', 'Wechsel', 'Akku', 'Neigung', 'Kompass'].map(l => ({ label: l })) },
  { type: 'range', id: 'speed', label: 'Geschwindigkeit', min: 0, max: 100, fmt: v => String(v) },
  { type: 'range', id: 'complexity', label: 'Komplexität', min: 1, max: 5, fmt: v => LEVELS[v - 1] },
  { type: 'range', id: 'glow', label: 'Leuchten (5 = wie Original)', min: 1, max: 10, fmt: v => String(v) },
  { type: 'grid', id: 'sym', label: 'Symmetrie', options: [{ label: 'Asymmetrisch' }, { label: 'Gespiegelt' }, { label: 'Zweifach gespiegelt' }] },
  { type: 'choice', id: 'touch', label: 'Berührung verformt das Plasma', options: ['Aus', 'An'] },
  { type: 'choice', id: 'move', label: 'Komplexe Bewegung', options: ['Aus', 'An'] },
];

// ---------- Shader ----------
const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
// 3D-Simplex-Rauschen: Ashima Arts / Stefan Gustavson (webgl-noise, MIT-Lizenz)
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;
const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uAsp;uniform float uT;uniform float uF;uniform float uSym;uniform float uMove;
uniform float uThick;uniform vec3 uCol;uniform vec2 uDrift;uniform vec4 uTouch[4];uniform vec4 uLook;uniform vec3 uOct;
${NOISE}
// Feld: grobe Lage für die Form, feinere Lagen für das Zucken der Linien
float field(vec2 p){
  vec2 q=p*uF+uDrift;
  if(uMove>0.5){
    // komplexe Bewegung: das Feld wird zusätzlich leicht und wechselnd verbogen (die Form bleibt gleich)
    q+=vec2(snoise(vec3(p*1.6,uT*0.45+5.0)),snoise(vec3(p*1.6+7.3,uT*0.45+11.0)))*0.22;
  }
  float n=snoise(vec3(q,uT));
  n+=uOct.x*snoise(vec3(q*2.07+vec2(17.3,3.1),uT*1.2+31.0));
  n+=uOct.y*snoise(vec3(q*4.31+vec2(-9.7,23.9),uT*1.45+57.0));
  n+=uOct.z*snoise(vec3(q*9.13+vec2(41.2,-15.4),uT*1.8+91.0));
  return n;
}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uRes.x;
  vec2 c=vec2(0.5,uAsp*0.5);
  if(uSym>0.5)p.x=c.x-abs(p.x-c.x);
  if(uSym>1.5)p.y=c.y-abs(p.y-c.y);
  float n=field(p);
  for(int i=0;i<4;i++){
    vec4 tc=uTouch[i];
    if(tc.z>0.001){
      vec2 tp=tc.xy;
      if(uSym>0.5)tp.x=c.x-abs(tp.x-c.x);
      if(uSym>1.5)tp.y=c.y-abs(tp.y-c.y);
      vec2 d=p-tp;
      n+=tc.z*exp(-dot(d,d)*55.0);
    }
  }
  // Linien bei ganzzahligen Feldwerten: Kern hell, Schein in der Farbe, Dunst dazwischen
  float s=abs(sin(n*3.14159265));
  float I=pow(uThick/max(s,0.0005),uLook.x);
  vec3 col=uCol*I+max(I-uLook.y,0.0)*uLook.z;
  col=1.0-exp(-col*uLook.w);
  gl_FragColor=vec4(col,1.0);
}`;

// ---------- Ersatz ohne WebGL: dasselbe Feld auf der CPU in kleiner Auflösung ----------
const PERM = new Uint8Array(512);
{ const p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const GR = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
function sn3(x, y, z) {
  const s = (x + y + z) / 3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s), t = (i + j + k) / 6;
  const x0 = x - i + t, y0 = y - j + t, z0 = z - k + t;
  let i1, j1, k1, i2, j2, k2;
  if (x0 >= y0) { if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } }
  else { if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } }
  const ii = i & 255, jj = j & 255, kk = k & 255;
  const c = [[x0, y0, z0, 0, 0, 0], [x0 - i1 + 1 / 6, y0 - j1 + 1 / 6, z0 - k1 + 1 / 6, i1, j1, k1],
    [x0 - i2 + 1 / 3, y0 - j2 + 1 / 3, z0 - k2 + 1 / 3, i2, j2, k2], [x0 - 0.5, y0 - 0.5, z0 - 0.5, 1, 1, 1]];
  let n = 0;
  for (const [a, b, d, di, dj, dk] of c) {
    let tt = 0.6 - a * a - b * b - d * d;
    if (tt <= 0) continue;
    const g = (PERM[ii + di + PERM[jj + dj + PERM[kk + dk]]] % 12) * 3;
    tt *= tt; n += tt * tt * (GR[g] * a + GR[g + 1] * b + GR[g + 2] * d);
  }
  return 32 * n;
}

// ---------- Zustand ----------
let W = 1, H = 1, dpr = 1, t = 0, tz = rnd(0, 200), drift = [rnd(0, 50), rnd(0, 50)];
let glc = null, gl = null, prog = null, U = {}, cpuC = null, cpuImg = null, rw = 1, rh = 1, tried = false;
const touches = [];
let col = PRESETS[0].rgb.slice(), randFrom = null, randTo = null, randT = 0, randNext = 0, cycleT = 0;
const sens = { battery: null, tilt: null, heading: null, asked: false, since: 0 };
let uiSet = null;

const rate = () => 0.02 + 0.52 * Math.pow(settings.speed / 100, 1.6);
// Aussehen der Linien: Abfall des Scheins, Schwelle und Stärke des weißen Kerns, Helligkeit, Linienstärke
const LOOK = { exp: 1.1, core: 1.1, white: 0.5, gain: 1.3, thick: 0.17, o2: 0.25, o3: 0.1, o4: 0.05 };
const thick = () => LOOK.thick * Math.sqrt(FREQ[2] / FREQ[settings.complexity - 1]) * (0.55 + 0.09 * settings.glow);
const mixRGB = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const smooth = k => k * k * (3 - 2 * k);
// Farbe an Stelle v (0..1) einer Liste; rund = Kreis (Kompass, Neigung)
function listColor(L, v, round) {
  const n = round ? L.length : L.length - 1, x = (round ? ((v % 1) + 1) % 1 : clamp(v, 0, 1)) * n;
  const i = Math.min(Math.floor(x), n - (round ? 0 : 1)), k = x - i;
  return mixRGB(L[i % L.length], L[(i + 1) % L.length], smooth(clamp(k, 0, 1)));
}
function hueRGB(h) {
  const f = n => { const k = (n + h * 6) % 6; return 255 * (1 - Math.max(0, Math.min(k, 4 - k, 1))); };
  return [f(5), f(3), f(1)];
}
// Hinweis unten einblenden (wie die Meldungen der Vorschau)
function note(msg) {
  const h = document.getElementById('hint');
  if (!h) return;
  h.textContent = msg; h.classList.add('msg'); h.classList.remove('gone');
  setTimeout(() => h.classList.add('gone'), 4500);
}
function askSensors() {
  if (sens.asked) return;
  sens.asked = true; sens.since = t;
  try { if (navigator.getBattery) navigator.getBattery().then(b => { const up = () => { sens.battery = b.level; }; up(); b.addEventListener('levelchange', up); }); } catch (e) {}
  const ori = e => {
    if (e.beta != null && e.gamma != null) sens.tilt = Math.atan2(e.gamma, e.beta) / (2 * Math.PI);
    const hd = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
    if (hd != null) sens.heading = hd / 360;
  };
  try {
    const go = () => { addEventListener('deviceorientationabsolute', ori); addEventListener('deviceorientation', ori); };
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(go, () => {});
    else go();
  } catch (e) {}
}
function targetColor(dt) {
  const base = settings.color === CUSTOM ? [settings.cr, settings.cg, settings.cb] : PRESETS[settings.color].rgb;
  switch (settings.mode) {
    case 1: { // Zufall: alle paar Sekunden zu einer neuen, kräftigen Farbe überblenden
      randNext -= dt;
      if (!randTo || randNext <= 0) { randFrom = randTo ? mixRGB(randFrom, randTo, smooth(clamp(randT, 0, 1))) : base; randTo = hueRGB(Math.random()); randT = 0; randNext = rnd(4, 8); }
      randT += dt / 1.4;
      return mixRGB(randFrom, randTo, smooth(clamp(randT, 0, 1)));
    }
    case 2: { // Wechsel: der Reihe nach durch die Farbliste, je Farbe kurz stehen, dann weich überblenden
      cycleT += dt / 3.5;
      const i = Math.floor(cycleT) % CYCLE.length, k = clamp((cycleT % 1 - 0.55) / 0.45, 0, 1);
      return mixRGB(CYCLE[i], CYCLE[(i + 1) % CYCLE.length], smooth(k));
    }
    case 3: { // Akku: leer rot … voll blau
      const v = sens.battery != null ? sens.battery : 0.5 + 0.5 * Math.sin(t * 0.15);
      return listColor(BATTERY, v, false);
    }
    case 4: { // Neigung: Richtung, in die das Handy gekippt ist
      const v = sens.tilt != null ? sens.tilt : t * 0.04;
      return listColor(COMPASS, v, true);
    }
    case 5: { // Kompass: Himmelsrichtung
      const v = sens.heading != null ? sens.heading : t * 0.025;
      return listColor(COMPASS, v, true);
    }
    default: return base;
  }
}

// ---------- WebGL ----------
function initGL() {
  tried = true;
  glc = mk(2, 2);
  try { gl = glc.getContext('webgl', { antialias: false, depth: false, preserveDrawingBuffer: true }) || glc.getContext('experimental-webgl'); } catch (e) { gl = null; }
  if (!gl || typeof gl.createShader !== 'function' || gl.VERTEX_SHADER == null) { gl = null; return; }
  const sh = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { gl = null; return; }
  prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return; }
  gl.useProgram(prog);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  for (const n of ['uRes', 'uAsp', 'uT', 'uF', 'uSym', 'uMove', 'uThick', 'uCol', 'uDrift', 'uTouch', 'uLook', 'uOct']) U[n] = gl.getUniformLocation(prog, n);
}
function touchData() {
  const d = new Float32Array(16);
  touches.slice(-4).forEach((tc, i) => { d[i * 4] = tc.x; d[i * 4 + 1] = tc.y; d[i * 4 + 2] = tc.amp; });
  return d;
}
function renderGL() {
  if (glc.width !== rw || glc.height !== rh) { glc.width = rw; glc.height = rh; }
  gl.viewport(0, 0, rw, rh);
  gl.uniform2f(U.uRes, rw, rh); gl.uniform1f(U.uAsp, rh / rw); gl.uniform1f(U.uT, tz);
  gl.uniform1f(U.uF, FREQ[settings.complexity - 1]); gl.uniform1f(U.uSym, settings.sym); gl.uniform1f(U.uMove, settings.move);
  gl.uniform1f(U.uThick, thick()); gl.uniform3f(U.uCol, col[0] / 255, col[1] / 255, col[2] / 255);
  gl.uniform2f(U.uDrift, drift[0], drift[1]); gl.uniform4fv(U.uTouch, touchData());
  gl.uniform4f(U.uLook, LOOK.exp, LOOK.core, LOOK.white, LOOK.gain); gl.uniform3f(U.uOct, LOOK.o2, LOOK.o3, LOOK.o4);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
function renderCPU() {
  const cw = 54, ch = Math.max(1, Math.round(54 * H / W));
  if (!cpuC || cpuC.width !== cw || cpuC.height !== ch) { cpuC = mk(cw, ch); cpuImg = cpuC.getContext('2d').createImageData(cw, ch); }
  const d = cpuImg.data, F = FREQ[settings.complexity - 1], th = thick(), asp = ch / cw, tl = touches.slice(-4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let px = (x + 0.5) / cw, py = (y + 0.5) / cw;
    if (settings.sym > 0) px = 0.5 - Math.abs(px - 0.5);
    if (settings.sym > 1) py = asp / 2 - Math.abs(py - asp / 2);
    const qx = px * F + drift[0], qy = py * F + drift[1];
    let n = sn3(qx, qy, tz) + LOOK.o2 * sn3(qx * 2.07 + 17.3, qy * 2.07 + 3.1, tz * 1.2 + 31) + LOOK.o3 * sn3(qx * 4.31 - 9.7, qy * 4.31 + 23.9, tz * 1.45 + 57);
    for (const tc of tl) {
      let tx = tc.x, ty = tc.y;
      if (settings.sym > 0) tx = 0.5 - Math.abs(tx - 0.5);
      if (settings.sym > 1) ty = asp / 2 - Math.abs(ty - asp / 2);
      n += tc.amp * Math.exp(-((px - tx) ** 2 + (py - ty) ** 2) * 55);
    }
    const I = Math.pow(th / Math.max(Math.abs(Math.sin(n * Math.PI)), 0.0005), LOOK.exp), o = (y * cw + x) * 4;
    for (let c = 0; c < 3; c++) d[o + c] = 255 * (1 - Math.exp(-(col[c] / 255 * I + Math.max(I - LOOK.core, 0) * LOOK.white) * LOOK.gain));
    d[o + 3] = 255;
  }
  cpuC.getContext('2d').putImageData(cpuImg, 0, 0);
}

return {
  maxDpr: 3,
  settings, controls,
  actionLabel: 'Berührung zeigen',
  hint: 'Tippen für Einstellungen · Wischen verformt das Plasma',
  bindUI(api) { uiSet = api.set; },
  resize(w, h, d) {
    W = w; H = h; dpr = d;
    // höchstens 600 Pixel breit: weicher Schein und flüssig auf dem Handy
    rw = Math.max(1, Math.min(W, 600)); rh = Math.max(1, Math.round(rw * H / W));
    if (!tried) initGL();
  },
  newPattern() { tz = rnd(0, 400); drift = [rnd(0, 50), rnd(0, 50)]; },
  action() { touches.push({ id: 'demo', x: rnd(0.25, 0.75), y: rnd(0.4, 0.9) * H / W, amp: 0, on: true, life: 0.9 }); },
  wake() {},
  look: LOOK,
  seek(v, dx, dy) { tz = v; drift = [dx || 0, dy || 0]; },
  change(id) {
    if ((id === 'cr' || id === 'cg' || id === 'cb') && settings.color !== CUSTOM && uiSet) uiSet('color', CUSTOM);
    if (id === 'mode') {
      randTo = null; cycleT = 0;
      if (settings.mode >= 3) {
        askSensors();
        setTimeout(() => {
          const ok = settings.mode === 3 ? sens.battery != null : settings.mode === 4 ? sens.tilt != null : sens.heading != null;
          if (!ok && settings.mode >= 3) note('Dieser Sensor ist in der Vorschau nicht erreichbar, die Farbe wird hier nur vorgeführt. In der App kommt sie vom Handy.');
        }, 1500);
      }
    }
    if (id === 'touch' && !settings.touch) touches.length = 0;
  },
  touch(type, x, y, id) {
    if (!settings.touch) return;
    const px = x / W, py = y / W;
    let tc = touches.find(o => o.id === id && o.on);
    if (type === 'down') { tc = { id, x: px, y: py, amp: 0, on: true }; touches.push(tc); if (touches.length > 8) touches.shift(); }
    else if (tc) { tc.x = px; tc.y = py; if (type === 'up') tc.on = false; }
  },
  frame(ctx, dt) {
    t += dt;
    const r = rate();
    tz += dt * r;
    if (tz > 4000) tz -= 4000;
    // komplexe Bewegung: das Muster gleitet zusätzlich, in langsam wechselnder Richtung
    if (settings.move) { const a = t * 0.07 + Math.sin(t * 0.13) * 1.6; drift[0] += Math.cos(a) * dt * 0.45 * r; drift[1] += Math.sin(a) * dt * 0.45 * r; }
    // Farbe weich nachführen
    const tc = targetColor(dt), k = 1 - Math.exp(-dt * 6);
    col = mixRGB(col, tc, k);
    // Berührungen: unter dem Finger wächst der Hügel schnell, nach dem Loslassen sinkt er weich zurück
    for (let i = touches.length - 1; i >= 0; i--) {
      const o = touches[i];
      if (o.life != null) { o.life -= dt; if (o.life <= 0) o.on = false; }
      o.amp += ((o.on ? 2.6 : 0) - o.amp) * (1 - Math.exp(-dt * (o.on ? 9 : 4.5)));
      if (!o.on && o.amp < 0.01) touches.splice(i, 1);
    }
    if (gl) renderGL(); else renderCPU();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(gl ? glc : cpuC, 0, 0, W, H);
  },
};
