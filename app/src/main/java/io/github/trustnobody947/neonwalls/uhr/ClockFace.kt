package io.github.trustnobody947.neonwalls.uhr

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import java.util.Calendar
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Schablonen-Uhr: kantige Ziffern aus abgeschrägten Balken mit schmalen Schablonen-Lücken, Uhrzeit und Datum.
 * Oberflächen: Chrom, Gold, Stahlblau, Roségold, Schwarzchrom, Kupfer (Metall mit Tiefe und Fasen) und Neon (leuchtend).
 * Liefert ein fertiges Bild (layer) und seine Lage auf dem Bildschirm; neu gebaut wird nur, wenn sich Minute,
 * Datum, Einstellungen oder Bildschirmgröße ändern.
 */
class ClockFace {

    var pos = 0       // 0 = oben, 1 = Mitte, 2 = unten
        private set
    var size = 5      // 1..10
        private set
    var date = 0      // 0 = wie Original (2026.10.11 SUN), 1 = deutsch (SO 11.10.2026), 2 = aus
        private set
    var finish = 0    // Index in FIN
        private set

    var layer: Bitmap? = null
        private set
    var x = 0f
        private set
    var y = 0f
        private set

    private var key = ""
    private var cacheKey = ""
    private val sprites = HashMap<String, Sprite>()

    private class Sprite(val bmp: Bitmap?, val w: Float, val pad: Int)
    private class Glyph(val w: Float, val polys: List<Array<FloatArray>>)

    fun configure(pos: Int, size: Int, date: Int, finish: Int) {
        this.pos = pos.coerceIn(0, 2)
        this.size = size.coerceIn(1, 10)
        this.date = date.coerceIn(0, 2)
        this.finish = finish.coerceIn(0, FIN.size - 1)
    }

    /** Bild bei Bedarf neu bauen. Billig, wenn sich nichts geändert hat. */
    fun update(sw: Int, sh: Int) {
        val cal = Calendar.getInstance()
        val h = cal.get(Calendar.HOUR_OF_DAY)
        val m = cal.get(Calendar.MINUTE)
        val k = "$h|$m|${cal.get(Calendar.DAY_OF_YEAR)}|$pos|$size|$date|$finish|$sw|$sh"
        if (k == key && layer != null) return
        key = k
        val ck = "$size|$finish|$sh"
        if (ck != cacheKey) { sprites.clear(); cacheKey = ck }
        val time = two(h) + ":" + two(m)
        val dow = cal.get(Calendar.DAY_OF_WEEK) - 1
        val ds = when (date) {
            0 -> "${cal.get(Calendar.YEAR)}.${two(cal.get(Calendar.MONTH) + 1)}.${two(cal.get(Calendar.DAY_OF_MONTH))} ${EN[dow]}"
            1 -> "${DE[dow]} ${two(cal.get(Calendar.DAY_OF_MONTH))}.${two(cal.get(Calendar.MONTH) + 1)}.${cal.get(Calendar.YEAR)}"
            else -> ""
        }
        build(sw, sh, time, ds)
    }

    private fun two(v: Int) = if (v < 10) "0$v" else v.toString()

    // ---------- Bild zusammensetzen ----------

    private fun build(sw: Int, sh: Int, time: String, ds: String) {
        val big = max(12, (sh * (0.04f + 0.008f * size)).roundToInt())
        val small = max(8, (big * 0.27f).roundToInt())
        val tl = line(time, big, 2.6f, 0.24f)
        val dl = if (ds.isNotEmpty()) line(ds, small, 2.0f, 0.3f) else Pair(emptyList<Pair<Sprite, Float>>(), 0f)
        val gap = if (ds.isNotEmpty()) (big * 0.24f).roundToInt() else 0
        val m = (big * (if (FIN[finish].neon != 0) 0.34f else 0.12f)).roundToInt() + 4
        val lw = ceil(max(tl.second, dl.second) + m * 2f).toInt().coerceAtLeast(1)
        val lh = ceil(big + gap + (if (ds.isNotEmpty()) small else 0) + m * 2f).toInt().coerceAtLeast(1)
        val bmp = Bitmap.createBitmap(lw, lh, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.FILTER_BITMAP_FLAG)
        val tx = (lw - tl.second) / 2f
        for ((s, gx) in tl.first) s.bmp?.let { c.drawBitmap(it, tx + gx - s.pad, (m - s.pad).toFloat(), p) }
        val dx0 = (lw - dl.second) / 2f
        for ((s, gx) in dl.first) s.bmp?.let { c.drawBitmap(it, dx0 + gx - s.pad, (m + big + gap - s.pad).toFloat(), p) }
        layer = bmp
        val cy = floatArrayOf(0.17f, 0.42f, 0.66f)[pos] * sh
        x = (sw / 2f - lw / 2f).roundToInt().toFloat()
        y = (cy - lh / 2f).coerceIn(sh * 0.03f, max(sh * 0.03f, sh * 0.97f - lh)).roundToInt().toFloat()
    }

    private fun line(str: String, hPx: Int, ha: Float, gapU: Float): Pair<List<Pair<Sprite, Float>>, Float> {
        val u = hPx / ha
        val list = ArrayList<Pair<Sprite, Float>>()
        var w = 0f
        for (ch in str) {
            val s = sprite(ch, hPx, ha)
            list.add(Pair(s, w))
            w += s.w + gapU * u
        }
        return Pair(list, max(0f, w - gapU * u))
    }

    // ---------- Zeichen aus Balken mit 45°-Stößen ----------
    // Die Balken kacheln das Zeichen lückenlos und werden dann rundum etwas eingezogen: so entstehen die schmalen
    // Schablonen-Lücken und die kantige Form.

    private fun pt(x: Float, y: Float) = floatArrayOf(x, y)

    private fun quad(x0: Float, y0: Float, x1: Float, y1: Float, w: Float): Array<FloatArray> {
        val dx = x1 - x0
        val dy = y1 - y0
        val len = hypot(dx, dy).takeIf { it > 0f } ?: 1f
        val nx = -dy / len * w / 2f
        val ny = dx / len * w / 2f
        val p = arrayOf(pt(x0 + nx, y0 + ny), pt(x1 + nx, y1 + ny), pt(x1 - nx, y1 - ny), pt(x0 - nx, y0 - ny))
        var a = 0f
        for (i in 0 until 4) { val q = p[(i + 1) % 4]; a += p[i][0] * q[1] - q[0] * p[i][1] }
        return if (a < 0f) p.reversedArray() else p
    }

    private fun segs(bw: Float, ha: Float, t: Float, th: Float): Map<Char, Array<FloatArray>> {
        val m = ha / 2f
        val cx = bw / 2f
        return mapOf(
            'a' to arrayOf(pt(0f, 0f), pt(bw, 0f), pt(bw - t, th), pt(t, th)),
            'd' to arrayOf(pt(t, ha - th), pt(bw - t, ha - th), pt(bw, ha), pt(0f, ha)),
            'f' to arrayOf(pt(0f, 0f), pt(t, th), pt(t, m - th / 2f), pt(0f, m)),
            'b' to arrayOf(pt(bw, 0f), pt(bw, m), pt(bw - t, m - th / 2f), pt(bw - t, th)),
            'e' to arrayOf(pt(0f, m), pt(t, m + th / 2f), pt(t, ha - th), pt(0f, ha)),
            'c' to arrayOf(pt(bw, m), pt(bw, ha), pt(bw - t, ha - th), pt(bw - t, m + th / 2f)),
            'g' to arrayOf(pt(0f, m), pt(t, m - th / 2f), pt(bw - t, m - th / 2f), pt(bw, m), pt(bw - t, m + th / 2f), pt(t, m + th / 2f)),
            'G' to arrayOf(pt(0f, m), pt(t, m - th / 2f), pt(cx + t * 0.4f, m - th / 2f), pt(cx + t * 0.4f, m + th / 2f), pt(t, m + th / 2f)),
            'i' to arrayOf(pt(cx - t / 2f, th), pt(cx + t / 2f, th), pt(cx + t / 2f, m - th / 2f), pt(cx - t / 2f, m - th / 2f)),
            'l' to arrayOf(pt(cx - t / 2f, m + th / 2f), pt(cx + t / 2f, m + th / 2f), pt(cx + t / 2f, ha - th), pt(cx - t / 2f, ha - th)),
            'h' to quad(t + t * 0.35f, th + t * 0.35f, cx - t * 0.45f, m - th / 2f - t * 0.2f, t * 0.8f),
            'j' to quad(bw - t - t * 0.35f, th + t * 0.35f, cx + t * 0.45f, m - th / 2f - t * 0.2f, t * 0.8f),
            'k' to quad(cx - t * 0.45f, m + th / 2f + t * 0.2f, t + t * 0.35f, ha - th - t * 0.35f, t * 0.8f),
            'm' to quad(cx + t * 0.45f, m + th / 2f + t * 0.2f, bw - t - t * 0.35f, ha - th - t * 0.35f, t * 0.8f)
        )
    }

    private fun diamond(c: Float, y: Float, s: Float) = arrayOf(pt(c, y - s), pt(c + s, y), pt(c, y + s), pt(c - s, y))

    private fun glyph(ch: Char, ha: Float): Glyph {
        val big = ha > 2.3f
        val t = 0.3f
        val th = if (big) 0.24f else 0.26f
        val gp = if (big) 0.075f else 0.085f
        var w = 1f
        var list: List<Array<FloatArray>> = emptyList()
        when {
            ch in '0'..'9' -> {
                val s = segs(1f, ha, t, th)
                list = SEG7[ch]!!.map { s[it]!! }
                if (ch == '1') list = list.map { p -> Array(p.size) { i -> pt(p[i][0] - (1f - t) / 2f, p[i][1]) } }
            }
            ch == ':' -> { w = 0.42f; list = listOf(diamond(0.21f, ha * 0.33f, 0.17f), diamond(0.21f, ha * 0.67f, 0.17f)) }
            ch == '.' -> { w = 0.36f; list = listOf(diamond(0.18f, ha - 0.2f, 0.17f)) }
            ch == ' ' -> { w = 0.55f }
            SEG14.containsKey(ch) -> {
                w = LW[ch] ?: 1f
                val s = segs(w, ha, t, th)
                list = SEG14[ch]!!.map { s[it]!! }
            }
        }
        return Glyph(w, list.map { insetPoly(it, gp / 2f) })
    }

    /** Kante nach innen versetzen (für die Lücken und die Fasen). */
    private fun insetPoly(p: Array<FloatArray>, b: Float): Array<FloatArray> {
        val n = p.size
        val lines = Array(n) { i ->
            val a = p[i]
            val q = p[(i + 1) % n]
            val dx = q[0] - a[0]
            val dy = q[1] - a[1]
            val len = hypot(dx, dy).takeIf { it > 0f } ?: 1e-9f
            floatArrayOf(a[0] - dy / len * b, a[1] + dx / len * b, dx, dy)
        }
        return Array(n) { i ->
            val la = lines[(i - 1 + n) % n]
            val lb = lines[i]
            val den = la[2] * lb[3] - la[3] * lb[2]
            if (abs(den) < 1e-12f) pt(lb[0], lb[1])
            else {
                val tt = ((lb[0] - la[0]) * lb[3] - (lb[1] - la[1]) * lb[2]) / den
                pt(la[0] + la[2] * tt, la[1] + la[3] * tt)
            }
        }
    }

    private fun minThick(p: Array<FloatArray>): Float {
        var x0 = Float.MAX_VALUE; var x1 = -Float.MAX_VALUE; var y0 = Float.MAX_VALUE; var y1 = -Float.MAX_VALUE
        for (q in p) { x0 = min(x0, q[0]); x1 = max(x1, q[0]); y0 = min(y0, q[1]); y1 = max(y1, q[1]) }
        return min(x1 - x0, y1 - y0)
    }

    private fun mix(a: Int, b: Int, k: Float): Int {
        val q = k.coerceIn(0f, 1f)
        return Color.rgb(
            (Color.red(a) + (Color.red(b) - Color.red(a)) * q).roundToInt(),
            (Color.green(a) + (Color.green(b) - Color.green(a)) * q).roundToInt(),
            (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * q).roundToInt()
        )
    }

    /** Zeichen als Metall: dunkle Tiefe nach rechts unten, Fläche mit Verlauf, Fasen je nach Kantenrichtung. */
    private fun sprite(ch: Char, hPx: Int, ha: Float): Sprite {
        val k = "$finish|$ch|$hPx|$ha"
        sprites[k]?.let { return it }
        val f = FIN[finish]
        val gl = glyph(ch, ha)
        val u = hPx / ha
        val depth = max(1, (hPx * 0.035f).roundToInt())
        val pad = depth + 3 + (if (f.neon != 0) (hPx * 0.3f).roundToInt() else 0)
        val bev = max(1f, hPx * 0.026f)
        if (gl.polys.isEmpty()) return Sprite(null, gl.w * u, pad).also { sprites[k] = it }
        val cw = max(1, ceil(gl.w * u + pad * 2 + depth).toInt())
        val chh = max(1, ceil(hPx + pad * 2f + depth).toInt())
        val bmp = Bitmap.createBitmap(cw, chh, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        fun path(polys: List<Array<FloatArray>>, ox: Float = 0f, oy: Float = 0f): Path {
            val path = Path()
            for (poly in polys) {
                path.moveTo(pad + poly[0][0] * u + ox, pad + poly[0][1] * u + oy)
                for (i in 1 until poly.size) path.lineTo(pad + poly[i][0] * u + ox, pad + poly[i][1] * u + oy)
                path.close()
            }
            return path
        }
        val outer = path(gl.polys)
        if (f.neon != 0) {
            // Schein: weich und weit, dann eng und kräftig
            for ((r, a) in listOf(Pair(hPx * 0.22f, 0.5f), Pair(hPx * 0.065f, 0.8f))) {
                p.color = Color.argb((a * 255).roundToInt(), Color.red(f.neon), Color.green(f.neon), Color.blue(f.neon))
                p.maskFilter = BlurMaskFilter(max(1f, r), BlurMaskFilter.Blur.NORMAL)
                c.drawPath(outer, p)
            }
            p.maskFilter = null
        }
        for (d in depth downTo 1) {
            p.color = mix(f.side0, f.side1, d / depth.toFloat())
            c.drawPath(path(gl.polys, d * 0.55f, d * 0.85f), p)
        }
        val inner = gl.polys.map { insetPoly(it, min(bev / u, minThick(it) * 0.4f)) }
        p.shader = LinearGradient(0f, pad.toFloat(), 0f, (pad + hPx).toFloat(), f.face, f.facePos, Shader.TileMode.CLAMP)
        c.drawPath(path(inner), p)
        p.shader = null
        // Fasen: Licht von links oben
        val lx = -0.5f
        val ly = -0.87f
        val facet = Path()
        gl.polys.forEachIndexed { si, o ->
            val inn = inner[si]
            for (i in o.indices) {
                val j = (i + 1) % o.size
                val dx = o[j][0] - o[i][0]
                val dy = o[j][1] - o[i][1]
                val len = hypot(dx, dy).takeIf { it > 0f } ?: 1f
                val lam = (dy / len) * lx + (-dx / len) * ly
                facet.reset()
                facet.moveTo(pad + o[i][0] * u, pad + o[i][1] * u)
                facet.lineTo(pad + o[j][0] * u, pad + o[j][1] * u)
                facet.lineTo(pad + inn[j][0] * u, pad + inn[j][1] * u)
                facet.lineTo(pad + inn[i][0] * u, pad + inn[i][1] * u)
                facet.close()
                p.color = if (lam > 0f) mix(f.mid, f.lit, lam) else mix(f.mid, f.shade, -lam)
                c.drawPath(facet, p)
            }
        }
        return Sprite(bmp, gl.w * u, pad).also { sprites[k] = it }
    }

    private class Finish(
        val face: IntArray, val facePos: FloatArray, val lit: Int, val mid: Int, val shade: Int,
        val side0: Int, val side1: Int, val neon: Int = 0
    )

    private companion object {
        val EN = arrayOf("SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT")
        val DE = arrayOf("SO", "MO", "DI", "MI", "DO", "FR", "SA")
        val SEG7 = mapOf('0' to "abcdef", '1' to "bc", '2' to "abged", '3' to "abgcd", '4' to "fgbc",
            '5' to "afgcd", '6' to "afgecd", '7' to "abc", '8' to "abcdefg", '9' to "abcdfg")
        val SEG14 = mapOf('A' to "abcefg", 'D' to "abcdil", 'E' to "adefG", 'F' to "aefG", 'H' to "bcefg", 'I' to "adil",
            'M' to "bcefhj", 'N' to "bcefhm", 'O' to "abcdef", 'R' to "abefgm", 'S' to "afgcd", 'T' to "ail", 'U' to "bcdef", 'W' to "bcefkm")
        val LW = mapOf('M' to 1.35f, 'W' to 1.35f, 'N' to 1.15f, 'I' to 0.9f, 'T' to 1.05f)
        private fun c(s: String) = Color.parseColor(s)
        private val P5 = floatArrayOf(0f, 0.4f, 0.49f, 0.56f, 1f)
        val FIN = arrayOf(
            // Chrom
            Finish(intArrayOf(c("#ffffff"), c("#e4e7ed"), c("#a2a7b1"), c("#d6dae2"), c("#aab0ba")), P5,
                Color.rgb(255, 255, 255), Color.rgb(196, 201, 210), Color.rgb(62, 66, 74), c("#55595f"), c("#141518")),
            // Gold
            Finish(intArrayOf(c("#fff8de"), c("#f1d37e"), c("#9e7924"), c("#e7c56b"), c("#b68b2f")), P5,
                Color.rgb(255, 248, 220), Color.rgb(214, 176, 90), Color.rgb(86, 60, 16), c("#6a4e18"), c("#1c1405")),
            // Stahlblau
            Finish(intArrayOf(c("#f2f8ff"), c("#bfd4ee"), c("#5f7995"), c("#aac3e0"), c("#7189a6")), P5,
                Color.rgb(240, 248, 255), Color.rgb(150, 175, 205), Color.rgb(28, 42, 60), c("#2c3d52"), c("#0b1119")),
            // Roségold
            Finish(intArrayOf(c("#fff1ea"), c("#f0bba6"), c("#99604e"), c("#e5aa94"), c("#b67b67")), P5,
                Color.rgb(255, 240, 232), Color.rgb(218, 162, 142), Color.rgb(92, 50, 40), c("#6e4135"), c("#1d100b")),
            // Schwarzchrom: dunkler Spiegel, nur die Kanten blitzen hell
            Finish(intArrayOf(c("#a4aab4"), c("#3b3e46"), c("#0b0c0f"), c("#2d3038"), c("#14161a")), P5,
                Color.rgb(225, 230, 240), Color.rgb(74, 78, 88), Color.rgb(6, 7, 9), c("#26282d"), c("#040405")),
            // Kupfer
            Finish(intArrayOf(c("#fff0de"), c("#e99b62"), c("#8a4a22"), c("#da8b52"), c("#a95d2c")), P5,
                Color.rgb(255, 236, 214), Color.rgb(206, 130, 82), Color.rgb(80, 36, 14), c("#6a3516"), c("#1c0c04")),
            // Neon: helle Fläche mit türkisem Schein
            Finish(intArrayOf(c("#ffffff"), c("#e6fdff"), c("#a8f1ff")), floatArrayOf(0f, 0.45f, 1f),
                Color.rgb(255, 255, 255), Color.rgb(176, 242, 255), Color.rgb(52, 168, 205), c("#0d4b5d"), c("#021116"),
                neon = Color.rgb(40, 225, 255))
        )
    }
}
