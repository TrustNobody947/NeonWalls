package io.github.trustnobody947.neonwalls.glitch

import java.util.Random
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Glasrisse wie in der Vorschau (vorschau/quellen/effects/brokenscreen.js).
 * Alles in Breiten-Einheiten: x von 0 bis 1, y von 0 bis a (= Höhe / Breite). Gleicher Zufallswert = gleiche Risse.
 *
 * Das Handy ist an einer Stelle aufgeschlagen (zufällig an Ecke oder Kante, oder selbst angetippt): Von dort laufen
 * die Hauptrisse sternförmig bis an den Rand, manche mit Abzweig, am Aufschlag ein Splitternetz. Die Hauptrisse teilen
 * das Display in Bruchstücke ([CrackSet.Region]).
 */
class CrackSet(
    val px: Double, val py: Double, val a: Double,
    val regions: List<Region>, val lines: List<Line>, val shards: List<Shard>
) {
    /** Bruchstück zwischen zwei benachbarten Hauptrissen. poly: x0, y0, x1, y1, … */
    class Region(val poly: DoubleArray, val area: Double, val x0: Double, val x1: Double, val y0: Double, val y1: Double, val zone: Int) {
        /** Versatz-Richtung und -Stärke (−1,2 … 1,2; 0 = bleibt stehen). */
        var s = 0.0
        /** liegt im Bereich der Uhr */
        var clock = false

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
    }
}

object Cracks {
    /** Wie stark zufällige Risse quer statt steil laufen (0 = gleich verteilt). */
    private const val QUER = 0.55

    private class Pt(val x: Double, val y: Double)
    private class Spoke(var coarse: List<Pt>, val dir: Double, val stub: Boolean = false) {
        var pts: List<Pt> = coarse
    }

    private fun angDiff(a: Double, b: Double): Double {
        var d = a - b
        while (d > PI) d -= 2 * PI
        while (d < -PI) d += 2 * PI
        return d
    }

    /** Schnitt der Strecke a→b mit q→e: Anteil entlang a→b, sonst −1. */
    private fun segHit(ax: Double, ay: Double, bx: Double, by: Double, qx: Double, qy: Double, ex: Double, ey: Double): Double {
        val rX = bx - ax; val rY = by - ay; val sX = ex - qx; val sY = ey - qy
        val den = rX * sY - rY * sX
        if (abs(den) < 1e-12) return -1.0
        val u = ((qx - ax) * sY - (qy - ay) * sX) / den
        val v = ((qx - ax) * rY - (qy - ay) * rX) / den
        return if (u > 1e-6 && u <= 1 && v >= 0 && v <= 1) u else -1.0
    }

    private fun polyLen(p: List<Pt>): Double {
        var l = 0.0
        for (i in 1 until p.size) l += hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y)
        return l
    }

    /** Punkt in der Entfernung d entlang des Risses, mit Richtung. */
    private fun pointAtLen(p: List<Pt>, d0: Double): DoubleArray {
        var d = d0
        for (i in 1 until p.size) {
            val a = p[i - 1]; val b = p[i]
            val l = hypot(b.x - a.x, b.y - a.y)
            if (d <= l || i == p.size - 1) {
                val f = if (l > 0) minOf(1.0, d / l) else 0.0
                return doubleArrayOf(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, atan2(b.y - a.y, b.x - a.x))
            }
            d -= l
        }
        return doubleArrayOf(p[0].x, p[0].y, 0.0)
    }

    /**
     * Riss wachsen lassen: kurze, fast gerade Stücke mit kleinen Knicken, die Grundrichtung wandert langsam.
     * Endet am Bildrand, nach maxLen (0 = ohne) oder an einem der Risse in stopAt. aim: Punkt, durch den er laufen soll.
     */
    private fun grow(R: () -> Double, a: Double, x0: Double, y0: Double, dir0: Double, maxLen: Double, aim: Pt?, stopAt: List<List<Pt>>?): List<Pt> {
        val pts = ArrayList<Pt>()
        pts.add(Pt(x0, y0))
        var x = x0; var y = y0; var dir = dir0; var base = dir0; var len = 0.0
        var aiming = aim != null
        var lastD = 1e9
        for (guard in 0 until 400) {
            val l = 0.015 + R() * 0.045
            base += (R() - 0.5) * 0.08
            dir += (R() - 0.5) * 0.34 + angDiff(base, dir) * 0.35
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
            if (stopAt != null) {
                var best = 2.0
                for (s in stopAt) for (i in 1 until s.size) {
                    val u = segHit(x, y, nx, ny, s[i - 1].x, s[i - 1].y, s[i].x, s[i].y)
                    if (u >= 0 && u < best) best = u
                }
                if (best <= 1) {
                    nx = x + (nx - x) * best
                    ny = y + (ny - y) * best
                    end = true
                }
            }
            val sl = hypot(nx - x, ny - y)
            if (maxLen > 0 && sl > 0 && len + sl >= maxLen) {
                val f = (maxLen - len) / sl
                nx = x + (nx - x) * f
                ny = y + (ny - y) * f
                end = true
            }
            len += hypot(nx - x, ny - y)
            pts.add(Pt(nx, ny))
            x = nx; y = ny
            if (end) break
        }
        return pts
    }

    /** Läuft ein Hauptriss nicht bis zum Rand (sehr selten), gerade weiter bis zum Rand verlängern. */
    private fun toEdge(p: List<Pt>, a: Double): List<Pt> {
        val e = p[p.size - 1]
        if (e.x <= 1e-9 || e.x >= 1 - 1e-9 || e.y <= 1e-9 || e.y >= a - 1e-9 || p.size < 2) return p
        val d = p[p.size - 2]
        val dir = atan2(e.y - d.y, e.x - d.x)
        val cx = cos(dir); val cy = sin(dir)
        var t = 1e9
        if (cx < -1e-9) t = minOf(t, -e.x / cx)
        if (cx > 1e-9) t = minOf(t, (1 - e.x) / cx)
        if (cy < -1e-9) t = minOf(t, -e.y / cy)
        if (cy > 1e-9) t = minOf(t, (a - e.y) / cy)
        var nx = (e.x + cx * t).coerceIn(0.0, 1.0)
        var ny = (e.y + cy * t).coerceIn(0.0, a)
        // genau auf den Rand legen
        val dl = nx; val dr = 1 - nx; val dt = ny; val db = a - ny
        val m = minOf(minOf(dl, dr), minOf(dt, db))
        when (m) {
            dl -> nx = 0.0
            dr -> nx = 1.0
            dt -> ny = 0.0
            else -> ny = a
        }
        return p + Pt(nx, ny)
    }

    /** Feine Zacken wie bei echtem Glasbruch: kleiner, zusammenhängender Zickzack quer zur Richtung (Enden bleiben). */
    private fun refine(R: () -> Double, p: List<Pt>, amp: Double): List<Pt> {
        val out = ArrayList<Pt>(p.size * 6)
        out.add(p[0])
        var j = 0.0
        for (i in 1 until p.size) {
            val a = p[i - 1]; val b = p[i]
            val dx = b.x - a.x; val dy = b.y - a.y
            val l = hypot(dx, dy)
            val n = max(1, (l / 0.007).roundToInt())
            for (k in 1 until n) {
                val f = k.toDouble() / n
                j = j * 0.55 + (R() - 0.5) * 2 * amp
                if (R() < 0.08) j += (R() - 0.5) * 4 * amp
                out.add(Pt(a.x + dx * f - dy / l * j, a.y + dy * f + dx / l * j))
            }
            out.add(b)
            j *= 0.3
        }
        return out
    }

    /** Richtungen im Fächer a0..a1: gleichmäßig verteilt, waagerechte Richtungen etwas häufiger (k = Stärke). */
    private fun fanDirs(R: () -> Double, a0: Double, a1: Double, n: Int, k: Double): DoubleArray {
        val m = 240
        val cum = DoubleArray(m + 1)
        for (i in 1..m) {
            val s = sin(a0 + (a1 - a0) * (i - 0.5) / m)
            cum[i] = cum[i - 1] + 1 - k * s * s
        }
        return DoubleArray(n) { i ->
            val u = ((i + 0.5 + (R() - 0.5) * 0.64) / n).coerceIn(0.0, 1.0) * cum[m]
            var j = 1
            while (j < m && cum[j] < u) j++
            val f = ((u - cum[j - 1]) / max(1e-9, cum[j] - cum[j - 1])).coerceIn(0.0, 1.0)
            a0 + (a1 - a0) * (j - 1 + f) / m
        }
    }

    /** Kreuzt der Riss c einen der Risse in list (abgesehen von der Aufschlagstelle)? */
    private fun crosses(c: List<Pt>, list: List<List<Pt>>, px: Double, py: Double): Boolean {
        for (s in list) for (i in 1 until c.size) for (j in 1 until s.size) {
            val u = segHit(c[i - 1].x, c[i - 1].y, c[i].x, c[i].y, s[j - 1].x, s[j - 1].y, s[j].x, s[j].y)
            if (u >= 0) {
                val x = c[i - 1].x + (c[i].x - c[i - 1].x) * u
                val y = c[i - 1].y + (c[i].y - c[i - 1].y) * u
                if (hypot(x - px, y - py) > 0.006) return true
            }
        }
        return false
    }

    /**
     * Risse bauen.
     * @param n Anzahl Hauptrisse (0 = keine Risse)
     * @param splinter Splitter am Aufschlag: 0 aus, 1 wenig, 2 viel
     * @param a Höhe / Breite
     * @param manual selbst angetippt: Aufschlag x, y und Richtung x, y als Anteil von Breite und Höhe (null = zufällig)
     * @param clockRect Bereich der Uhr in Breiten-Einheiten (x0, y0, x1, y1), durch den ein Riss laufen soll (oder null)
     */
    fun make(n: Int, splinter: Int, seed: Long, a: Double, manual: FloatArray?, clockRect: DoubleArray?): CrackSet? {
        if (n <= 0 || a <= 0) return null
        val rnd = Random(seed)
        val R = { rnd.nextDouble() }
        fun r(x: Double, y: Double) = x + R() * (y - x)
        val ins = r(0.025, 0.05)
        var px: Double
        var py: Double
        var sx = Double.NaN
        var sy = Double.NaN
        var a0: Double
        var a1: Double
        val dirs: DoubleArray
        var md: Double
        var back = false
        var aim: Pt? = null
        var aimIdx = -1

        if (manual != null) {
            // selbst angetippt: Aufschlag und Richtung vom Nutzer, der genaue Verlauf bleibt dem Zufall überlassen
            px = manual[0].toDouble().coerceIn(0.012, 0.988)
            py = manual[1].toDouble().coerceIn(0.006, 0.994) * a
            val tx = manual[2].toDouble()
            val ty = manual[3].toDouble() * a
            val far = hypot(tx - px, ty - py) > 0.03
            md = if (far) atan2(ty - py, tx - px) else R() * 2 * PI
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
            } else {
                a0 = md - PI; a1 = md + PI; back = true
            }
            val mid = (a0 + a1) / 2
            md = mid + angDiff(md, mid)
            // Fächer um die angetippte Richtung: je mehr Risse, desto breiter
            val spread = minOf(a1 - a0, 0.45 + 0.4 * n) * (if (back) 0.85 else 1.0)
            val c0 = if (spread >= a1 - a0 - 1e-6) mid else md.coerceIn(a0 + spread / 2, a1 - spread / 2)
            dirs = fanDirs(R, c0 - spread / 2, c0 + spread / 2, n, 0.0)
            // der Riss, der der angetippten Richtung am nächsten ist, läuft genau dorthin
            aimIdx = 0
            for (i in dirs.indices) if (abs(dirs[i] - md) < abs(dirs[aimIdx] - md)) aimIdx = i
            dirs[aimIdx] = md.coerceIn(a0, a1)
            if (far) aim = Pt(tx, ty) else aimIdx = -1
        } else {
            // zufällig: halb an einer Ecke (unten etwas häufiger), halb an einer Kante (meist links oder rechts)
            if (R() < 0.5) {
                val c = if (R() < 0.6) (if (R() < 0.5) 0 else 1) else (if (R() < 0.5) 2 else 3)   // 0 unten links, 1 unten rechts, 2 oben links, 3 oben rechts
                val left = c == 0 || c == 2
                val bottom = c < 2
                px = if (left) ins else 1 - ins
                py = if (bottom) a - ins else ins
                sx = if (left) 0.0 else 1.0
                sy = if (bottom) a else 0.0
                when (c) {
                    0 -> { a0 = -PI / 2; a1 = 0.0 }
                    1 -> { a0 = PI; a1 = 1.5 * PI }
                    2 -> { a0 = 0.0; a1 = PI / 2 }
                    else -> { a0 = PI / 2; a1 = PI }
                }
            } else {
                val e = R()
                if (e < 0.38) { px = ins; py = r(0.12, 0.9) * a; sx = 0.0; sy = py; a0 = -PI / 2; a1 = PI / 2 }
                else if (e < 0.76) { px = 1 - ins; py = r(0.12, 0.9) * a; sx = 1.0; sy = py; a0 = PI / 2; a1 = 1.5 * PI }
                else if (e < 0.9) { px = r(0.15, 0.85); py = a - ins; sx = px; sy = a; a0 = PI; a1 = 2 * PI }
                else { px = r(0.15, 0.85); py = ins; sx = px; sy = 0.0; a0 = 0.0; a1 = PI }
            }
            a0 += 0.17; a1 -= 0.17   // kein Riss direkt an der Kante entlang
            dirs = fanDirs(R, a0, a1, n, QUER)
            md = (a0 + a1) / 2
            // mit Uhr: ein Riss läuft durch die Ziffern (der nächstliegende wird dorthin gelenkt)
            if (clockRect != null) {
                val tx = clockRect[0] + (clockRect[2] - clockRect[0]) * r(0.3, 0.7)
                val ty = clockRect[1] + (clockRect[3] - clockRect[1]) * r(0.3, 0.55)
                val d = angDiff(atan2(ty - py, tx - px), md)
                if (abs(d) <= (a1 - a0) / 2 + 0.17) {
                    val ta = md + d
                    var best = 1e9
                    for (i in dirs.indices) if (abs(dirs[i] - ta) < best) { best = abs(dirs[i] - ta); aimIdx = i }
                    dirs[aimIdx] = ta
                    aim = Pt(tx, ty)
                }
            }
        }

        // Hauptrisse vom Aufschlag bis zum Rand (der gelenkte zuerst), ohne sich zu kreuzen
        val order = ArrayList<Int>()
        for (i in dirs.indices) order.add(i)
        if (aimIdx >= 0) { order.remove(aimIdx); order.add(0, aimIdx) }
        val spokes = ArrayList<Spoke>()
        for (i in order) {
            var pts: List<Pt>? = null
            var tr = 0
            while (tr < 8 && pts == null) {
                val c = grow(R, a, px, py, dirs[i] + (if (tr > 0) r(-0.06, 0.06) else 0.0), 0.0, if (i == aimIdx) aim else null, null)
                if (!crosses(c, spokes.map { it.coarse }, px, py)) pts = c
                tr++
            }
            if (pts == null) pts = grow({ 0.5 }, a, px, py, dirs[i], 0.0, null, null)   // notfalls ganz gerade
            spokes.add(Spoke(toEdge(pts, a), dirs[i]))
        }
        for (s in spokes) s.pts = refine(R, s.coarse, 0.0019)
        if (!sx.isNaN()) {
            // die Aufschlagstelle reißt bis an den Rand durch
            val st = Spoke(listOf(Pt(px, py), Pt(sx, sy)), atan2(sy - py, sx - px), stub = true)
            st.pts = refine(R, st.coarse, 0.0012)
            spokes.add(st)
        } else if (back) {
            // Aufschlag mitten im Glas: nach hinten reißt es ebenfalls bis zum Rand
            val bd = md + PI + r(-0.35, 0.35)
            var pts: List<Pt>? = null
            var tr = 0
            while (tr < 8 && pts == null) {
                val c = grow(R, a, px, py, bd + (if (tr > 0) r(-0.25, 0.25) else 0.0), 0.0, null, null)
                if (!crosses(c, spokes.map { it.coarse }, px, py)) pts = c
                tr++
            }
            if (pts == null) pts = grow({ 0.5 }, a, px, py, bd, 0.0, null, null)
            val bs = Spoke(toEdge(pts, a), bd)
            bs.pts = refine(R, bs.coarse, 0.0019)
            spokes.add(bs)
        }

        // Abzweige: enden am Rand, nach einer Weile oder an einem anderen Riss
        val branches = ArrayList<List<Pt>>()
        for (s in spokes) {
            if (s.stub) continue
            val nb = if (R() < 0.55) (if (R() < 0.25) 2 else 1) else 0
            val total = polyLen(s.pts)
            for (k in 0 until nb) {
                val at = pointAtLen(s.pts, total * r(0.25, 0.8))
                val bd = at[2] + (if (R() < 0.5) -1 else 1) * r(0.3, 0.65)
                val others = ArrayList<List<Pt>>()
                for (o in spokes) if (o !== s) others.add(o.pts)
                others.addAll(branches)
                branches.add(refine(R, grow(R, a, at[0], at[1], bd, r(0.12, 0.55), null, others), 0.0016))
            }
        }

        // Splitternetz am Aufschlag: Bögen zwischen benachbarten Rissen, kurze Sprünge, kleine Glassplitter
        val web = ArrayList<List<Pt>>()
        val shards = ArrayList<CrackSet.Shard>()
        if (splinter > 0) {
            val fan = spokes.filter { !it.stub }.sortedBy { angDiff(it.dir, md) }
            val radii = if (splinter == 1) doubleArrayOf(r(0.014, 0.022), r(0.032, 0.05))
            else doubleArrayOf(r(0.01, 0.016), r(0.024, 0.034), r(0.042, 0.06), r(0.07, 0.1))
            for (rad in radii) for (i in 0 until fan.size - 1) {
                if (R() > (if (splinter == 1) 0.7 else 0.88) || abs(angDiff(fan[i + 1].dir, fan[i].dir)) > 1.6) continue
                val pa = pointAtLen(fan[i].pts, rad * r(0.85, 1.15))
                val pb = pointAtLen(fan[i + 1].pts, rad * r(0.85, 1.15))
                val mx = (pa[0] + pb[0]) / 2; val my = (pa[1] + pb[1]) / 2
                val ox = mx - px; val oy = my - py
                val ol = hypot(ox, oy).let { if (it > 0) it else 1.0 }
                val bulge = rad * r(0.02, 0.15)
                web.add(refine(R, listOf(Pt(pa[0], pa[1]), Pt(mx + ox / ol * bulge, my + oy / ol * bulge), Pt(pb[0], pb[1])), 0.0009))
            }
            val nt = if (splinter == 1) 2 + (R() * 3).toInt() else 6 + (R() * 5).toInt()
            for (k in 0 until nt) {
                val ang = r(a0 - 0.17, a1 + 0.17)
                val d0 = r(0.004, if (splinter == 1) 0.03 else 0.05)
                val x0 = px + cos(ang) * d0; val y0 = py + sin(ang) * d0
                if (x0 <= 0 || x0 >= 1 || y0 <= 0 || y0 >= a) continue
                web.add(refine(R, grow(R, a, x0, y0, ang + r(-0.9, 0.9), r(0.006, 0.025), null, null), 0.0008))
            }
            val ns = if (splinter == 1) 5 + (R() * 4).toInt() else 14 + (R() * 8).toInt()
            for (k in 0 until ns) {
                val ang = r(a0 - 0.17, a1 + 0.17)
                val d0 = r(0.0, if (splinter == 1) 0.018 else 0.03) * (0.4 + R())
                val cx = px + cos(ang) * d0; val cy = py + sin(ang) * d0
                val s0 = r(0.0025, 0.007); val rot = R() * 6.3
                val tri = DoubleArray(6)
                var ok = true
                for (q in 0..2) {
                    val an = rot + q * 2.1 + r(-0.5, 0.5); val rr = s0 * r(0.6, 1.2)
                    tri[2 * q] = cx + cos(an) * rr; tri[2 * q + 1] = cy + sin(an) * rr
                    if (tri[2 * q] <= 0 || tri[2 * q] >= 1 || tri[2 * q + 1] <= 0 || tri[2 * q + 1] >= a) ok = false
                }
                if (ok) shards.add(CrackSet.Shard(tri, r(0.05, 0.16), r(0.25, 0.6)))
            }
        }

        // Bruchstücke: zwischen je zwei benachbarten Hauptrissen (nach ihrem Endpunkt am Rand, im Uhrzeigersinn)
        val per = 2 + 2 * a
        fun perim(x: Double, y: Double) = when {
            y <= 1e-7 -> x
            x >= 1 - 1e-7 -> 1 + y
            y >= a - 1e-7 -> 1 + a + (1 - x)
            else -> 2 + a + (a - y)
        }
        val corners = arrayOf(doubleArrayOf(1.0, 0.0, 1.0), doubleArrayOf(1.0, a, 1 + a), doubleArrayOf(0.0, a, 2 + a), doubleArrayOf(0.0, 0.0, 0.0))
        val ends = spokes.map { s -> val e = s.pts[s.pts.size - 1]; Pair(s, perim(e.x, e.y)) }.sortedBy { it.second }
        val regions = ArrayList<CrackSet.Region>()
        for (i in ends.indices) {
            val ea = ends[i]; val eb = ends[(i + 1) % ends.size]
            val ta = ea.second
            val tb = if (eb.second > ta) eb.second else eb.second + per
            val poly = ArrayList<Double>()
            for (p in ea.first.pts) { poly.add(p.x); poly.add(p.y) }
            val inc = ArrayList<DoubleArray>()
            for (c in corners) for (off in doubleArrayOf(0.0, per)) {
                val ct = c[2] + off
                if (ct > ta + 1e-9 && ct < tb - 1e-9) inc.add(doubleArrayOf(ct, c[0], c[1]))
            }
            inc.sortBy { it[0] }
            for (c in inc) { poly.add(c[1]); poly.add(c[2]) }
            val bp = eb.first.pts
            for (k in bp.size - 1 downTo 1) { poly.add(bp[k].x); poly.add(bp[k].y) }
            val pa = poly.toDoubleArray()
            val m = pa.size / 2
            var area = 0.0; var gy = 0.0
            var x0 = 1e9; var x1 = -1e9; var y0 = 1e9; var y1 = -1e9
            for (k in 0 until m) {
                val ax = pa[2 * k]; val ay = pa[2 * k + 1]
                val bx = pa[(2 * k + 2) % pa.size]; val by = pa[(2 * k + 3) % pa.size]
                val cr = ax * by - bx * ay
                area += cr; gy += (ay + by) * cr
                x0 = minOf(x0, ax); x1 = maxOf(x1, ax); y0 = minOf(y0, ay); y1 = maxOf(y1, ay)
            }
            val cy = if (abs(area) > 1e-9) gy / (3 * area) else (y0 + y1) / 2
            val zone = if (cy < a / 3) GlitchRenderer.ZONE_TOP else if (cy > 2 * a / 3) GlitchRenderer.ZONE_BOTTOM else GlitchRenderer.ZONE_MID
            regions.add(CrackSet.Region(pa, abs(area / 2), x0, x1, y0, y1, zone))
        }
        // Versatz der Stücke: abwechselnd nach links und rechts, das größte Stück bleibt, wo es ist
        regions.forEachIndexed { i, g -> g.s = (if (i % 2 == 1) -1 else 1) * r(0.6, 1.2) }
        regions.maxByOrNull { it.area }?.s = 0.0

        // Zeichenliste: dunkle Bruchkante mit Glanz, der entlang des Risses weich stärker und schwächer wird
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
            lines.add(CrackSet.Line(pts, cl, w, kind, base, CrackSet.Glint(rnd), nx, ny))
        }
        for (s in spokes) add(s.pts, if (s.stub) 1.2 else 1.0, CrackSet.SPOKE, r(0.5, 0.75))
        for (b in branches) add(b, 0.8, CrackSet.BRANCH, r(0.4, 0.65))
        for (w in web) add(w, 0.65, CrackSet.WEB, r(0.55, 0.9))
        return CrackSet(px, py, a, regions, lines, shards)
    }
}
