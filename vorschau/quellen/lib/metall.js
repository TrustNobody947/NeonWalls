// Metall-Uhr in 3D (Vorschau; gleiche Rechnung später in der App als AGSL-Shader).
// Aus den Formen der Zeichen wird eine Normalenkarte gerechnet: Fläche oben flach, ringsum eine Fase wie gefräst
// (exakter Abstand zum Rand, Gehrung an den Ecken). Die Karte hat doppelte Auflösung, der Shader rechnet die
// Oberfläche vierfach je Pixel – so bleiben Kanten und Gehrungen scharf und glatt. Ein kleiner WebGL-Shader spiegelt
// darin ein Fotostudio:
// heller Himmel, scharfer Horizont, dunkler Boden, zwei Lichtkästen. Beim Neigen wandert die Spiegelung, die Uhr
// schwebt ein wenig (Parallax) und ihre Seitenwände zeigen sich auf der passenden Seite.
// Erwartet: GLYPHS/glyph/GH aus uhrface.js, mk und clamp aus dem Rahmen.

// ---------- Abstandstransformation (Felzenszwalb & Huttenlocher, exakt) ----------
function edt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
}
// Abstand jedes Innenpixels zum nächsten Außenpixel (in Pixeln)
function edt2(inside, w, h) {
  const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(w * h), out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = inside[y * w + x] ? 1e20 : 0;
    edt1(f, h, d, v, z);
    for (let y = 0; y < h; y++) g[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = g[y * w + x];
    edt1(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

// ---------- Normalenkarte je Zeichen (zwischengespeichert, unabhängig von der Oberfläche) ----------
// Ergebnis: RGBA je Pixel = Normale x, Normale y (128 = flach), Höhe (Fase 0..255 Fläche), Deckung.
// Die Fase wird genau aus dem Umriss gerechnet: Jede Stelle neigt sich zur nächsten Kante des Umrisses hin. So sind die
// Fasen glatt (kein Treppenmuster) und die Gehrungen scharf.
const nmCache = {};
const BEVEL_SLOPE = 1.25;   // Steilheit der Fase (1 = 45°)
// Außenrand eines Zeichens als Strecken [ax, ay, bx, by] (Einheiten der Schrift). Kanten, die an einem anderen Teil
// desselben Zeichens anliegen (z. B. der Steg im H), gehören nicht zum Rand und fallen weg.
function glyphEdges(S) {
  const onOrIn = (Q, x, y) => {
    let inside = false;
    for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) {
      const a = Q[i], b = Q[j];
      const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
      const t = l2 > 0 ? clamp(((x - a[0]) * vx + (y - a[1]) * vy) / l2, 0, 1) : 0;
      if (Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t) < 1e-6) return true;
      if ((a[1] > y) !== (b[1] > y) && x < vx * (y - a[1]) / vy + a[0]) inside = !inside;
    }
    return inside;
  };
  const E = [];
  S.forEach((P, pi) => {
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-9) continue;
      const n = Math.max(1, Math.ceil(L / 1.5));
      let run = null;
      const flush = () => { if (run) E.push([a[0] + (b[0] - a[0]) * run[0], a[1] + (b[1] - a[1]) * run[0], a[0] + (b[0] - a[0]) * run[1], a[1] + (b[1] - a[1]) * run[1]]); run = null; };
      for (let k = 0; k < n; k++) {
        const tm = (k + 0.5) / n, mx = a[0] + (b[0] - a[0]) * tm, my = a[1] + (b[1] - a[1]) * tm;
        if (S.some((Q, qi) => qi !== pi && onOrIn(Q, mx, my))) flush();
        else if (run) run[1] = (k + 1) / n; else run = [k / n, (k + 1) / n];
      }
      flush();
    }
  });
  return E;
}
function glyphNM(ch, hPx, flat) {
  const key = ch + '|' + hPx + '|' + (flat ? 1 : 0);
  if (nmCache[key]) return nmCache[key];
  const g = glyph(ch), u = hPx / GH, SS = hPx > 60 ? 3 : 4, pad = 2;
  const w = Math.max(1, Math.ceil(g.w * u + pad * 2)), h = Math.max(1, Math.ceil(hPx + pad * 2));
  const W2 = w * SS, H2 = h * SS;
  const out = new Uint8ClampedArray(w * h * 4);
  const res = { w, h, pad, data: out };
  nmCache[key] = res;
  if (!g.S.length) return res;
  const c = mk(W2, H2), x = c.getContext('2d');
  if (!x || !x.getImageData) return res;
  x.setTransform(SS, 0, 0, SS, 0, 0);
  x.beginPath();
  for (const p of g.S) { x.moveTo(pad + p[0][0] * u, pad + p[0][1] * u); for (let i = 1; i < p.length; i++) x.lineTo(pad + p[i][0] * u, pad + p[i][1] * u); x.closePath(); }
  x.fillStyle = '#fff'; x.fill();
  const id = x.getImageData(0, 0, W2, H2).data;
  // Umriss in Pixeln dieser Karte
  const E = glyphEdges(g.S).map(e => { const ax = pad + e[0] * u, ay = pad + e[1] * u, vx = (e[2] - e[0]) * u, vy = (e[3] - e[1]) * u; return [ax, ay, vx, vy, vx * vx + vy * vy]; });
  // Fasenbreite: große Ziffern etwa 4 % der Zeichenhöhe, Datum etwas mehr (sonst kaum zu sehen)
  const bev = flat ? Math.max(1, hPx * 0.06) : Math.max(1.4, hPx * 0.042);
  const k = BEVEL_SLOPE / Math.sqrt(1 + BEVEL_SLOPE * BEVEL_SLOPE);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    let nx = 0, ny = 0, hs = 0, cov = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const X = xx * SS + sx, Y = yy * SS + sy;
      if (id[(Y * W2 + X) * 4 + 3] <= 127) continue;
      cov++;
      // nächste Stelle auf dem Umriss
      const px = (X + 0.5) / SS, py = (Y + 0.5) / SS;
      let best = 1e18, qx = 0, qy = 0;
      for (const e of E) {
        let t = ((px - e[0]) * e[2] + (py - e[1]) * e[3]) / e[4];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = e[0] + e[2] * t - px, ey = e[1] + e[3] * t - py, dd = ex * ex + ey * ey;
        if (dd < best) { best = dd; qx = ex; qy = ey; }
      }
      const d = Math.sqrt(best);
      if (d < bev && d > 1e-6) {
        // Normale zeigt von der Fase nach außen-oben (zur Kante hin)
        nx += qx / d * k; ny += qy / d * k;
        hs += d / bev;
      } else hs += 1;
    }
    if (!cov) continue;
    const o = (yy * w + xx) * 4;
    out[o] = 128 + nx / cov * 127; out[o + 1] = 128 + ny / cov * 127;
    out[o + 2] = hs / cov * 255; out[o + 3] = cov / (SS * SS) * 255;
  }
  return res;
}

// ---------- WebGL ----------
const M3D = { gl: null, cv: null, ok: null, prog: null, u: {}, tA: null, tB: null, lw: 0, lh: 0, pad: 0 };
const M3D_VS = 'attribute vec2 p;varying vec2 vP;uniform vec2 uOut;void main(){vP=(p*0.5+0.5)*uOut;vP.y=uOut.y-vP.y;gl_Position=vec4(p,0.0,1.0);}';
const M3D_FS = `precision highp float;
varying vec2 vP;
uniform sampler2D uA, uB;
uniform vec2 uLay, uPad, uTilt, uDepth;
uniform float uDateDepth, uRough, uKind, uBrush;
uniform vec3 uF0, uSide0, uSide1, uNeon;
vec4 tA(vec2 l) { return texture2D(uA, l / uLay); }
vec4 tB(vec2 l) { return texture2D(uB, l / uLay); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// weicher Lichtkasten im Spiegelbild
float box(vec2 s, vec2 c, vec2 h, float r) {
  vec2 d = abs(s - c) - h;
  float o = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  return 1.0 - smoothstep(-0.03 - r * 0.2, 0.03 + r * 0.2, o);
}
// Fotostudio: Himmel oben, scharfer Horizont, dunkler Boden, zwei Lichtkästen, eine Lichtleiste unten
vec3 env(vec3 R, float r) {
  float up = -R.y;
  // wie bei klassischem Chrom: über dem Horizont am hellsten, nach oben bläulicher; direkt darunter fast schwarz,
  // weiter unten heller (Boden)
  float hz = smoothstep(-0.012 - r * 0.4, 0.012 + r * 0.4, up - 0.02);
  vec3 ground = mix(vec3(0.02, 0.018, 0.016), vec3(0.40, 0.36, 0.31), smoothstep(0.0, 0.8, -up));
  vec3 sky = mix(vec3(1.0, 1.0, 1.02), vec3(0.52, 0.62, 0.80), smoothstep(0.03, 0.85, up));
  vec3 c = mix(ground, sky, hz);
  vec2 s = R.xy / (1.0 + abs(R.z));
  c += vec3(1.7) * box(s, vec2(-0.62, -0.72), vec2(0.20, 0.10), r);
  c += vec3(1.3) * box(s, vec2(0.72, -0.42), vec2(0.08, 0.22), r);
  c += vec3(0.8) * box(s, vec2(-0.1, 0.86), vec2(0.45, 0.05), r);
  return c;
}
// Blickrichtung: Neigung plus etwas Perspektive über die Breite und die Zeilenhöhe (der Horizont läuft quer durch)
vec3 viewDir(vec2 l, float v) { return normalize(vec3(-uTilt.x * 0.65 + (l.x / uLay.x - 0.5) * 0.3, -uTilt.y * 0.65 + (0.5 - v) * 0.95, 1.0)); }
// Oberfläche an der Stelle l: Farbe mal Deckung, Deckung in .a
vec4 surf(vec2 l, float v) {
  vec4 a = tA(l);
  if (a.a < 0.003) return vec4(0.0);
  vec3 n = vec3(a.r * 2.0 - 1.0, a.g * 2.0 - 1.0, 0.0);
  n.z = sqrt(max(0.04, 1.0 - dot(n.xy, n.xy)));
  n = normalize(n);
  vec3 V = viewDir(l, v);
  vec3 R = reflect(-V, n);
  float br = 1.0 + (hash(vec2(floor(l.y), floor(l.x / 23.0))) - 0.5) * 0.06 * uBrush;
  vec3 col;
  if (uKind < 0.5) {
    vec3 e = env(R, uRough);
    float ct = clamp(dot(n, V), 0.0, 1.0);
    vec3 F = uF0 + (vec3(1.0) - uF0) * pow(1.0 - ct, 5.0);
    col = e * F * br;
  } else if (uKind < 1.5) {
    vec3 e = env(R, uRough);
    col = e * 0.2 * br + max(e - vec3(1.0), 0.0) * 0.9;
  } else if (uKind < 2.5) {
    vec3 L = normalize(vec3(-0.25, -0.78, 0.58));
    float dif = 1.0 + 1.1 * (dot(n, L) - L.z);
    col = vec3(clamp(dif, 0.5, 1.0));
    vec3 e = env(R, 0.35);
    col += 0.05 * e + 0.3 * max(e - vec3(1.0), 0.0);
  } else {
    // Neon: helle Fläche, die Fase satt in der Neonfarbe mit Licht und Schatten, am Übergang ein heller Saum –
    // so ist der Rand der Ziffern gut zu sehen, wie bei den Metallen
    vec3 face = mix(vec3(1.0), uNeon, 0.25 + 0.35 * v);
    float bev = clamp((1.0 - n.z) * 4.0, 0.0, 1.0);
    vec3 Ld = normalize(vec3(-0.25, -0.78, 0.58));
    float lit = clamp(0.3 + 1.0 * max(dot(n, Ld), 0.0), 0.0, 1.25);
    col = mix(face, uNeon * lit, smoothstep(0.1, 0.6, bev));
    col += vec3(0.45) * smoothstep(0.03, 0.14, bev) * (1.0 - smoothstep(0.14, 0.34, bev));
    col += 0.2 * max(env(R, 0.25) - vec3(1.0), 0.0);
  }
  return vec4(clamp(col, 0.0, 1.0) * a.a, a.a);
}
void main() {
  vec2 l = vP - uPad;
  vec4 a = tA(l), b = tB(l);
  // weit weg von jeder Ziffer: nichts zu tun (spart fast die ganze Rechenzeit)
  if (a.a < 0.003 && b.b < 0.5) { gl_FragColor = vec4(0.0); return; }
  // Seitenwand: die erste Lage des Ziffernkörpers entlang der Tiefe (Datum flacher), genau nachgemessen
  float wa = 0.0, wk = 0.0, cmax = 0.0, kmax = 0.0, prev = 0.0;
  if (a.a < 0.995 && b.b > 0.5) {
    for (int i = 1; i <= 24; i++) {
      float k = float(i) / 24.0;
      vec2 q = l - uDepth * k;
      float lim = mix(1.0, uDateDepth, step(0.5, tB(q).g));
      float c = k <= lim ? tA(q).a : 0.0;
      if (c > cmax) { cmax = c; kmax = k / lim; }
      if (c > 0.5) {
        float lo = prev, hi = k;
        for (int j = 0; j < 4; j++) { float m = 0.5 * (lo + hi); if (tA(l - uDepth * m).a > 0.5) hi = m; else lo = m; }
        wk = hi / lim; break;
      }
      prev = k;
    }
    wa = smoothstep(0.15, 0.6, cmax);
    if (wk == 0.0) wk = kmax;
  }
  float v = b.r;
  // Oberfläche vierfach je Pixel gerechnet (die Normalenkarte hat doppelte Auflösung): Fasen, Gehrungen und Ränder
  // werden sauber geglättet, statt eine gemittelte Normale zu spiegeln
  vec4 f = 0.25 * (surf(l + vec2(-0.25, -0.25), v) + surf(l + vec2(0.25, -0.25), v) + surf(l + vec2(-0.25, 0.25), v) + surf(l + vec2(0.25, 0.25), v));
  if (f.a < 0.003 && wa < 0.003) { gl_FragColor = vec4(0.0); return; }
  // Wand: senkrechte Fläche Richtung Tiefe, nach hinten dunkler
  vec3 V = viewDir(l, v);
  vec2 wd = normalize(uDepth + vec2(1e-4, 1e-4));
  vec3 Rw = reflect(-V, normalize(vec3(wd, 0.45)));
  vec3 wc = uKind < 1.5 ? env(Rw, uRough + 0.25) * (uKind < 0.5 ? uF0 : vec3(0.22)) * 0.6 : mix(uSide0, uSide1, wk);
  wc *= 1.0 - 0.6 * wk;
  wc = clamp(wc, 0.0, 1.0);
  float A = f.a;
  gl_FragColor = vec4(f.rgb + wc * wa * (1.0 - A), A + wa * (1.0 - A));
}`;

function m3dInit() {
  if (M3D.ok !== null) return M3D.ok;
  M3D.ok = false;
  try {
    const cv = mk(1, 1);
    const gl = cv.getContext && cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl || typeof gl.createShader !== 'function') return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (gl.getShaderParameter(s, gl.COMPILE_STATUS) !== true) { const log = gl.getShaderInfoLog(s); if (log) console.warn(log); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, M3D_VS), fs = sh(gl.FRAGMENT_SHADER, M3D_FS);
    if (!vs || !fs) return false;
    const p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (gl.getProgramParameter(p, gl.LINK_STATUS) !== true) return false;
    gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uA', 'uB', 'uOut', 'uLay', 'uPad', 'uTilt', 'uDepth', 'uDateDepth', 'uRough', 'uKind', 'uBrush', 'uF0', 'uSide0', 'uSide1', 'uNeon']) M3D.u[n] = gl.getUniformLocation(p, n);
    const tex = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    M3D.tA = tex(0); M3D.tB = tex(1);
    gl.uniform1i(M3D.u.uA, 0); gl.uniform1i(M3D.u.uB, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    M3D.gl = gl; M3D.cv = cv; M3D.prog = p; M3D.ok = true;
  } catch (e) { M3D.ok = false; }
  return M3D.ok;
}
// Normalenkarte der ganzen Uhr hochladen (A: Normale, Höhe, Deckung; B: Höhe in der Zeile, Datum ja/nein). Die Karte
// hat tw × th Pixel (doppelte Auflösung), die Uhr selbst lw × lh Bildschirmpixel.
function m3dSetLayer(dataA, dataB, tw, th, lw, lh, pad) {
  if (!m3dInit()) return false;
  const gl = M3D.gl;
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, M3D.tA);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(dataA.buffer, dataA.byteOffset, dataA.length));
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, M3D.tB);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(dataB.buffer, dataB.byteOffset, dataB.length));
  M3D.lw = lw; M3D.lh = lh; M3D.pad = pad;
  M3D.cv.width = lw + 2 * pad; M3D.cv.height = lh + 2 * pad;
  gl.viewport(0, 0, M3D.cv.width, M3D.cv.height);
  return true;
}
// Oberflächen: Grundfarbe des Metalls (F0), Rauheit, Art (0 Metall, 1 Schwarzchrom, 2 Weiß, 3 Neon), Bürstung
const MET = [
  { f0: [0.97, 0.97, 0.98], rough: 0.05, kind: 0, brush: 0.3 },   // Chrom
  { f0: [1.00, 0.76, 0.33], rough: 0.10, kind: 0, brush: 0.5 },   // Gold
  { f0: [0.50, 0.64, 0.86], rough: 0.16, kind: 0, brush: 1 },     // Stahlblau
  { f0: [0.98, 0.70, 0.60], rough: 0.10, kind: 0, brush: 0.5 },   // Roségold
  { f0: [0.22, 0.23, 0.25], rough: 0.04, kind: 1, brush: 0.2 },   // Schwarzchrom
  { f0: [0.97, 0.56, 0.38], rough: 0.12, kind: 0, brush: 0.6 },   // Kupfer
  { f0: [1, 1, 1], rough: 0.2, kind: 3, brush: 0 },                // Neon
  { f0: [1, 1, 1], rough: 0.3, kind: 2, brush: 0 },                // Weiß
];
// Ein Bild der Uhr rechnen. tilt: Neigung −1..1, depth: Tiefe als Verschiebung in Pixeln (Richtung der Seitenwände)
function m3dRender(finish, tilt, depth, dateDepth, F) {
  const gl = M3D.gl, u = M3D.u, m = MET[finish] || MET[0];
  gl.uniform2f(u.uOut, M3D.cv.width, M3D.cv.height);
  gl.uniform2f(u.uLay, M3D.lw, M3D.lh);
  // Bruchteil eines Pixels für ruhiges, weiches Schweben (die Leinwand selbst liegt auf ganzen Pixeln)
  const sub = M3D.sub || [0, 0];
  gl.uniform2f(u.uPad, M3D.pad + sub[0], M3D.pad + sub[1]);
  gl.uniform2f(u.uTilt, tilt[0], tilt[1]);
  gl.uniform2f(u.uDepth, depth[0], depth[1]);
  gl.uniform1f(u.uDateDepth, dateDepth);
  gl.uniform1f(u.uRough, m.rough);
  gl.uniform1f(u.uKind, m.kind);
  gl.uniform1f(u.uBrush, m.brush);
  gl.uniform3f(u.uF0, m.f0[0], m.f0[1], m.f0[2]);
  const s0 = F && F.side ? F.side[0] : [60, 64, 68], s1 = F && F.side ? F.side[1] : [24, 26, 28];
  gl.uniform3f(u.uSide0, s0[0] / 255, s0[1] / 255, s0[2] / 255);
  gl.uniform3f(u.uSide1, s1[0] / 255, s1[1] / 255, s1[2] / 255);
  const ne = F && F.neon ? F.neon : [40, 225, 255];
  gl.uniform3f(u.uNeon, ne[0] / 255, ne[1] / 255, ne[2] / 255);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return M3D.cv;
}
