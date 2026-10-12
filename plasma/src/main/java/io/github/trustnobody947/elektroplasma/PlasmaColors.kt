package io.github.trustnobody947.elektroplasma

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Drei Farben einer Plasma-Linie (Werte 0..1): Mittellinie, Rand drumherum, Nebel außen. */
class Tri(val k: FloatArray, val g: FloatArray, val h: FloatArray)

/**
 * Farben wie in der Vorschau (vorschau/quellen/effects/elektroplasma.js): ein Farbspektrum je Regler,
 * Voreinstellungen als Reglerstellungen und die Farblisten für Wechsel, Akku, Neigung und Kompass.
 */
object PlasmaColors {

    /** Voreinstellungen als Reglerstellungen (0..100) für Mittellinie, Rand und Nebel. */
    val PRESETS = arrayOf(
        floatArrayOf(100f, 60.5f, 66f),   // Elektroblau
        floatArrayOf(100f, 39f, 40.5f),   // Hellgrün
        floatArrayOf(100f, 74f, 66.5f),   // Lila
        floatArrayOf(95f, 6f, 4f),        // Dunkelrot
        floatArrayOf(21f, 13f, 9f),       // Feuer
        floatArrayOf(100f, 20f, 18f),     // Gelb
        floatArrayOf(100f, 100f, 100f)    // Weiß
    )
    const val CUSTOM = 7

    /** Volle Farbe zum Farbton h (0..1). */
    fun hue(h: Float): FloatArray {
        fun f(n: Int): Float {
            var k = (n + h * 6f) % 6f
            if (k < 0f) k += 6f
            return 1f - max(0f, min(min(k, 4f - k), 1f))
        }
        return floatArrayOf(f(5), f(3), f(1))
    }

    /** Farbspektrum der Regler: 0 = aus (schwarz), dann Rot → Orange → Gelb → Grün → Türkis → Blau → Violett → Pink, am Ende Weiß. */
    fun spec(v0: Float): FloatArray {
        val v = v0.coerceIn(0f, 100f)
        if (v <= 6f) return floatArrayOf(v / 6f, 0f, 0f)
        val c = hue(min(330f, (v - 6f) / 84f * 330f) / 360f)
        if (v <= 90f) return c
        val w = (v - 90f) / 10f
        return floatArrayOf(c[0] + (1f - c[0]) * w, c[1] + (1f - c[1]) * w, c[2] + (1f - c[2]) * w)
    }

    fun name(v: Float): String {
        if (v <= 0f) return "aus"
        if (v < 5f) return "dunkelrot"
        if (v >= 98f) return "weiß"
        if (v > 90f) return "hellrosa"
        val h = (v - 6f) / 84f * 330f
        return when {
            h < 15f -> "rot"
            h < 45f -> "orange"
            h < 70f -> "gelb"
            h < 100f -> "gelbgrün"
            h < 150f -> "grün"
            h < 195f -> "türkis"
            h < 250f -> "blau"
            h < 285f -> "violett"
            h < 320f -> "magenta"
            else -> "pink"
        }
    }

    fun argb(c: FloatArray): Int =
        (0xff shl 24) or ((c[0] * 255f).toInt().coerceIn(0, 255) shl 16) or
            ((c[1] * 255f).toInt().coerceIn(0, 255) shl 8) or (c[2] * 255f).toInt().coerceIn(0, 255)

    fun tri(k: FloatArray) = Tri(spec(k[0]), spec(k[1]), spec(k[2]))

    fun mix(a: FloatArray, b: FloatArray, t: Float) =
        floatArrayOf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)

    fun mixTri(a: Tri, b: Tri, t: Float) = Tri(mix(a.k, b.k, t), mix(a.g, b.g, t), mix(a.h, b.h, t))

    fun smooth(k: Float) = k * k * (3f - 2f * k)

    private fun rgb(r: Int, g: Int, b: Int) = floatArrayOf(r / 255f, g / 255f, b / 255f)

    /** Wechsel: der Reihe nach durch die ersten sechs Voreinstellungen. */
    val CYCLE: Array<Tri> = Array(6) { tri(PRESETS[it]) }
    /** Akku: leer rot … voll blau. */
    val BATTERY = arrayOf(rgb(255, 30, 20), rgb(245, 220, 40), rgb(40, 255, 80), rgb(40, 110, 255))
    /** Neigung und Kompass: einmal im Kreis. */
    val COMPASS = arrayOf(rgb(255, 30, 20), rgb(245, 220, 40), rgb(40, 255, 80), rgb(30, 230, 255), rgb(40, 110, 255), rgb(170, 60, 255))

    /** Farbe an Stelle v (0..1) einer Liste; rund = Kreis (Kompass, Neigung). */
    fun listColor(list: Array<FloatArray>, v: Float, round: Boolean): FloatArray {
        val n = if (round) list.size else list.size - 1
        val vv = if (round) ((v % 1f) + 1f) % 1f else v.coerceIn(0f, 1f)
        val x = vv * n
        val i = min(floor(x).toInt(), n - (if (round) 0 else 1)).coerceAtLeast(0)
        val k = (x - i).coerceIn(0f, 1f)
        return mix(list[i % list.size], list[(i + 1) % list.size], smooth(k))
    }

    /** Aus einer einzelnen Farbe (Farbwechsel nach Sensor) eine Linie machen: Mittellinie bleibt, Rand und Nebel in der Farbe. */
    fun fromOne(c: FloatArray, base: Tri) = Tri(base.k, c, c)
}
