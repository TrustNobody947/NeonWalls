package io.github.trustnobody947.neonwalls.glitch

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.Shader
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import java.util.Random
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.round
import kotlin.math.min
import kotlin.math.pow

/**
 * "Broken Screen": flackernde Farbstreifen wie bei einem kaputten Display,
 * mit Haarriss (plus Abzweig), an dem die Streifen gekappt und versetzt weiterlaufen.
 * Jedes Teilstück zwischen den Rissen flackert unabhängig.
 * Optional liegt die Schablonen-Uhr im Bild: Ein eigener Haarriss läuft durch die Ziffern, auch der große Riss versetzt
 * sie, die Teilstücke flackern einzeln, bei Glitch-Ausbrüchen zerfällt die Uhr kurz in Farbkanäle, verrutschte Streifen
 * und Farbblitze, und die Farbstreifen laufen über die Uhr.
 */
class GlitchRenderer(private val density: Float) {

    // Einstellungen (0..10, Anzahl 10..60)
    var calm = 4
    var burst = -1
    var shearAmt = 5
    var mutate = false   // Glitches verändern das Streifenmuster
    var clock: ClockFace? = null   // Uhr im Bild (null = aus)
    var clockCrack = 5             // Riss durch die Uhr 0..10
    private var count = 30
    private var seed = 0L

    private val rnd = Random()
    private fun r(a: Float, b: Float) = a + rnd.nextFloat() * (b - a)
    private fun chance(p: Float) = rnd.nextFloat() < p
    private fun pickCol(): Int = PAL[rnd.nextInt(PAL.size)]

    private var w = 1f
    private var h = 1f
    private var t = 0f
    private var dt = 0.016f
    private var calmF = 0.4f
    private var g = 0.25f   // Glitch-Stärke aus dem Regler (quadratisch)

    /** Wahrscheinlichkeit für "rate mal pro Sekunde", unabhängig von der Bildrate. */
    private fun p(rate: Float) = 1f - exp(-rate * dt)

    private val lines = ArrayList<Line>()

    // Glitch-Ausbrüche
    private var burstT = 0f
    private var nextBurst = 6f
    private var burstZone = ZONE_ALL
    private var burstPow = 1f

    // Hauptriss (leicht schräg über die ganze Breite) und Abzweig (steiler nach oben)
    private var sideLeft = true
    private var yOuter = 0.86f
    private var yInner = 0.77f
    private var f1 = 1f
    private var bx = 0.5f
    private var by = 0.8f
    private var ex = 0.7f
    private var ey = 0.5f
    private var bf = 1f
    private var ccY = 0.5f
    private var ccK = 0f
    private var ccF = 1f

    class Zone {
        var flash = 0f
        var col = 0
        var off = 0f
    }

    class Line(
        val x: Float, val tilt: Float, val w: Float, var col: Int,
        val base: Float, val phase: Float, val speed: Float, val dotted: Boolean
    ) {
        var flash = 0f
        var flashCol = 0
        var off = 0f
        var dim = 0f
        var dimF = 1f
        var fragY = -1f
        var fragT = 0f
        val mask = booleanArrayOf(true, true, true)
        val zones = arrayOf(Zone(), Zone(), Zone())
    }

    // ---------- Einstellungen / Muster ----------

    fun configure(calm: Int, burst: Int, count: Int, shear: Int, seed: Long) {
        this.calm = calm
        if (burst != this.burst || lines.isEmpty()) {
            // Regler geändert: nächsten Ausbruch neu planen, damit "seltener" sofort wirkt
            this.burst = burst
            burstT = 0f
            nextBurst = scheduleBurst(burst / 10f)
        }
        this.shearAmt = shear
        if (count != this.count || seed != this.seed || lines.isEmpty()) {
            this.count = count
            this.seed = seed
            build()
        }
    }

    private fun makeLine(pr: Random, x: Float): Line {
        fun p(a: Float, b: Float) = a + pr.nextFloat() * (b - a)
        val col = if (pr.nextFloat() < 0.5f) PAL[pr.nextInt(4)] else PAL[pr.nextInt(PAL.size)]
        return Line(
            x = x,
            tilt = if (pr.nextFloat() < 0.3f) p(-0.012f, 0.012f) else 0f,
            // ein Teil haarfein, die meisten dünn, wenige etwas breiter
            w = pr.nextFloat().let { q -> if (q < 0.3f) p(0.22f, 0.4f) else if (q < 0.87f) p(0.5f, 1.1f) else p(1.4f, 2.2f) },
            col = col,
            base = p(0.55f, 1f),
            phase = p(0f, 6.28f),
            speed = p(0.4f, 2.2f),
            dotted = pr.nextFloat() < 0.45f
        )
    }

    /** Neues Muster: Streifen und Risse aus dem gespeicherten Zufallswert. */
    private fun build() {
        val pr = Random(seed)
        buildLines(pr)
        buildCracks(pr)
    }

    /** Nur die Streifen neu (Risse bleiben). */
    private fun buildLines(pr: Random) {
        fun p(a: Float, b: Float) = a + pr.nextFloat() * (b - a)
        lines.clear()
        // Cluster wie bei echtem Displayschaden
        val nCl = 2 + pr.nextInt(3)
        val cc = FloatArray(nCl) { p(0.1f, 0.95f) }
        val cs = FloatArray(nCl) { p(0.03f, 0.12f) }
        repeat(count) {
            val x = if (pr.nextFloat() < 0.65f) {
                val k = pr.nextInt(nCl)
                cc[k] + (pr.nextFloat() - 0.5f) * 2f * cs[k]
            } else pr.nextFloat()
            lines.add(makeLine(pr, x.coerceIn(0.005f, 0.995f)))
        }
        // Doppellinien, Anzahl wächst mit
        repeat(Math.round(count * 0.12f)) {
            val l = lines[pr.nextInt(lines.size)]
            val n = makeLine(pr, (l.x + p(0.004f, 0.01f)).coerceAtMost(0.995f))
            n.col = PAL[pr.nextInt(PAL.size)]
            lines.add(n)
        }
    }

    private fun buildCracks(pr: Random) {
        fun p(a: Float, b: Float) = a + pr.nextFloat() * (b - a)
        sideLeft = pr.nextBoolean()
        yOuter = p(0.82f, 0.9f)
        yInner = p(0.74f, 0.8f)
        f1 = (if (pr.nextBoolean()) -1f else 1f) * p(0.8f, 1.2f)
        bx = p(0.3f, 0.7f)
        by = crackY(bx)
        ex = (bx + (if (pr.nextBoolean()) -1f else 1f) * p(0.18f, 0.32f)).coerceIn(0.02f, 0.98f)
        ey = by - p(0.22f, 0.38f)
        bf = (if (pr.nextBoolean()) -1f else 1f) * p(0.7f, 1.2f)
        // eigener Haarriss durch die Uhr (Lage relativ zur Uhr)
        ccY = p(0.3f, 0.7f)
        ccK = p(-0.16f, 0.16f)
        ccF = if (pr.nextBoolean()) -1f else 1f
    }

    private fun crackY(xn: Float) = yInner + (if (sideLeft) 1f - xn else xn) * (yOuter - yInner)

    // ---------- Glitch-Ausbrüche ----------

    fun triggerBurst() {
        burstT = if (chance(0.2f)) r(1.2f, 2.4f) else r(0.15f, 1.1f)
        burstPow = r(0.5f, 1.5f)
        val q = rnd.nextFloat()
        burstZone = when {
            q < 0.35f -> ZONE_ALL
            q < 0.65f -> ZONE_BOTTOM
            q < 0.85f -> ZONE_TOP
            else -> ZONE_MID
        }
    }

    /** Meist lange Pausen, ab und zu ein schneller Nachschlag. Regler links = sehr selten. */
    private fun scheduleBurst(bur: Float): Float {
        if (chance(0.18f * bur)) return r(0.3f, 1.6f)
        val p = if (chance(0.3f)) r(25f, 60f) else r(8f, 25f)
        return p * (0.5f + (1f - bur).pow(2) * 4f)
    }

    // ---------- Teilstücke an den Rissen ----------

    private val sx0 = FloatArray(3)
    private val sy0 = FloatArray(3)
    private val sx1 = FloatArray(3)
    private val sy1 = FloatArray(3)
    private var segN = 0
    private val cutY = FloatArray(2)
    private val cutD = FloatArray(2)

    private fun jit() = if (burstT > 0f && chance(0.3f)) r(0.6f, 1.8f) else 1f

    private fun addSeg(xa: Float, ya: Float, xb: Float, yb: Float) {
        if (segN >= 3) return
        sx0[segN] = xa; sy0[segN] = ya; sx1[segN] = xb; sy1[segN] = yb
        segN++
    }

    private fun computeSegs(l: Line, x: Float) {
        val xn = x / w
        val base = shearAmt * 1.2f * density
        var nc = 0
        if (base > 0f) {
            cutY[0] = crackY(xn) * h
            cutD[0] = f1 * base * jit()
            nc = 1
            val lo = min(bx, ex)
            val hi = max(bx, ex)
            if (xn > lo && xn < hi) {
                val k = (xn - bx) / (ex - bx)
                cutY[1] = (by + k * (ey - by)) * h
                cutD[1] = bf * base * jit()
                nc = 2
                if (cutY[1] < cutY[0]) {
                    val ty = cutY[0]; cutY[0] = cutY[1]; cutY[1] = ty
                    val td = cutD[0]; cutD[0] = cutD[1]; cutD[1] = td
                }
            }
        }
        segN = 0
        var cum = 0f
        var yStart = 0f
        for (i in 0 until nc) {
            val cy = cutY[i]
            if (cy >= h - 2f) continue
            addSeg(x + cum, yStart, x + cum, cy)
            cum += cutD[i]
            yStart = cy
        }
        addSeg(x + cum, yStart, x + cum, h)
        // leichte Schräglage
        for (i in 0 until segN) {
            sx0[i] += l.tilt * w * (sy0[i] / h - 0.5f)
            sx1[i] += l.tilt * w * (sy1[i] / h - 0.5f)
        }
        // senkrechte Streifen exakt aufs Pixelraster legen: gestochen scharf
        if (l.tilt == 0f) {
            for (i in 0 until segN) {
                sx0[i] = floor(sx0[i]) + 0.5f
                sx1[i] = floor(sx1[i]) + 0.5f
            }
        }
    }

    // ---------- Zeichnen ----------

    private val add = PorterDuffXfermode(PorterDuff.Mode.ADD)
    private fun strokePaint() = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.BUTT
        xfermode = add
    }
    private val pGlow = strokePaint()
    private val pMid = strokePaint()
    private val pCore = strokePaint()
    private val pDot = strokePaint().apply {
        pathEffect = DashPathEffect(floatArrayOf(1f * density, 1.5f * density), 0f)
    }

    private fun argb(a: Float, r: Int, g: Int, b: Int) =
        Color.argb((a.coerceIn(0f, 1f) * 255f).toInt(), r.coerceAtMost(255), g.coerceAtMost(255), b.coerceAtMost(255))

    private fun paintSeg(c: Canvas, l: Line, i: Int, a: Float, col: Int) {
        val r = Color.red(col)
        val g = Color.green(col)
        val b = Color.blue(col)
        val x0 = sx0[i]; val y0 = sy0[i]; val x1 = sx1[i]; val y1 = sy1[i]
        val lw = l.w * density
        // Glow
        pGlow.color = argb(a * 0.10f, r, g, b)
        pGlow.strokeWidth = max(lw * 2.5f, 1.5f)
        c.drawLine(x0, y0, x1, y1, pGlow)
        // heller, haarfeiner Mittelstrich
        pMid.color = argb(a * 0.55f, r + 120, g + 120, b + 120)
        pMid.strokeWidth = max(1f, lw * 0.35f)
        c.drawLine(x0, y0, x1, y1, pMid)
        // Kern
        pCore.color = argb(a, r, g, b)
        pCore.strokeWidth = max(1f, round(lw))   // ganze Pixel = scharf
        c.drawLine(x0, y0, x1, y1, pCore)
        // Pixelraster
        if (l.dotted) {
            pDot.color = argb(a * 0.35f, r + 80, g + 80, b + 80)
            pDot.strokeWidth = max(1f, lw * 0.5f)
            c.drawLine(x0, y0, x1, y1, pDot)
        }
    }

    private fun drawLine(c: Canvas, l: Line, x: Float, alpha: Float, col: Int, y0: Float, y1: Float) {
        computeSegs(l, x)
        val clip = y0 > 0f || y1 < h
        if (clip) {
            c.save()
            c.clipRect(0f, y0, w, y1)
        }
        val n = segN
        for (i in 0 until n) {
            val z = l.zones[i]
            // Gilt der aktuelle Ausbruch für dieses Teilstück?
            val sb = burstT > 0f && n > 1 && (burstZone == ZONE_ALL ||
                (burstZone == ZONE_TOP && i == 0) ||
                (burstZone == ZONE_BOTTOM && i == n - 1) ||
                (burstZone == ZONE_MID && n == 3 && i == 1))
            if (n > 1) {
                if (z.off > 0f) {
                    z.off -= dt
                    if (z.off > 0f) continue
                } else if (chance(if (sb) 0.035f * burstPow else p(0.05f * g))) {
                    z.off = r(0.05f, if (sb) 0.5f else 1.2f)
                    continue
                }
                if (z.flash > 0f) z.flash -= dt
                else if (chance(if (sb) 0.3f * burstPow else p(0.18f * g))) {
                    z.flash = r(0.03f, 0.18f)
                    z.col = if (chance(0.6f)) pickCol() else col
                }
            }
            var a = alpha
            var cc = col
            if (l.flash > 0f && l.mask[i]) {
                a = if (chance(0.5f)) r(1f, 1.6f) else r(0.05f, 0.3f)
                cc = l.flashCol
            } else if (n > 1 && z.flash > 0f) {
                a = if (chance(0.5f)) r(1f, 1.6f) else r(0.05f, 0.3f)
                cc = z.col
            }
            paintSeg(c, l, i, a.coerceIn(0f, 1f), cc)
        }
        if (clip) c.restore()
    }

    // ---------- Uhr in Teilstücken ----------

    private class ClockZone {
        var off = 0f
        var flash = 0f
        var col = 0
        var fl = 1f
        var flT = 0f
        var split = 0f
        var sx = 0f
        var slice = 0f
    }

    private val czones = Array(4) { ClockZone() }
    private val cY0 = FloatArray(2)
    private val cK = FloatArray(2)
    private val cDx = FloatArray(2)
    private val cDy = FloatArray(2)
    private val clipP = Path()
    private val clockPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val chPaint = arrayOf(Color.RED, Color.GREEN, Color.BLUE).map { col ->
        Paint(Paint.FILTER_BITMAP_FLAG).apply { colorFilter = PorterDuffColorFilter(col, PorterDuff.Mode.MULTIPLY); xfermode = add }
    }
    private val tintPaint = Paint(Paint.FILTER_BITMAP_FLAG).apply { xfermode = add }
    private val tintFilters = HashMap<Int, PorterDuffColorFilter>()
    private val srcR = Rect()
    private val dstR = Rect()
    private val crackDark = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; color = Color.argb(217, 0, 0, 0) }
    private val crackShine = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private var shineX0 = Float.NaN
    private var shineX1 = Float.NaN

    /** Halbebene unter (below) oder über der Geraden y = y0 + k*x. */
    private fun halfPlane(y0: Float, k: Float, below: Boolean) {
        val xa = -w
        val xb = 2f * w
        val far = if (below) 4f * h + 1e4f else -4f * h - 1e4f
        clipP.reset()
        clipP.moveTo(xa, y0 + k * xa); clipP.lineTo(xb, y0 + k * xb); clipP.lineTo(xb, far); clipP.lineTo(xa, far); clipP.close()
    }

    private fun inPiece(px: Float, py: Float, mask: Int, n: Int): Boolean {
        for (i in 0 until n) {
            val below = py > cY0[i] + cK[i] * px
            if (below != ((mask and (1 shl i)) != 0)) return false
        }
        return true
    }

    private fun drawClock(c: Canvas) {
        val ck = clock ?: return
        ck.update(c.width, c.height)
        val layer = ck.layer ?: return
        val lx = ck.x
        val ly = ck.y
        val lw = layer.width.toFloat()
        val lh = layer.height.toFloat()
        // Risse: eigener Haarriss durch die Uhr und der große Riss (als Gerade)
        var n = 0
        if (clockCrack > 0) {
            val k = ccK * lh / lw
            cY0[n] = ly + lh * ccY - k * (lx + lw / 2f); cK[n] = k
            cDx[n] = ccF * clockCrack * 0.9f * density * jit(); cDy[n] = clockCrack * 0.12f * density
            n++
        }
        if (shearAmt > 0) {
            val ya = crackY(0f) * h
            val yb = crackY(1f) * h
            cY0[n] = ya; cK[n] = (yb - ya) / w
            cDx[n] = f1 * shearAmt * 1.2f * density * jit(); cDy[n] = 0f
            n++
        }
        val all = (1 shl n) - 1
        for (mask in 0..all) {
            var ox = 0f
            var oy = 0f
            for (i in 0 until n) if ((mask and (1 shl i)) != 0) { ox += cDx[i]; oy += cDy[i] }
            // Liegt dieses Teilstück überhaupt im Bereich der Uhr?
            if (n > 0) {
                var any = false
                var yy = 0
                while (yy <= 8 && !any) {
                    var xx = 0
                    while (xx <= 8 && !any) { any = inPiece(lx + lw * xx / 8f, ly + lh * yy / 8f, mask, n); xx++ }
                    yy++
                }
                if (!any) continue
            }
            val z = czones[mask]
            val sb = burstT > 0f && (burstZone == ZONE_ALL || (burstZone == ZONE_TOP && mask == 0) ||
                (burstZone == ZONE_BOTTOM && mask == all) || (burstZone == ZONE_MID && mask > 0 && mask < all))
            if (z.off > 0f) {
                z.off -= dt
                if (z.off > 0f) continue
            } else if (chance(if (sb) 0.02f * burstPow else p(0.025f * g))) {
                z.off = r(0.04f, if (sb) 0.3f else 0.5f)
                continue
            }
            if (z.flash > 0f) z.flash -= dt
            else if (chance(if (sb) 0.18f * burstPow else p(0.08f * g))) { z.flash = r(0.03f, 0.15f); z.col = pickCol() }
            if (z.split > 0f) z.split -= dt
            else if (chance(if (sb) 0.12f * burstPow else p(0.04f * g))) { z.split = r(0.04f, 0.22f); z.sx = r(2f, 7f) * density * (if (chance(0.5f)) -1f else 1f) }
            if (z.slice > 0f) z.slice -= dt
            else if (sb && chance(0.05f * burstPow)) z.slice = r(0.05f, 0.2f)
            if (z.flT <= 0f) { z.flT = r(0.03f, 0.09f); z.fl = 1f - calmF * r(0f, 0.22f) } else z.flT -= dt
            c.save()
            for (i in 0 until n) { halfPlane(cY0[i], cK[i], (mask and (1 shl i)) != 0); c.clipPath(clipP) }
            val x = lx + ox
            val y = ly + oy
            val a = (z.fl * 255f).toInt().coerceIn(0, 255)
            if (z.split > 0f) {
                // Farbkanäle auseinander
                chPaint[0].alpha = a; c.drawBitmap(layer, x + z.sx, y, chPaint[0])
                chPaint[1].alpha = a; c.drawBitmap(layer, x, y, chPaint[1])
                chPaint[2].alpha = a; c.drawBitmap(layer, x - z.sx, y, chPaint[2])
            } else if (z.slice > 0f) {
                // waagerechte Streifen verrutschen
                val k = 3 + rnd.nextInt(4)
                clockPaint.alpha = a
                for (sI in 0 until k) {
                    val sy = (lh * sI / k).toInt()
                    val sh = kotlin.math.ceil(lh / k).toInt()
                    val dx = r(-1f, 1f) * 10f * density
                    srcR.set(0, sy, layer.width, min(layer.height, sy + sh))
                    dstR.set((x + dx).toInt(), (y + sy).toInt(), (x + dx + lw).toInt(), (y + sy + sh).toInt())
                    c.drawBitmap(layer, srcR, dstR, clockPaint)
                }
            } else {
                clockPaint.alpha = a
                c.drawBitmap(layer, x, y, clockPaint)
            }
            if (z.flash > 0f) {
                tintPaint.colorFilter = tintFilters.getOrPut(z.col) { PorterDuffColorFilter(z.col, PorterDuff.Mode.SRC_IN) }
                tintPaint.alpha = (0.75f * z.fl * 255f).toInt().coerceIn(0, 255)
                c.drawBitmap(layer, x, y, tintPaint)
            }
            c.restore()
        }
        // der Haarriss selbst: dunkle Bruchkante über den Ziffern, mit feinem Glanz
        if (clockCrack > 0 && n > 0) {
            val x0 = lx - lw * 0.08f
            val x1 = lx + lw * 1.08f
            crackDark.strokeWidth = max(1f, 1.6f * density)
            c.drawLine(x0, cY0[0] + cK[0] * x0, x1, cY0[0] + cK[0] * x1, crackDark)
            crackShine.strokeWidth = max(1f, 0.6f * density)
            if (x0 != shineX0 || x1 != shineX1) {
                shineX0 = x0; shineX1 = x1
                crackShine.shader = LinearGradient(x0, 0f, x1, 0f, intArrayOf(Color.argb(0, 255, 255, 255), Color.argb(56, 255, 255, 255), Color.argb(0, 255, 255, 255)),
                    null, Shader.TileMode.CLAMP)
            }
            c.drawLine(x0, cY0[0] + cK[0] * x0 - density, x1, cY0[0] + cK[0] * x1 - density, crackShine)
        }
    }

    /** Ein Bild zeichnen. dtSeconds = Zeit seit dem letzten Bild. */
    fun frame(c: Canvas, dtSeconds: Float) {
        w = c.width.toFloat().coerceAtLeast(1f)
        h = c.height.toFloat().coerceAtLeast(1f)
        dt = dtSeconds.coerceIn(0f, 0.05f)
        t += dt
        calmF = calm / 10f
        val bur = burst.coerceAtLeast(0) / 10f
        g = if (bur > 0f) 0.02f + 0.98f * bur.pow(1.6f) else 0f

        if (burstT > 0f) {
            burstT -= dt
            // Option: nach einem Ausbruch manchmal neue Streifen (Risse bleiben gleich)
            if (burstT <= 0f && mutate && chance(0.5f)) buildLines(Random(rnd.nextLong()))
        }
        else if (bur > 0f) {
            nextBurst -= dt
            if (nextBurst <= 0f) {
                triggerBurst()
                nextBurst = scheduleBurst(bur)
            }
        }
        val bursting = burstT > 0f && burstZone == ZONE_ALL

        c.drawColor(if (bursting && chance(0.3f)) Color.rgb(0, 15, 5) else Color.rgb(0, 7, 2))
        drawClock(c)

        for (l in lines) {
            // Ausfall / Wiederkehr
            if (l.off > 0f) {
                l.off -= dt
                if (l.off > 0f) continue
            } else if (chance(if (bursting) 0.02f else p(0.03f * g))) {
                l.off = r(0.05f, if (bursting) 0.4f else 1.5f)
                continue
            }
            // Glitch-Flash (Farbwechsel) – nur über den Glitch-Regler; nur manche Teilstücke machen mit
            if (l.flash > 0f) l.flash -= dt
            else if (chance(if (bursting) 0.25f * burstPow else p(0.12f * g))) {
                l.flash = r(0.03f, 0.15f)
                l.flashCol = if (chance(0.5f)) pickCol() else l.col
                for (k in 0..2) l.mask[k] = chance(0.55f)
                if (!l.mask[0] && !l.mask[1] && !l.mask[2]) l.mask[rnd.nextInt(3)] = true
            }
            if (bursting && mutate && chance(0.01f)) l.col = pickCol()

            // Grundflackern: jeder Streifen flimmert unabhängig in kleinen, schnellen Helligkeitsschritten
            // (kein Farbwechsel, keine Wellen, die durchs Bild laufen)
            if (l.dim <= 0f) {
                l.dim = r(0.03f, 0.09f)
                l.dimF = 1f - calmF * r(0f, 0.45f)
            } else l.dim -= dt
            val a = (l.base * l.dimF).coerceIn(0f, 1f)
            var x = l.x * w
            if (bursting && chance(0.15f)) x += r(-3f, 3f) * density

            // abgerissene Fragmente unten
            if (l.fragY < 0f && chance(if (bursting) 0.02f else p(0.02f * g))) {
                l.fragY = r(0.55f, 0.9f) * h
                l.fragT = r(0.3f, 3f)
            }
            if (l.fragY >= 0f) {
                l.fragT -= dt
                drawLine(c, l, x, a, l.col, l.fragY, h)
                if (chance(0.2f)) {
                    drawLine(c, l, x, a * 0.7f, l.col, l.fragY - r(10f, 60f) * density, l.fragY - r(2f, 8f) * density)
                }
                if (l.fragT <= 0f) l.fragY = -1f
            } else {
                drawLine(c, l, x, a, l.col, 0f, h)
            }
        }

        // während Ausbrüchen tauchen kurz neue Streifen auf
        if (bursting && chance(0.35f)) {
            val tmp = makeLine(rnd, rnd.nextFloat())
            drawLine(c, tmp, tmp.x * w, r(0.6f, 1f), tmp.col, if (chance(0.5f)) 0f else r(0.3f, 0.8f) * h, h)
        }
    }

    companion object {
        const val ZONE_ALL = 0
        const val ZONE_TOP = 1
        const val ZONE_MID = 2
        const val ZONE_BOTTOM = 3

        // Farben aus den vier Vorlagen
        val PAL = intArrayOf(
            Color.rgb(25, 230, 25),   // Neongrün
            Color.rgb(40, 210, 40),   // Grün
            Color.rgb(200, 20, 200),  // Magenta
            Color.rgb(170, 0, 170),   // Lila-Pink
            Color.rgb(255, 20, 20),   // Rot
            Color.rgb(45, 95, 255),   // Blau
            Color.rgb(20, 170, 230),  // Cyan
            Color.rgb(120, 40, 255),  // Violett
            Color.rgb(30, 190, 120),  // Türkisgrün
            Color.rgb(255, 0, 220)    // Pink
        )
    }
}
