package io.github.trustnobody947.neonwalls.glitch

import java.util.Random
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sign
import kotlin.math.sin

/**
 * Glasrisse wie in der Vorschau (vorschau/quellen/effects/brokenscreen.js).
 * Alles in Breiten-Einheiten: x von 0 bis 1, y von 0 bis a (= Höhe / Breite). Gleicher Zufallswert = gleiche Risse.
 *
 * Das Handy ist an bis zu drei Stellen aufgeschlagen (zufällig an Ecke, Kante oder mitten im Glas, oder selbst
 * angetippt). Von dort laufen die Hauptrisse (bis zu 36) sternförmig übers Bild, auf Wunsch laufen auch Risse waagerecht
 * quer über den Bildschirm. Die Risse entstehen nacheinander, jeder endet am Rand oder an einem schon vorhandenen Riss,
 * wie bei echtem Glas. Kommen Risse dazu („Mehr Risse mit der Zeit“), bleiben die vorhandenen genau, wie sie sind.
 * Mit Uhr läuft einer der Risse (zufällig welcher) durch die Ziffern.
 * An den großen Rissen hängen kleine, die zur Spitze hin auslaufen, dazu ein paar feine Haarrisse (nicht mitgezählt).
 * Die Risse teilen das Display in Bruchstücke ([CrackSet.Region], die Flächen dieses Netzes); jedes Stück kennt seine
 * Nachbarn.
 */
class CrackSet(
    /** Aufschlagstellen (x, y) */
    val imps: List<DoubleArray>,
    val a: Double,
    val regions: List<Region>,
    val lines: List<Line>,
    val shards: List<Shard>,
    /** Risse, die das Display teilen, in der Reihenfolge ihres Entstehens: Punkte x, y, … (zum Aufblitzen neuer Risse) */
    val divs: List<DoubleArray>
) {
    /** Bruchstück. poly: Umriss x0, y0, x1, y1, … (kann nach innen gezackt sein) */
    class Region(
        val poly: DoubleArray, val area: Double, val x0: Double, val x1: Double, val y0: Double, val y1: Double,
        val cx: Double, val cy: Double, val zone: Int
    ) {
        /** Versatz-Richtung und -Stärke (−1,2 … 1,2; 0 = bleibt stehen). */
        var s = 0.0
        /** liegt im Bereich der Uhr */
        var clock = false
        /** Nachbarn: Stücke, die sich eine Risskante mit diesem teilen */
        var nb = IntArray(0)

        fun contains(x: Double, y: Double): Boolean {
            var inside = false
            val n = poly.size / 2
            var j = n - 1
            for (i in 0 until n) {
                val ax = poly[2 * i]; val ay = poly[2 * i + 1]; val bx = poly[2 * j]; val by = poly[2 * j + 1]
                if ((ay > y) != (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
                j = i
            }
            return inside
        }
    }

    /** Ein Riss zum Zeichnen: Punkte (x, y abwechselnd), Länge bis zu jedem Punkt, Breite, Art, Glanz. */
    class Line(val pts: DoubleArray, val cl: DoubleArray, val w: Double, val kind: Int, val base: Double, val glint: Glint, val nx: Double, val ny: Double)

    class Shard(val tri: DoubleArray, val fill: Double, val edge: Double)

    /** Weich schwankender Glanz entlang des Risses (mal fängt die Bruchkante Licht, mal nicht), mit Lichtpunkten. */
    class Glint(rnd: Random) {
        private val f = doubleArrayOf(8 + rnd.nextDouble() * 6, 19 + rnd.nextDouble() * 14, 43 + rnd.nextDouble() * 25)
        private val p = doubleArrayOf(rnd.nextDouble() * 6.3, rnd.nextDouble() * 6.3, rnd.nextDouble() * 6.3)
        private val peaks: Array<DoubleArray> = Array(1 + rnd.nextInt(3)) {
            doubleArrayOf(rnd.nextDouble() * 1.6, 0.012 + rnd.nextDouble() * 0.03, 0.4 + rnd.nextDouble() * 0.5)
        }

        fun at(s: Double): Double {
            var v = 0.5 + 0.26 * sin(s * f[0] + p[0]) + 0.15 * sin(s * f[1] + p[1]) + 0.09 * sin(s * f[2] + p[2])
            for (q in peaks) {
                val d = (s - q[0]) / q[1]
                v += q[2] * exp(-d * d)
            }
            return v.coerceIn(0.0, 1.4)
        }
    }

    companion object {
        const val SPOKE = 0
        const val BRANCH = 1
        const val WEB = 2
        /** Riss, der waagerecht quer übers Bild läuft */
        const val HORIZ = 3
        /** kleiner Riss, der an einem großen hängt (läuft zur Spitze hin aus) */
        const val TWIG = 4
        /** feiner Haarriss (nicht mitgezählt, teilt nichts) */
        const val HAIR = 5
    }
}

object Cracks {
    /** Höchstzahl der Hauptrisse */
    const val MAX = 36

    /** Wie stark zufällige Risse quer statt steil laufen (0 = gleich verteilt). */
    private const val QUER = 0.55

    // Arten der Risse, die das Display teilen
    private const val D_STUB = 0    // vom Aufschlag bis an den nahen Rand
    private const val D_SPOKE = 1   // vom Aufschlag übers Bild
    private const val D_BACK = 2    // Aufschlag mitten im Glas: nach hinten durchgerissen
    private const val D_H = 3       // waagerecht quer übers Bild
    private const val D_C = 4       // durch die Uhr (von einem Riss oder vom Rand aus, wenn sonst keiner hinkommt)

    private class Pt(@JvmField val x: Double, @JvmField val y: Double)

    /** Treffer auf einem Riss: Anteil der Strecke, Nummer des Risses, Stelle darin (Stück + Anteil), Punkt */
    private class Hit(val u: Double, val ci: Int, val pos: Double, val x: Double, val y: Double)
    private class Grown(val pts: ArrayList<Pt>, val hit: Hit?)
    private class Split(val pos: Double, val node: Int)

    /**
     * Linienzug mit umgebendem Rechteck und Rechtecken je [CHUNK] Stücke (für schnelle Schnitt-Tests; bei vielen Rissen
     * viel schneller, das Ergebnis bleibt genau gleich).
     */
    private open class PL(val pts: List<Pt>) {
        val bx0: Double
        val by0: Double
        val bx1: Double
        val by1: Double
        /** je Abschnitt: x0, y0, x1, y1 und erstes/letztes Stück (i0, i1 als Double) */
        val chunks: DoubleArray

        init {
            var x0 = 1e9; var y0 = 1e9; var x1 = -1e9; var y1 = -1e9
            for (p in pts) {
                if (p.x < x0) x0 = p.x
                if (p.x > x1) x1 = p.x
                if (p.y < y0) y0 = p.y
                if (p.y > y1) y1 = p.y
            }
            bx0 = x0; by0 = y0; bx1 = x1; by1 = y1
            val n = if (pts.size > 1) (pts.size - 2) / CHUNK + 1 else 0
            chunks = DoubleArray(n * 6)
            for (c in 0 until n) {
                val i0 = 1 + c * CHUNK
                val i1 = min(pts.size - 1, i0 + CHUNK - 1)
                var cx0 = 1e9; var cy0 = 1e9; var cx1 = -1e9; var cy1 = -1e9
                for (k in i0 - 1..i1) {
                    val p = pts[k]
                    if (p.x < cx0) cx0 = p.x
                    if (p.x > cx1) cx1 = p.x
                    if (p.y < cy0) cy0 = p.y
                    if (p.y > cy1) cy1 = p.y
                }
                chunks[6 * c] = cx0; chunks[6 * c + 1] = cy0; chunks[6 * c + 2] = cx1; chunks[6 * c + 3] = cy1
                chunks[6 * c + 4] = i0.toDouble(); chunks[6 * c + 5] = i1.toDouble()
            }
        }
    }

    private const val CHUNK = 16

    /**
     * Der eigene Aufschlag eines Risses: Lage und Knoten (dicht daran zählen nur die dort losgehenden Risse nicht).
     * host: geht der Riss von einem anderen ab, zählt dieser dicht am Startpunkt auch nicht.
     */
    private class Ign(@JvmField val x: Double, @JvmField val y: Double, @JvmField val node: Int, @JvmField val host: PL? = null)

    private class Div(pts: List<Pt>, val n0: Int, val n1: Int, val kind: Int, val imp: Int, val dir: Double) : PL(pts) {
        val splits = ArrayList<Split>()
    }

    /** Aufschlag: Lage, Stelle am Rand, bis zu der es durchreißt (sx, sy oder NaN), Fächer a0..a1, Hauptrichtung md */
    private class Imp(
        var px: Double, var py: Double, val sx: Double, val sy: Double, val a0: Double, val a1: Double,
        val md: Double, val back: Boolean, val aim: Pt?, val manual: Boolean, val k: Int
    ) {
        val full = a1 - a0 >= 2 * PI - 1e-6
        val chosen = ArrayList<Double>()
        var backDir = Double.NaN
        var backDone = false
        var started = false
        var node = -1
        val hasStub get() = !sx.isNaN()
    }

    private fun angDiff(a: Double, b: Double): Double {
        var d = a - b
        while (d > PI) d -= 2 * PI
        while (d < -PI) d += 2 * PI
        return d
    }

    private fun polyLen(p: List<Pt>): Double {
        var l = 0.0
        for (i in 1 until p.size) l += hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
        return l
    }

    /** Abstand des Punkts (x, y) zur Strecke p→q */
    private fun segDist(x: Double, y: Double, p: Pt, q: Pt): Double {
        val vx = q.x - p.x
        val vy = q.y - p.y
        val l2 = vx * vx + vy * vy
        val u = if (l2 > 0) (((x - p.x) * vx + (y - p.y) * vy) / l2).coerceIn(0.0, 1.0) else 0.0
        return hypot(x - p.x - vx * u, y - p.y - vy * u)
    }

    /** Punkt in der Entfernung d entlang des Risses, mit Richtung. */
    private fun pointAtLen(p: List<Pt>, d0: Double): DoubleArray {
        var d = d0
        for (i in 1 until p.size) {
            val a = p[i - 1]; val b = p[i]
            val l = hypot(b.x - a.x, b.y - a.y)
            if (d <= l || i == p.size - 1) {
                val f = if (l > 0) min(1.0, d / l) else 0.0
                return doubleArrayOf(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, atan2(b.y - a.y, b.x - a.x))
            }
            d -= l
        }
        return doubleArrayOf(p[0].x, p[0].y, 0.0)
    }

    /**
     * Erster Schnitt der Strecke a→b mit einem der Risse in stop. ign: der eigene Aufschlag – dicht an ihm zählen nur die
     * Risse nicht, die dort selbst losgehen; jeder andere Riss, der dort vorbeiläuft, zählt. endPt: genau dieser Punkt
     * zählt nicht (das gewollte Ende am Riss).
     */
    private fun hitAny(ax: Double, ay: Double, bx: Double, by: Double, stop: List<PL>, ign: Ign?, endPt: Pt?): Hit? {
        var best = 2.0
        var bh: Hit? = null
        val mx0 = min(ax, bx); val mx1 = max(ax, bx); val my0 = min(ay, by); val my1 = max(ay, by)
        val rX = bx - ax; val rY = by - ay
        for (ci in stop.indices) {
            val s = stop[ci]
            if (s.bx0 > mx1 + 1e-9 || s.bx1 < mx0 - 1e-9 || s.by0 > my1 + 1e-9 || s.by1 < my0 - 1e-9) continue
            val sp = s.pts
            val ch = s.chunks
            // geht dieser Riss am eigenen Aufschlag los (oder geht der neue Riss von ihm ab), zählen Treffer dicht am
            // Startpunkt nicht
            val own = if (ign != null && ((s is Div && s.n0 == ign.node) || s === ign.host)) ign else null
            var c = 0
            while (c < ch.size) {
                if (ch[c] > mx1 + 1e-9 || ch[c + 2] < mx0 - 1e-9 || ch[c + 1] > my1 + 1e-9 || ch[c + 3] < my0 - 1e-9) { c += 6; continue }
                val i1 = ch[c + 5].toInt()
                for (i in ch[c + 4].toInt()..i1) {
                    val qx = sp[i - 1].x; val qy = sp[i - 1].y
                    val sX = sp[i].x - qx; val sY = sp[i].y - qy
                    val den = rX * sY - rY * sX
                    if (abs(den) < 1e-12) continue
                    val u = ((qx - ax) * sY - (qy - ay) * sX) / den
                    val v = ((qx - ax) * rY - (qy - ay) * rX) / den
                    if (!(u > 1e-9 && u <= 1 && v >= 0 && v <= 1) || u >= best) continue
                    val hx = ax + rX * u; val hy = ay + rY * u
                    if (own != null && hypot(hx - own.x, hy - own.y) < 0.006) continue
                    if (endPt != null && hypot(hx - endPt.x, hy - endPt.y) < 1e-7) continue
                    best = u
                    bh = Hit(u, ci, i - 1 + v, hx, hy)
                }
                c += 6
            }
        }
        return bh
    }

    /**
     * Riss wachsen lassen: kurze, fast gerade Stücke mit kleinen Knicken, die Grundrichtung wandert langsam.
     * Endet am Bildrand, nach maxLen (0 = ohne) oder an einem Riss in stop. aim: Punkt, durch den er laufen soll.
     */
    private fun grow(R: () -> Double, a: Double, x0: Double, y0: Double, dir0: Double, maxLen: Double, aim: Pt?, stop: List<PL>?, ign: Ign?): Grown {
        val pts = ArrayList<Pt>()
        pts.add(Pt(x0, y0))
        var x = x0; var y = y0; var dir = dir0; var base = dir0; var len = 0.0
        var aiming = aim != null
        var lastD = 1e9
        var hit: Hit? = null
        for (guard in 0 until 400) {
            val l = 0.015 + R() * 0.045
            base += (R() - 0.5) * 0.05
            val wob = (R() - 0.5) * 0.15
            if (guard > 0) dir += wob + angDiff(base, dir) * 0.35
            if (aiming && aim != null) {
                val dA = hypot(aim.x - x, aim.y - y)
                if (dA < 0.035 || dA > lastD) {
                    aiming = false
                    base = dir
                } else {
                    dir += angDiff(atan2(aim.y - y, aim.x - x), dir) * 0.75
                    base = dir
                }
                lastD = dA
            }
            var nx = x + cos(dir) * l
            var ny = y + sin(dir) * l
            var end = false
            var k = 1.0
            var side = -1
            if (nx < 0) { val q = -x / (nx - x); if (q < k) { k = q; side = 0 } }
            if (nx > 1) { val q = (1 - x) / (nx - x); if (q < k) { k = q; side = 1 } }
            if (ny < 0) { val q = -y / (ny - y); if (q < k) { k = q; side = 2 } }
            if (ny > a) { val q = (a - y) / (ny - y); if (q < k) { k = q; side = 3 } }
            if (side >= 0) {
                nx = x + (nx - x) * k
                ny = y + (ny - y) * k
                end = true
                when (side) {
                    0 -> nx = 0.0
                    1 -> nx = 1.0
                    2 -> ny = 0.0
                    else -> ny = a
                }
            }
            if (stop != null) {
                val bh = hitAny(x, y, nx, ny, stop, ign, null)
                if (bh != null) {
                    nx = bh.x
                    ny = bh.y
                    end = true
                    hit = bh
                }
            }
            val sl = hypot(nx - x, ny - y)
            if (maxLen > 0 && sl > 0 && len + sl >= maxLen) {
                val f = (maxLen - len) / sl
                if (f < 1 - 1e-9) hit = null
                nx = x + (nx - x) * f
                ny = y + (ny - y) * f
                end = true
            }
            len += hypot(nx - x, ny - y)
            pts.add(Pt(nx, ny))
            x = nx; y = ny
            if (end) break
        }
        return Grown(pts, hit)
    }

    /** Läuft ein Riss nicht bis zum Rand (sehr selten), gerade weiter bis zum Rand verlängern. */
    private fun toEdge(p: ArrayList<Pt>, a: Double): ArrayList<Pt> {
        val e = p[p.size - 1]
        if (e.x <= 1e-9 || e.x >= 1 - 1e-9 || e.y <= 1e-9 || e.y >= a - 1e-9 || p.size < 2) return p
        val d = p[p.size - 2]
        val dir = atan2(e.y - d.y, e.x - d.x)
        val cx = cos(dir); val cy = sin(dir)
        var t = 1e9
        if (cx < -1e-9) t = min(t, -e.x / cx)
        if (cx > 1e-9) t = min(t, (1 - e.x) / cx)
        if (cy < -1e-9) t = min(t, -e.y / cy)
        if (cy > 1e-9) t = min(t, (a - e.y) / cy)
        var nx = (e.x + cx * t).coerceIn(0.0, 1.0)
        var ny = (e.y + cy * t).coerceIn(0.0, a)
        // genau auf den Rand legen
        val dl = nx; val dr = 1 - nx; val dt = ny; val db = a - ny
        val m = min(min(dl, dr), min(dt, db))
        when (m) {
            dl -> nx = 0.0
            dr -> nx = 1.0
            dt -> ny = 0.0
            else -> ny = a
        }
        val out = ArrayList(p)
        out.add(Pt(nx, ny))
        return out
    }

    /**
     * Feine Zacken wie bei echtem Glasbruch (klein, weich zusammenhängend, quer zur Richtung; die Enden bleiben genau). Am
     * Anfang und am Ende laufen die Zacken weich aus (t0, t1: Länge), damit sich Risse am selben Punkt nicht kreuzen.
     * Mit a > 0 bleiben die Zacken im Bild (ein Riss, der flach auf den Rand zuläuft, darf ihn nicht vorher kreuzen).
     * s0: so lang bleibt der Anfang ganz gerade (Risse aus demselben Aufschlag kreuzen sich dort sonst leicht).
     */
    private fun refine(R: () -> Double, p: List<Pt>, amp: Double, t0: Double, t1: Double, a: Double, s0: Double = 0.0): ArrayList<Pt> {
        val total = polyLen(p)
        val out = ArrayList<Pt>(p.size * 8)
        out.add(p[0])
        var j = 0.0
        var acc = 0.0
        for (i in 1 until p.size) {
            val pa = p[i - 1]; val pb = p[i]
            val dx = pb.x - pa.x; val dy = pb.y - pa.y
            val l = hypot(dx, dy)
            if (l < 1e-12) continue
            val n = max(1, (l / 0.007).roundToInt())
            for (k in 1 until n) {
                val f = k.toDouble() / n
                j = j * 0.78 + (R() - 0.5) * 1.1 * amp
                if (R() < 0.02) j += (R() - 0.5) * 3 * amp   // selten ein kleiner Sprung
                val s = acc + l * f
                var tp = 1.0
                if (t0 > 0) tp = min(tp, (s - s0) / t0)
                if (t1 > 0) tp = min(tp, (total - s) / t1)
                val jj = j * tp.coerceIn(0.0, 1.0)
                var px = pa.x + dx * f - dy / l * jj
                var py = pa.y + dy * f + dx / l * jj
                if (a > 0 && (px < 1e-5 || px > 1 - 1e-5 || py < 1e-5 || py > a - 1e-5)) {
                    px = pa.x + dx * f
                    py = pa.y + dy * f
                    j = 0.0
                }
                out.add(Pt(px, py))
            }
            out.add(pb)
            acc += l
            j *= 0.3
        }
        return out
    }

    /** Zahl 0..1 aus einer Stelle (gleiche Stelle = gleiche Zahl): Versatz eines Bruchstücks bleibt, wenn Risse dazukommen */
    private fun hash01(x: Double, y: Double, s: Double): Double {
        val v = sin(x * 127.1 + y * 311.7 + s * 0.000123) * 43758.5453
        return v - floor(v)
    }

    /** Aufschläge: zufällig gut verteilt (Ecke, Kante oder mitten im Glas, in verschiedenen Höhen) oder selbst angetippt. */
    private fun makeImpacts(R: () -> Double, a: Double, n: Int, manual: Array<FloatArray?>): ArrayList<Imp> {
        fun r(x: Double, y: Double) = x + R() * (y - x)
        val imps = ArrayList<Imp>()
        val bands = intArrayOf(0, 1, 2)
        for (i in 2 downTo 1) {
            val j = floor(R() * (i + 1)).toInt()
            val t = bands[i]; bands[i] = bands[j]; bands[j] = t
        }
        for (k in 0 until n) {
            val m = manual.getOrNull(k)
            var imp: Imp? = null
            if (m != null && m.size >= 4) {
                // selbst angetippt: Aufschlag und Richtung vom Nutzer, der genaue Verlauf bleibt dem Zufall überlassen
                val px = m[0].toDouble().coerceIn(0.012, 0.988)
                val py = m[1].toDouble().coerceIn(0.006, 0.994) * a
                val tx = m[2].toDouble()
                val ty = m[3].toDouble() * a
                val far = hypot(tx - px, ty - py) > 0.03
                var md = if (far) atan2(ty - py, tx - px) else R() * 2 * PI
                var a0: Double; var a1: Double
                var sx = Double.NaN; var sy = Double.NaN
                var back = false
                val ed = doubleArrayOf(px, 1 - px, py, a - py)
                var e = 0
                for (i in 1..3) if (ed[i] < ed[e]) e = i
                if (ed[e] < 0.07) {
                    // nah am Rand: von dort reißt es bis zum Rand durch, die Risse laufen nur ins Bild hinein
                    when (e) {
                        0 -> { sx = 0.0; sy = py; a0 = -PI / 2; a1 = PI / 2 }
                        1 -> { sx = 1.0; sy = py; a0 = PI / 2; a1 = 1.5 * PI }
                        2 -> { sx = px; sy = 0.0; a0 = 0.0; a1 = PI }
                        else -> { sx = px; sy = a; a0 = PI; a1 = 2 * PI }
                    }
                    a0 += 0.17; a1 -= 0.17
                    val mid = (a0 + a1) / 2
                    md = (mid + angDiff(md, mid)).coerceIn(a0, a1)
                } else {
                    a0 = md - PI; a1 = md + PI; back = true
                }
                imp = Imp(px, py, sx, sy, a0, a1, md, back, if (far) Pt(tx, ty) else null, true, k)
            } else {
                // zufällig, gut verteilt: Ecke, Kante oder mitten im Glas; mehrere Aufschläge in verschiedenen Höhen
                for (tr in 0 until 24) {
                    val band = if (n == 1) (if (R() < 0.6) 2 else floor(R() * 2).toInt()) else bands[k]
                    val ty = R()
                    val ins = r(0.025, 0.05)
                    val y = (band + r(0.1, 0.9)) / 3 * a
                    var px: Double; var py: Double
                    var sx = Double.NaN; var sy = Double.NaN
                    var a0: Double; var a1: Double
                    var full = false
                    if (ty < 0.3) {
                        // Ecke: oben oder unten passend zum Drittel, in der Mitte egal
                        val bottom = if (band == 2) true else if (band == 0) false else R() < 0.5
                        val left = R() < 0.5
                        px = if (left) ins else 1 - ins
                        py = if (bottom) a - ins else ins
                        sx = if (left) 0.0 else 1.0
                        sy = if (bottom) a else 0.0
                        if (left && bottom) { a0 = -PI / 2; a1 = 0.0 }
                        else if (!left && bottom) { a0 = PI; a1 = 1.5 * PI }
                        else if (left) { a0 = 0.0; a1 = PI / 2 }
                        else { a0 = PI / 2; a1 = PI }
                    } else if (ty < 0.65) {
                        // Kante: meist links oder rechts, ganz oben/unten auch an der oberen/unteren Kante
                        val e = R()
                        if (band != 1 && e < 0.25) {
                            val x = r(0.15, 0.85)
                            if (band == 2) { px = x; py = a - ins; sx = x; sy = a; a0 = PI; a1 = 2 * PI }
                            else { px = x; py = ins; sx = x; sy = 0.0; a0 = 0.0; a1 = PI }
                        } else if (e < 0.62) { px = ins; py = y; sx = 0.0; sy = y; a0 = -PI / 2; a1 = PI / 2 }
                        else { px = 1 - ins; py = y; sx = 1.0; sy = y; a0 = PI / 2; a1 = 1.5 * PI }
                    } else {
                        // mitten im Glas: Risse in alle Richtungen
                        px = r(0.2, 0.8); py = y.coerceIn(0.12 * a, 0.88 * a)
                        a0 = 0.0; a1 = 2 * PI; full = true
                    }
                    if (!full) { a0 += 0.17; a1 -= 0.17 }
                    // mitten im Glas reißt der erste Riss auch nach hinten durch
                    val c = Imp(px, py, sx, sy, a0, a1, (a0 + a1) / 2, full, null, false, k)
                    imp = c
                    if (imps.all { hypot(it.px - c.px, it.py - c.py) > 0.38 }) break
                }
            }
            imps.add(imp!!)
        }
        return imps
    }

    /**
     * Richtung des nächsten Risses eines Aufschlags: selbst angetippt zuerst genau dorthin, dann abwechselnd links und
     * rechts daneben; sonst immer in die größte Lücke des Fächers (quer etwas häufiger).
     */
    private fun nextDir(R: () -> Double, imp: Imp): Double {
        fun r(x: Double, y: Double) = x + R() * (y - x)
        val j = imp.chosen.size
        val taken = ArrayList<Double>(imp.chosen)
        if (!imp.backDir.isNaN()) taken.add(imp.backDir)
        fun free(d: Double) = taken.all { abs(angDiff(it, d)) > 0.14 }
        if (imp.manual) {
            if (j == 0) return imp.md
            val side = if (j % 2 == 1) 1 else -1
            val step = (j + 1) / 2
            var d = imp.md + side * step * r(0.36, 0.52)
            if (!imp.full) d = d.coerceIn(imp.a0 + 0.06, imp.a1 - 0.06)
            if (free(d)) return d
        }
        if (j == 0) {
            if (imp.full) return r(imp.a0, imp.a1)
            // erster Riss: irgendwo im Fächer, quer etwas häufiger
            for (tr in 0 until 8) {
                val d = r(imp.a0, imp.a1)
                val s = sin(d)
                if (R() < 1 - QUER * s * s || tr == 7) return d
            }
        }
        // größte Lücke (am Rand des Fächers zählt die Lücke wie gespiegelt: dort ein Drittel vom Rand weg)
        val two = 2 * PI
        val ang = taken.map { c ->
            if (imp.full) imp.a0 + ((c - imp.a0) % two + two) % two else c.coerceIn(imp.a0, imp.a1)
        }.sorted()
        val cd = ArrayList<Double>(); val cg = ArrayList<Double>(); val cw = ArrayList<Double>()
        if (imp.full) {
            for (i in ang.indices) {
                val p = ang[i]
                val q = if (i + 1 < ang.size) ang[i + 1] else ang[0] + two
                cd.add((p + q) / 2); cg.add((q - p) / 2); cw.add(q - p)
            }
        } else {
            cd.add(imp.a0 + (ang[0] - imp.a0) / 3); cg.add((ang[0] - imp.a0) * 2 / 3); cw.add((ang[0] - imp.a0) / 3)
            for (i in 0 until ang.size - 1) {
                cd.add((ang[i] + ang[i + 1]) / 2); cg.add((ang[i + 1] - ang[i]) / 2); cw.add(ang[i + 1] - ang[i])
            }
            val last = ang[ang.size - 1]
            cd.add(imp.a1 - (imp.a1 - last) / 3); cg.add((imp.a1 - last) * 2 / 3); cw.add((imp.a1 - last) / 3)
        }
        var best = 0
        var bs = -1.0
        for (i in cd.indices) {
            val s = sin(cd[i])
            val sc = cg[i] * (1 - QUER * 0.6 * s * s)
            if (sc > bs) { bs = sc; best = i }
        }
        return cd[best] + (R() - 0.5) * 0.3 * cw[best]
    }

    /**
     * Risse bauen.
     * @param n Anzahl Hauptrisse 0..36 (0 = keine Risse)
     * @param splinter Splitter am Aufschlag: 0 aus, 1 wenig, 2 viel
     * @param a Höhe / Breite
     * @param impacts Anzahl Aufschläge 1..3
     * @param manual je Aufschlag selbst angetippt: Aufschlag x, y und Richtung x, y als Anteil von Breite und Höhe (sonst null)
     * @param hshare Anteil der Risse, die waagerecht quer übers Bild laufen (0..100 %)
     * @param clockRect Bereich der Uhr in Breiten-Einheiten (x0, y0, x1, y1), durch den ein Riss laufen soll (oder null)
     * @param clockSpan aus so vielen Rissen wird zufällig der gewählt, der durch die Uhr läuft (ohne „Mehr Risse mit der
     * Zeit“ die sichtbaren, sonst alle bis „bis“). Muss für alle Anzahlen gleich bleiben, sonst ändern sich alte Risse.
     */
    fun make(n: Int, splinter: Int, seed: Long, a: Double, impacts: Int, manual: Array<FloatArray?>, hshare: Int,
             clockRect: DoubleArray?, clockSpan: Int): CrackSet? {
        val count = n.coerceIn(0, MAX)
        if (count <= 0 || a <= 0) return null
        val rnd = Random(seed)
        val R = { rnd.nextDouble() }
        fun r(x: Double, y: Double) = x + R() * (y - x)
        val nImp = impacts.coerceIn(1, 3)
        val imps = makeImpacts(R, a, nImp, manual)
        // welche der (bis zu 36) Risse waagerecht quer laufen: feste Reihenfolge, auch für später dazukommende
        val hs = hshare.coerceIn(0, 100) / 100.0
        val horiz = BooleanArray(MAX) { i -> Math.round((i + 1) * hs) > Math.round(i * hs) }
        // Mit Uhr: einer der Risse läuft durch die Ziffern – welcher, ist Zufall (immer ausgewürfelt, damit die Reihenfolge
        // gleich bleibt); mit „Mehr Risse mit der Zeit“ bekommt die Uhr ihren Riss also irgendwann unterwegs. Hat schon ein
        // anderer Riss die Uhr getroffen, braucht es keinen eigenen mehr.
        val ctx0 = r(0.3, 0.7)
        val cty0 = r(0.3, 0.55)
        var clockDue = floor(R() * max(1, clockSpan.coerceAtMost(MAX))).toInt()
        val clockAim: Pt? = if (clockRect != null)
            Pt(clockRect[0] + (clockRect[2] - clockRect[0]) * ctx0, clockRect[1] + (clockRect[3] - clockRect[1]) * cty0) else null
        if (clockAim == null) clockDue = -1
        val bands = intArrayOf(0, 1, 2)
        for (i in 2 downTo 1) {
            val j = floor(R() * (i + 1)).toInt()
            val t = bands[i]; bands[i] = bands[j]; bands[j] = t
        }

        // Netz: Knoten (Ecken, Enden am Rand, Aufschläge, Stellen, an denen ein Riss an einem anderen endet) und Risse
        val nodes = arrayListOf(Pt(0.0, 0.0), Pt(1.0, 0.0), Pt(1.0, a), Pt(0.0, a))
        val border = arrayListOf(0, 1, 2, 3)
        val divs = ArrayList<Div>()
        fun addNode(x: Double, y: Double): Int {
            nodes.add(Pt(x, y))
            return nodes.size - 1
        }
        fun onBorder(x: Double, y: Double) = x <= 1e-9 || x >= 1 - 1e-9 || y <= 1e-9 || y >= a - 1e-9
        fun borderNode(x: Double, y: Double): Int {
            for (id in border) if (hypot(nodes[id].x - x, nodes[id].y - y) < 1e-7) return id
            val id = addNode(x, y)
            border.add(id)
            return id
        }
        fun hostNode(h: Hit): Int {
            val host = divs[h.ci]
            val last = host.pts.size - 1
            if (h.pos <= 1e-9) return host.n0
            if (h.pos >= last - 1e-9) return host.n1
            for (s in host.splits) if (hypot(nodes[s.node].x - h.x, nodes[s.node].y - h.y) < 1e-7) return s.node
            val id = addNode(h.x, h.y)
            host.splits.add(Split(h.pos, id))
            return id
        }
        // Riss fertig machen: Zacken, an einem dabei gekreuzten Riss kappen, Knoten setzen, eintragen
        fun finish(coarse: List<Pt>, n0: Int, hit0: Hit?, kind: Int, amp: Double, ign: Ign?, imp: Int, dir: Double) {
            var hit = hit0
            var pts = refine(R, coarse, amp, if (ign != null) 0.02 else 0.006, if (hit != null) 0.012 else 0.004, a, if (ign != null) 0.008 else 0.0)
            pts[0] = nodes[n0]
            val endPt = pts[pts.size - 1]
            var crI = -1
            var crH: Hit? = null
            for (i in 1 until pts.size) {
                val h = hitAny(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, divs, ign, if (i == pts.size - 1 && hit != null) endPt else null)
                if (h != null) { crI = i; crH = h; break }
            }
            if (crH != null) {
                pts = ArrayList(pts.subList(0, crI))
                pts.add(Pt(crH.x, crH.y))
                hit = crH
            }
            val n1 = if (hit != null) hostNode(hit) else {
                val e = pts[pts.size - 1]
                if (onBorder(e.x, e.y)) borderNode(e.x, e.y) else addNode(e.x, e.y)
            }
            pts[pts.size - 1] = nodes[n1]
            divs.add(Div(pts, n0, n1, kind, imp, dir))
        }
        // Abstand eines Punkts zum nächsten Riss
        fun distToCracks(x: Double, y: Double): Double {
            var m = 1e9
            for (d in divs) for (i in 1 until d.pts.size) m = min(m, segDist(x, y, d.pts[i - 1], d.pts[i]))
            return m
        }
        // Läuft der Riss durch die Uhr (dicht am Zielpunkt in den Ziffern vorbei)?
        fun reaches(p: List<Pt>, aim: Pt): Boolean {
            for (i in 1 until p.size) if (segDist(aim.x, aim.y, p[i - 1], p[i]) < 0.04) return true
            return false
        }
        fun startImpact(imp: Imp) {
            imp.started = true
            // liegt der Aufschlag genau auf einem schon vorhandenen Riss: ein Stück daneben setzen
            var tr = 0
            while (tr < 6 && distToCracks(imp.px, imp.py) < 0.008) {
                imp.px = (imp.px + (if (tr % 2 == 1) -1 else 1) * 0.012).coerceIn(0.01, 0.99)
                imp.py = (imp.py + 0.009).coerceIn(0.01, a - 0.01)
                tr++
            }
            imp.node = addNode(imp.px, imp.py)
            // am Rand: der Aufschlag reißt bis an den Rand durch
            if (imp.hasStub) finish(listOf(Pt(imp.px, imp.py), Pt(imp.sx, imp.sy)), imp.node, null, D_STUB, 0.0007, Ign(imp.px, imp.py, imp.node), imp.k, 0.0)
        }
        // Riss vom Aufschlag aus. need: muss durch diese Stelle laufen (Uhr), sonst wird er nicht gesetzt (false)
        fun spoke(imp: Imp, dir: Double, aim: Pt?, kind: Int, need: Pt? = null): Boolean {
            val p = Ign(imp.px, imp.py, imp.node)
            var best: Grown? = null
            var bestLen = 0.0
            for (tr in 0 until 6) {
                val g = grow(R, a, imp.px, imp.py, dir + (if (tr > 0) r(-0.06, 0.06) else 0.0), 0.0, aim, divs, p)
                val len = polyLen(g.pts)
                val bb = if (best == null || len > bestLen) { bestLen = len; g } else best
                best = bb
                if (len > 0.08 || bb.hit == null) break
            }
            val b = best ?: return false
            if (need != null && !reaches(b.pts, need)) return false
            finish(if (b.hit != null) b.pts else toEdge(b.pts, a), imp.node, b.hit, kind, 0.0010, p, imp.k, dir)
            return true
        }
        // Riss waagerecht quer übers Bild; mit aim auf Höhe der Uhr durch die Ziffern (false, wenn er nicht hinkommt)
        fun horizontal(j: Int, aim: Pt?): Boolean {
            var best: Grown? = null
            var bestLen = 0.0
            var bx0 = 0.0
            var by0 = 0.0
            for (tr in 0 until 6) {
                if (aim != null && tr >= 2) break
                val band = bands[(j + tr) % 3]
                var y = (band + r(0.12, 0.88)) / 3 * a
                val left = R() < 0.5
                val dir = (if (left) 0.0 else PI) + r(-0.12, 0.12)
                if (aim != null) y = (aim.y + r(-0.03, 0.03)).coerceIn(0.02, a - 0.02)
                val x0 = if (left) 0.0 else 1.0
                if (border.any { hypot(nodes[it].x - x0, nodes[it].y - y) < 0.03 }) continue
                val g = grow(R, a, x0, y, dir, 0.0, aim, divs, null)
                if (aim != null && !reaches(g.pts, aim)) continue
                // gleich am Anfang an einem Riss hängen geblieben: andere Höhe nehmen
                val len = polyLen(g.pts)
                if (best == null || len > bestLen) { best = g; bestLen = len; bx0 = x0; by0 = y }
                if (aim != null || len > 0.45) break
            }
            val b = best ?: return false
            val n0 = borderNode(bx0, by0)
            finish(if (b.hit != null) b.pts else toEdge(b.pts, a), n0, b.hit, D_H, 0.0009, null, -1, if (bx0 > 0.5) PI else 0.0)
            return true
        }
        // Riss durch die Uhr, wenn er weder vom Aufschlag noch von der Seite hinkommt: Er geht von einem Riss oder vom Rand
        // aus, und zwar von einer Stelle, von der aus kein anderer Riss im Weg liegt (die nächste Stelle des Netzes, oder
        // links, rechts, oben am Rand, wenn der Weg frei ist), läuft mitten durch die Ziffern und weiter, bis er auf einen
        // Riss oder den Rand trifft.
        fun clockCrack(aim: Pt) {
            val cx = ArrayList<Double>(); val cy = ArrayList<Double>(); val cw = ArrayList<Double>(); val ch = ArrayList<Hit?>()
            var near: Hit? = null
            var nearD = 1e9
            for (ci in divs.indices) {
                val d = divs[ci]
                for (k in 1 until d.pts.size) {
                    val p = d.pts[k - 1]; val q = d.pts[k]
                    val vx = q.x - p.x; val vy = q.y - p.y
                    val l2 = vx * vx + vy * vy
                    val u = if (l2 > 0) (((aim.x - p.x) * vx + (aim.y - p.y) * vy) / l2).coerceIn(0.0, 1.0) else 0.0
                    val x = p.x + vx * u; val y = p.y + vy * u
                    val dd = hypot(aim.x - x, aim.y - y)
                    if (dd < nearD) { nearD = dd; near = Hit(0.0, ci, k - 1 + u, x, y) }
                }
            }
            near?.let { cx.add(it.x); cy.add(it.y); cw.add(1.5); ch.add(it) }
            for (s in 0..2) {
                val x = when (s) { 0 -> 0.0; 1 -> 1.0; else -> aim.x }
                val y = if (s < 2) aim.y else 0.0
                if (border.any { hypot(nodes[it].x - x, nodes[it].y - y) < 0.02 }) continue
                if (hitAny(x, y, aim.x, aim.y, divs, null, null) != null) continue
                cx.add(x); cy.add(y); cw.add(if (s < 2) 1.0 else 0.6); ch.add(null)
            }
            if (cw.isEmpty()) return
            var sv = R() * cw.sum()
            var pick = cw.size - 1
            for (i in cw.indices) {
                sv -= cw[i]
                if (sv <= 0) { pick = i; break }
            }
            val host = ch[pick]
            val sx = cx[pick]; val sy = cy[pick]
            // geht er von einem Riss ab, zählt dieser dicht am Startpunkt nicht als Ende
            val ign = if (host != null) Ign(sx, sy, -2, divs[host.ci]) else null
            val g = grow(R, a, sx, sy, atan2(aim.y - sy, aim.x - sx), 0.0, aim, divs, ign)
            if (polyLen(g.pts) < 0.01) return
            val n0 = if (host != null) hostNode(host) else borderNode(sx, sy)
            finish(if (g.hit != null) g.pts else toEdge(g.pts, a), n0, g.hit, D_C, 0.0009, ign, -1, 0.0)
        }

        var si = 0
        var hj = 0
        for (i in 0 until count) {
            val ca = clockAim
            // Uhr schon von einem anderen Riss getroffen: braucht keinen eigenen mehr
            if (ca != null && clockDue in 0..i && distToCracks(ca.x, ca.y) < 0.025) clockDue = -1
            val aimC = if (ca != null && clockDue in 0..i) ca else null
            if (horiz[i]) {
                if (aimC != null) {
                    if (!horizontal(hj++, aimC)) clockCrack(aimC)
                    clockDue = -1
                } else horizontal(hj++, null)
                continue
            }
            val imp = imps[si % nImp]
            si++
            if (!imp.started) startImpact(imp)
            if (imp.manual && imp.chosen.isEmpty()) {
                // selbst angetippt: der erste Riss läuft genau in die gewählte Richtung (die Uhr kommt dann beim nächsten dran)
                imp.chosen.add(imp.md)
                spoke(imp, imp.md, imp.aim, D_SPOKE)
            } else if (aimC != null) {
                clockDue = -1
                val ta = atan2(aimC.y - imp.py, aimC.x - imp.px)
                val inFan = imp.full || abs(angDiff(ta, imp.md)) <= (imp.a1 - imp.a0) / 2 + 0.17
                if (inFan && spoke(imp, ta, aimC, D_SPOKE, aimC)) imp.chosen.add(ta)
                else {
                    clockCrack(aimC)
                    continue
                }
            } else {
                val dir = nextDir(R, imp)
                imp.chosen.add(dir)
                spoke(imp, dir, null, D_SPOKE)
            }
            // mitten im Glas: der erste Riss reißt auch nach hinten durch (sonst hinge er lose im Glas und teilte nichts)
            if (imp.back && !imp.backDone && imp.chosen.isNotEmpty()) {
                imp.backDone = true
                imp.backDir = imp.chosen[0] + PI + r(-0.35, 0.35)
                spoke(imp, imp.backDir, null, D_BACK)
            }
        }

        val regions = buildRegions(nodes, divs, border, a, seed)

        // Abzweige je Riss (eigener Zufall je Riss, damit sie bleiben, wenn Risse dazukommen): enden am Rand, nach einer
        // Weile oder an einem anderen Riss
        val branches = ArrayList<List<Pt>>()
        val branchPL = ArrayList<PL>()
        divs.forEachIndexed { i, d ->
            if (d.kind == D_STUB) return@forEachIndexed
            val rb = Random(seed xor (0x9E3779B1L * (i + 1)))
            val Rb = { rb.nextDouble() }
            fun rr(x: Double, y: Double) = x + Rb() * (y - x)
            val nb = if (Rb() < 0.5) (if (Rb() < 0.25) 2 else 1) else 0
            val total = polyLen(d.pts)
            for (k in 0 until nb) {
                val at = pointAtLen(d.pts, total * rr(0.25, 0.8))
                val bd = at[2] + (if (Rb() < 0.5) -1 else 1) * rr(0.3, 0.65)
                val stop = ArrayList<PL>()
                for (o in divs) if (o !== d) stop.add(o)
                stop.addAll(branchPL)
                val br = refine(Rb, grow(Rb, a, at[0], at[1], bd, rr(0.1, 0.45), null, stop, null).pts, 0.0009, 0.01, 0.0, 0.0)
                branches.add(br)
                branchPL.add(PL(br))
            }
        }

        // Kleine Risse, die an den großen hängen (eigener Zufall je Riss): kurze Ästchen schräg ab, ab und zu noch einmal
        // gegabelt; wo ein Riss am Rand endet, splittert er oft kurz davor in ein, zwei kleine Risse auf
        val twigs = ArrayList<List<Pt>>()
        divs.forEachIndexed { i, d ->
            if (d.kind == D_STUB) return@forEachIndexed
            val rt = Random(seed xor (0x2545F491L * (i + 3)))
            val Rt = { rt.nextDouble() }
            fun rr(x: Double, y: Double) = x + Rt() * (y - x)
            val total = polyLen(d.pts)
            if (total < 0.05) return@forEachIndexed
            val stop = ArrayList<PL>()
            for (o in divs) if (o !== d) stop.add(o)
            stop.addAll(branchPL)
            fun twig(x: Double, y: Double, dir: Double, len: Double): List<Pt> {
                val g = grow(Rt, a, x, y, dir, len, null, stop, null)
                if (g.pts.size > 1 && polyLen(g.pts) > 0.004) twigs.add(refine(Rt, g.pts, 0.0005, 0.003, 0.0, 0.0))
                return g.pts
            }
            val n = min(5, floor(total * rr(0.8, 2.2) + Rt()).toInt())
            for (k in 0 until n) {
                val at = pointAtLen(d.pts, total * rr(0.06, 0.94))
                val side = if (Rt() < 0.5) -1 else 1
                val p = twig(at[0], at[1], at[2] + side * rr(0.35, 1.0), rr(0.015, 0.06))
                if (Rt() < 0.3 && p.size > 2) {
                    val e = p[p.size - 1]; val q = p[p.size - 2]
                    val side2 = if (Rt() < 0.5) -1 else 1
                    twig(e.x, e.y, atan2(e.y - q.y, e.x - q.x) + side2 * rr(0.4, 0.9), rr(0.006, 0.02))
                }
            }
            val e = d.pts[d.pts.size - 1]
            if ((e.x <= 1e-6 || e.x >= 1 - 1e-6 || e.y <= 1e-6 || e.y >= a - 1e-6) && Rt() < 0.6) {
                val back = pointAtLen(d.pts, max(0.0, total - rr(0.012, 0.035)))
                val m = if (Rt() < 0.4) 2 else 1
                for (k in 0 until m) twig(back[0], back[1], back[2] + (if (k > 0) -1 else 1) * rr(0.3, 0.75), rr(0.015, 0.05))
            }
        }

        // Haarrisse (nicht mitgezählt): sehr fein und fast gerade, laufen von einem Riss ins Glas und hören dort einfach auf,
        // ab und zu einer vom Rand aus. Sie teilen nichts. Eigener Zufall je Riss, damit sie bleiben, wenn Risse dazukommen.
        val hairs = ArrayList<List<Pt>>()
        val hairStop = ArrayList<PL>()
        hairStop.addAll(divs)
        hairStop.addAll(branchPL)
        divs.forEachIndexed { i, d ->
            if (d.kind == D_STUB) return@forEachIndexed
            val rh = Random(seed xor (0x7FEB352DL * (i + 13)))
            val Rh = { rh.nextDouble() }
            fun rr(x: Double, y: Double) = x + Rh() * (y - x)
            fun addHair(p: ArrayList<Pt>) {
                if (p.size < 2) return
                hairs.add(p)
                hairStop.add(PL(p))
            }
            val total = polyLen(d.pts)
            if (Rh() < 0.4 && total > 0.08) {
                // vom Riss aus (der eigene Riss zählt nur dicht am Startpunkt nicht als Ende)
                val at = pointAtLen(d.pts, total * rr(0.12, 0.88))
                val side = if (Rh() < 0.5) -1 else 1
                val g = grow(Rh, a, at[0], at[1], at[2] + side * rr(0.45, 1.25), rr(0.05, 0.2), null, hairStop, Ign(at[0], at[1], -2, d))
                if (polyLen(g.pts) > 0.02) addHair(refine(Rh, g.pts, 0.00025, 0.004, 0.003, a))
            }
            if (Rh() < 0.12) {
                // vom Rand aus
                val side = floor(Rh() * 4).toInt()
                val q = rr(0.08, 0.92)
                val x0 = when (side) { 0 -> 0.0; 1 -> 1.0; else -> q }
                val y0 = when (side) { 2 -> 0.0; 3 -> a; else -> q * a }
                val din = when (side) { 0 -> 0.0; 1 -> PI; 2 -> PI / 2; else -> -PI / 2 }
                val g = grow(Rh, a, x0, y0, din + rr(-0.6, 0.6), rr(0.04, 0.14), null, hairStop, null)
                if (polyLen(g.pts) > 0.015) addHair(refine(Rh, g.pts, 0.00025, 0.004, 0.003, a))
            }
        }

        // Splitternetz je Aufschlag: Querrisse in Bögen zwischen benachbarten Rissen, kurze Sprünge, kleine Glassplitter
        val web = ArrayList<List<Pt>>()
        val shards = ArrayList<CrackSet.Shard>()
        if (splinter > 0) imps.forEachIndexed { k, imp ->
            val rw = Random(seed xor (0x85EBCA6BL * (k + 7)))
            val Rw = { rw.nextDouble() }
            fun rr(x: Double, y: Double) = x + Rw() * (y - x)
            val px = imp.px
            val py = imp.py
            val fan = divs.filter { it.imp == k && (it.kind == D_SPOKE || it.kind == D_BACK) }.sortedBy { angDiff(it.dir, imp.md) }
            val radii = if (splinter == 1) doubleArrayOf(rr(0.014, 0.022), rr(0.032, 0.05))
            else doubleArrayOf(rr(0.01, 0.016), rr(0.024, 0.034), rr(0.042, 0.06), rr(0.07, 0.1))
            val pairs = ArrayList<Pair<Div, Div>>()
            for (i in 0 until fan.size - 1) pairs.add(Pair(fan[i], fan[i + 1]))
            if (imp.full && fan.size > 2) pairs.add(Pair(fan[fan.size - 1], fan[0]))
            for (rad in radii) for ((fa, fb) in pairs) {
                if (Rw() > (if (splinter == 1) 0.7 else 0.88) || abs(angDiff(fb.dir, fa.dir)) > 1.6) continue
                if (polyLen(fa.pts) < rad * 1.3 || polyLen(fb.pts) < rad * 1.3) continue
                val pa = pointAtLen(fa.pts, rad * rr(0.85, 1.15))
                val pb = pointAtLen(fb.pts, rad * rr(0.85, 1.15))
                val mx = (pa[0] + pb[0]) / 2; val my = (pa[1] + pb[1]) / 2
                val ox = mx - px; val oy = my - py
                val ol = hypot(ox, oy).let { if (it > 0) it else 1.0 }
                val bulge = rad * rr(0.02, 0.15)
                web.add(refine(Rw, listOf(Pt(pa[0], pa[1]), Pt(mx + ox / ol * bulge, my + oy / ol * bulge), Pt(pb[0], pb[1])), 0.0007, 0.0, 0.0, 0.0))
            }
            val nt = (if (splinter == 1) 2 + (Rw() * 3).toInt() else 6 + (Rw() * 5).toInt()) + (if (imp.started) 0 else 3)
            for (q in 0 until nt) {
                val ang = rr(imp.a0 - 0.17, imp.a1 + 0.17)
                val d0 = rr(0.004, if (splinter == 1) 0.03 else 0.05)
                val x0 = px + cos(ang) * d0; val y0 = py + sin(ang) * d0
                if (x0 <= 0 || x0 >= 1 || y0 <= 0 || y0 >= a) continue
                web.add(refine(Rw, grow(Rw, a, x0, y0, ang + rr(-0.9, 0.9), rr(0.006, 0.025), null, null, null).pts, 0.0006, 0.0, 0.0, 0.0))
            }
            // kleine Glassplitter: Dreiecke mit hellen Kanten, dicht am Aufschlag
            val ns = if (splinter == 1) 5 + (Rw() * 4).toInt() else 14 + (Rw() * 8).toInt()
            for (q in 0 until ns) {
                val ang = rr(imp.a0 - 0.17, imp.a1 + 0.17)
                val d0 = rr(0.0, if (splinter == 1) 0.018 else 0.03) * (0.4 + Rw())
                val cx0 = px + cos(ang) * d0; val cy0 = py + sin(ang) * d0
                val s0 = rr(0.0025, 0.007); val rot = Rw() * 6.3
                val tri = DoubleArray(6)
                var ok = true
                for (z in 0..2) {
                    val an = rot + z * 2.1 + rr(-0.5, 0.5); val rad = s0 * rr(0.6, 1.2)
                    tri[2 * z] = cx0 + cos(an) * rad; tri[2 * z + 1] = cy0 + sin(an) * rad
                    if (!(tri[2 * z] > 0 && tri[2 * z] < 1 && tri[2 * z + 1] > 0 && tri[2 * z + 1] < a)) ok = false
                }
                if (ok) shards.add(CrackSet.Shard(tri, rr(0.05, 0.16), rr(0.25, 0.6)))
            }
        }

        // Zeichenliste: dunkle Bruchkante mit Glanz, der entlang des Risses weich stärker und schwächer wird
        val rl = Random(seed xor 0x27D4EB2FL)
        val lines = ArrayList<CrackSet.Line>()
        fun add(p: List<Pt>, w: Double, kind: Int, base: Double) {
            val pts = DoubleArray(p.size * 2)
            val cl = DoubleArray(p.size)
            for (i in p.indices) {
                pts[2 * i] = p[i].x; pts[2 * i + 1] = p[i].y
                if (i > 0) cl[i] = cl[i - 1] + hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
            }
            // Seite zum Licht (oben) einmal je Riss festlegen, damit der Glanz nicht hin und her springt
            val e = p[p.size - 1]
            val dx = e.x - p[0].x; val dy = e.y - p[0].y
            val l = hypot(dx, dy).let { if (it > 0) it else 1.0 }
            var nx = -dy / l; var ny = dx / l
            if (ny > 0 || (abs(ny) < 0.25 && nx > 0)) { nx = -nx; ny = -ny }
            lines.add(CrackSet.Line(pts, cl, w, kind, base, CrackSet.Glint(rl), nx, ny))
        }
        for (d in divs) {
            val quer = d.kind == D_H || d.kind == D_C
            add(d.pts, if (d.kind == D_STUB) 1.2 else if (quer) 0.9 else 1.0, if (quer) CrackSet.HORIZ else CrackSet.SPOKE, 0.5 + rl.nextDouble() * 0.25)
        }
        for (b in branches) add(b, 0.8, CrackSet.BRANCH, 0.4 + rl.nextDouble() * 0.25)
        for (w in web) add(w, 0.65, CrackSet.WEB, 0.55 + rl.nextDouble() * 0.35)
        for (t in twigs) add(t, 0.55, CrackSet.TWIG, 0.45 + rl.nextDouble() * 0.3)
        for (hr in hairs) add(hr, 0.42, CrackSet.HAIR, 0.35 + rl.nextDouble() * 0.3)

        val divPts = divs.map { d -> DoubleArray(d.pts.size * 2) { i -> if (i % 2 == 0) d.pts[i / 2].x else d.pts[i / 2].y } }
        return CrackSet(imps.map { doubleArrayOf(it.px, it.py) }, a, regions, lines, shards, divPts)
    }

    private class Edge(val a: Int, val b: Int, val pts: List<Pt>, val border: Boolean)
    private class Half(val e: Int, val fw: Boolean, val ang: Double)
    private class Face(val poly: List<Pt>, val used: List<Int>, val area: Double)

    /**
     * Bruchstücke = Flächen des Netzes aus Rissen und Rand. Jeder Riss wird an den Stellen geteilt, an denen andere Risse
     * an ihm enden; dann läuft man um jede Fläche herum (an jedem Knoten die nächste Kante im Uhrzeigersinn).
     */
    private fun buildRegions(nodes: List<Pt>, divs: List<Div>, border: List<Int>, a: Double, seed: Long): List<CrackSet.Region> {
        val edges = ArrayList<Edge>()
        for (d in divs) {
            val cuts = ArrayList<Split>()
            cuts.add(Split(0.0, d.n0))
            cuts.addAll(d.splits.sortedBy { it.pos })
            cuts.add(Split((d.pts.size - 1).toDouble(), d.n1))
            for (k in 0 until cuts.size - 1) {
                val c0 = cuts[k]; val c1 = cuts[k + 1]
                if (c0.node == c1.node) continue
                val pts = ArrayList<Pt>()
                pts.add(nodes[c0.node])
                var q = floor(c0.pos).toInt() + 1
                while (q < c1.pos - 1e-9) { pts.add(d.pts[q]); q++ }
                pts.add(nodes[c1.node])
                edges.add(Edge(c0.node, c1.node, pts, false))
            }
        }
        fun per(id: Int): Double {
            val x = nodes[id].x; val y = nodes[id].y
            return when {
                y <= 1e-7 -> x
                x >= 1 - 1e-7 -> 1 + y
                y >= a - 1e-7 -> 1 + a + (1 - x)
                else -> 2 + a + (a - y)
            }
        }
        val bs = border.sortedBy { per(it) }
        for (i in bs.indices) {
            val p = bs[i]; val q = bs[(i + 1) % bs.size]
            edges.add(Edge(p, q, listOf(nodes[p], nodes[q]), true))
        }
        val outs = LinkedHashMap<Int, ArrayList<Half>>()
        fun addOut(n: Int, h: Half) { outs.getOrPut(n) { ArrayList() }.add(h) }
        edges.forEachIndexed { ei, e ->
            val p = e.pts
            val last = p.size - 1
            var i1 = 1
            while (i1 < last && hypot(p[i1].x - p[0].x, p[i1].y - p[0].y) < 1e-9) i1++
            var j1 = last - 1
            while (j1 > 0 && hypot(p[j1].x - p[last].x, p[j1].y - p[last].y) < 1e-9) j1--
            addOut(e.a, Half(ei, true, atan2(p[i1].y - p[0].y, p[i1].x - p[0].x)))
            addOut(e.b, Half(ei, false, atan2(p[j1].y - p[last].y, p[j1].x - p[last].x)))
        }
        for (l in outs.values) l.sortBy { it.ang }
        val seen = BooleanArray(edges.size * 2)
        fun key(h: Half) = h.e * 2 + (if (h.fw) 0 else 1)
        val faces = ArrayList<Face>()
        for (l in outs.values) for (h0 in l) {
            if (seen[key(h0)]) continue
            val poly = ArrayList<Pt>()
            val used = ArrayList<Int>()
            var h = h0
            var guard = 0
            do {
                seen[key(h)] = true
                used.add(h.e)
                val e = edges[h.e]
                val p = if (h.fw) e.pts else e.pts.asReversed()
                for (q in 0 until p.size - 1) poly.add(p[q])
                val v = if (h.fw) e.b else e.a
                val l2 = outs[v] ?: break
                val ti = l2.indexOfFirst { it.e == h.e && it.fw != h.fw }
                h = l2[(ti + l2.size - 1) % l2.size]
            } while (h !== h0 && ++guard < 20000)
            var ar = 0.0
            for (k in poly.indices) {
                val p = poly[k]; val q = poly[(k + 1) % poly.size]
                ar += p.x * q.y - q.x * p.y
            }
            faces.add(Face(poly, used, ar / 2))
        }
        if (faces.isEmpty()) return emptyList()
        // die Fläche außen herum (läuft den Rand andersherum entlang) weglassen
        var bi = 0
        for (i in faces.indices) if (abs(faces[i].area) > abs(faces[bi].area)) bi = i
        val outer = sign(faces[bi].area)
        val regions = ArrayList<CrackSet.Region>()
        val usedBy = ArrayList<List<Int>>()
        for (i in faces.indices) {
            val f = faces[i]
            if (i == bi || abs(f.area) < 1e-7 || sign(f.area) == outer) continue
            var x0 = 1e9; var x1 = -1e9; var y0 = 1e9; var y1 = -1e9
            var gx = 0.0; var gy = 0.0; var a2 = 0.0
            val m = f.poly.size
            val poly = DoubleArray(m * 2)
            for (k in 0 until m) {
                val p = f.poly[k]; val q = f.poly[(k + 1) % m]
                val cr = p.x * q.y - q.x * p.y
                a2 += cr; gx += (p.x + q.x) * cr; gy += (p.y + q.y) * cr
                x0 = min(x0, p.x); x1 = max(x1, p.x); y0 = min(y0, p.y); y1 = max(y1, p.y)
                poly[2 * k] = p.x; poly[2 * k + 1] = p.y
            }
            val cx = gx / (3 * a2)
            val cy = gy / (3 * a2)
            val zone = if (cy < a / 3) GlitchRenderer.ZONE_TOP else if (cy > 2 * a / 3) GlitchRenderer.ZONE_BOTTOM else GlitchRenderer.ZONE_MID
            regions.add(CrackSet.Region(poly, abs(f.area), x0, x1, y0, y1, cx, cy, zone))
            usedBy.add(f.used)
        }
        // Nachbarn: Stücke, die sich eine Risskante teilen
        val byEdge = HashMap<Int, ArrayList<Int>>()
        for (gi in regions.indices) for (e in usedBy[gi]) if (!edges[e].border) byEdge.getOrPut(e) { ArrayList() }.add(gi)
        val nbs = Array(regions.size) { ArrayList<Int>() }
        for (l in byEdge.values) if (l.size == 2 && l[0] != l[1]) {
            if (l[1] !in nbs[l[0]]) nbs[l[0]].add(l[1])
            if (l[0] !in nbs[l[1]]) nbs[l[1]].add(l[0])
        }
        // Versatz der Stücke: Richtung und Stärke aus der Lage (bleibt gleich, solange das Stück bleibt); das größte bleibt stehen
        val hs = ((seed xor (seed ushr 31)) and 0x7fffffffL).toDouble()
        var big = 0
        regions.forEachIndexed { i, g ->
            g.nb = nbs[i].toIntArray()
            val h = hash01(g.cx, g.cy, hs)
            g.s = (if (h < 0.5) -1 else 1) * (0.6 + 0.6 * hash01(g.cy, g.cx, hs + 7))
            if (g.area > regions[big].area) big = i
        }
        if (regions.isNotEmpty()) regions[big].s = 0.0
        return regions
    }
}
