package io.github.trustnobody947.neonwalls.uhr

import android.annotation.TargetApi
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RuntimeShader
import android.graphics.Shader

/**
 * Metall-Uhr in 3D als AGSL-Shader (ab Android 13). Gleiche Rechnung wie die Vorschau (vorschau/quellen/lib/metall.js):
 * Aus der Normalenkarte der Zeichen (Fasen) und einem Fotostudio (Himmel, scharfer Horizont, dunkler Boden,
 * Lichtkästen) entsteht die Spiegelung; beim Neigen wandert sie und die Seitenwände der Ziffern zeigen sich.
 * Die Karte ist doppelt so fein wie der Bildschirm, die Oberfläche wird vierfach je Pixel gerechnet und gemittelt:
 * Fasen, Gehrungen und Ränder bleiben scharf und glatt (keine Treppen, keine hellen Pünktchen).
 * Fern der Ziffern (Abstand steht in der Normalenkarte) hört der Shader sofort auf.
 * Zusätzlich: Karte der Bruchstücke (die Uhr zerfällt an den Rissen in versetzte Stücke) und Bänder, in denen die Uhr
 * gerade wegen eines glitchenden Streifens ausgespart wird.
 */
@TargetApi(33)
class MetalClock private constructor(private val rt: RuntimeShader) : Clock3D {

    private val paint = Paint().apply { shader = rt }
    override var pad = 0
        private set
    override var w3 = 1
        private set
    override var h3 = 1
        private set
    private var version = -1
    private var lw = 1
    private var lh = 1
    private var ready = false
    private var hasRegions = false
    private var bmpA: Bitmap? = null
    private var bmpB: Bitmap? = null
    private var bmpR: Bitmap? = null

    override fun setFace(ck: ClockFace, pad: Int): Boolean {
        if (ready && ck.version == version && this.pad == pad) return true
        val nm = ck.normalMap() ?: return false
        try {
            val a = Bitmap.createBitmap(nm.a, nm.w, nm.h, Bitmap.Config.ARGB_8888)
            val b = Bitmap.createBitmap(nm.b, nm.w, nm.h, Bitmap.Config.ARGB_8888)
            rt.setInputBuffer("texA", BitmapShader(a, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR })
            rt.setInputBuffer("texB", BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_LINEAR })
            // alte Bilder nicht sofort freigeben: das letzte Bild kann noch gezeichnet werden (der Müllsammler räumt auf)
            bmpA = a
            bmpB = b
            // die Karte ist nm.scale-mal so fein wie die Uhr auf dem Bildschirm
            lw = nm.w / nm.scale
            lh = nm.h / nm.scale
            this.pad = pad
            w3 = lw + 2 * pad
            h3 = lh + 2 * pad
            rt.setFloatUniform("uLay", lw.toFloat(), lh.toFloat())
            rt.setFloatUniform("uS", nm.scale.toFloat())
            version = ck.version
            if (!hasRegions) setRegions(Bitmap.createBitmap(intArrayOf(Color.rgb(1, 0, 0)), 1, 1, Bitmap.Config.ARGB_8888))
            ready = true
        } catch (e: Throwable) {
            ready = false
        }
        return ready
    }

    override fun setRegions(map: Bitmap) {
        bmpR = map
        rt.setInputBuffer("texR", BitmapShader(map, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP).apply { filterMode = BitmapShader.FILTER_MODE_NEAREST })
        hasRegions = true
    }

    override fun setFrame(ck: ClockFace, tiltX: Float, tiltY: Float, depthX: Float, depthY: Float, dateDepth: Float,
                          subX: Float, subY: Float, regOrgX: Float, regOrgY: Float) {
        val m = MET[ck.finish.coerceIn(0, MET.size - 1)]
        rt.setFloatUniform("uPad", pad + subX, pad + subY)
        rt.setFloatUniform("uROrg", regOrgX, regOrgY)
        rt.setFloatUniform("uTilt", tiltX, tiltY)
        rt.setFloatUniform("uDepth", depthX, depthY)
        rt.setFloatUniform("uDateDepth", dateDepth)
        rt.setFloatUniform("uRough", m[3])
        rt.setFloatUniform("uKind", m[4])
        rt.setFloatUniform("uBrush", m[5])
        rt.setFloatUniform("uF0", m[0], m[1], m[2])
        val s0 = ck.side0
        val s1 = ck.side1
        rt.setFloatUniform("uSide0", Color.red(s0) / 255f, Color.green(s0) / 255f, Color.blue(s0) / 255f)
        rt.setFloatUniform("uSide1", Color.red(s1) / 255f, Color.green(s1) / 255f, Color.blue(s1) / 255f)
        val ne = if (ck.neon != 0) ck.neon else Color.rgb(40, 225, 255)
        rt.setFloatUniform("uNeon", Color.red(ne) / 255f, Color.green(ne) / 255f, Color.blue(ne) / 255f)
    }

    override fun setPieces(off: FloatArray, alpha: FloatArray, tint: FloatArray, bands: FloatArray) {
        rt.setFloatUniform("uOff", off)
        rt.setFloatUniform("uRA", alpha)
        rt.setFloatUniform("uTint", tint)
        rt.setFloatUniform("uBand", bands)
    }

    override fun draw(c: Canvas, x: Float, y: Float, alpha: Int) {
        if (!ready) return
        paint.alpha = alpha.coerceIn(0, 255)
        c.save()
        c.translate(x, y)
        c.drawRect(0f, 0f, w3.toFloat(), h3.toFloat(), paint)
        c.restore()
    }

    companion object {
        /** null, wenn der Shader auf diesem Gerät nicht übersetzt werden kann. */
        fun create(): Clock3D? = try {
            MetalClock(RuntimeShader(AGSL))
        } catch (e: Throwable) {
            null
        }

        // Oberflächen: Metallfarbe (F0 r, g, b), Rauheit, Art (0 Metall, 1 Schwarzchrom, 2 Weiß, 3 Neon), Bürstung
        private val MET = arrayOf(
            floatArrayOf(0.97f, 0.97f, 0.98f, 0.05f, 0f, 0.3f),   // Chrom
            floatArrayOf(1.00f, 0.76f, 0.33f, 0.10f, 0f, 0.5f),   // Gold
            floatArrayOf(0.50f, 0.64f, 0.86f, 0.16f, 0f, 1f),     // Stahlblau
            floatArrayOf(0.98f, 0.70f, 0.60f, 0.10f, 0f, 0.5f),   // Roségold
            floatArrayOf(0.22f, 0.23f, 0.25f, 0.04f, 1f, 0.2f),   // Schwarzchrom
            floatArrayOf(0.97f, 0.56f, 0.38f, 0.12f, 0f, 0.6f),   // Kupfer
            floatArrayOf(1f, 1f, 1f, 0.20f, 3f, 0f),              // Neon
            floatArrayOf(1f, 1f, 1f, 0.30f, 2f, 0f)               // Weiß
        )

        private const val AGSL = """
uniform shader texA;
uniform shader texB;
uniform shader texR;
uniform float2 uLay;
uniform float uS;
uniform float2 uPad;
uniform float2 uROrg;
uniform float2 uTilt;
uniform float2 uDepth;
uniform float uDateDepth;
uniform float uRough;
uniform float uKind;
uniform float uBrush;
uniform float3 uF0;
uniform float3 uSide0;
uniform float3 uSide1;
uniform float3 uNeon;
uniform float2 uOff[8];
uniform float uRA[8];
uniform float4 uTint[8];
uniform float4 uBand[10];

float4 tA(float2 l) { return float4(texA.eval(l * uS)); }
float4 tB(float2 l) { return float4(texB.eval(l * uS)); }

float hash(float2 p) { return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453); }

float box(float2 s, float2 c, float2 h, float r) {
    float2 d = abs(s - c) - h;
    float o = length(max(d, float2(0.0))) + min(max(d.x, d.y), 0.0);
    return 1.0 - smoothstep(-0.03 - r * 0.2, 0.03 + r * 0.2, o);
}

float3 env(float3 R, float r) {
    float up = -R.y;
    float hz = smoothstep(-0.012 - r * 0.4, 0.012 + r * 0.4, up - 0.02);
    float3 ground = mix(float3(0.02, 0.018, 0.016), float3(0.40, 0.36, 0.31), smoothstep(0.0, 0.8, -up));
    float3 sky = mix(float3(1.0, 1.0, 1.02), float3(0.52, 0.62, 0.80), smoothstep(0.03, 0.85, up));
    float3 c = mix(ground, sky, hz);
    float2 s = R.xy / (1.0 + abs(R.z));
    c += float3(1.7) * box(s, float2(-0.62, -0.72), float2(0.20, 0.10), r);
    c += float3(1.3) * box(s, float2(0.72, -0.42), float2(0.08, 0.22), r);
    c += float3(0.8) * box(s, float2(-0.1, 0.86), float2(0.45, 0.05), r);
    return c;
}

// Blickrichtung: Neigung plus etwas Perspektive über die Breite und die Zeilenhöhe (der Horizont läuft quer durch)
float3 viewDir(float2 l, float v) {
    return normalize(float3(-uTilt.x * 0.65 + (l.x / uLay.x - 0.5) * 0.3, -uTilt.y * 0.65 + (0.5 - v) * 0.95, 1.0));
}

// Oberfläche an der Stelle l (mit Farbblitz tint): Farbe mal Deckung, Deckung in .a
float4 surf(float2 l, float v, float4 tint) {
    float cov = tB(l).r;
    if (cov < 0.003) { return float4(0.0); }
    float4 a = tA(l);
    float3 n = float3(a.r * 2.0 - 1.0, a.g * 2.0 - 1.0, 0.0);
    n.z = sqrt(max(0.04, 1.0 - dot(n.xy, n.xy)));
    n = normalize(n);
    float3 V = viewDir(l, v);
    float3 R = reflect(-V, n);
    float br = 1.0 + (hash(float2(floor(l.y), floor(l.x / 23.0))) - 0.5) * 0.06 * uBrush;
    float3 col;
    if (uKind < 0.5) {
        float3 e = env(R, uRough);
        float ct = clamp(dot(n, V), 0.0, 1.0);
        float3 F = uF0 + (float3(1.0) - uF0) * pow(1.0 - ct, 5.0);
        col = e * F * br;
    } else if (uKind < 1.5) {
        float3 e = env(R, uRough);
        col = e * 0.2 * br + max(e - float3(1.0), float3(0.0)) * 0.9;
    } else if (uKind < 2.5) {
        float3 L = normalize(float3(-0.25, -0.78, 0.58));
        float dif = 1.0 + 1.1 * (dot(n, L) - L.z);
        col = float3(clamp(dif, 0.5, 1.0));
        float3 e = env(R, 0.35);
        col += 0.05 * e + 0.3 * max(e - float3(1.0), float3(0.0));
    } else {
        // Neon: helle Fläche, die Fase satt in der Neonfarbe mit Licht und Schatten, am Übergang ein heller Saum –
        // so ist der Rand der Ziffern gut zu sehen, wie bei den Metallen
        float3 face = mix(float3(1.0), uNeon, 0.25 + 0.35 * v);
        float bev = clamp((1.0 - n.z) * 4.0, 0.0, 1.0);
        float3 Ld = normalize(float3(-0.25, -0.78, 0.58));
        float lit = clamp(0.3 + 1.0 * max(dot(n, Ld), 0.0), 0.0, 1.25);
        col = mix(face, uNeon * lit, smoothstep(0.1, 0.6, bev));
        col += float3(0.45) * smoothstep(0.03, 0.14, bev) * (1.0 - smoothstep(0.14, 0.34, bev));
        col += 0.2 * max(env(R, 0.25) - float3(1.0), float3(0.0));
    }
    col = clamp(col + tint.rgb * tint.a, 0.0, 1.0);
    return float4(col * cov, cov);
}

half4 main(float2 p) {
    float rid = floor(float(texR.eval(p - uROrg).r) * 255.0 + 0.5);
    float2 off = float2(0.0);
    float ra = 1.0;
    float4 tint = float4(0.0);
    for (int i = 0; i < 8; i++) {
        if (float(i + 1) == rid) {
            off = uOff[i];
            ra = uRA[i];
            tint = uTint[i];
        }
    }
    if (ra < 0.002) { return half4(0.0); }
    for (int i = 0; i < 10; i++) {
        float4 bd = uBand[i];
        if (bd.w > 0.5 && p.x >= bd.x && p.x <= bd.y && (bd.z < 0.5 || abs(bd.z - rid) < 0.5)) { return half4(0.0); }
    }
    float2 l = p - uPad - off;
    float4 a = tA(l);
    float4 b = tB(l);
    float cov = b.r;
    if (cov < 0.003 && a.b * 255.0 > length(uDepth) + 2.0) { return half4(0.0); }
    float wa = 0.0;
    float wk = 0.0;
    if (cov < 0.995) {
        float cmax = 0.0;
        float kmax = 0.0;
        float prev = 0.0;
        for (int i = 1; i <= 24; i++) {
            float k = float(i) / 24.0;
            float4 bq = tB(l - uDepth * k);
            float lim = mix(1.0, uDateDepth, step(0.5, bq.b));
            float c = k <= lim ? bq.r : 0.0;
            if (c > cmax) { cmax = c; kmax = k / lim; }
            if (c > 0.5) {
                float lo = prev;
                float hi = k;
                for (int j = 0; j < 4; j++) {
                    float m = 0.5 * (lo + hi);
                    if (tB(l - uDepth * m).r > 0.5) { hi = m; } else { lo = m; }
                }
                wk = hi / lim;
                break;
            }
            prev = k;
        }
        wa = smoothstep(0.15, 0.6, cmax);
        if (wk == 0.0) { wk = kmax; }
    }
    float v = b.g;
    // Oberfläche vierfach je Pixel (die Karte ist doppelt so fein): Fasen, Gehrungen und Ränder werden sauber
    // geglättet, statt eine gemittelte Normale zu spiegeln
    float4 f = 0.25 * (surf(l + float2(-0.25, -0.25), v, tint) + surf(l + float2(0.25, -0.25), v, tint)
        + surf(l + float2(-0.25, 0.25), v, tint) + surf(l + float2(0.25, 0.25), v, tint));
    if (f.a < 0.003 && wa < 0.003) { return half4(0.0); }
    float3 V = viewDir(l, v);
    float2 wd = normalize(uDepth + float2(0.0001, 0.0001));
    float3 Rw = reflect(-V, normalize(float3(wd, 0.45)));
    float3 wc;
    if (uKind < 1.5) {
        float3 tintW = uKind < 0.5 ? uF0 : float3(0.22);
        wc = env(Rw, uRough + 0.25) * tintW * 0.6;
    } else {
        wc = mix(uSide0, uSide1, wk);
    }
    wc *= 1.0 - 0.6 * wk;
    wc = clamp(wc + tint.rgb * (tint.a * 0.5), 0.0, 1.0);
    float A = f.a;
    float al = (A + wa * (1.0 - A)) * ra;
    float3 rgb = (f.rgb + wc * wa * (1.0 - A)) * ra;
    return half4(half3(rgb), half(al));
}
"""
    }
}
