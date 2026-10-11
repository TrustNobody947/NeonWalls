package io.github.trustnobody947.neonwalls.pegel

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * LED-Pegelanzeige wie an einer alten Stereoanlage: gewölbte LEDs in Vertiefungen, Spitzenwerte,
 * Nachleuchten mit leichtem Flimmern und Spiegelung auf einer glänzenden Fläche.
 * Die Pegel kommen von außen (Musik oder Mikrofon) oder aus dem eingebauten Demo-Song.
 */
class PegelRenderer(private val density: Float) {

    var style = 0          // 0 = Balken, 1 = Spiegel
        private set
    var colorScheme = 0    // 0 = Klassisch, 1 = Cyan, 2 = Pink, 3 = Bernstein, 4 = Regenbogen
        private set
    var bands = 16
        private set
    private var peaks = true
    private var after = 5
    private var mirror = true
    private var bottom = true
    private var gain = 6

    val demo = PegelDemo()
    var clock: ClockFace? = null   // Uhr über der Anzeige (null = aus)

    private var w = 0
    private var h = 0
    private var dirty = true
    private var nb = 16
    private var nseg = 18
    private var segW = 1f
    private var segH = 1f
    private var pad = 1
    private var floorY = -1f
    private var cellB = IntArray(0)
    private var cellS = IntArray(0)
    private var cellX = FloatArray(0)
    private var cellY = FloatArray(0)
    private var cellCol = IntArray(0)
    private var glow = FloatArray(0)
    private val litSprites = HashMap<Int, Bitmap>()
    private val darkSprites = HashMap<Int, Bitmap>()
    private val disp = FloatArray(64)
    private val peak = FloatArray(64)
    private val hold = FloatArray(64)
    private val flut = FloatArray(64)
    private val target = FloatArray(64)
    private val litN = IntArray(64)
    private val pkN = IntArray(64)
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val addPaint = Paint(Paint.FILTER_BITMAP_FLAG).apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.ADD) }
    private var test = -1f

    val bandCount: Int get() = bands.coerceIn(8, 32)

    fun configure(style: Int, colorScheme: Int, bands: Int, peaks: Boolean, after: Int, mirror: Boolean, bottom: Boolean, gain: Int) {
        if (style != this.style || colorScheme != this.colorScheme || bands != this.bands || bottom != this.bottom) dirty = true
        this.style = style
        this.colorScheme = colorScheme
        this.bands = bands
        this.peaks = peaks
        this.after = after
        this.mirror = mirror
        this.bottom = bottom
        this.gain = gain
    }

    /** Selbsttest wie beim Einschalten eines Verstärkers. */
    fun wake() { test = 0f }

    fun bassDrop() { demo.bassDrop() }

    private fun layout(cw: Int, ch: Int) {
        w = cw; h = ch; dirty = false
        nb = bandCount
        val bs = ArrayList<Int>(); val ss = ArrayList<Int>(); val xs = ArrayList<Float>(); val ys = ArrayList<Float>()
        val x0 = w * 0.07f
        val x1 = w * 0.93f
        val colW = (x1 - x0) / nb
        segW = colW * 0.76f
        if (style == 0) {
            nseg = 18
            val y1 = h * (if (bottom) 0.88f else 0.7f)
            val y0 = y1 - h * 0.36f
            val rh = (y1 - y0) / nseg
            segH = rh * 0.68f
            for (b in 0 until nb) for (s in 0 until nseg) {
                bs.add(b); ss.add(s); xs.add(x0 + b * colW + (colW - segW) / 2f); ys.add(y1 - (s + 1) * rh + (rh - segH) / 2f)
            }
            floorY = y1 + rh * 0.2f
        } else {
            nseg = 11
            val cy = h * (if (bottom) 0.7f else 0.52f)
            val rh = h * 0.19f / nseg
            segH = rh * 0.66f
            for (b in 0 until nb) for (s in 0 until nseg) for (dir in intArrayOf(-1, 1)) {
                val off = (s + 0.5f) * rh + rh * 0.15f
                bs.add(b); ss.add(s); xs.add(x0 + b * colW + (colW - segW) / 2f); ys.add(cy + dir * off - segH / 2f)
            }
            floorY = -1f
        }
        val n = bs.size
        cellB = IntArray(n) { bs[it] }
        cellS = IntArray(n) { ss[it] }
        cellX = FloatArray(n) { xs[it] }
        cellY = FloatArray(n) { ys[it] }
        cellCol = IntArray(n) { segColor(cellS[it] / (nseg - 1f), cellB[it] / max(1f, nb - 1f)) }
        glow = FloatArray(n)
        pad = (min(segW, segH) * 0.9f + 3f * density).roundToInt()
        litSprites.clear()
        darkSprites.clear()
    }

    private fun lerp(a: Int, b: Int, k: Float): Int {
        val q = k.coerceIn(0f, 1f)
        return Color.rgb(
            (Color.red(a) + (Color.red(b) - Color.red(a)) * q).roundToInt(),
            (Color.green(a) + (Color.green(b) - Color.green(a)) * q).roundToInt(),
            (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * q).roundToInt()
        )
    }

    private fun segColor(p: Float, b: Float): Int = when (colorScheme) {
        0 -> if (p < 0.6f) Color.rgb(60, 255, 95) else if (p < 0.85f) Color.rgb(255, 214, 40) else Color.rgb(255, 52, 42)
        1 -> if (p < 0.8f) lerp(Color.rgb(30, 120, 255), Color.rgb(60, 245, 255), p / 0.8f) else lerp(Color.rgb(60, 245, 255), Color.rgb(220, 255, 255), (p - 0.8f) / 0.2f)
        2 -> if (p < 0.7f) lerp(Color.rgb(150, 50, 255), Color.rgb(255, 50, 190), p / 0.7f) else lerp(Color.rgb(255, 50, 190), Color.rgb(255, 190, 240), (p - 0.7f) / 0.3f)
        3 -> if (p < 0.85f) lerp(Color.rgb(255, 120, 10), Color.rgb(255, 190, 60), p / 0.85f) else Color.rgb(255, 236, 170)
        else -> Color.HSVToColor(floatArrayOf((b * 300f + 340f) % 360f, if (p > 0.92f) 0.45f else 0.95f, 1f))
    }

    private fun scaled(c: Int, k: Float, add: Int): Int = Color.rgb(
        (Color.red(c) * k + add).roundToInt().coerceIn(0, 255),
        (Color.green(c) * k + add).roundToInt().coerceIn(0, 255),
        (Color.blue(c) * k + add).roundToInt().coerceIn(0, 255)
    )

    private fun lifted(c: Int, q: Float): Int = Color.rgb(
        (Color.red(c) + (255 - Color.red(c)) * q).roundToInt(),
        (Color.green(c) + (255 - Color.green(c)) * q).roundToInt(),
        (Color.blue(c) + (255 - Color.blue(c)) * q).roundToInt()
    )

    // leuchtende LED: Schein, gewölbte Linse, heller Kern, Glanzlicht
    private fun lit(col: Int): Bitmap = litSprites.getOrPut(col) {
        val bmp = Bitmap.createBitmap((segW + pad * 2).toInt() + 2, (segH + pad * 2).toInt() + 2, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val r = min(segW, segH) * 0.22f
        val rect = RectF(pad.toFloat(), pad.toFloat(), pad + segW, pad + segH)
        val glowP = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = col; alpha = 225
            maskFilter = BlurMaskFilter(max(1f, pad * 0.75f), BlurMaskFilter.Blur.NORMAL)
        }
        c.drawRoundRect(rect, r, r, glowP)
        val body = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, rect.top, 0f, rect.bottom, intArrayOf(lifted(col, 0.5f), col, scaled(col, 0.6f, 0)),
                floatArrayOf(0f, 0.45f, 1f), Shader.TileMode.CLAMP)
        }
        c.drawRoundRect(rect, r, r, body)
        val core = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(rect.centerX(), rect.top + segH * 0.55f, max(1f, max(segW, segH) * 0.6f),
                Color.argb(82, 255, 255, 255), Color.argb(0, 255, 255, 255), Shader.TileMode.CLAMP)
        }
        c.drawRoundRect(rect, r, r, core)
        val shine = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(140, 255, 255, 255) }
        c.drawRoundRect(RectF(rect.left + segW * 0.14f, rect.top + segH * 0.1f, rect.left + segW * 0.86f, rect.top + segH * 0.1f + max(1f, segH * 0.22f)), r * 0.5f, r * 0.5f, shine)
        bmp
    }

    // dunkle LED in ihrer Vertiefung
    private fun dark(col: Int): Bitmap = darkSprites.getOrPut(col) {
        val bmp = Bitmap.createBitmap((segW + pad * 2).toInt() + 2, (segH + pad * 2).toInt() + 2, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val r = min(segW, segH) * 0.22f
        val rim = max(1f, density * 0.9f)
        val rect = RectF(pad.toFloat(), pad.toFloat(), pad + segW, pad + segH)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.color = Color.rgb(2, 2, 2)
        c.drawRoundRect(RectF(rect.left - rim, rect.top - rim, rect.right + rim, rect.bottom + rim), r + rim, r + rim, p)
        p.color = Color.argb(18, 255, 255, 255)
        c.drawRect(rect.left + r, rect.bottom + rim * 0.4f, rect.right - r, rect.bottom + rim, p)
        p.shader = LinearGradient(0f, rect.top, 0f, rect.bottom, intArrayOf(scaled(col, 0.2f, 14), scaled(col, 0.11f, 5), scaled(col, 0.07f, 3)),
            floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP)
        c.drawRoundRect(rect, r, r, p)
        p.shader = null
        p.color = Color.argb(18, 255, 255, 255)
        c.drawRoundRect(RectF(rect.left + segW * 0.12f, rect.top + segH * 0.1f, rect.left + segW * 0.88f, rect.top + segH * 0.1f + max(1f, segH * 0.26f)), r * 0.5f, r * 0.5f, p)
        bmp
    }

    /** levels = Pegel je Band (0..1) aus Musik oder Mikrofon; null = Demo-Song. */
    fun frame(canvas: Canvas, dtIn: Float, levels: FloatArray?) {
        val dt = dtIn.coerceIn(0f, 0.05f)
        if (dirty || canvas.width != w || canvas.height != h) layout(canvas.width, canvas.height)
        val g = 0.55f + gain * 0.07f
        val testing = test >= 0f
        demo.step(dt, !testing && levels == null)
        if (testing) {
            test += dt
            val k = if (test < 0.6f) test / 0.6f else if (test < 0.9f) 1f else max(0f, 1f - (test - 0.9f) / 0.5f)
            for (i in 0 until nb) target[i] = k
            if (test > 1.5f) { test = -1f; demo.resync() }
        } else if (levels == null) {
            for (i in 0 until nb) {
                flut[i] += (Random.nextFloat() - flut[i]) * min(1f, dt * 20f)
                target[i] = (demo.level((i + 0.5f) / nb) * g * (0.88f + 0.24f * flut[i]) + demo.drop * (0.7f - 0.5f * i / nb)).coerceIn(0f, 1.02f)
            }
        } else {
            for (i in 0 until nb) {
                val v = if (levels.isEmpty()) 0f else levels[min(levels.size - 1, i * levels.size / nb)]
                target[i] = (v * (0.5f + gain * 0.1f) + demo.drop * (0.7f - 0.5f * i / nb)).coerceIn(0f, 1.02f)
            }
        }
        // Anzeige-Trägheit: steigt sofort, fällt gleichmäßig; Spitzen halten kurz
        for (i in 0 until nb) {
            disp[i] = if (target[i] > disp[i]) target[i] else max(target[i], disp[i] - dt * 1.7f)
            if (disp[i] >= peak[i]) { peak[i] = disp[i]; hold[i] = 0.7f }
            else if (hold[i] > 0f) hold[i] -= dt
            else peak[i] = max(0f, peak[i] - dt * 0.55f)
            litN[i] = floor(disp[i] * nseg + 0.25f).toInt()
            pkN[i] = if (peaks && !testing) min(nseg - 1, floor(peak[i] * nseg - 0.25f).toInt()) else -1
        }

        canvas.drawColor(Color.BLACK)
        val n = cellB.size
        paint.alpha = 255
        for (i in 0 until n) canvas.drawBitmap(dark(cellCol[i]), cellX[i] - pad, cellY[i] - pad, paint)
        // Nachleuchten: ausgehende LEDs verglimmen und flimmern dabei leicht
        val decay = exp(-dt / (0.03f + after * 0.045f))
        for (i in 0 until n) {
            val b = cellB[i]
            val s = cellS[i]
            val isPk = s == pkN[b] && pkN[b] >= litN[b]
            val on = s < litN[b] || isPk
            val v = if (on) (if (isPk) 0.85f else 1f) else glow[i] * decay
            glow[i] = v
            if (v < 0.015f) continue
            val a = if (on) v else v * (if (after > 0) 0.75f + 0.25f * Random.nextFloat() else 1f)
            addPaint.alpha = (a * 255f).roundToInt().coerceIn(0, 255)
            canvas.drawBitmap(lit(cellCol[i]), cellX[i] - pad, cellY[i] - pad, addPaint)
        }
        // Spiegelung auf glänzender Fläche unter den Balken
        if (floorY > 0f && mirror) {
            val reflH = min(h * 0.17f, h - floorY)
            if (reflH > 2f) {
                canvas.save()
                canvas.clipRect(0f, floorY, w.toFloat(), floorY + reflH)
                canvas.scale(1f, -1f, 0f, floorY)
                for (i in 0 until n) {
                    val d = floorY - (cellY[i] + segH / 2f)
                    if (d < 0f || d > reflH) continue
                    val q = 1f - d / reflH
                    val f = q * q * 0.28f
                    paint.alpha = (f * 150f).roundToInt().coerceIn(0, 255)
                    canvas.drawBitmap(dark(cellCol[i]), cellX[i] - pad, cellY[i] - pad, paint)
                    if (glow[i] > 0.015f) {
                        addPaint.alpha = (f * glow[i] * 255f).roundToInt().coerceIn(0, 255)
                        canvas.drawBitmap(lit(cellCol[i]), cellX[i] - pad, cellY[i] - pad, addPaint)
                    }
                }
                paint.alpha = 255
                canvas.restore()
            }
        }
        // Uhr obendrauf
        clock?.let { ck ->
            ck.update(canvas.width, canvas.height)
            ck.layer?.let { paint.alpha = 255; canvas.drawBitmap(it, ck.x, ck.y, paint) }
        }
    }
}
