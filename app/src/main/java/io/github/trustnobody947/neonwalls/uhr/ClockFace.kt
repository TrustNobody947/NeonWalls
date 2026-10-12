package io.github.trustnobody947.neonwalls.uhr

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import java.util.Calendar
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Schablonen-Uhr: Uhrzeit und Datum in der Schrift der Original-Sperrbildschirm-Uhr.
 * Die Schrift ist nach Screenshots vermessen: nur senkrechte Balken mit 45°-Fasen auf einem Raster (Zeichenhöhe
 * 153 Einheiten = 9 × 17), Schablonen-Lücke zwischen linker und rechter Spalte, Doppelpunkt aus zwei Keilen.
 * Licht von oben: Fläche, hellere Seitenfasen, dunklere Unterkanten und darunter eine dunkle Kante (Tiefe).
 * Oberflächen: Chrom, Gold, Stahlblau, Roségold, Schwarzchrom, Kupfer, Neon (leuchtend) und Weiß (wie das Original).
 * Liefert ein fertiges Bild (layer) und seine Lage auf dem Bildschirm; neu gebaut wird nur, wenn sich Minute,
 * Datum, Einstellungen oder Bildschirmgröße ändern.
 */
class ClockFace {

    var pos = 0       // 0 = oben, 1 = Mitte, 2 = unten
        private set
    var size = 5      // 1..10, 5 = so groß wie beim Original
        private set
    var date = 0      // 0 = wie Original (2026.10.11 SUN), 1 = deutsch (SO 11.10.2026), 2 = aus
        private set
    var finish = WHITE // Index in FIN
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

    private class Sprite(val bmp: Bitmap?, val pad: Int)
    private class Glyph(val polys: List<Array<FloatArray>>, val x0: Float, val x1: Float, val w: Float)
    private class Placed(val s: Sprite, val x: Float)

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
    // Abstände wie beim Original (Einheiten der Zeichenhöhe 153): Ziffernzellen 52 breit im Abstand 102, der
    // Doppelpunkt mittig in der Zelle dazwischen; Datumszeile 42 hoch, 51 unter der Uhrzeit, Proportionalschrift mit
    // 39 Abstand, 50 um den Punkt und 350 zwischen Datum und Wochentag.

    private fun build(sw: Int, sh: Int, time: String, ds: String) {
        val big = max(12, (sh * 0.0628f * (0.6f + 0.08f * size)).roundToInt())
        val small = max(7, (big * 42f / 153f).roundToInt())
        val tl = timeLine(time, big)
        val dl = if (ds.isNotEmpty()) dateLine(ds, small) else Pair(emptyList<Placed>(), 0f)
        val gap = if (ds.isNotEmpty()) (big * 51f / 153f).roundToInt() else 0
        val m = (big * (if (FIN[finish].neon != 0) 0.34f else 0.12f)).roundToInt() + 4
        val lw = ceil(max(tl.second, dl.second) + m * 2f).toInt().coerceAtLeast(1)
        val lh = ceil(big + gap + (if (ds.isNotEmpty()) small else 0) + m * 2f).toInt().coerceAtLeast(1)
        val bmp = Bitmap.createBitmap(lw, lh, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.FILTER_BITMAP_FLAG)
        val tx = (lw - tl.second) / 2f
        for (g in tl.first) g.s.bmp?.let { c.drawBitmap(it, (tx + g.x - g.s.pad).roundToInt().toFloat(), (m - g.s.pad).toFloat(), p) }
        val dx0 = (lw - dl.second) / 2f
        for (g in dl.first) g.s.bmp?.let { c.drawBitmap(it, (dx0 + g.x - g.s.pad).roundToInt().toFloat(), (m + big + gap - g.s.pad).toFloat(), p) }
        layer = bmp
        // „Oben“ wie beim Original: Uhr und Datum zusammen mittig bei 14,66 % der Bildschirmhöhe
        val cy = floatArrayOf(0.1466f, 0.42f, 0.66f)[pos] * sh
        x = (sw / 2f - lw / 2f).roundToInt().toFloat()
        y = (cy - lh / 2f).coerceIn(sh * 0.03f, max(sh * 0.03f, sh * 0.97f - lh)).roundToInt().toFloat()
    }

    /** Uhrzeit: feste Zellen, die 1 steht mittig in ihrer Zelle. */
    private fun timeLine(str: String, hPx: Int): Pair<List<Placed>, Float> {
        val u = hPx / GH
        val list = ArrayList<Placed>()
        for ((i, ch) in str.withIndex()) {
            val g = glyph(ch)
            list.add(Placed(sprite(ch, hPx, false), (i * 102f + (CW - g.w) / 2f) * u))
        }
        return Pair(list, max(0f, (str.length - 1) * 102f + CW) * u)
    }

    /** Datum: Proportionalschrift wie beim Original. */
    private fun dateLine(str: String, hPx: Int): Pair<List<Placed>, Float> {
        val u = hPx / GH
        val list = ArrayList<Placed>()
        var x = 0f
        var prev: Char? = null
        for (ch in str) {
            if (ch == ' ') { if (prev != null) x += 350f - 39f; prev = ' '; continue }
            if (prev != null) x += if (ch == '.' || prev == '.') 50f else 39f
            val g = glyph(ch)
            list.add(Placed(sprite(ch, hPx, true), (x - g.x0) * u))
            x += g.x1 - g.x0
            prev = ch
        }
        return Pair(list, x * u)
    }

    // ---------- Schrift: Balken mit 45°-Fasen auf dem Raster der Original-Uhr ----------

    private fun pt(x: Float, y: Float) = floatArrayOf(x, y)

    /** Balken in einer Spalte von y0 bis y1; Fase oben/unten links ('l'), rechts ('r') oder gerade ('-'). */
    private fun bar(x0: Float, y0: Float, y1: Float, top: Char, bot: Char, w: Float = BW): Array<FloatArray> {
        val x1 = x0 + w
        return arrayOf(
            pt(x0, y0 + (if (top == 'l') CH else 0f)), pt(x1, y0 + (if (top == 'r') CH else 0f)),
            pt(x1, y1 - (if (bot == 'r') CH else 0f)), pt(x0, y1 - (if (bot == 'l') CH else 0f))
        )
    }

    /** Balken über die ganze Höhe mit spitzer Kerbe in der Mitte (rechte Spalte von 3 und 8, linke Spalte von 8). */
    private fun notchR(x0: Float) = arrayOf(pt(x0, 0f), pt(x0 + BW, CH), pt(x0 + BW, 62f), pt(x0 + 3.5f, 76.5f),
        pt(x0 + BW, 91f), pt(x0 + BW, GH - CH), pt(x0, GH))
    private fun notchL(x0: Float) = arrayOf(pt(x0, CH), pt(x0 + BW, 0f), pt(x0 + BW, GH), pt(x0, GH - CH),
        pt(x0, 91f), pt(x0 + BW - 3.5f, 76.5f), pt(x0, 62f))

    /** Waagerechter Balken mit schräg abgeschnittenem rechtem Ende (E, F). */
    private fun hbar(y0: Float) = arrayOf(pt(0f, y0), pt(CW - BW, y0), pt(CW, y0 + BW), pt(0f, y0 + BW))

    private fun shapes(ch: Char): List<Array<FloatArray>> = when (ch) {
        '0' -> listOf(bar(0f, 0f, GH, 'l', 'l'), bar(XR, 0f, GH, 'r', 'r'))
        '1' -> listOf(bar(XM, 0f, GH, 'l', 'l'))
        '2' -> listOf(bar(0f, 0f, 52f, 'l', 'l'), bar(0f, 85f, GH, 'l', '-'), bar(XR, 0f, 85f, 'r', 'r'), bar(XR, 118f, GH, 'r', '-'))
        '3' -> listOf(bar(0f, 0f, 52f, 'l', 'l'), bar(0f, 101f, GH, 'l', 'l'), notchR(XR))
        '4' -> listOf(bar(0f, 0f, 102f, 'l', 'l'), bar(XR, 0f, GH, 'l', 'l'))
        '5' -> listOf(bar(0f, 0f, 85f, '-', 'l'), bar(0f, 101f, GH, 'l', 'l'), bar(XR, 0f, 35f, '-', 'r'), bar(XR, 68f, GH, 'r', 'r'))
        '6' -> listOf(bar(0f, 0f, GH, 'l', 'l'), bar(XR, 0f, 35f, 'r', '-'), bar(XR, 68f, GH, 'r', 'r'))
        '7' -> listOf(bar(0f, 0f, 35f, '-', 'r'), bar(XR, 0f, GH, '-', 'r'))
        '8' -> listOf(notchL(0f), notchR(XR))
        '9' -> listOf(bar(0f, 0f, 85f, 'l', 'l'), bar(0f, 118f, GH, '-', 'l'), bar(XR, 0f, GH, 'r', 'r'))
        ':' -> listOf(arrayOf(pt(0f, 17f), pt(28.5f, 0f), pt(28.5f, 52f), pt(0f, 35f)),
            arrayOf(pt(0f, 118f), pt(28.5f, 101f), pt(28.5f, GH), pt(0f, 136f)))
        '.' -> listOf(arrayOf(pt(0f, GH - 17f), pt(16f, GH - 17f), pt(16f, GH), pt(0f, GH)))
        'A' -> listOf(bar(0f, 0f, GH, 'l', '-'), bar(XR, 0f, GH, 'r', '-'))
        'D' -> listOf(bar(0f, 0f, GH, '-', '-'), bar(XR, 0f, GH, 'r', 'r'))
        'E' -> listOf(hbar(0f), hbar(66f), hbar(GH - BW))
        'F' -> listOf(hbar(0f), arrayOf(pt(0f, 66f), pt(CW - BW, 66f), pt(CW, 66f + BW), pt(BW, 66f + BW), pt(BW, GH), pt(0f, GH)))
        'H' -> listOf(bar(0f, 0f, GH, '-', '-'), bar(XR, 0f, GH, '-', '-'), arrayOf(pt(BW, 68f), pt(XR, 85f), pt(BW, 85f)))
        'I' -> listOf(bar(0f, 0f, GH, '-', '-'))
        'M' -> listOf(bar(0f, 0f, GH, 'l', '-'), bar(M3, 0f, GH, '-', '-'), bar(2 * M3, 0f, GH, 'r', '-'))
        'N' -> listOf(bar(0f, 0f, GH, '-', '-'), bar(XR, 0f, GH, 'r', '-'))
        'O' -> listOf(bar(0f, 0f, GH, 'l', 'l'), bar(XR, 0f, GH, 'r', 'r'))
        'R' -> listOf(bar(0f, 0f, GH, 'l', '-'), arrayOf(pt(XR, 0f), pt(CW, CH), pt(CW, 66f), pt(XR + 1f, 84f), pt(CW, 84f), pt(CW, GH), pt(XR, GH)))
        'S' -> listOf(bar(0f, 0f, 85f, 'l', 'l'), bar(0f, 102f, GH, 'l', 'l'), bar(XR, 0f, 51f, 'r', 'r'), bar(XR, 68f, GH, 'r', 'r'))
        'T' -> listOf(arrayOf(pt(0f, 0f), pt(CW, 0f), pt(CW, BW), pt(XM + BW, BW), pt(XM + BW, GH), pt(XM, GH), pt(XM, BW), pt(0f, BW)))
        'U' -> listOf(arrayOf(pt(0f, 0f), pt(BW, 0f), pt(BW, GH - CH), pt(XR, GH - CH), pt(XR, 0f), pt(CW, 0f), pt(CW, GH - CH),
            pt(XR, GH), pt(BW, GH), pt(0f, GH - CH)))
        'W' -> listOf(bar(0f, 0f, GH, '-', 'l'), bar(M3, 0f, GH, '-', '-'), bar(2 * M3, 0f, GH, '-', 'r'))
        else -> emptyList()
    }

    /** Zeichen mit Tintengrenzen; Ziffern sind immer eine volle Zelle breit (die 1 steht mittig darin). */
    private fun glyph(ch: Char): Glyph {
        val s = shapes(ch)
        var x0 = 0f
        var x1 = 0f
        if (s.isNotEmpty()) {
            x0 = Float.MAX_VALUE; x1 = -Float.MAX_VALUE
            for (p in s) for (q in p) { x0 = min(x0, q[0]); x1 = max(x1, q[0]) }
        }
        return Glyph(s, x0, x1, if (ch in '0'..'9') CW else x1)
    }

    // ---------- Zeichen als Bild ----------

    private fun mix(a: Int, b: Int, k: Float): Int {
        val q = k.coerceIn(0f, 1f)
        return Color.rgb(
            (Color.red(a) + (Color.red(b) - Color.red(a)) * q).roundToInt(),
            (Color.green(a) + (Color.green(b) - Color.green(a)) * q).roundToInt(),
            (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * q).roundToInt()
        )
    }

    /** Flächenfarbe in der Höhe v (0 oben, 1 unten) aus dem Verlauf der Oberfläche. */
    private fun faceAt(f: Finish, v: Float): Int {
        val pos = f.facePos
        if (v <= pos[0]) return f.face[0]
        for (i in 1 until pos.size) if (v <= pos[i]) return mix(f.face[i - 1], f.face[i], (v - pos[i - 1]) / (pos[i] - pos[i - 1]))
        return f.face[f.face.size - 1]
    }

    /**
     * Ein Teilstück mit Fasen einfärben: jedes Pixel bekommt die Farbe der nächsten Kante, wenn es näher als die
     * Fasenbreite an ihr liegt (Licht von oben: Oberkanten hell, Seiten mittel, Unterkanten dunkel), sonst die
     * Flächenfarbe. So stimmen auch spitze Kerben und dünne Stellen.
     */
    private fun shadePoly(c: Canvas, poly: List<FloatArray>, f: Finish, bev: Float, top: Float, hPx: Int) {
        var minX = Float.MAX_VALUE; var minY = Float.MAX_VALUE; var maxX = -Float.MAX_VALUE; var maxY = -Float.MAX_VALUE
        for (q in poly) { minX = min(minX, q[0]); minY = min(minY, q[1]); maxX = max(maxX, q[0]); maxY = max(maxY, q[1]) }
        val bx = floor(minX).toInt() - 1
        val by = floor(minY).toInt() - 1
        val bw = ceil(maxX).toInt() - bx + 2
        val bh = ceil(maxY).toInt() - by + 2
        if (bw <= 0 || bh <= 0) return
        val tmp = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888)
        val path = Path()
        path.moveTo(poly[0][0] - bx, poly[0][1] - by)
        for (i in 1 until poly.size) path.lineTo(poly[i][0] - bx, poly[i][1] - by)
        path.close()
        Canvas(tmp).drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE })
        val px = IntArray(bw * bh)
        tmp.getPixels(px, 0, bw, 0, 0, bw, bh)
        // Kanten: Anfang, Richtung, Länge², Farbe der Fase
        val n = poly.size
        val ex = FloatArray(n); val ey = FloatArray(n); val edx = FloatArray(n); val edy = FloatArray(n); val el2 = FloatArray(n)
        val ecol = IntArray(n)
        var ne = 0
        for (i in 0 until n) {
            val a = poly[i]
            val b = poly[(i + 1) % n]
            val dx = b[0] - a[0]
            val dy = b[1] - a[1]
            val l2 = dx * dx + dy * dy
            if (l2 < 1e-6f) continue
            val lam = dx / sqrt(l2)
            ex[ne] = a[0]; ey[ne] = a[1]; edx[ne] = dx; edy[ne] = dy; el2[ne] = l2
            ecol[ne] = if (lam > 0f) mix(f.mid, f.lit, lam) else mix(f.mid, f.shade, -lam)
            ne++
        }
        for (yy in 0 until bh) {
            val pyy = by + yy + 0.5f
            val fc = faceAt(f, (pyy - top) / hPx)
            for (xx in 0 until bw) {
                val o = yy * bw + xx
                val alpha = px[o] ushr 24
                if (alpha == 0) continue
                val pxx = bx + xx + 0.5f
                var best = Float.MAX_VALUE
                var col = f.mid
                for (e in 0 until ne) {
                    var k = ((pxx - ex[e]) * edx[e] + (pyy - ey[e]) * edy[e]) / el2[e]
                    k = if (k < 0f) 0f else if (k > 1f) 1f else k
                    val qx = ex[e] + edx[e] * k - pxx
                    val qy = ey[e] + edy[e] * k - pyy
                    val dd = qx * qx + qy * qy
                    if (dd < best) { best = dd; col = ecol[e] }
                }
                val rgb = mix(col, fc, sqrt(best) - bev + 0.5f)
                px[o] = (alpha shl 24) or (rgb and 0xffffff)
            }
        }
        tmp.setPixels(px, 0, bw, 0, 0, bw, bh)
        c.drawBitmap(tmp, bx.toFloat(), by.toFloat(), null)
        tmp.recycle()
    }

    /** Zeichen als fertiges Bild: Uhrzeit mit Fasen und Tiefe, Datum flach (wie beim Original). */
    private fun sprite(ch: Char, hPx: Int, flat: Boolean): Sprite {
        val k = "$finish|$ch|$hPx|$flat"
        sprites[k]?.let { return it }
        val f = FIN[finish]
        val gl = glyph(ch)
        val u = hPx / GH
        val depth = if (flat) 0 else max(1, (hPx * 0.026f).roundToInt())
        val pad = depth + 3 + (if (f.neon != 0) (hPx * (if (flat) 0.45f else 0.3f)).roundToInt() else 0)
        val bev = max(1f, hPx * 0.026f)
        if (gl.polys.isEmpty()) return Sprite(null, pad).also { sprites[k] = it }
        val cw = max(1, ceil(gl.w * u + pad * 2).toInt())
        val chh = max(1, ceil(hPx + pad * 2f + depth).toInt())
        val bmp = Bitmap.createBitmap(cw, chh, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        val polys = gl.polys.map { poly -> poly.map { q -> floatArrayOf(pad + q[0] * u, pad + q[1] * u) } }
        fun path(oy: Float): Path {
            val path = Path()
            for (poly in polys) {
                path.moveTo(poly[0][0], poly[0][1] + oy)
                for (i in 1 until poly.size) path.lineTo(poly[i][0], poly[i][1] + oy)
                path.close()
            }
            return path
        }
        val outer = path(0f)
        if (f.neon != 0) {
            // Schein: weich und weit, dann eng und kräftig
            for ((r, a) in listOf(Pair(hPx * 0.22f, 0.5f), Pair(hPx * 0.065f, 0.8f))) {
                p.color = Color.argb((a * 255).roundToInt(), Color.red(f.neon), Color.green(f.neon), Color.blue(f.neon))
                p.maskFilter = BlurMaskFilter(max(1f, r), BlurMaskFilter.Blur.NORMAL)
                c.drawPath(outer, p)
            }
            p.maskFilter = null
        }
        if (flat) {
            p.color = f.date
            c.drawPath(outer, p)
        } else {
            // Tiefe: dieselbe Form mehrfach nach unten versetzt, dunkler je tiefer
            for (d in depth downTo 1) {
                p.color = mix(f.side0, f.side1, (d - 1) / max(1, depth - 1).toFloat())
                c.drawPath(path(d.toFloat()), p)
            }
            for (poly in polys) shadePoly(c, poly, f, bev, pad.toFloat(), hPx)
        }
        return Sprite(bmp, pad).also { sprites[k] = it }
    }

    private class Finish(
        val face: IntArray, val facePos: FloatArray, val lit: Int, val mid: Int, val shade: Int,
        val side0: Int, val side1: Int, val date: Int, val neon: Int = 0
    )

    companion object {
        /** Index der Oberfläche „Weiß wie das Original“ (Voreinstellung). */
        const val WHITE = 7

        // Raster der Schrift: Zeichenhöhe GH, Balkenbreite BW, Lücke GAP, Zellenbreite CW, Fase CH
        private const val GH = 153f
        private const val BW = 18.5f
        private const val GAP = 15f
        private const val CW = 2 * BW + GAP
        private const val CH = 17f
        private const val XR = BW + GAP
        private const val XM = (CW - BW) / 2f
        private const val M3 = BW + GAP

        private val EN = arrayOf("SUN", "MON", "TUE", "WED", "THUR", "FRI", "SAT")
        private val DE = arrayOf("SO", "MO", "DI", "MI", "DO", "FR", "SA")
        private fun c(s: String) = Color.parseColor(s)
        private val P5 = floatArrayOf(0f, 0.4f, 0.49f, 0.56f, 1f)
        private val FIN = arrayOf(
            // Chrom
            Finish(intArrayOf(c("#ffffff"), c("#e4e7ed"), c("#a2a7b1"), c("#d6dae2"), c("#aab0ba")), P5,
                Color.rgb(255, 255, 255), Color.rgb(196, 201, 210), Color.rgb(62, 66, 74), c("#55595f"), c("#141518"), Color.rgb(212, 216, 222)),
            // Gold
            Finish(intArrayOf(c("#fff8de"), c("#f1d37e"), c("#9e7924"), c("#e7c56b"), c("#b68b2f")), P5,
                Color.rgb(255, 248, 220), Color.rgb(214, 176, 90), Color.rgb(86, 60, 16), c("#6a4e18"), c("#1c1405"), Color.rgb(232, 196, 112)),
            // Stahlblau
            Finish(intArrayOf(c("#f2f8ff"), c("#bfd4ee"), c("#5f7995"), c("#aac3e0"), c("#7189a6")), P5,
                Color.rgb(240, 248, 255), Color.rgb(150, 175, 205), Color.rgb(28, 42, 60), c("#2c3d52"), c("#0b1119"), Color.rgb(172, 196, 226)),
            // Roségold
            Finish(intArrayOf(c("#fff1ea"), c("#f0bba6"), c("#99604e"), c("#e5aa94"), c("#b67b67")), P5,
                Color.rgb(255, 240, 232), Color.rgb(218, 162, 142), Color.rgb(92, 50, 40), c("#6e4135"), c("#1d100b"), Color.rgb(232, 176, 156)),
            // Schwarzchrom: dunkler Spiegel, nur die Kanten blitzen hell
            Finish(intArrayOf(c("#a4aab4"), c("#3b3e46"), c("#0b0c0f"), c("#2d3038"), c("#14161a")), P5,
                Color.rgb(225, 230, 240), Color.rgb(74, 78, 88), Color.rgb(6, 7, 9), c("#26282d"), c("#040405"), Color.rgb(118, 124, 134)),
            // Kupfer
            Finish(intArrayOf(c("#fff0de"), c("#e99b62"), c("#8a4a22"), c("#da8b52"), c("#a95d2c")), P5,
                Color.rgb(255, 236, 214), Color.rgb(206, 130, 82), Color.rgb(80, 36, 14), c("#6a3516"), c("#1c0c04"), Color.rgb(222, 146, 98)),
            // Neon: helle Fläche mit türkisem Schein
            Finish(intArrayOf(c("#ffffff"), c("#e6fdff"), c("#a8f1ff")), floatArrayOf(0f, 0.45f, 1f),
                Color.rgb(255, 255, 255), Color.rgb(176, 242, 255), Color.rgb(52, 168, 205), c("#0d4b5d"), c("#021116"), Color.rgb(196, 246, 255),
                neon = Color.rgb(40, 225, 255)),
            // Weiß wie das Original: matte weiße Fläche, Fasen hellgrau, Unterkanten grau, dunkle Kante darunter
            Finish(intArrayOf(c("#ffffff"), c("#ffffff")), floatArrayOf(0f, 1f),
                Color.rgb(255, 255, 255), Color.rgb(220, 221, 222), Color.rgb(172, 174, 178), Color.rgb(60, 64, 68), Color.rgb(24, 26, 28),
                Color.rgb(218, 218, 218))
        )
    }
}
