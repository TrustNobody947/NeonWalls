package io.github.trustnobody947.neonwalls.glitch

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import java.util.Random
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.round

/**
 * "Broken Screen": flackernde Farbstreifen wie bei einem kaputten Display hinter echtem Glasbruch.
 * Die Risse ([Cracks]) laufen von einer Aufschlagstelle quer übers Bild und teilen das Display in Bruchstücke:
 * Die Streifen werden genau entlang der Risse ausgeschnitten, jedes Stück ist etwas versetzt und flackert für sich.
 * Die Risse selbst: dunkle Bruchkante mit weich schwankendem Glanz, am Aufschlag Splitter.
 * Optional liegt die Schablonen-Uhr im Bild: Ein Riss läuft durch die Ziffern, die Uhr zerfällt dort in versetzte
 * Stücke und glitcht nur dort, wo gerade auch die Streifen glitchen.
 * Gleiche Logik wie die Vorschau vorschau/quellen/effects/brokenscreen.js.
 */
class GlitchRenderer(private val density: Float) {

    // Einstellungen (0..10)
    var calm = 4
    var burst = -1
    var shearAmt = 5
    var mutate = false             // Glitches verändern das Streifenmuster
    var clock: ClockFace? = null   // Uhr im Bild (null = aus)
    var clockCrack = 5             // Riss durch die Uhr 0..10
    /** false = Uhr gerade ausgeblendet (z. B. nur auf dem Startbildschirm gewünscht und der Sperrbildschirm ist zu sehen). */
    var clockShown = true
    /** Vorschau: angetippte Aufschlagstelle in Pixeln, bis die Richtung angetippt ist (sonst null). */
    var marker: FloatArray? = null
    /** Wird bei jedem großen Glitch-Ausbruch über das ganze Bild aufgerufen (für „Risse wechseln bei Glitches“). */
    var onBigBurst: (() -> Unit)? = null

    private var count = 30
    private var seed = 0L

    // Risse
    private var crackN = 3
    private var splinter = 1
    private var crackSeed = 1L
    private var manual: FloatArray? = null
    private var clockKey = ""
    private var cracksDirty = true
    private var cs: CrackSet? = null
    private var crackBmp: Bitmap? = null
    private var builtW = 0
    private var builtH = 0
    private var clockLayerSeen: Bitmap? = null

    // Bruchstücke in Pixeln (ohne Risse: ein Stück = ganzer Bildschirm)
    private var nR = 1
    private var regPath: Array<Path?> = arrayOf(null)
    private var regPoly: Array<FloatArray?> = arrayOf(null)   // Umriss x0, y0, x1, y1, … (für die Schnittkanten der Streifen)
    private var regX0 = floatArrayOf(-1e6f)
    private var regX1 = floatArrayOf(1e6f)
    private var regY0 = floatArrayOf(0f)
    private var regY1 = floatArrayOf(1e6f)
    private var regS = floatArrayOf(0f)
    private var regZone = intArrayOf(ZONE_ALL)
    private var regClock = booleanArrayOf(false)
    private var regDx = floatArrayOf(0f)

    private val rnd = Random()
    private fun r(a: Float, b: Float) = a + rnd.nextFloat() * (b - a)
    private fun chance(p: Float) = rnd.nextFloat() < p
    private fun pickCol(): Int = PAL[rnd.nextInt(PAL.size)]

    private var w = 1f
    private var h = 1f
    private var t = 0f
    private var dt = 0.016f
    private var calmF = 0.4f
    private var g = 0.25f   // Glitch-Stärke aus dem Regler
    private var clockAlpha = 1f

    /** Wahrscheinlichkeit für "rate mal pro Sekunde", unabhängig von der Bildrate. */
    private fun p(rate: Float) = 1f - exp(-rate * dt)

    private val lines = ArrayList<Line>()

    // Glitch-Ausbrüche
    private var burstT = 0f
    private var nextBurst = 6f
    private var burstZone = ZONE_ALL
    private var burstPow = 1f

    /** Zustand eines Streifens in einem Bruchstück; drawn/a/c/x/fl* gelten für das aktuelle Bild. */
    class Zone {
        var flash = 0f
        var col = 0
        var off = 0f
        var bw = 0f
        var bdx = 0f
        var drawn = false
        var a = 0f
        var c = 0
        var x = 0f
        var fl = false
        var flCol = 0
        var flW = 0f
        var flDx = 0f
        // Abschnitte des Streifens innerhalb des Bruchstücks (y von, y bis, …), gilt für die Lage ivX
        var iv = FloatArray(4)
        var ivN = 0
        var ivX = Float.NaN
    }

    class Line(val x: Float, val tilt: Float, val w: Float, var col: Int, val base: Float, val dotted: Boolean) {
        var flash = 0f
        var flashCol = 0
        var bw = 0f
        var bdx = 0f
        var off = 0f
        var dim = 0f
        var dimF = 1f
        var fragOn = false
        var fragT = 0f
        var fragY = -1f
        var keep: BooleanArray? = null
        var mask = BooleanArray(1) { true }
        var zones = arrayOf(Zone())
        var vis = false
        var a = 0f
        var cx = 0f
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
            buildLines(Random(seed))
        }
    }

    /**
     * Risse einstellen. manual: selbst angetippt (Aufschlag x, y, Richtung x, y als Anteil von Breite und Höhe) oder null.
     * clockKey: Einstellungen der Uhr, von denen der Riss durch die Uhr abhängt.
     */
    fun configureCracks(n: Int, splinter: Int, seed: Long, manual: FloatArray?, clockKey: String) {
        val same = n == crackN && splinter == this.splinter && seed == crackSeed && clockKey == this.clockKey &&
            (manual?.contentEquals(this.manual) ?: (this.manual == null))
        if (same) return
        crackN = n
        this.splinter = splinter
        crackSeed = seed
        this.manual = manual
        this.clockKey = clockKey
        cracksDirty = true
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
            dotted = pr.nextFloat() < 0.45f
        )
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

    // ---------- Risse bauen und einmal in ein Bild zeichnen ----------

    private fun buildCracks() {
        cracksDirty = false
        builtW = w.toInt()
        builtH = h.toInt()
        val ck = clock
        val layer = ck?.layer
        val rect = if (ck != null && layer != null && clockCrack > 0)
            doubleArrayOf(ck.x / w.toDouble(), ck.y / w.toDouble(), (ck.x + layer.width) / w.toDouble(), (ck.y + layer.height) / w.toDouble())
        else null
        val set = Cracks.make(crackN, splinter, crackSeed, h / w.toDouble(), manual, rect)
        cs = set
        crackBmp?.recycle()
        crackBmp = null
        if (set == null) {
            nR = 1
            regPath = arrayOf(null)
            regPoly = arrayOf(null)
            regX0 = floatArrayOf(-1e6f); regX1 = floatArrayOf(1e6f)
            regY0 = floatArrayOf(0f); regY1 = floatArrayOf(1e6f)
            regS = floatArrayOf(0f); regZone = intArrayOf(ZONE_ALL)
            regClock = booleanArrayOf(false); regDx = floatArrayOf(0f)
        } else {
            val rs = set.regions
            nR = rs.size
            regPath = Array<Path?>(nR) { i ->
                val poly = rs[i].poly
                Path().apply {
                    moveTo((poly[0] * w).toFloat(), (poly[1] * w).toFloat())
                    var k = 2
                    while (k < poly.size) {
                        lineTo((poly[k] * w).toFloat(), (poly[k + 1] * w).toFloat())
                        k += 2
                    }
                    close()
                }
            }
            regPoly = Array<FloatArray?>(nR) { i ->
                val poly = rs[i].poly
                FloatArray(poly.size) { k -> (poly[k] * w).toFloat() }
            }
            regX0 = FloatArray(nR) { (rs[it].x0 * w).toFloat() }
            regX1 = FloatArray(nR) { (rs[it].x1 * w).toFloat() }
            regY0 = FloatArray(nR) { (rs[it].y0 * w).toFloat() }
            regY1 = FloatArray(nR) { (rs[it].y1 * w).toFloat() }
            regS = FloatArray(nR) { rs[it].s.toFloat() }
            regZone = IntArray(nR) { rs[it].zone }
            regClock = BooleanArray(nR)
            regDx = FloatArray(nR)
            crackBmp = renderCracks(set)
        }
        czones = Array(nR + 1) { ClockZone() }
        for (l in lines) {
            l.zones = Array(nR) { Zone() }
            l.mask = BooleanArray(nR) { true }
            l.keep = null
            l.fragOn = false
        }
        clockLayerSeen = null
    }

    /** Welche Bruchstücke liegen im Bereich der Uhr? (neu, wenn sich das Bild der Uhr ändert) */
    private fun updateClockPieces() {
        val ck = clock
        val layer = ck?.layer
        clockLayerSeen = layer
        val set = cs ?: return
        for (i in 0 until nR) {
            regClock[i] = false
            if (ck == null || layer == null) continue
            val reg = set.regions[i]
            var yy = 0
            while (yy <= 8 && !regClock[i]) {
                var xx = 0
                while (xx <= 8 && !regClock[i]) {
                    if (reg.contains((ck.x + layer.width * xx / 8f) / w.toDouble(), (ck.y + layer.height * yy / 8f) / w.toDouble())) regClock[i] = true
                    xx++
                }
                yy++
            }
        }
    }

    private fun renderCracks(set: CrackSet): Bitmap {
        val bw = max(1, w.toInt())
        val bh = max(1, h.toInt())
        val bmp = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val s = w.toDouble()
        val dark = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND; color = Color.BLACK
        }
        val shine = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
        }
        val path = Path()
        // am Aufschlag ist das Glas zertrümmert und fängt mehr Licht
        fun boost(x: Double, y: Double) = 1 + 1.3 * exp(-Math.hypot(x - set.px, y - set.py) / 0.05)

        // 1) dunkle Bruchkante: am Aufschlag breiter, zum Ende hin schmaler (in Stücken gezeichnet)
        for (cl in set.lines) {
            val n = cl.cl.size
            val total = max(1e-9, cl.cl[n - 1])
            var i0 = 0
            while (i0 < n - 1) {
                var i1 = i0 + 1
                while (i1 < n - 1 && cl.cl[i1] - cl.cl[i0] < 0.04) i1++
                val f = if (cl.kind == CrackSet.SPOKE) 1.35 - 0.6 * min(1.0, cl.cl[i0] / max(0.3, total)) else 1.0
                dark.strokeWidth = max(1f, (1.25 * density * cl.w * f).toFloat())
                path.reset()
                path.moveTo((cl.pts[2 * i0] * s).toFloat(), (cl.pts[2 * i0 + 1] * s).toFloat())
                for (k in i0 + 1..i1) path.lineTo((cl.pts[2 * k] * s).toFloat(), (cl.pts[2 * k + 1] * s).toFloat())
                c.drawPath(path, dark)
                i0 = i1
            }
        }
        // 2) Glanz: dünne helle Linie knapp neben der Kante, auf der Seite zum Licht. Gleiche Helligkeit wird zu einem
        //    Linienzug zusammengefasst (sonst überlappen sich die Stücke zu Perlen).
        fun shineLine(cl: CrackSet.Line, side: Int, amt: (Double) -> Double) {
            val o = density * (0.55 + 0.45 * cl.w) * side
            val ox = (cl.nx * o).toFloat()
            val oy = (cl.ny * o).toFloat()
            shine.strokeWidth = max(1f, (0.55 * density * (0.75 + 0.35 * cl.w)).toFloat())
            var cur = -1
            var open = false
            val n = cl.cl.size
            for (i in 1 until n) {
                val ax = cl.pts[2 * i - 2]; val ay = cl.pts[2 * i - 1]
                val bx = cl.pts[2 * i]; val by = cl.pts[2 * i + 1]
                val sm = (cl.cl[i - 1] + cl.cl[i]) / 2
                val v = amt(sm) * cl.base * cl.glint.at(sm) * boost((ax + bx) / 2, (ay + by) / 2)
                val lv = (v.coerceIn(0.0, 1.0) * 14).toInt()
                if (lv != cur) {
                    if (open) { c.drawPath(path, shine); open = false }
                    cur = lv
                    if (lv > 0) {
                        shine.color = Color.argb((lv / 14f * 0.7f * 255f).toInt(), 235, 242, 255)
                        path.reset()
                        path.moveTo((ax * s).toFloat() + ox, (ay * s).toFloat() + oy)
                        open = true
                    }
                }
                if (open) path.lineTo((bx * s).toFloat() + ox, (by * s).toFloat() + oy)
            }
            if (open) c.drawPath(path, shine)
        }
        for (cl in set.lines) {
            shineLine(cl, 1) { 1.0 }
            // breite Risse am Aufschlag: auch die andere Kante fängt etwas Licht
            if (cl.kind == CrackSet.SPOKE) shineLine(cl, -1) { sv -> 0.6 * max(0.0, 1 - sv / 0.18) }
        }
        // 3) kleine Glassplitter am Aufschlag
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = max(1f, 0.5f * density) }
        for (sh in set.shards) {
            path.reset()
            path.moveTo((sh.tri[0] * s).toFloat(), (sh.tri[1] * s).toFloat())
            path.lineTo((sh.tri[2] * s).toFloat(), (sh.tri[3] * s).toFloat())
            path.lineTo((sh.tri[4] * s).toFloat(), (sh.tri[5] * s).toFloat())
            path.close()
            fill.color = Color.argb((sh.fill * 255).toInt(), 220, 230, 245)
            c.drawPath(path, fill)
            edge.color = Color.argb((sh.edge * 255).toInt(), 240, 246, 255)
            c.drawPath(path, edge)
        }
        return bmp
    }

    // ---------- Glitch-Ausbrüche ----------

    /** Ausbruch auslösen (zone = −1: zufälliger Bereich). Gibt true zurück, wenn er das ganze Bild betrifft. */
    fun triggerBurst(zone: Int = -1): Boolean {
        burstT = if (chance(0.2f)) r(1.2f, 2.4f) else r(0.15f, 1.1f)
        burstPow = r(0.5f, 1.5f)
        val q = rnd.nextFloat()
        burstZone = if (zone >= 0) zone else when {
            q < 0.35f -> ZONE_ALL
            q < 0.65f -> ZONE_BOTTOM
            q < 0.85f -> ZONE_TOP
            else -> ZONE_MID
        }
        return burstZone == ZONE_ALL
    }

    /** Beim Einschalten bzw. Entsperren: kurzer Glitch über das ganze Bild. */
    fun wake() {
        triggerBurst(ZONE_ALL)
        burstT = r(0.25f, 0.6f)
    }

    /** Meist lange Pausen, ab und zu ein schneller Nachschlag. Regler links = sehr selten. */
    private fun scheduleBurst(bur: Float): Float {
        if (chance(0.18f * bur)) return r(0.3f, 1.6f)
        val p = if (chance(0.3f)) r(25f, 60f) else r(8f, 25f)
        return p * (0.5f + (1f - bur).pow(2) * 4f)
    }

    private fun jit() = if (burstT > 0f && chance(0.3f)) r(0.6f, 1.8f) else 1f

    // ---------- Streifen ----------

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

    /** Ein Streifen von y0 bis y1 an der Stelle x (bei y = Bildmitte), leicht schräg je nach Streifen. */
    private fun drawSeg(c: Canvas, l: Line, x: Float, y0: Float, y1: Float, a: Float, col: Int) {
        var xa = x + l.tilt * w * (y0 / h - 0.5f)
        var xb = x + l.tilt * w * (y1 / h - 0.5f)
        if (l.tilt == 0f) {
            // senkrechte Streifen exakt aufs Pixelraster legen: gestochen scharf
            xa = floor(x) + 0.5f
            xb = xa
        }
        val r = Color.red(col)
        val g = Color.green(col)
        val b = Color.blue(col)
        val lw = l.w * density
        // Glow
        pGlow.color = argb(a * 0.10f, r, g, b)
        pGlow.strokeWidth = max(lw * 2.5f, 1.5f)
        c.drawLine(xa, y0, xb, y1, pGlow)
        // heller, haarfeiner Mittelstrich
        pMid.color = argb(a * 0.55f, r + 120, g + 120, b + 120)
        pMid.strokeWidth = max(1f, lw * 0.35f)
        c.drawLine(xa, y0, xb, y1, pMid)
        // Kern
        pCore.color = argb(a, r, g, b)
        pCore.strokeWidth = max(1f, round(lw))   // ganze Pixel = scharf
        c.drawLine(xa, y0, xb, y1, pCore)
        // Pixelraster
        if (l.dotted) {
            pDot.color = argb(a * 0.35f, r + 80, g + 80, b + 80)
            pDot.strokeWidth = max(1f, lw * 0.5f)
            c.drawLine(xa, y0, xb, y1, pDot)
        }
    }

    /** Zustand aller Streifen für dieses Bild: Ausfälle, Farbblitze, Versatz je Bruchstück. */
    private fun stripeStates(bursting: Boolean) {
        val multi = nR > 1
        for (l in lines) {
            if (l.zones.size != nR) {
                l.zones = Array(nR) { Zone() }
                l.mask = BooleanArray(nR) { true }
                l.keep = null
                l.fragOn = false
            }
            l.vis = false
            // Ausfall / Wiederkehr
            if (l.off > 0f) {
                l.off -= dt
                if (l.off > 0f) continue
            } else if (chance(if (bursting) 0.02f else p(0.03f * g))) {
                l.off = r(0.05f, if (bursting) 0.4f else 1.5f)
                continue
            }
            // Glitch-Flash (Farbwechsel) – nur über den Glitch-Regler; nur manche Bruchstücke machen mit
            if (l.flash > 0f) l.flash -= dt
            else if (chance(if (bursting) 0.25f * burstPow else p(0.12f * g))) {
                l.flash = r(0.03f, 0.15f)
                l.flashCol = if (chance(0.5f)) pickCol() else l.col
                l.bw = r(4f, 16f) * density
                l.bdx = (if (chance(0.5f)) -1f else 1f) * r(1.5f, 5f) * density
                var any = false
                for (k in 0 until nR) { l.mask[k] = chance(0.55f); any = any || l.mask[k] }
                if (!any) l.mask[rnd.nextInt(nR)] = true
            }
            if (bursting && mutate && chance(0.01f)) l.col = pickCol()
            // Grundflackern: jeder Streifen flimmert unabhängig in kleinen, schnellen Helligkeitsschritten
            if (l.dim <= 0f) {
                l.dim = r(0.03f, 0.09f)
                l.dimF = 1f - calmF * r(0f, 0.45f)
            } else l.dim -= dt
            l.a = (l.base * l.dimF).coerceIn(0f, 1f)
            var x = l.x * w
            if (bursting && chance(0.15f)) x += r(-3f, 3f) * density
            l.cx = x
            // abgerissene Stücke: mit Rissen bleibt der Streifen nur in einzelnen Bruchstücken stehen (endet also genau
            // am Riss), ohne Risse nur unten ab einer zufälligen Höhe
            if (!l.fragOn && chance(if (bursting) 0.02f else p(0.02f * g))) {
                l.fragOn = true
                l.fragT = r(0.3f, 3f)
                l.fragY = r(0.55f, 0.9f) * h
                if (multi) {
                    val k = l.keep ?: BooleanArray(nR).also { l.keep = it }
                    var any = false
                    for (i in 0 until nR) { k[i] = chance(if (regZone[i] == ZONE_BOTTOM) 0.6f else 0.25f); any = any || k[i] }
                    if (!any) k[rnd.nextInt(nR)] = true
                } else l.keep = null
            }
            if (l.fragOn) {
                l.fragT -= dt
                if (l.fragT <= 0f) l.fragOn = false
            }
            l.vis = true
        }
        // je Bruchstück: Versatz, Ausfälle und Farbblitze der Teilstücke
        for (ri in 0 until nR) {
            val dx = round(regS[ri] * shearAmt * 1.2f * density * jit())
            regDx[ri] = dx
            val sb = burstT > 0f && multi && (burstZone == ZONE_ALL || burstZone == regZone[ri])
            val lo = regX0[ri] - 6f * density
            val hi = regX1[ri] + 6f * density
            for (l in lines) {
                val z = l.zones[ri]
                z.drawn = false
                z.fl = false
                if (!l.vis) continue
                val x = l.cx + dx
                if (x < lo || x > hi) continue
                val keep = l.keep
                if (l.fragOn && keep != null && !keep[ri]) continue
                if (multi) {
                    // zwischen den Rissen fällt ein Streifen ab und zu für eine Weile aus
                    if (z.off > 0f) {
                        z.off -= dt
                        if (z.off > 0f) continue
                    } else if (chance(if (sb) 0.035f * burstPow else p(0.05f * g))) {
                        z.off = r(0.15f, if (sb) 0.8f else 2.2f)
                        continue
                    }
                    if (z.flash > 0f) z.flash -= dt
                    else if (chance(if (sb) 0.3f * burstPow else p(0.18f * g))) {
                        z.flash = r(0.03f, 0.18f)
                        z.col = if (chance(0.6f)) pickCol() else l.col
                        z.bw = r(4f, 16f) * density
                        z.bdx = (if (chance(0.5f)) -1f else 1f) * r(1.5f, 5f) * density
                    }
                }
                var a = l.a
                var cc = l.col
                if (l.flash > 0f && l.mask[ri]) {
                    a = if (chance(0.5f)) r(1f, 1.6f) else r(0.05f, 0.3f)
                    cc = l.flashCol
                    z.fl = true; z.flCol = cc; z.flW = l.bw; z.flDx = l.bdx
                } else if (multi && z.flash > 0f) {
                    a = if (chance(0.5f)) r(1f, 1.6f) else r(0.05f, 0.3f)
                    cc = z.col
                    z.fl = true; z.flCol = cc; z.flW = z.bw; z.flDx = z.bdx
                }
                z.drawn = true
                z.a = a.coerceIn(0f, 1f)
                z.c = cc
                z.x = x
            }
        }
    }

    private var cross = FloatArray(16)

    /**
     * Wo liegt der Streifen (an der Stelle x, leicht schräg wie in [drawSeg]) innerhalb des Bruchstücks?
     * Schnittpunkte mit dem Umriss ausrechnen statt in jedem Bild auszuschneiden – sieht gleich aus, kostet aber fast nichts.
     */
    private fun stripeIntervals(z: Zone, l: Line, poly: FloatArray) {
        z.ivX = z.x
        val k = l.tilt * w / h
        val x0 = z.x - 0.5f * l.tilt * w   // Streifen: x(y) = x0 + k·y
        val m = poly.size / 2
        if (m < 3) { z.ivN = 0; return }
        var n = 0
        var py = poly[2 * m - 1]
        var pf = poly[2 * m - 2] - (x0 + k * py)
        for (i in 0 until m) {
            val qy = poly[2 * i + 1]
            val qf = poly[2 * i] - (x0 + k * qy)
            if ((pf >= 0f) != (qf >= 0f)) {
                if (n == cross.size) cross = cross.copyOf(n * 2)
                cross[n++] = py + (qy - py) * (pf / (pf - qf))
            }
            py = qy
            pf = qf
        }
        // sortieren (wenige Werte)
        for (i in 1 until n) {
            val v = cross[i]
            var j = i - 1
            while (j >= 0 && cross[j] > v) { cross[j + 1] = cross[j]; j-- }
            cross[j + 1] = v
        }
        n = n and 1.inv()
        if (z.iv.size < n) z.iv = FloatArray(n)
        System.arraycopy(cross, 0, z.iv, 0, n)
        z.ivN = n
    }

    /** Streifen zeichnen: in jedem Bruchstück nur bis genau an den Riss. */
    private fun drawStripes(c: Canvas, bursting: Boolean) {
        for (ri in 0 until nR) {
            val poly = regPoly[ri]
            for (l in lines) {
                val z = l.zones[ri]
                if (!z.drawn) continue
                if (poly != null) {
                    if (z.ivX != z.x) stripeIntervals(z, l, poly)
                    var k = 0
                    while (k + 1 < z.ivN) {
                        drawSeg(c, l, z.x, z.iv[k], z.iv[k + 1], z.a, z.c)
                        k += 2
                    }
                } else if (l.fragOn && l.keep == null) {
                    drawSeg(c, l, z.x, l.fragY, h, z.a, z.c)
                    if (chance(0.2f)) drawSeg(c, l, z.x, l.fragY - r(10f, 60f) * density, l.fragY - r(2f, 8f) * density, z.a * 0.7f, z.c)
                } else drawSeg(c, l, z.x, 0f, h, z.a, z.c)
            }
        }
        // während Ausbrüchen tauchen kurz neue Streifen auf
        if (bursting && chance(0.35f)) {
            val tmp = makeLine(rnd, rnd.nextFloat())
            drawSeg(c, tmp, tmp.x * w, if (chance(0.5f)) 0f else r(0.3f, 0.8f) * h, h, r(0.6f, 1f), tmp.col)
        }
    }

    // ---------- Uhr in Bruchstücken ----------

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

    private var czones = Array(2) { ClockZone() }
    private val clockPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val chPaint = arrayOf(Color.RED, Color.GREEN, Color.BLUE).map { col ->
        Paint(Paint.FILTER_BITMAP_FLAG).apply { colorFilter = PorterDuffColorFilter(col, PorterDuff.Mode.MULTIPLY); xfermode = add }
    }
    private val tintPaint = Paint(Paint.FILTER_BITMAP_FLAG).apply { xfermode = add }
    private val bandPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val blackPaint = Paint().apply { color = Color.BLACK }
    private val tintFilters = HashMap<Int, PorterDuffColorFilter>()
    private val srcR = Rect()
    private val dstR = Rect()

    private fun tint(col: Int) = tintFilters.getOrPut(col) { PorterDuffColorFilter(col, PorterDuff.Mode.SRC_IN) }

    private fun clockZoneOf(ck: ClockFace, lh: Int): Int {
        val c = (ck.y + lh / 2f) / h
        return if (c < 1f / 3f) ZONE_TOP else if (c > 2f / 3f) ZONE_BOTTOM else ZONE_MID
    }

    // Fertig ausgeschnittene Stücke der Uhr (versetzt wie im Bild), neu nur wenn sich Uhr, Risse oder Versatz ändern.
    // So muss nicht in jedem Bild entlang der Risse ausgeschnitten werden.
    private var pieceBmp: Array<Bitmap?> = arrayOf()
    private var pieceX = FloatArray(0)
    private var pieceY = FloatArray(0)
    private var pieceLayer: Bitmap? = null
    private var pieceSet: CrackSet? = null
    private var pieceK = -1

    private fun cutClockPieces(ck: ClockFace, layer: Bitmap) {
        if (layer === pieceLayer && cs === pieceSet && clockCrack == pieceK && pieceBmp.size == nR) return
        for (b in pieceBmp) b?.recycle()
        pieceLayer = layer
        pieceSet = cs
        pieceK = clockCrack
        pieceBmp = arrayOfNulls(nR)
        pieceX = FloatArray(nR)
        pieceY = FloatArray(nR)
        val k = clockCrack
        for (i in 0 until nR) {
            if (!regClock[i]) continue
            val path = regPath[i] ?: continue
            val lx = ck.x + round(regS[i] * k * 0.9f * density)
            val ly = ck.y + round(abs(regS[i]) * k * 0.12f * density)
            val bx0 = floor(max(regX0[i], lx)).toInt()
            val by0 = floor(max(regY0[i], ly)).toInt()
            val bx1 = kotlin.math.ceil(min(regX1[i], lx + layer.width)).toInt()
            val by1 = kotlin.math.ceil(min(regY1[i], ly + layer.height)).toInt()
            if (bx1 - bx0 < 1 || by1 - by0 < 1) continue
            try {
                val b = Bitmap.createBitmap(bx1 - bx0, by1 - by0, Bitmap.Config.ARGB_8888)
                val pc = Canvas(b)
                pc.translate(-bx0.toFloat(), -by0.toFloat())
                pc.clipPath(path)
                pc.drawBitmap(layer, lx, ly, null)
                pieceBmp[i] = b
                pieceX[i] = bx0.toFloat()
                pieceY[i] = by0.toFloat()
            } catch (e: Throwable) {
                // zu wenig Speicher: dieses Stück wird wie bisher beim Zeichnen ausgeschnitten
            }
        }
    }

    private fun drawClock(c: Canvas) {
        val ck = clock ?: return
        val layer = ck.layer ?: return
        if (clockAlpha <= 0.01f) return
        var pieces = 0
        if (cs != null && clockCrack > 0) for (i in 0 until nR) if (regClock[i]) pieces++
        if (pieces < 2) drawClockPiece(c, ck, layer, -1)
        else {
            cutClockPieces(ck, layer)
            for (i in 0 until nR) if (regClock[i]) drawClockPiece(c, ck, layer, i)
        }
    }

    /** Ein Stück der Uhr (ri = −1: die ganze Uhr). */
    private fun drawClockPiece(c: Canvas, ck: ClockFace, layer: Bitmap, ri: Int) {
        val lw = layer.width
        val lh = layer.height
        val z = czones[if (ri < 0) nR else ri]
        val zone = if (ri < 0) clockZoneOf(ck, lh) else regZone[ri]
        // Die Uhr glitcht als Ganzes nur bei einem Ausbruch in ihrem Bereich
        val sb = burstT > 0f && (burstZone == ZONE_ALL || burstZone == zone)
        if (z.off > 0f) {
            z.off -= dt
            if (z.off > 0f) return
        } else if (sb && chance(0.02f * burstPow)) {
            z.off = r(0.04f, 0.3f)
            return
        }
        if (z.flash > 0f) z.flash -= dt
        else if (sb && chance(0.18f * burstPow)) { z.flash = r(0.03f, 0.15f); z.col = pickCol() }
        if (z.split > 0f) z.split -= dt
        else if (sb && chance(0.12f * burstPow)) { z.split = r(0.04f, 0.22f); z.sx = r(2f, 7f) * density * (if (chance(0.5f)) -1f else 1f) }
        if (z.slice > 0f) z.slice -= dt
        else if (sb && chance(0.05f * burstPow)) z.slice = r(0.05f, 0.2f)
        if (z.flT <= 0f) { z.flT = r(0.03f, 0.09f); z.fl = 1f - calmF * r(0f, 0.22f) } else z.flT -= dt

        // Versatz des Stücks: zur Seite und etwas nach unten, Stärke nach „Riss durch die Uhr“
        val k = if (ri >= 0) clockCrack else 0
        val jx = if (ri >= 0) jit() else 1f
        val x = ck.x + (if (ri >= 0) round(regS[ri] * k * 0.9f * density * jx) else 0f)
        val y = ck.y + (if (ri >= 0) round(abs(regS[ri]) * k * 0.12f * density) else 0f)
        val a = (z.fl * clockAlpha * 255f).toInt().coerceIn(0, 255)
        // ruhiges Bild: das fertig ausgeschnittene Stück; nur bei Effekten wird beim Zeichnen ausgeschnitten
        val piece = if (ri >= 0 && jx == 1f && z.split <= 0f && z.slice <= 0f) pieceBmp.getOrNull(ri) else null
        val clipped = ri >= 0 && piece == null
        c.save()
        if (clipped) regPath[ri]?.let { c.clipPath(it) }
        if (piece != null) {
            clockPaint.alpha = a
            c.drawBitmap(piece, pieceX[ri], pieceY[ri], clockPaint)
        } else if (z.split > 0f) {
            // Farbkanäle auseinander
            chPaint[0].alpha = a; c.drawBitmap(layer, x + z.sx, y, chPaint[0])
            chPaint[1].alpha = a; c.drawBitmap(layer, x, y, chPaint[1])
            chPaint[2].alpha = a; c.drawBitmap(layer, x - z.sx, y, chPaint[2])
        } else if (z.slice > 0f) {
            // waagerechte Streifen verrutschen
            val n = 3 + rnd.nextInt(4)
            clockPaint.alpha = a
            for (sI in 0 until n) {
                val sy = (lh * sI / n)
                val sh = kotlin.math.ceil(lh / n.toFloat()).toInt()
                val dx = r(-1f, 1f) * 10f * density
                srcR.set(0, sy, lw, min(lh, sy + sh))
                dstR.set((x + dx).toInt(), (y + sy).toInt(), (x + dx + lw).toInt(), (y + sy + sh).toInt())
                c.drawBitmap(layer, srcR, dstR, clockPaint)
            }
        } else {
            clockPaint.alpha = a
            c.drawBitmap(layer, x, y, clockPaint)
        }
        if (z.flash > 0f) {
            tintPaint.colorFilter = tint(z.col)
            tintPaint.alpha = (0.75f * a).toInt()
            if (piece != null) c.drawBitmap(piece, pieceX[ri], pieceY[ri], tintPaint)
            else c.drawBitmap(layer, x, y, tintPaint)
        }
        // einzelne Streifen glitchen gerade: in ihrem Band verrutscht die Uhr und nimmt ihre Farbe an
        var nb = 0
        for (rj in 0 until nR) {
            if (ri >= 0) { if (rj != ri) continue } else if (cs != null && !regClock[rj]) continue
            for (l in lines) {
                val zz = l.zones[rj]
                if (!zz.drawn || !zz.fl) continue
                val half = zz.flW / 2f
                if (zz.x + half < x || zz.x - half > x + lw) continue
                if (++nb > 10) break
                c.save()
                c.clipRect(zz.x - half, y - 2f, zz.x + half, y + lh + 2f)
                // nur der schmale Streifen wird am Riss ausgeschnitten (billig)
                if (ri >= 0 && !clipped) regPath[ri]?.let { c.clipPath(it) }
                c.drawRect(zz.x - half, y, zz.x + half, y + lh, blackPaint)
                clockPaint.alpha = a
                c.drawBitmap(layer, x + zz.flDx, y, clockPaint)
                bandPaint.colorFilter = tint(zz.flCol)
                bandPaint.alpha = (0.55f * a).toInt()
                c.drawBitmap(layer, x + zz.flDx, y, bandPaint)
                c.restore()
            }
        }
        c.restore()
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
        } else if (bur > 0f) {
            nextBurst -= dt
            if (nextBurst <= 0f) {
                val all = triggerBurst()
                nextBurst = scheduleBurst(bur)
                if (all) onBigBurst?.invoke()
            }
        }
        val bursting = burstT > 0f && burstZone == ZONE_ALL

        // Uhr vorbereiten (ihre Lage braucht der Riss, der durch sie laufen soll)
        val ck = clock
        ck?.update(c.width, c.height)
        val target = if (clockShown) 1f else 0f
        clockAlpha += (target - clockAlpha) * (1f - exp(-dt * 8f))
        if (cracksDirty || builtW != w.toInt() || builtH != h.toInt()) buildCracks()
        if (ck?.layer !== clockLayerSeen) updateClockPieces()

        c.drawColor(if (bursting && chance(0.3f)) Color.rgb(0, 15, 5) else Color.rgb(0, 7, 2))
        stripeStates(bursting)
        drawClock(c)
        drawStripes(c, bursting)
        crackBmp?.let { c.drawBitmap(it, 0f, 0f, null) }
        // Vorschau: Markierung der angetippten Aufschlagstelle
        marker?.let { m ->
            markPaint.strokeWidth = 1.5f * density
            c.drawCircle(m[0], m[1], 10f * density, markPaint)
            c.drawCircle(m[0], m[1], 2f * density, markFill)
        }
    }

    private val markPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = Color.argb(217, 255, 255, 255) }
    private val markFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; color = Color.WHITE }

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
