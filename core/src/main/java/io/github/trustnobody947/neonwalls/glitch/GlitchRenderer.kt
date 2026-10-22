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
import android.graphics.RectF
import io.github.trustnobody947.neonwalls.uhr.Clock3D
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import java.util.Random
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.round
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * "Broken Screen": flackernde Farbstreifen wie bei einem kaputten Display hinter echtem Glasbruch.
 * Die Risse ([Cracks], bis zu 36 und ein paar Haarrisse) laufen von bis zu drei Aufschlagstellen (und auf Wunsch
 * waagerecht) quer übers Bild und teilen das Display in Bruchstücke: Die Streifen werden genau entlang der Risse
 * ausgeschnitten, jedes Stück ist etwas versetzt und flackert für sich. Fällt ein Streifen in einem Stück aus, stirbt er
 * an der Risskante (kurzes Flackern) und bleibt 30 Sekunden bis 5 Minuten weg – sobald ein Riss da ist, fehlt bei 4
 * Streifen einer, bei 5 zwei, mit mehr Streifen mehr. Ab 9 Rissen bleibt ab und zu ein kleines Stück schwarz (die
 * kleinsten zuerst, mehr unten und in den Ecken, nie oben an der Benachrichtigungsleiste, über der Uhr selten), wie
 * lange, stellt der Regler ein (ein paar Sekunden bis etwa 20 Minuten); bei etwa jedem zweiten bleiben auf einer Seite
 * Streifen stehen. Auf Wunsch werden es mit der Zeit mehr Risse (jeder neue springt mit kurzem Aufblitzen ins Glas).
 * Die Risse selbst: feine dunkle Bruchkante mit dünnem, weich schwankendem Glanz, mal feiner, mal etwas kräftiger;
 * jeder Aufschlag sieht anders aus (Strahlen, Ringe, Splitter). Nebenrisse laufen bis zum Haarriss aus. Beim Neigen
 * glitzern an den Rissen einzelne Pixel ([glint]).
 * Die Streifen stehen in fester Reihenfolge und können mit der Zeit oder mit sinkendem Akku mehr werden; unter dem
 * Finger flackern sie, dazu kurze Druckstreifen. Flächenglitch (ab 5 Rissen): Das kleinste Bruchstück unter dem Finger
 * flackert grau und blitzt dazwischen weiß wie ein Stroboskop (große Stücke selten, ganz große nie).
 * Ein eigenes Bild liegt auf Wunsch unter allem und zerbricht mit den Rissen.
 * Optional liegt die Schablonen-Uhr im Bild – auf neueren Handys aus Metall in 3D ([Clock3D]): Beim Neigen wandert
 * sie mit, ihre Ziffern gehen sichtbar in die Tiefe und die Spiegelung wandert. Einer der Risse (zufällig welcher) läuft
 * durch die Ziffern, die Uhr zerfällt dort in versetzte Stücke (jeder Riss durch die Uhr bekommt eine sichtbare Lücke)
 * und glitcht nur dort, wo gerade auch die Streifen glitchen. Die kaputten Streifen laufen über die Uhr.
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
    /**
     * Vorschau beim Antippen: schon angetippte Stellen in Pixeln (x, y, x, y, …) in der Reihenfolge Aufschlag,
     * Richtung, Aufschlag, … (sonst null).
     */
    var marks: FloatArray? = null
    /** Wird bei jedem großen Glitch-Ausbruch über das ganze Bild aufgerufen (für „Risse wechseln bei Glitches“). */
    var onBigBurst: (() -> Unit)? = null

    // Anzahl Streifen: von – bis; mehr mit der Zeit (Durchgang ab growStart, Uhrzeit in ms) oder mit sinkendem Akku
    var countFrom = 30
    var countTo = 30
    var growTime = false
    var growHours = 6
    var growStart = 0L
    var growBatt = false
    /** Akkustand 0..1. */
    var battery = 1f
    /** Ende des Durchgangs nach dem großen Glitch: neues Muster und neue Startzeit festhalten (sonst nur hier). */
    var onGrowRestart: (() -> Unit)? = null
    /** Glitch unter dem Finger. */
    var touchFx = true
    /** Flächenglitch: Bruchstücke leuchten beim Berühren auf (grau flackernd, weiße Blitze), ab [FGE_MIN] Rissen. */
    var touchFlash = true
    /**
     * Schwarze Stellen zwischen den Rissen 0..10 (ganze Bruchstücke fallen ab und zu aus): vor allem, wie lange ein Stück
     * schwarz bleibt ([darkMid]). Verstellt: gleich neu verteilen (aus: alle wieder an; sonst sofort eins, das ausgeht).
     */
    var dark = 5
        set(v) {
            if (field == v) return
            field = v
            seedDead(true)
        }

    /** Glitzern beim Neigen: einzelne Pixel an den Rissen leuchten je nach Neigung kurz auf (braucht den Neigungssensor). */
    var glint = true

    /** Metall-Uhr in 3D (null = Gerät kann es nicht, dann die bisherige Uhr). */
    var metal: Clock3D? = null
    /** Stärke des 3D-Effekts 0..10. */
    var d3 = 5
    private var tiltTX = 0f
    private var tiltTY = 0f
    private var tiltX = 0f
    private var tiltY = 0f
    private var gTiltX = 0f
    private var gTiltY = 0f

    /** Neigung vom Sensor (−1..1), wird weich nachgezogen. */
    fun setTilt(x: Float, y: Float) {
        tiltTX = x
        tiltTY = y
    }

    /** Aktuell sichtbare Anzahl Streifen (für die Anzeige in den Einstellungen). */
    var shownCount = 0
        private set

    private var seed = 0L

    // Risse: Anzahl von – bis, mehr mit der Zeit (Durchgang ab crackStart, Uhrzeit in ms)
    var crackFrom = 3
        private set
    var crackTo = 3
        private set
    var crackGrow = false
        private set
    var crackHours = 6
        private set
    var crackStart = 0L
        private set
    /** Ende des Durchgangs nach dem großen Glitch: neue Risse und neue Startzeit festhalten (sonst nur hier). */
    var onCrackRestart: (() -> Unit)? = null
    private var crackPending = false
    /** gerade gezeigte Anzahl Hauptrisse (−1 = noch keine gebaut) */
    private var crackN = -1
    private var splinter = 1
    private var crackSeed = 1L
    private var impacts = 1
    private var manual: Array<FloatArray?> = arrayOfNulls(3)
    private var hshare = 30
    private var clockKey = ""
    private var shapeKey = ""
    /** Anzahl hat sich über die Einstellungen geändert (dann blitzen neue Risse nicht auf) */
    private var countChanged = false
    /** beim nächsten Aufbau die neu dazugekommenen Risse aufblitzen lassen */
    private var growFlash = false
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
    private var regNb: Array<IntArray> = arrayOf(IntArray(0))
    /** Anteil des Stücks am Bildschirm (für den Flächenglitch: kleine Stücke zuerst) */
    private var regFrac = floatArrayOf(1f)
    // ganz ausgefallene Bruchstücke: Restzeit, Dauer, gerade schwarz (beim Aus- und Angehen flackert es kurz)
    private var regDead = floatArrayOf(0f)
    private var regDeadT = floatArrayOf(0f)
    private var regDv = booleanArrayOf(false)
    // ausgefallenes Stück, in dem auf einer Seite Streifen stehen bleiben: dort läuft das Display noch (x von, bis in
    // Pixeln; NaN = ganz schwarz)
    private var regKeep0 = floatArrayOf(Float.NaN)
    private var regKeep1 = floatArrayOf(Float.NaN)
    // schwarze Stücke: gerade wieder an (Ruhezeit), geht gleich mit aus (Wartezeit, Dauer), darf schwarz werden, wie gern
    private var regRest = floatArrayOf(0f)
    private var regPend = floatArrayOf(0f)
    private var regPendLen = floatArrayOf(0f)
    private var regDOK = booleanArrayOf(false)
    private var regDW = floatArrayOf(0f)
    // Uhr: wie viele der 81 Prüfpunkte der Uhr im Stück liegen, Versatz des Uhr-Stücks („Riss durch die Uhr“)
    private var regClockN = intArrayOf(0)
    private var regCS = floatArrayOf(0f)

    private fun hasKeep(i: Int) = !regKeep0[i].isNaN()
    /** Liegt x (Pixel) in einem ausgefallenen Stück im schwarzen Teil (nicht auf der Seite, die noch läuft)? */
    private fun deadAt(i: Int, x: Float) = regDv[i] && (!hasKeep(i) || x < regKeep0[i] || x > regKeep1[i])

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
    private val pool = ArrayList<Line>()
    private var poolFresh = true

    // Glitch-Ausbrüche
    private var burstT = 0f
    private var nextBurst = 6f
    private var burstZone = ZONE_ALL
    private var burstPow = 1f
    private var pendingRestart = false

    /** Zustand eines Streifens in einem Bruchstück; drawn/a/c/x/fl* gelten für das aktuelle Bild. */
    class Zone {
        var flash = 0f
        var col = 0
        var off = 0f
        /** stirbt gerade an der Risskante (flackert, dann lange aus) bzw. kommt flackernd wieder */
        var die = 0f
        var wake = 0f
        /** der laufende Ausfall ist ein langer (30 s bis 5 min), kein kurzer beim Glitch-Ausbruch */
        var long = false
        /** gerade erst wiedergekommen: fällt so lange nicht gleich wieder aus */
        var rest = 0f
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
        // Abschnitte des Streifens innerhalb des Bruchstücks (y von, y bis, …) und ihre Länge, gilt für die Lage ivX
        var iv = FloatArray(4)
        var ivN = 0
        var ivX = Float.NaN
        var len = 0f
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
        var mask = BooleanArray(1) { true }
        var zones = arrayOf(Zone())
        var vis = false
        var a = 0f
        var cx = 0f
        /** Zeitpunkt des Erscheinens (für das kurze Aufblitzen), −1 = schon immer da. */
        var born = -1f
    }

    // ---------- Einstellungen / Muster ----------

    fun configure(calm: Int, burst: Int, shear: Int, seed: Long) {
        this.calm = calm
        if (burst != this.burst || pool.isEmpty()) {
            // Regler geändert: nächsten Ausbruch neu planen, damit "seltener" sofort wirkt
            this.burst = burst
            burstT = 0f
            nextBurst = scheduleBurst(burst / 10f)
        }
        this.shearAmt = shear
        if (seed != this.seed || pool.isEmpty()) {
            this.seed = seed
            buildPool(seed)
        }
    }

    /**
     * Risse einstellen. from/to: Anzahl Hauptrisse von – bis (0..36); grow: mehr mit der Zeit (in hours Stunden, Durchgang
     * ab start). impacts: Anzahl Aufschläge 1..3; manual: je Aufschlag selbst angetippt (Aufschlag x, y, Richtung x, y
     * als Anteil von Breite und Höhe) oder null. hshare: Anteil waagerechter Risse in Prozent.
     * clockKey: Einstellungen der Uhr, von denen der Riss durch die Uhr abhängt.
     */
    fun configureCracks(from: Int, to: Int, grow: Boolean, hours: Int, start: Long, splinter: Int, seed: Long,
                        impacts: Int, manual: Array<FloatArray?>, hshare: Int, clockKey: String) {
        if (from != crackFrom || to != crackTo || grow != crackGrow || hours != crackHours) countChanged = true
        crackFrom = from
        crackTo = to
        crackGrow = grow
        crackHours = hours
        crackStart = start
        val mk = manual.joinToString(";") { m -> m?.joinToString(",") ?: "-" }
        // welcher Riss durch die Uhr läuft, hängt auch von „von“/„bis“ ab: ändert sich das, die Risse neu bauen
        val key = "$splinter|$seed|$impacts|$mk|$hshare|$clockKey|$clockSpan"
        if (key == shapeKey) return
        shapeKey = key
        this.splinter = splinter
        crackSeed = seed
        this.impacts = impacts
        this.manual = manual
        this.hshare = hshare
        this.clockKey = clockKey
        countChanged = true
        cracksDirty = true
    }

    /** Anzahl Hauptrisse jetzt (mit „Mehr Risse mit der Zeit“ wachsend). */
    fun crackTarget(now: Long): Int {
        val a = crackFrom.coerceIn(0, Cracks.MAX)
        val b = crackTo.coerceIn(0, Cracks.MAX)
        if (!crackGrow || b <= a || crackStart <= 0L) return a
        val f = ((now - crackStart) / (crackHours * 3_600_000f)).coerceIn(0f, 1f)
        return Math.round(a + (b - a) * f)
    }

    /** Gerade zu sehende Anzahl Hauptrisse (für die Anzeige in den Einstellungen). */
    val shownCracks: Int get() = max(0, crackN)

    /**
     * Aus so vielen Rissen wird zufällig der gewählt, der durch die Uhr läuft: ohne „Mehr Risse mit der Zeit“ einer der
     * sichtbaren, sonst irgendeiner bis „bis“ (die Uhr bekommt ihren Riss dann irgendwann unterwegs).
     */
    private val clockSpan: Int
        get() {
            val a = crackFrom.coerceIn(0, Cracks.MAX)
            val b = crackTo.coerceIn(0, Cracks.MAX)
            return max(1, if (crackGrow && b > a) b else a)
        }

    /** Restzeit bis zum Neustart der wachsenden Risse in ms (−1 = wachsen nicht). */
    fun crackRemainingMs(now: Long): Long =
        if (crackGrow && crackStart > 0L && crackTo > crackFrom) max(0L, crackHours * 3_600_000L - (now - crackStart)) else -1L

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

    /**
     * Vorrat an Streifen in fester Reihenfolge (gleicher Zufallswert = gleiche Streifen). Sichtbar sind immer die
     * ersten n: Kommen Streifen dazu, bleiben die vorhandenen, wie sie sind (das Display geht weiter kaputt).
     */
    private fun buildPool(seed: Long) {
        val pr = Random(seed)
        fun p(a: Float, b: Float) = a + pr.nextFloat() * (b - a)
        pool.clear()
        lines.clear()
        // Cluster wie bei echtem Displayschaden
        val nCl = 2 + pr.nextInt(3)
        val cc = FloatArray(nCl) { p(0.1f, 0.95f) }
        val csp = FloatArray(nCl) { p(0.03f, 0.12f) }
        for (i in 0 until POOL) {
            val l: Line
            if (i >= 3 && pr.nextFloat() < 0.107f) {
                // Doppellinie dicht neben einem schon vorhandenen Streifen
                val p0 = pool[pr.nextInt(i)]
                l = makeLine(pr, (p0.x + p(0.004f, 0.01f)).coerceAtMost(0.995f))
                l.col = PAL[pr.nextInt(PAL.size)]
            } else {
                val x = if (pr.nextFloat() < 0.65f) {
                    val k = pr.nextInt(nCl)
                    cc[k] + (pr.nextFloat() - 0.5f) * 2f * csp[k]
                } else pr.nextFloat()
                l = makeLine(pr, x.coerceIn(0.005f, 0.995f))
            }
            pool.add(l)
        }
        poolFresh = true
    }

    /** Sichtbare Streifen an die gewünschte Zahl anpassen; neue blitzen beim Erscheinen kurz auf. */
    private fun setVisible(n: Int) {
        shownCount = n
        val birth = !poolFresh
        poolFresh = false
        val total = min(pool.size, max(1, Math.round(n * 1.12f)))
        while (lines.size < total) {
            val l = pool[lines.size]
            l.off = 0f; l.flash = 0f; l.fragOn = false
            l.zones = Array(nR) { Zone() }
            l.mask = BooleanArray(nR) { true }
            l.born = if (birth) t else -1f
            lines.add(l)
        }
        while (lines.size > total) lines.removeAt(lines.size - 1)
    }

    private fun growFrac(now: Long): Float {
        var f = 0f
        if (growTime && growStart > 0L) f = max(f, ((now - growStart) / (growHours * 3_600_000f)).coerceIn(0f, 1f))
        // voller Akku = „von“, kurz vor leer (5 %) = „bis“
        if (growBatt) f = max(f, ((1f - battery) / 0.95f).coerceIn(0f, 1f))
        return f
    }

    fun targetCount(now: Long): Int =
        if (growTime || growBatt) Math.round(countFrom + (countTo - countFrom) * growFrac(now)) else countFrom

    /** Restzeit bis zum Neustart in ms (−1 = ohne Zeit). */
    fun growRemainingMs(now: Long): Long =
        if (growTime && growStart > 0L) max(0L, growHours * 3_600_000L - (now - growStart)) else -1L

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
        // neue Risse beim Wachsen: die bisherigen bleiben genau gleich, nur die dazugekommenen blitzen auf
        val flash = growFlash && cs != null
        growFlash = false
        val before = cs?.divs?.size ?: 0
        val set = Cracks.make(max(0, crackN), splinter, crackSeed, h / w.toDouble(), impacts, manual, hshare, rect, clockSpan)
        cs = set
        crackBmp?.recycle()
        crackBmp = null
        regFlash.clear()
        if (set == null) {
            nR = 1
            regPath = arrayOf(null)
            regPoly = arrayOf(null)
            regX0 = floatArrayOf(-1e6f); regX1 = floatArrayOf(1e6f)
            regY0 = floatArrayOf(0f); regY1 = floatArrayOf(1e6f)
            regS = floatArrayOf(0f); regZone = intArrayOf(ZONE_ALL)
            regClock = booleanArrayOf(false); regDx = floatArrayOf(0f)
            regNb = arrayOf(IntArray(0)); regFrac = floatArrayOf(1f)
            regDead = floatArrayOf(0f); regDeadT = floatArrayOf(0f); regDv = booleanArrayOf(false)
            regKeep0 = floatArrayOf(Float.NaN); regKeep1 = floatArrayOf(Float.NaN)
            allocRegionState(1)
            glN = 0
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
            regNb = Array(nR) { rs[it].nb }
            regFrac = FloatArray(nR) { (rs[it].area / set.a).toFloat() }
            regDead = FloatArray(nR)
            regDeadT = FloatArray(nR)
            regDv = BooleanArray(nR)
            regKeep0 = FloatArray(nR) { Float.NaN }
            regKeep1 = FloatArray(nR) { Float.NaN }
            allocRegionState(nR)
            crackBmp = renderCracks(set)
            buildGlints(set)
            if (flash) {
                for (i in before until set.divs.size) {
                    val p = set.divs[i]
                    if (p.size < 4) continue
                    val path = Path()
                    path.moveTo((p[0] * w).toFloat(), (p[1] * w).toFloat())
                    var k = 2
                    while (k + 1 < p.size) {
                        path.lineTo((p[k] * w).toFloat(), (p[k + 1] * w).toFloat())
                        k += 2
                    }
                    crackFlashes.add(CrackFlash(path, t))
                }
                // der neue Riss springt mit einem kurzen Glitch ins Glas
                triggerBurst(ZONE_ALL)
                burstT = r(0.2f, 0.45f)
            }
        }
        czones = Array(nR + 1) { ClockZone() }
        for (l in lines) {
            l.zones = Array(nR) { Zone() }
            l.mask = BooleanArray(nR) { true }
            l.fragOn = false
        }
        for (q in pressLines) q.zone.ivX = Float.NaN
        regMapKey = ""
        // Uhr-Stücke gleich bestimmen, dann die schwarzen Stücke verteilen (dafür muss bekannt sein, wo die Uhr liegt)
        updateClockPieces()
        seedDead(false)
    }

    private fun allocRegionState(n: Int) {
        regRest = FloatArray(n)
        regPend = FloatArray(n)
        regPendLen = FloatArray(n)
        regDOK = BooleanArray(n)
        regDW = FloatArray(n)
        regClockN = IntArray(n)
        regCS = FloatArray(n)
    }

    /**
     * Welche Bruchstücke liegen im Bereich der Uhr (und wie viel von ihr)? Neu, wenn sich das Bild der Uhr ändert; dann
     * auch den Versatz der Uhr-Stücke und welche Stücke schwarz werden dürfen.
     */
    private fun updateClockPieces() {
        val ck = clock
        val layer = ck?.layer
        clockLayerSeen = layer
        regMapKey = ""
        val set = cs ?: return
        if (regClockN.size != nR) return
        for (i in 0 until nR) {
            regClock[i] = false
            regClockN[i] = 0
            regCS[i] = 0f
            if (ck == null || layer == null) continue
            if (regX1[i] < ck.x || regX0[i] > ck.x + layer.width || regY1[i] < ck.y || regY0[i] > ck.y + layer.height) continue
            val reg = set.regions[i]
            for (yy in 0..8) for (xx in 0..8) {
                if (reg.contains((ck.x + layer.width * xx / 8f) / w.toDouble(), (ck.y + layer.height * yy / 8f) / w.toDouble())) regClockN[i]++
            }
            regClock[i] = regClockN[i] > 0
        }
        clockShifts(set)
        prepDark()
    }

    /**
     * Versatz der Uhr-Stücke („Riss durch die Uhr“): Jeder Riss durch die Ziffern soll eine sichtbare Lücke haben, deshalb
     * bekommen benachbarte Stücke der Uhr deutlich verschiedenen Versatz (meist abwechselnd nach links und rechts; stoßen
     * drei Stücke aneinander, steht eins still oder geht nur halb so weit). Richtung und Stärke kommen aus der Lage des
     * Stücks, damit es ruhig bleibt, wenn woanders Risse dazukommen. Liegt die ganze Uhr in einem Stück, bleibt sie stehen.
     */
    private fun clockShifts(set: CrackSet) {
        val cl = (0 until nR).filter { regClock[it] }.sortedBy { set.regions[it].cx }
        if (cl.size < 2) return
        val hs = Cracks.seedHash(crackSeed)
        val done = BooleanArray(nR)
        val cand = FloatArray(5)
        for (i in cl) {
            val g = set.regions[i]
            val pref = if (Cracks.hash01(g.cx, g.cy, hs + 3) < 0.5) -1f else 1f
            val m = (0.85 + 0.3 * Cracks.hash01(g.cy, g.cx, hs + 5)).toFloat()
            cand[0] = pref; cand[1] = -pref; cand[2] = 0.5f * pref; cand[3] = -0.5f * pref; cand[4] = 0f
            var best = pref * m
            var bestD = -1f
            for (v0 in cand) {
                val v = v0 * m
                var d = 9f
                for (j in regNb[i]) if (j < nR && done[j]) d = min(d, abs(v - regCS[j]))
                if (d > bestD + 1e-6f) { bestD = d; best = v }
                if (d >= 0.9f) break
            }
            regCS[i] = best
            done[i] = true
        }
    }

    /**
     * Nebenrisse (Abzweige, kleine Risse) laufen bis zum Haarriss aus: bis ein Drittel der Länge wie ihr Riss, dann immer
     * schmaler bis auf gut ein Viertel (schmaler als ein Pixel wird die Linie stattdessen blasser). u: Stelle 0..1
     */
    private fun nebenTaper(u: Double) = if (u < 0.33) 1.0 else 1 - 0.72 * ((u - 0.33) / 0.67).pow(0.85)

    /** Glanz der Nebenrisse: ab einem Viertel weich schwächer, an der Spitze nur noch ein Hauch. */
    private fun nebenShine(u: Double) = if (u < 0.25) 1.0 else 0.06 + 0.94 * max(0.0, 1 - (u - 0.25) / 0.75).pow(1.6)

    // ---------- Glitzern der Risse beim Neigen ----------
    // An den Kanten der Risse sitzen winzige Bruchflächen, die das Licht nur in einem ganz bestimmten Winkel zurückwerfen:
    // Jede blitzt bei ihrer eigenen Neigung des Handys kurz auf, als einzelnes Pixel (am Aufschlag dichter und heller). Das
    // Fenster ist schmal und die Neigung kaum geglättet (gTiltX/gTiltY), so blitzt es schon bei kleinen Bewegungen schnell
    // auf und wieder aus; es leuchtet immer nur etwa jede zweihundertste. Eigener Zufall je Muster.

    private var glN = 0
    private var glX = FloatArray(0)
    private var glY = FloatArray(0)
    private var glNX = FloatArray(0)
    private var glNY = FloatArray(0)
    private var glB = FloatArray(0)
    private val glPaint = Paint().apply { style = Paint.Style.FILL; color = Color.WHITE }

    private fun buildGlints(set: CrackSet) {
        val R = Random(crackSeed xor 0x5BD1E995L)
        val xs = ArrayList<Float>(); val ys = ArrayList<Float>(); val nxs = ArrayList<Float>(); val nys = ArrayList<Float>(); val bs = ArrayList<Float>()
        val s = w.toDouble()
        fun boostAt(x: Double, y: Double): Double {
            var m = 0.0
            for (p in set.imps) m = max(m, p[2] * exp(-Math.hypot(x - p[0], y - p[1]) / 0.05))
            return 1 + 1.3 * m
        }
        fun add(x: Double, y: Double, b: Double) {
            if (x < 0 || y < 0 || x >= w || y >= h) return
            val a = R.nextDouble() * 2 * PI
            val r = Math.sqrt(R.nextDouble()) * 1.05
            xs.add(round(x.toFloat())); ys.add(round(y.toFloat()))
            nxs.add((cos(a) * r).toFloat()); nys.add((sin(a) * r).toFloat()); bs.add(b.toFloat())
        }
        for (cl in set.lines) {
            // auf der hellen Kante des Risses, etwa alle 2 Bildpunkte (Haarrisse seltener)
            val o = density * (0.38 + 0.14 * cl.v + (0.32 + 0.1 * cl.v) * cl.w)
            val step = if (cl.kind == CrackSet.HAIR) 0.012 else 0.005
            val base = if (cl.kind == CrackSet.HAIR) 0.55 else 0.8 + 0.2 * cl.v
            var next = R.nextDouble() * step
            var acc = 0.0
            val n = cl.cl.size
            for (i in 1 until n) {
                val ax = cl.pts[2 * i - 2]; val ay = cl.pts[2 * i - 1]
                val bx = cl.pts[2 * i]; val by = cl.pts[2 * i + 1]
                val l = Math.hypot(bx - ax, by - ay)
                while (next <= acc + l) {
                    val f = if (l > 0) (next - acc) / l else 0.0
                    val x = ax + (bx - ax) * f
                    val y = ay + (by - ay) * f
                    add(x * s + cl.nx * o, y * s + cl.ny * o, base * boostAt(x, y))
                    next += step * (0.5 + R.nextDouble())
                }
                acc += l
            }
        }
        for (sh in set.shards) {
            var k = 0
            while (k + 1 < sh.tri.size) { add(sh.tri[k] * s, sh.tri[k + 1] * s, 1.3); k += 2 }
        }
        glN = xs.size
        glX = xs.toFloatArray(); glY = ys.toFloatArray(); glNX = nxs.toFloatArray(); glNY = nys.toFloatArray(); glB = bs.toFloatArray()
    }

    private fun drawGlints(c: Canvas) {
        if (!glint || glN == 0 || cs == null) return
        val tx = gTiltX
        val ty = gTiltY
        val r2 = GLINT_R * GLINT_R
        val big = if (density >= 2.5f) 2f else 1f
        for (i in 0 until glN) {
            val dx = glNX[i] - tx
            val dy = glNY[i] - ty
            val d2 = dx * dx + dy * dy
            if (d2 >= r2) continue
            // dazu ein leichtes Funkeln von Bild zu Bild
            val k = 1f - kotlin.math.sqrt(d2) / GLINT_R
            val a = min(1f, k.pow(1.5f) * glB[i] * (0.65f + 0.35f * rnd.nextFloat()))
            if (a < 0.03f) continue
            // ein einzelner Bildpunkt (auf sehr feinen Bildschirmen die hellsten zwei mal zwei, sonst sieht man sie kaum)
            val z = if (a > 0.55f) big else 1f
            glPaint.alpha = (a * 255f).toInt().coerceIn(0, 255)
            c.drawRect(glX[i], glY[i], glX[i] + z, glY[i] + z, glPaint)
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
        // an den Aufschlägen ist das Glas zertrümmert und fängt mehr Licht (je Aufschlag verschieden stark)
        fun boost(x: Double, y: Double): Double {
            var m = 0.0
            for (p in set.imps) m = max(m, p[2] * exp(-Math.hypot(x - p[0], y - p[1]) / 0.05))
            return 1 + 1.3 * m
        }

        // 1) dunkle Bruchkante: fein, am Aufschlag etwas breiter, zum Ende hin schmaler (in Stücken gezeichnet); kräftige
        //    Risse (v) etwas breiter; Haarrisse nur ein Hauch. Nebenrisse (Abzweige und kleine Risse) laufen bis zum
        //    Haarriss aus: ab einem Drittel ihrer Länge immer schmaler und blasser (in kürzeren Stücken, damit es weich
        //    ausläuft).
        for (cl in set.lines) {
            val n = cl.cl.size
            val total = max(1e-9, cl.cl[n - 1])
            val neben = cl.kind == CrackSet.TWIG || cl.kind == CrackSet.BRANCH
            dark.color = if (cl.kind == CrackSet.HAIR) Color.argb(178, 0, 0, 0) else Color.BLACK
            var i0 = 0
            while (i0 < n - 1) {
                var i1 = i0 + 1
                while (i1 < n - 1 && cl.cl[i1] - cl.cl[i0] < (if (neben) 0.008 else 0.04)) i1++
                val u = cl.cl[i0] / total
                val f = when (cl.kind) {
                    CrackSet.SPOKE -> 1.35 - 0.6 * min(1.0, cl.cl[i0] / max(0.3, total))
                    // Strahlen am Aufschlag und Haarrisse laufen zur Spitze hin aus, Nebenrisse bis zum Haarriss
                    CrackSet.RAY -> 1.2 - 0.8 * u
                    CrackSet.TWIG -> 1.15 * nebenTaper(u)
                    CrackSet.BRANCH -> nebenTaper(u)
                    CrackSet.HAIR -> 1.15 - 0.75 * u
                    else -> 1.0
                }
                if (neben) dark.color = Color.argb(((0.55 + 0.45 * nebenTaper(u)) * 255).toInt(), 0, 0, 0)
                dark.strokeWidth = max(1f, ((0.85 + 0.27 * cl.v) * density * cl.w * f).toFloat())
                path.reset()
                path.moveTo((cl.pts[2 * i0] * s).toFloat(), (cl.pts[2 * i0 + 1] * s).toFloat())
                for (k in i0 + 1..i1) path.lineTo((cl.pts[2 * k] * s).toFloat(), (cl.pts[2 * k + 1] * s).toFloat())
                c.drawPath(path, dark)
                i0 = i1
            }
        }
        // 2) Glanz: sehr dünne helle Linie dicht an der Kante, auf der Seite zum Licht. Gleiche Helligkeit wird zu einem
        //    Linienzug zusammengefasst (sonst überlappen sich die Stücke zu Perlen).
        fun shineLine(cl: CrackSet.Line, side: Int, amt: (Double) -> Double) {
            val o = density * (0.38 + 0.14 * cl.v + (0.32 + 0.1 * cl.v) * cl.w) * side
            val ox = (cl.nx * o).toFloat()
            val oy = (cl.ny * o).toFloat()
            val al = (0.82 + 0.1 * cl.v).toFloat()
            shine.strokeWidth = max(1f, ((0.4 + 0.12 * cl.v) * density * (0.75 + 0.35 * cl.w)).toFloat())
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
                        shine.color = Color.argb((lv / 14f * al * 255f).toInt().coerceIn(0, 255), 235, 242, 255)
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
            // Nebenrisse, Strahlen und Haarrisse: der Glanz läuft zur Spitze hin aus (Nebenrisse bis zu einem Hauch)
            val tot = max(1e-9, cl.cl[cl.cl.size - 1])
            when (cl.kind) {
                CrackSet.TWIG, CrackSet.BRANCH -> shineLine(cl, 1) { sv -> nebenShine(sv / tot) }
                CrackSet.RAY -> shineLine(cl, 1) { sv -> max(0.0, 1 - sv / tot).pow(0.6) }
                CrackSet.HAIR -> shineLine(cl, 1) { sv -> max(0.0, 1 - sv / tot).pow(0.5) }
                else -> shineLine(cl, 1) { 1.0 }
            }
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

    /**
     * Ausbruch auslösen (zone = −1: zufälliger Bereich): dauert zufällig 0,3 bis 0,8 Sekunden.
     * Gibt true zurück, wenn er das ganze Bild betrifft.
     */
    fun triggerBurst(zone: Int = -1): Boolean {
        burstT = r(0.3f, 0.8f)
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

    /**
     * Meist lange Pausen, ab und zu ein schneller Nachschlag – mit genug Pause, dass es zwei kurze bleiben und kein langer
     * wird. Regler links = sehr selten.
     */
    private fun scheduleBurst(bur: Float): Float {
        if (chance(0.18f * bur)) return r(0.8f, 2.2f)
        val p = if (chance(0.3f)) r(25f, 60f) else r(8f, 25f)
        return p * (0.5f + (1f - bur).pow(2) * 4f)
    }

    private fun jit() = if (burstT > 0f && chance(0.3f)) r(0.6f, 1.8f) else 1f

    // ---------- Finger auf dem Glas ----------

    private class Touch(var x: Float, var y: Float, var up: Float) {
        // Stück für den Flächenglitch (nur neu gesucht, wenn der Finger sich bewegt hat oder die Risse neu sind)
        var fi = -1
        var fx = 0f
        var fy = 0f
        var fSet: CrackSet? = null
    }
    /**
     * Finger: Lage, Bruchstück darunter (ri), kleinstes Stück unter der Fingerkuppe (fi, für den Flächenglitch), Stärke
     * (klingt nach dem Loslassen ab), liegt noch (down)
     */
    private class Press(val x: Float, val ri: Int, val fi: Int, val k: Float, val down: Boolean)
    private class PressLine(val line: Line, val ri: Int, var life: Float, val col: Int) {
        val zone = Zone()
    }

    private val touches = HashMap<Int, Touch>()
    private val presses = ArrayList<Press>()
    private val pressLines = ArrayList<PressLine>()

    /** Finger auf dem Glas (Bildschirmpixel). up = false: liegt oder bewegt sich, true: losgelassen. */
    fun touch(id: Int, x: Float, y: Float, up: Boolean) {
        val p = touches[id]
        if (up) {
            if (p != null && p.up < 0f) p.up = t
            return
        }
        if (p != null && p.up < 0f) {
            p.x = x
            p.y = y
        } else touches[id] = Touch(x, y, -1f)
    }

    /** Alle Finger weg (z. B. Berührung abgebrochen). */
    fun touchEnd() {
        for (p in touches.values) if (p.up < 0f) p.up = t
    }

    private fun gauss() = (rnd.nextFloat() + rnd.nextFloat() + rnd.nextFloat() - 1.5f) * 1.15f

    private fun inPoly(poly: FloatArray, x: Float, y: Float): Boolean {
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

    private fun regionAt(x: Float, y: Float): Int {
        if (cs == null) return 0
        for (i in 0 until nR) {
            if (x < regX0[i] || x > regX1[i] || y < regY0[i] || y > regY1[i]) continue
            val poly = regPoly[i] ?: continue
            if (inPoly(poly, x, y)) return i
        }
        return -1
    }

    /**
     * Kleinstes Bruchstück unter der Fingerkuppe (Mitte und ein Kreis von 11 dp drumherum): Für den Flächenglitch haben
     * kleine Stücke Vorrang vor großen.
     */
    private fun smallestUnder(x: Float, y: Float): Int {
        var best = -1
        for (k in 0 until 9) {
            val an = k * PI / 4
            val rr = if (k == 0) 0f else 11f * density
            val i = regionAt(x + (cos(an) * rr).toFloat(), y + (sin(an) * rr).toFloat())
            if (i >= 0 && (best < 0 || regFrac[i] < regFrac[best])) best = i
        }
        return best
    }

    private fun updatePresses() {
        presses.clear()
        // Finger zählen, wenn „Glitch unter dem Finger“ oder „Flächenglitch“ an ist (jedes auch allein)
        if (!touchFx) pressLines.clear()
        if (!touchFx && !touchFlash) {
            touches.clear()
            return
        }
        val it = touches.values.iterator()
        while (it.hasNext()) {
            val p = it.next()
            val age = if (p.up >= 0f) t - p.up else 0f
            if (age > 0.3f) { it.remove(); continue }
            val ri = regionAt(p.x, p.y)
            var fi = -1
            val set = cs
            if (touchFlash && p.up < 0f && set != null) {
                if (p.fSet !== set || hypot(p.x - p.fx, p.y - p.fy) > 2f * density) {
                    p.fSet = set
                    p.fx = p.x
                    p.fy = p.y
                    p.fi = smallestUnder(p.x, p.y)
                }
                fi = p.fi
            }
            presses.add(Press(p.x, ri, fi, 1f - age / 0.3f, p.up < 0f))
            // Druckstreifen: unter dem Finger tauchen kurz neue Linien auf
            if (touchFx && p.up < 0f && chance(p(14f)) && pressLines.size < 24) {
                val l = makeLine(rnd, ((p.x + gauss() * 9f * density) / w).coerceIn(0.002f, 0.998f))
                pressLines.add(PressLine(l, ri, r(0.08f, 0.45f), if (chance(0.5f)) pickCol() else l.col))
            }
        }
        val pit = pressLines.iterator()
        while (pit.hasNext()) {
            val q = pit.next()
            q.life -= dt
            if (q.life <= 0f) pit.remove()
        }
    }

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

    // Bereich der Uhr in diesem Bild (Bildschirmpixel, großzügig): dort verdecken die Streifen die Uhr
    private var cvOn = false
    private var cvX0 = 0f
    private var cvY0 = 0f
    private var cvX1 = 0f
    private var cvY1 = 0f
    private val pErase = Paint().apply {
        isAntiAlias = true
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.BUTT
        color = Color.BLACK
    }

    private fun setClockArea(x0: Float, y0: Float, x1: Float, y1: Float) {
        // Platz für Bruchstücke, die am Riss versetzt sind, und für verrutschte Zeilen bei Glitches
        val m = 30f * density
        cvOn = true
        cvX0 = x0 - m
        cvY0 = y0 - m
        cvX1 = x1 + m
        cvY1 = y1 + m
    }

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
        // Über der Uhr ist diese Spalte des Displays kaputt: erst schwarz, dann der Streifen darauf. So liegt er wirklich
        // über der Uhr und sieht genauso aus wie auf dem schwarzen Grund (statt nur durchzuschimmern).
        if (cvOn && y1 > cvY0 && y0 < cvY1) {
            val core = max(1f, round(lw))
            val xm = (xa + xb) * 0.5f
            if (xm + core > cvX0 && xm - core < cvX1) {
                val ya = max(y0, cvY0)
                val yb = min(y1, cvY1)
                val ea = if (l.tilt == 0f) xa else x + l.tilt * w * (ya / h - 0.5f)
                val eb = if (l.tilt == 0f) xa else x + l.tilt * w * (yb / h - 0.5f)
                // gerade Breiten liegen halb auf den Nachbarpixeln: dort ganz abdecken, sonst bleibt ein heller Rand
                pErase.strokeWidth = if (core.toInt() % 2 == 0) core + 1f else core
                c.drawLine(ea, ya, eb, yb, pErase)
            }
        }
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

    /** Zustand aller Streifen für dieses Bild: Ausfälle, Farbblitze, Versatz je Bruchstück, Finger. */
    private fun stripeStates(bursting: Boolean) {
        val multi = nR > 1
        for (l in lines) {
            if (l.zones.size != nR) {
                l.zones = Array(nR) { Zone() }
                l.mask = BooleanArray(nR) { true }
                l.fragOn = false
            }
            l.vis = false
            // ohne Risse fällt ab und zu ein ganzer Streifen kurz aus; mit Rissen nie über den ganzen Bildschirm, dort
            // fällt er nur in einzelnen Bruchstücken aus und endet an der Risskante (unten)
            if (!multi) {
                if (l.off > 0f) {
                    l.off -= dt
                    if (l.off > 0f) continue
                } else if (chance(if (bursting) 0.02f else p(0.03f * g))) {
                    l.off = r(0.05f, if (bursting) 0.4f else 1.5f)
                    continue
                }
            } else l.off = 0f
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
            // Grundflackern: jeder Streifen flimmert unabhängig in kleinen, schnellen Helligkeitsschritten (halb so stark
            // wie früher, der Regler bleibt)
            if (l.dim <= 0f) {
                l.dim = r(0.03f, 0.09f)
                l.dimF = 1f - calmF * r(0f, 0.225f)
            } else l.dim -= dt
            l.a = (l.base * l.dimF).coerceIn(0f, 1f)
            var x = l.x * w
            if (bursting && chance(0.15f)) x += r(-3f, 3f) * density
            l.cx = x
            // abgerissen: ohne Risse bleibt der Streifen kurz nur unten ab einer zufälligen Höhe stehen. Mit Rissen nicht –
            // dort fallen Streifen nur je Bruchstück aus (lange, siehe unten), statt quer übers Bild zu verschwinden
            if (multi) l.fragOn = false
            else if (!l.fragOn && chance(if (bursting) 0.02f else p(0.02f * g))) {
                l.fragOn = true
                l.fragT = r(0.3f, 3f)
                l.fragY = r(0.55f, 0.9f) * h
            }
            if (l.fragOn) {
                l.fragT -= dt
                if (l.fragT <= 0f) l.fragOn = false
            }
            l.vis = true
        }
        // je Bruchstück: Versatz, Ausfälle und Farbblitze der Teilstücke. Fällt ein Streifen in einem Bruchstück aus,
        // stirbt er dort an der Risskante (flackert kurz) und bleibt 30 Sekunden bis 5 Minuten weg (jedes Mal anders: viele
        // kürzer, manche richtig lang), dann kommt er flackernd wieder. Wie viele gerade fehlen: sobald ein Riss da ist, bei
        // 4 Streifen einer, bei 5 zwei, danach etwa für jeden zweiten Streifen einer mehr (mit „Glitch-Ausbrüche“ etwas
        // mehr oder weniger, höchstens 30 % der Teilstücke). Ab 3 Rissen fehlen deutlich mehr, aber nie alle: bei 3 Rissen
        // 1,6-mal so viele, mit jedem weiteren Riss etwas mehr (2,2-mal ab 15 Rissen), höchstens 45 % der Teilstücke.
        // Fehlt einer zu wenig, stirbt nach ein paar Sekunden der nächste. Bei Ausbrüchen fallen Teilstücke auch kurz aus.
        val nC = max(0, crackN)
        val more = if (nC >= 3) 1.6f + 0.05f * min(nC - 3, 12) else 1f
        val want = if (multi) (0.5f * (shownCount - 2) * (g / 0.343f).coerceIn(0f, 1.6f) * more).roundToInt().coerceAtLeast(0) else 0
        var gone = 0
        var segs = 0
        cand.clear()
        for (ri in 0 until nR) {
            // ausgefallenes Bruchstück: bleibt schwarz (bis auf die Seite, auf der Streifen stehen bleiben)
            if (regDv[ri] && !hasKeep(ri)) {
                for (l in lines) {
                    val z = l.zones[ri]
                    z.drawn = false
                    z.fl = false
                }
                continue
            }
            val dx = round(regS[ri] * shearAmt * SHEAR_K * density * jit())
            regDx[ri] = dx
            val sb = burstT > 0f && multi && (burstZone == ZONE_ALL || burstZone == regZone[ri])
            val lo = regX0[ri] - 6f * density
            val hi = regX1[ri] + 6f * density
            val poly = regPoly[ri]
            for (l in lines) {
                val z = l.zones[ri]
                z.drawn = false
                z.fl = false
                if (!l.vis) continue
                var x = l.cx + dx
                if (x < lo || x > hi || (regDv[ri] && deadAt(ri, x))) continue
                if (multi) {
                    // hat der Streifen in diesem Stück überhaupt ein Teilstück (und wie lang)?
                    if (poly != null && z.ivX != x) {
                        z.x = x
                        stripeIntervals(z, l, poly)
                    }
                    if (poly == null) z.len = h
                    val seg = z.len > 4f * density
                    if (seg) segs++
                    if (z.rest > 0f) z.rest -= dt
                    if (z.off > 0f) {
                        z.off -= dt
                        if (z.off > 0f) {
                            if (z.long) gone++
                            continue
                        }
                        z.wake = if (z.long) r(0.12f, 0.3f) else 0f
                        z.rest = if (z.long) r(10f, 30f) else 0f
                    } else if (z.die <= 0f && sb && chance(0.035f * burstPow)) {
                        z.off = r(0.2f, 1.2f)
                        z.long = false
                        continue
                    }
                    if (z.die > 0f) {
                        gone++
                        z.die -= dt
                        if (z.die <= 0f) {
                            z.die = 0f
                            z.off = 30f * 10f.pow(rnd.nextFloat())
                            z.long = true
                            continue
                        }
                    } else if (seg && z.wake <= 0f && z.rest <= 0f) cand.add(z)
                    if (z.wake > 0f) z.wake -= dt
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
                // gerade erst aufgetaucht: kurz hell aufblitzen
                if (l.born >= 0f && t - l.born < 0.45f) {
                    a = if (chance(0.6f)) r(1f, 1.6f) else r(0.1f, 0.4f)
                    if (chance(0.3f)) cc = pickCol()
                }
                // stirbt gerade an der Risskante oder kommt wieder: flackert
                if (multi && (z.die > 0f || z.wake > 0f)) a = if (chance(0.45f)) 0f else a * r(0.3f, 1.5f)
                // Finger auf diesem Bruchstück, genau über dem Streifen
                if (touchFx) for (pr in presses) {
                    if ((multi && pr.ri != ri) || abs(x - pr.x) > (16f + l.w * 4f) * density) continue
                    a = if (chance(0.5f)) r(0.9f, 1.6f) else r(0.05f, 0.5f)
                    if (chance(0.4f)) cc = pickCol()
                    x += r(-1.5f, 1.5f) * density * pr.k
                    z.fl = true; z.flCol = cc; z.flW = r(4f, 14f) * density; z.flDx = r(-4f, 4f) * density
                    break
                }
                z.drawn = true
                z.a = a.coerceIn(0f, 1f)
                z.c = cc
                z.x = x
            }
        }
        // fehlen zu wenige: der nächste Streifen stirbt an einer Risskante (fehlt einer, im Schnitt nach 2 Sekunden). Lange
        // Teilstücke sind eher dran als kleine Ecken, damit man den Ausfall auch sieht.
        val lim = min(want, (segs * (if (nC >= 3) 0.45f else 0.3f)).roundToInt())
        if (gone < lim && cand.isNotEmpty() && chance(p(0.5f * (lim - gone)))) {
            var sum = 0f
            for (z in cand) sum += z.len
            var s = rnd.nextFloat() * sum
            for ((i, z) in cand.withIndex()) {
                s -= z.len
                if (s <= 0f || i == cand.size - 1) {
                    z.die = r(0.15f, 0.45f)
                    break
                }
            }
        }
    }

    /** Teilstücke, die gerade ausfallen könnten (für [stripeStates]) */
    private val cand = ArrayList<Zone>()

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
        var len = 0f
        var q = 0
        while (q + 1 < n) { len += cross[q + 1] - cross[q]; q += 2 }
        z.len = len
    }

    /** Streifen zeichnen: in jedem Bruchstück nur bis genau an den Riss. */
    private fun drawStripes(c: Canvas, bursting: Boolean) {
        for (ri in 0 until nR) {
            // ausgefallenes Bruchstück: bleibt schwarz (bis auf die Seite, auf der Streifen stehen bleiben)
            if (regDv[ri] && !hasKeep(ri)) continue
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
                } else if (l.fragOn) {
                    drawSeg(c, l, z.x, l.fragY, h, z.a, z.c)
                    if (chance(0.2f)) drawSeg(c, l, z.x, l.fragY - r(10f, 60f) * density, l.fragY - r(2f, 8f) * density, z.a * 0.7f, z.c)
                } else drawSeg(c, l, z.x, 0f, h, z.a, z.c)
            }
            // Druckstreifen unter dem Finger, nur in diesem Bruchstück
            for (q in pressLines) {
                if (cs != null && q.ri != ri) continue
                val x = q.line.x * w
                if (deadAt(ri, x)) continue
                val col = if (chance(0.2f)) pickCol() else q.col
                if (poly != null) {
                    val z = q.zone
                    z.x = x
                    if (z.ivX != x) stripeIntervals(z, q.line, poly)
                    var k = 0
                    while (k + 1 < z.ivN) {
                        drawSeg(c, q.line, x, z.iv[k], z.iv[k + 1], r(0.3f, 1f), col)
                        k += 2
                    }
                } else drawSeg(c, q.line, x, 0f, h, r(0.3f, 1f), col)
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

    /** Glitch-Zustand eines Uhr-Stücks fortschreiben. false = Stück ist gerade aus. */
    private fun stepClockZone(z: ClockZone, zone: Int): Boolean {
        // Die Uhr glitcht als Ganzes nur bei einem Ausbruch in ihrem Bereich
        val sb = burstT > 0f && (burstZone == ZONE_ALL || burstZone == zone)
        if (z.off > 0f) {
            z.off -= dt
            if (z.off > 0f) return false
        } else if (sb && chance(0.02f * burstPow)) {
            z.off = r(0.04f, 0.3f)
            return false
        }
        if (z.flash > 0f) z.flash -= dt
        else if (sb && chance(0.18f * burstPow)) { z.flash = r(0.03f, 0.15f); z.col = pickCol() }
        if (z.split > 0f) z.split -= dt
        else if (sb && chance(0.12f * burstPow)) { z.split = r(0.04f, 0.22f); z.sx = r(2f, 7f) * density * (if (chance(0.5f)) -1f else 1f) }
        if (z.slice > 0f) z.slice -= dt
        else if (sb && chance(0.05f * burstPow)) z.slice = r(0.05f, 0.2f)
        if (z.flT <= 0f) { z.flT = r(0.03f, 0.09f); z.fl = 1f - calmF * r(0f, 0.11f) } else z.flT -= dt
        return true
    }

    // Fertig ausgeschnittene Stücke der Uhr (versetzt wie im Bild), neu nur wenn sich Uhr, Risse oder Versatz ändern.
    // So muss nicht in jedem Bild entlang der Risse ausgeschnitten werden (Uhr ohne 3D).
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
            val lx = ck.x + round(regCS[i] * k * CLOCK_DX * density)
            val ly = ck.y + round(abs(regCS[i]) * k * CLOCK_DY * density)
            val bx0 = floor(max(regX0[i], lx)).toInt()
            val by0 = floor(max(regY0[i], ly)).toInt()
            val bx1 = ceil(min(regX1[i], lx + layer.width)).toInt()
            val by1 = ceil(min(regY1[i], ly + layer.height)).toInt()
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

    /**
     * Liegt die Uhr ganz in ausgefallenen Bruchstücken? Dann bleibt sie mit ihnen schwarz (außer eins davon läuft auf
     * einer Seite noch).
     */
    private fun clockAllDead(): Boolean {
        if (cs == null) return false
        var any = false
        for (i in 0 until nR) if (regClock[i]) {
            if (!regDv[i] || hasKeep(i)) return false
            any = true
        }
        return any
    }

    private val deadOut = Path()
    private val deadPart = Path()

    /**
     * Ausgefallene Stücke im Bereich der Uhr, in denen auf einer Seite Streifen stehen bleiben: ihren schwarzen Teil
     * ausschneiden (dort keine Uhr, auf der Seite, die noch läuft, schon).
     */
    private fun clipDeadKeep(c: Canvas) {
        var any = false
        deadOut.reset()
        for (i in 0 until nR) {
            if (!regClock[i] || !regDv[i] || !hasKeep(i)) continue
            val path = regPath[i] ?: continue
            deadPart.reset()
            if (regKeep0[i] < 0f) deadPart.addRect(regKeep1[i], 0f, w, h, Path.Direction.CW)
            else deadPart.addRect(0f, 0f, regKeep0[i], h, Path.Direction.CW)
            deadPart.op(path, Path.Op.INTERSECT)
            deadOut.addPath(deadPart)
            any = true
        }
        if (any) c.clipOutPath(deadOut)
    }

    private fun drawClock(c: Canvas) {
        cvOn = false
        val ck = clock ?: return
        val layer = ck.layer ?: return
        if (clockAlpha <= 0.01f) return
        if (clockAllDead()) return
        val sc = c.save()
        if (cs != null) clipDeadKeep(c)
        val m = metal
        // Shader nur auf der Grafikkarte (ohne sie die Uhr wie bisher)
        if (m != null && c.isHardwareAccelerated && draw3D(c, ck, layer, m)) {
            c.restoreToCount(sc)
            return
        }
        setClockArea(ck.x, ck.y, ck.x + layer.width, ck.y + layer.height)
        var pieces = 0
        if (cs != null && clockCrack > 0) for (i in 0 until nR) if (regClock[i]) pieces++
        if (pieces < 2) drawClockPiece(c, ck, layer, -1)
        else {
            cutClockPieces(ck, layer)
            for (i in 0 until nR) if (regClock[i] && (!regDv[i] || hasKeep(i))) drawClockPiece(c, ck, layer, i)
        }
        c.restoreToCount(sc)
    }

    /** Ein Stück der Uhr ohne 3D (ri = −1: die ganze Uhr). */
    private fun drawClockPiece(c: Canvas, ck: ClockFace, layer: Bitmap, ri: Int) {
        val lw = layer.width
        val lh = layer.height
        val z = czones[if (ri < 0) nR else ri]
        val zone = if (ri < 0) clockZoneOf(ck, lh) else regZone[ri]
        if (!stepClockZone(z, zone)) return

        // Versatz des Stücks: zur Seite und etwas nach unten, Stärke nach „Riss durch die Uhr“ (gilt für jeden Riss durch
        // die Uhr, siehe clockShifts)
        val k = if (ri >= 0) clockCrack else 0
        val jx = if (ri >= 0) jit() else 1f
        val x = ck.x + (if (ri >= 0) round(regCS[ri] * k * CLOCK_DX * density * jx) else 0f)
        val y = ck.y + (if (ri >= 0) round(abs(regCS[ri]) * k * CLOCK_DY * density) else 0f)
        val a = (z.fl * clockAlpha * 255f).toInt().coerceIn(0, 255)
        // ruhiges Bild: das fertig ausgeschnittene Stück; nur bei Effekten wird beim Zeichnen ausgeschnitten
        val piece = if (ri >= 0 && jx == 1f && z.split <= 0f && z.slice <= 0f) pieceBmp.getOrNull(ri) else null
        val clipped = ri >= 0 && piece == null
        c.save()
        if (clipped) regPath[ri]?.let { c.clipPath(it) }
        if (piece != null) {
            clockPaint.alpha = a
            c.drawBitmap(piece, pieceX[ri], pieceY[ri], clockPaint)
        } else drawStaticEffects(c, layer, z, x, y, a)
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
                drawBand(c, layer, x + zz.flDx, y, a, zz.flCol)
                c.restore()
            }
        }
        c.restore()
    }

    /** Uhr als Bild: Farbkanäle auseinander, verrutschte Zeilen oder ruhig. */
    private fun drawStaticEffects(c: Canvas, layer: Bitmap, z: ClockZone, x: Float, y: Float, a: Int) {
        val lw = layer.width
        val lh = layer.height
        if (z.split > 0f) {
            chPaint[0].alpha = a; c.drawBitmap(layer, x + z.sx, y, chPaint[0])
            chPaint[1].alpha = a; c.drawBitmap(layer, x, y, chPaint[1])
            chPaint[2].alpha = a; c.drawBitmap(layer, x - z.sx, y, chPaint[2])
        } else if (z.slice > 0f) {
            val n = 3 + rnd.nextInt(4)
            clockPaint.alpha = a
            for (sI in 0 until n) {
                val sy = (lh * sI / n)
                val sh = ceil(lh / n.toFloat()).toInt()
                val dx = r(-1f, 1f) * 10f * density
                srcR.set(0, sy, lw, min(lh, sy + sh))
                dstR.set((x + dx).toInt(), (y + sy).toInt(), (x + dx + lw).toInt(), (y + sy + sh).toInt())
                c.drawBitmap(layer, srcR, dstR, clockPaint)
            }
        } else {
            clockPaint.alpha = a
            c.drawBitmap(layer, x, y, clockPaint)
        }
    }

    /** In einem Band (Ausschnitt schon gesetzt): Uhr verrutscht und in der Farbe des glitchenden Streifens. */
    private fun drawBand(c: Canvas, layer: Bitmap, x: Float, y: Float, a: Int, col: Int) {
        clockPaint.alpha = a
        c.drawBitmap(layer, x, y, clockPaint)
        bandPaint.colorFilter = tint(col)
        bandPaint.alpha = (0.55f * a).toInt()
        c.drawBitmap(layer, x, y, bandPaint)
    }

    // ---------- Uhr in 3D (Metall, Neigung) ----------

    private var regMap: Bitmap? = null
    private var regMapKey = ""
    private var regMapX = 0f
    private var regMapY = 0f
    private var nPieces = 0
    private val pieceRegion = IntArray(Clock3D.MAX_PIECES)
    private val pOff = FloatArray(Clock3D.MAX_PIECES * 2)
    private val pAlpha = FloatArray(Clock3D.MAX_PIECES)
    private val pTint = FloatArray(Clock3D.MAX_PIECES * 4)
    private val pBand = FloatArray(Clock3D.MAX_BANDS * 4)
    private val pDx = FloatArray(Clock3D.MAX_PIECES)
    private val pDy = FloatArray(Clock3D.MAX_PIECES)
    private val pTransient = BooleanArray(Clock3D.MAX_PIECES)
    private val pVisible = BooleanArray(Clock3D.MAX_PIECES)
    // Bänder glitchender Streifen über der Uhr: Stück, x0, x1, Verschiebung, Farbe
    private var nBands = 0
    private val bPiece = IntArray(Clock3D.MAX_BANDS)
    private val bX0 = FloatArray(Clock3D.MAX_BANDS)
    private val bX1 = FloatArray(Clock3D.MAX_BANDS)
    private val bDx = FloatArray(Clock3D.MAX_BANDS)
    private val bCol = IntArray(Clock3D.MAX_BANDS)

    /** Karte der Bruchstücke rund um die Uhr (fest auf dem Bildschirm, die Uhr wandert darunter). */
    private fun updateRegionMap(ck: ClockFace, layer: Bitmap, m: Clock3D, margin: Int) {
        val key = "${System.identityHashCode(cs)}|${ck.x}|${ck.y}|${layer.width}|${layer.height}|$clockCrack|$margin|$nR"
        if (key == regMapKey && regMap != null) return
        regMapKey = key
        nPieces = 0
        if (cs != null && clockCrack > 0) {
            var cnt = 0
            for (i in 0 until nR) if (regClock[i]) cnt++
            if (cnt >= 2) for (i in 0 until nR) if (regClock[i] && nPieces < Clock3D.MAX_PIECES) pieceRegion[nPieces++] = i
        }
        val map: Bitmap
        if (nPieces == 0) {
            // ganze Uhr: überall Stück 1
            map = Bitmap.createBitmap(intArrayOf(Color.rgb(1, 0, 0)), 1, 1, Bitmap.Config.ARGB_8888)
            regMapX = -1e6f
            regMapY = -1e6f
        } else {
            val mx = (ck.x - margin).toInt()
            val my = (ck.y - margin).toInt()
            val mw = layer.width + 2 * margin
            val mh = layer.height + 2 * margin
            map = Bitmap.createBitmap(mw, mh, Bitmap.Config.ARGB_8888)
            val c = Canvas(map)
            c.drawColor(Color.BLACK)
            c.translate(-mx.toFloat(), -my.toFloat())
            val p = Paint()   // ohne Kantenglättung: genaue Nummern
            for (k in 0 until nPieces) {
                val path = regPath[pieceRegion[k]] ?: continue
                p.color = Color.rgb(k + 1, 0, 0)
                c.drawPath(path, p)
            }
            regMapX = mx.toFloat()
            regMapY = my.toFloat()
        }
        regMap = map
        m.setRegions(map)
    }

    /** Uhr aus Metall in 3D zeichnen. false = geht gerade nicht (dann die Uhr ohne 3D). */
    private fun draw3D(c: Canvas, ck: ClockFace, layer: Bitmap, m: Clock3D): Boolean {
        val big = max(12, ck.bigPx).toFloat()
        val k3 = d3 / 10f
        val tx = tiltX * k3
        val ty = tiltY * k3
        val amp = D3_AMP * density
        // Rand für die Seitenwände: so weit, wie die Tiefe bei voller Neigung reicht
        val pad = ceil(big * (D3_DEPTH0 + D3_DEPTH + D3_WALL) + 4f).toInt()
        if (!m.setFace(ck, pad)) return false
        updateRegionMap(ck, layer, m, pad + (amp + 24f * density).toInt())
        // die Uhr liegt im Display, tiefer als die Streifen: sie wandert mit dem Blick (Parallax); ihr Körper geht in die
        // Tiefe – so zeigen sich die Seitenwände der Ziffern auf der Seite, von der man schaut
        val ox = amp * tx * 0.6f
        val oy = amp * ty * 0.6f
        val ix = floor(ox)
        val iy = floor(oy)
        val depth = max(1f, big * (D3_DEPTH0 + D3_DEPTH * k3))
        val wall = big * D3_WALL
        val clx = ck.x - pad + ix
        val cly = ck.y - pad + iy
        setClockArea(clx, cly, clx + m.w3, cly + m.h3)
        // Lage der ruhigen Ebene (für Effekte, die mit dem Bild der Uhr gezeichnet werden)
        val sx = ck.x + ix
        val sy = ck.y + iy
        val alpha = (clockAlpha * 255f).toInt().coerceIn(0, 255)

        // Zustand je Stück
        val n = if (nPieces == 0) 1 else nPieces
        for (k in 0 until Clock3D.MAX_PIECES) {
            pAlpha[k] = 0f; pOff[2 * k] = 0f; pOff[2 * k + 1] = 0f
            pTint[4 * k] = 0f; pTint[4 * k + 1] = 0f; pTint[4 * k + 2] = 0f; pTint[4 * k + 3] = 0f
            pTransient[k] = false; pVisible[k] = false
        }
        for (k in 0 until n) {
            val ri = if (nPieces == 0) -1 else pieceRegion[k]
            // ausgefallenes Bruchstück: dieses Stück der Uhr bleibt schwarz (bis auf die Seite, die noch läuft)
            if (ri >= 0 && regDv[ri] && !hasKeep(ri)) continue
            val z = czones[if (ri < 0) nR else ri]
            val zone = if (ri < 0) clockZoneOf(ck, layer.height) else regZone[ri]
            if (!stepClockZone(z, zone)) continue
            pVisible[k] = true
            val kc = if (ri >= 0) clockCrack else 0
            val jx = if (ri >= 0) jit() else 1f
            pDx[k] = if (ri >= 0) round(regCS[ri] * kc * CLOCK_DX * density * jx) else 0f
            pDy[k] = if (ri >= 0) round(abs(regCS[ri]) * kc * CLOCK_DY * density) else 0f
            pOff[2 * k] = pDx[k]
            pOff[2 * k + 1] = pDy[k]
            // kurze Effekte (Farbkanäle, verrutschte Zeilen) zeichnet die ruhige Ebene; der Shader spart das Stück aus
            pTransient[k] = z.split > 0f || z.slice > 0f
            pAlpha[k] = if (pTransient[k]) 0f else z.fl
            if (z.flash > 0f) {
                pTint[4 * k] = Color.red(z.col) / 255f
                pTint[4 * k + 1] = Color.green(z.col) / 255f
                pTint[4 * k + 2] = Color.blue(z.col) / 255f
                pTint[4 * k + 3] = 0.75f
            }
        }
        // Bänder glitchender Streifen über der Uhr
        nBands = 0
        for (i in pBand.indices) pBand[i] = 0f
        val lw = layer.width.toFloat()
        for (k in 0 until n) {
            if (!pVisible[k]) continue
            val ri = if (nPieces == 0) -1 else pieceRegion[k]
            val x0 = sx + pDx[k]
            for (rj in 0 until nR) {
                if (ri >= 0) { if (rj != ri) continue } else if (cs != null && !regClock[rj]) continue
                for (l in lines) {
                    if (nBands >= Clock3D.MAX_BANDS) break
                    val zz = l.zones[rj]
                    if (!zz.drawn || !zz.fl) continue
                    val half = zz.flW / 2f
                    if (zz.x + half < x0 || zz.x - half > x0 + lw) continue
                    val b = nBands++
                    bPiece[b] = k; bX0[b] = zz.x - half; bX1[b] = zz.x + half; bDx[b] = zz.flDx; bCol[b] = zz.flCol
                    pBand[4 * b] = bX0[b] - clx
                    pBand[4 * b + 1] = bX1[b] - clx
                    pBand[4 * b + 2] = if (nPieces == 0) 0f else (k + 1).toFloat()
                    pBand[4 * b + 3] = 1f
                }
            }
        }
        // Neon: der Schein kommt aus der ruhigen Ebene (Leuchtröhre darunter)
        if (ck.neon != 0) {
            tintPaint.colorFilter = null
            tintPaint.alpha = (0.8f * alpha).toInt()
            c.drawBitmap(layer, sx, sy, tintPaint)
        }
        m.setFrame(ck, tx, ty, wall * tx, depth + wall * ty, 0.3f, ox - ix, oy - iy, regMapX - clx, regMapY - cly)
        m.setPieces(pOff, pAlpha, pTint, pBand)
        m.draw(c, clx, cly, alpha)
        // kurze Effekte mit der ruhigen Ebene
        for (k in 0 until n) {
            if (!pVisible[k] || !pTransient[k]) continue
            val ri = if (nPieces == 0) -1 else pieceRegion[k]
            val z = czones[if (ri < 0) nR else ri]
            val a = (z.fl * clockAlpha * 255f).toInt().coerceIn(0, 255)
            c.save()
            if (ri >= 0) regPath[ri]?.let { c.clipPath(it) }
            drawStaticEffects(c, layer, z, sx + pDx[k], sy + pDy[k], a)
            if (z.flash > 0f) {
                tintPaint.colorFilter = tint(z.col)
                tintPaint.alpha = (0.75f * a).toInt()
                c.drawBitmap(layer, sx + pDx[k], sy + pDy[k], tintPaint)
            }
            c.restore()
        }
        // in den Bändern: Uhr verrutscht und in der Farbe des Streifens
        for (b in 0 until nBands) {
            val k = bPiece[b]
            val ri = if (nPieces == 0) -1 else pieceRegion[k]
            val z = czones[if (ri < 0) nR else ri]
            val a = (z.fl * clockAlpha * 255f).toInt().coerceIn(0, 255)
            val y = sy + pDy[k]
            c.save()
            c.clipRect(bX0[b], y - 2f, bX1[b], y + layer.height + 2f)
            if (ri >= 0) regPath[ri]?.let { c.clipPath(it) }
            drawBand(c, layer, sx + pDx[k] + bDx[b], y, a, bCol[b])
            c.restore()
        }
        return true
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
        val now = System.currentTimeMillis()

        if (burstT > 0f) {
            burstT -= dt
            // Option: nach einem Ausbruch manchmal neue Streifen (Risse bleiben gleich)
            if (burstT <= 0f && mutate && chance(0.5f) && !pendingRestart) buildPool(rnd.nextLong())
        } else if (bur > 0f) {
            nextBurst -= dt
            if (nextBurst <= 0f) {
                val all = triggerBurst()
                nextBurst = scheduleBurst(bur)
                if (all) onBigBurst?.invoke()
            }
        }
        // Mehr Streifen mit der Zeit: am Ende großer Glitch, danach geht es mit wenigen Streifen von vorn los
        if (growTime && !pendingRestart && growStart > 0L && now - growStart >= growHours * 3_600_000L) {
            pendingRestart = true
            triggerBurst(ZONE_ALL)
            burstT = r(1.2f, 1.6f)
            burstPow = 1.5f
            onBigBurst?.invoke()
        }
        if (pendingRestart && burstT <= 0f) {
            pendingRestart = false
            growStart = now
            val cb = onGrowRestart
            if (cb != null) cb() else buildPool(rnd.nextLong())
        }
        setVisible(targetCount(now))
        // Mehr Risse mit der Zeit: am Ende großer Glitch, danach ein neues Rissmuster mit wenigen Rissen
        if (crackGrow && crackTo > crackFrom && !crackPending && crackStart > 0L && now - crackStart >= crackHours * 3_600_000L) {
            crackPending = true
            triggerBurst(ZONE_ALL)
            burstT = r(1.2f, 1.6f)
            burstPow = 1.5f
        }
        if (crackPending && burstT <= 0f) {
            crackPending = false
            val cb = onCrackRestart
            if (cb != null) cb() else {
                crackSeed = rnd.nextLong()
                crackStart = now
                cracksDirty = true
            }
            countChanged = true
        }
        val cn = if (crackPending) crackTo.coerceIn(0, Cracks.MAX) else crackTarget(now)
        if (cn != crackN) {
            // nur echtes Wachsen lässt die neuen Risse aufblitzen (nicht das Verstellen in den Einstellungen)
            growFlash = crackN >= 0 && cn > crackN && !countChanged && cs != null
            crackN = cn
            cracksDirty = true
        }
        countChanged = false
        val bursting = burstT > 0f && burstZone == ZONE_ALL

        // Neigung weich nachziehen (fürs Glitzern kaum geglättet, damit es sofort aufblitzt)
        val ts = 1f - exp(-dt * 9f)
        tiltX += (tiltTX - tiltX) * ts
        tiltY += (tiltTY - tiltY) * ts
        val tg = 1f - exp(-dt * 30f)
        gTiltX += (tiltTX - gTiltX) * tg
        gTiltY += (tiltTY - gTiltY) * tg

        // Uhr vorbereiten (ihre Lage braucht der Riss, der durch sie laufen soll)
        val ck = clock
        ck?.update(c.width, c.height)
        val target = if (clockShown) 1f else 0f
        clockAlpha += (target - clockAlpha) * (1f - exp(-dt * 8f))
        if (cracksDirty || builtW != w.toInt() || builtH != h.toInt()) buildCracks()
        if (ck?.layer !== clockLayerSeen) updateClockPieces()

        updatePresses()
        updateFlash()
        updateDead()
        updateBg()
        val bg = bgLayer
        if (bg != null) c.drawBitmap(bg, 0f, 0f, null)
        else c.drawColor(if (bursting && chance(0.3f)) Color.rgb(0, 15, 5) else Color.rgb(0, 7, 2))
        // ausgefallene Bruchstücke: schwarz (bis auf die Seite, auf der Streifen stehen bleiben)
        if (cs != null) for (i in 0 until nR) if (regDv[i]) regPath[i]?.let {
            if (!hasKeep(i)) c.drawPath(it, deadPaint)
            else {
                c.save()
                if (regKeep0[i] < 0f) c.clipRect(regKeep1[i], 0f, w, h) else c.clipRect(0f, 0f, regKeep0[i], h)
                c.drawPath(it, deadPaint)
                c.restore()
            }
        }
        stripeStates(bursting)
        // die Uhr gehört zum Bild des Displays: die kaputten Streifen laufen über sie, die Glasrisse über allem
        drawClock(c)
        drawFlash(c, false)
        drawStripes(c, bursting)
        // weiße Blitze des Flächenglitches: über Streifen und Uhr, unter den Rissen im Glas
        drawFlash(c, true)
        crackBmp?.let { c.drawBitmap(it, 0f, 0f, null) }
        drawGlints(c)
        drawCrackFlash(c)
        // Vorschau beim Antippen: Kreise an den Aufschlagstellen, gestrichelte Linien zu den Richtungen
        marks?.let { m ->
            markPaint.strokeWidth = 1.5f * density
            markDash.strokeWidth = 1.5f * density
            var i = 0
            while (i + 1 < m.size) {
                if ((i / 2) % 2 == 0) {
                    c.drawCircle(m[i], m[i + 1], 10f * density, markPaint)
                    c.drawCircle(m[i], m[i + 1], 2f * density, markFill)
                } else c.drawLine(m[i - 2], m[i - 1], m[i], m[i + 1], markDash)
                i += 2
            }
        }
    }

    private val markPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; color = Color.argb(217, 255, 255, 255) }
    private val markFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; color = Color.WHITE }
    private val markDash = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.argb(217, 255, 255, 255)
        pathEffect = DashPathEffect(floatArrayOf(4f * density, 4f * density), 0f)
    }

    // ---------- Schwarze Bruchstücke ----------
    // Erst ab DARK_MIN Rissen (vorher sind die Stücke zu groß). Ab und zu fällt ein Bruchstück aus und bleibt schwarz (beim
    // Ausgehen flackert es, es stirbt; beim Angehen kurz). Immer zuerst die kleinsten Stücke – je weiter der Regler rechts
    // steht, desto eher auch etwas größere, aber höchstens etwa 4 bis 8 % des Bildschirms –, mehr unten und in den Ecken,
    // nie oben an der Benachrichtigungsleiste (das Stück darf nicht bis in die obersten 5 % reichen). Über der Uhr nur
    // selten und nur, wenn das Stück höchstens die halbe Uhr abdeckt. Meist einzeln; ab und zu gehen ein bis drei Nachbarn
    // kurz nacheinander mit aus (dann liegen 2–4 schwarze Stücke nebeneinander).
    // Der Regler „Schwarze Stellen zwischen den Rissen“ legt vor allem fest, wie lange: links nur ein paar Sekunden, in der
    // Mitte um eine Minute, ganz rechts sehr lange (um 20 Minuten); jedes Mal anders (halb bis doppelt so lange). Mit dem
    // Regler werden es auch etwas mehr (etwa 4 bis 18 % der Stücke, mit vielen Streifen etwas mehr, mindestens eins). Bei
    // etwa jedem zweiten bleiben auf einer Seite ein paar Streifen stehen (am linken oder rechten Rand des Stücks, 15–40 %
    // seiner Breite: dort läuft das Display noch). Bei Glitch-Ausbrüchen fallen kleine Stücke auch kurz aus (dann ganz).
    // Beim Bauen der Risse sind gleich so viele schwarz wie sonst im Schnitt, beim Verstellen des Reglers mindestens eins –
    // damit man es sofort sieht. Gleiche Regeln wie die Vorschau (prepDark, pickDark, spreadDark).

    private val deadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; color = Color.BLACK }
    private var deadWait = 0f

    /** halb bis doppelt so lange wie [darkMid] (im Schnitt 1,08-mal) */
    private fun darkLen(lv: Int) = darkMid(lv) * 4f.pow(rnd.nextFloat()) / 2f

    /** Anteil der Stücke, die im Schnitt schwarz sind */
    private fun darkFrac(lv: Int) = (0.04f + 0.14f * (lv - 1) / 9f) * (0.75f + 0.5f * ((shownCount - 12) / 110f).coerceIn(0f, 1f))

    /** Gibt es gerade schwarze Stellen (Regler an und genug Risse)? */
    private fun darkOn() = dark > 0 && max(0, crackN) >= DARK_MIN

    /** So viele Stücke sollen schwarz sein (mindestens eins). */
    private fun darkWant() = max(1, Math.round(darkFrac(dark) * nR))

    /**
     * Welche Stücke schwarz werden dürfen und wie gern (fest je Rissmuster, Lage der Uhr und Reglerstellung): die kleinsten
     * zuerst (ein doppelt so großes Stück kommt nur etwa halb so oft dran, bei hohem Regler etwas öfter), unten viel mehr
     * als oben, an der Unterkante, an den Seiten und vor allem in den unteren Ecken mehr, über der Uhr selten.
     */
    private fun prepDark() {
        val set = cs ?: return
        if (regDOK.size != nR) return
        val lv = max(1, dark)
        val fMax = 0.035f + 0.0045f * lv
        val ex = 1.3 - 0.05 * lv
        var minA = Double.MAX_VALUE
        for (i in 0 until nR) {
            regDOK[i] = false
            regDW[i] = 0f
            val f = regFrac[i]
            if (f < 0.002f || f > fMax || regY0[i] < 0.05f * h || (regClock[i] && regClockN[i] > 40)) continue
            regDOK[i] = true
            minA = min(minA, set.regions[i].area)
        }
        for (i in 0 until nR) {
            if (!regDOK[i]) continue
            val g = set.regions[i]
            val y = (g.cy / set.a).coerceIn(0.0, 1.0)
            val bot = regY1[i] > h - 0.01f * w
            val side = regX0[i] < 0.01f * w || regX1[i] > 0.99f * w
            var wt = (minA / g.area).pow(ex) * (0.15 + 2.6 * y * y)
            if (bot) wt *= 1.6
            if (side) wt *= 1.3
            if (bot && side) wt *= 1.6
            if (regClock[i]) wt *= 0.12
            regDW[i] = wt.toFloat()
        }
    }

    private fun darkBusy(i: Int) = regDead[i] > 0f || regPend[i] > 0f

    /** Darf Stück i jetzt ausgehen? (nicht neben einem schwarzen, nicht gerade erst wieder an) */
    private fun darkCand(i: Int) = regDOK[i] && !darkBusy(i) && regRest[i] <= 0f && regNb[i].none { it < nR && darkBusy(it) }

    /** Ein Stück auswürfeln, das jetzt ausgeht (−1 = keins). */
    private fun pickDark(): Int {
        var sum = 0f
        for (i in 0 until nR) if (darkCand(i)) sum += regDW[i]
        if (sum <= 0f) return -1
        var s = rnd.nextFloat() * sum
        var last = -1
        for (i in 0 until nR) {
            if (!darkCand(i)) continue
            last = i
            s -= regDW[i]
            if (s <= 0f) return i
        }
        return last
    }

    /** Ab und zu gehen Nachbarn mit aus: ein bis drei, kurz nacheinander, ähnlich lange (zusammen höchstens 10 %). */
    private fun spreadDark(i: Int) {
        val set = cs ?: return
        if (!chance(0.3f)) return
        val cand = regNb[i].filter { it < nR && regDOK[it] && regDead[it] <= 0f && regPend[it] <= 0f }.sortedByDescending { regDW[it] }
        var n = 1 + rnd.nextInt(3)
        var area = set.regions[i].area
        var delay = 0f
        for (j in cand) {
            if (n-- <= 0 || area + set.regions[j].area > 0.1 * set.a) break
            area += set.regions[j].area
            delay += r(0.4f, 2.5f)
            regPend[j] = delay
            regPendLen[j] = regDeadT[i] * r(0.7f, 1.3f)
        }
    }

    private fun killRegion(i: Int, len: Float) {
        regDead[i] = len
        regDeadT[i] = len
        if (len > 5f && chance(0.5f)) {
            // auf einer Seite bleiben ein paar Streifen stehen
            val f = (regX1[i] - regX0[i]) * r(0.15f, 0.4f)
            if (chance(0.5f)) { regKeep0[i] = -1e6f; regKeep1[i] = regX0[i] + f }
            else { regKeep0[i] = regX1[i] - f; regKeep1[i] = 1e6f }
        } else {
            regKeep0[i] = Float.NaN
            regKeep1[i] = Float.NaN
        }
    }

    private fun updateDead() {
        if (cs == null || regRest.size != nR) return
        val lv = dark
        val on = darkOn()
        var nd = 0
        for (i in 0 until nR) {
            if (regDead[i] > 0f) {
                regDead[i] -= dt
                if (regDead[i] > 0f) nd++
                else {
                    regKeep0[i] = Float.NaN
                    regKeep1[i] = Float.NaN
                    regRest[i] = if (regDeadT[i] > 5f) r(8f, 25f) else 0f
                }
            } else if (regRest[i] > 0f) regRest[i] -= dt
            if (regPend[i] > 0f) {
                regPend[i] -= dt
                if (regPend[i] <= 0f) {
                    regPend[i] = 0f
                    if (on && regDead[i] <= 0f) {
                        killRegion(i, regPendLen[i])
                        nd++
                    }
                }
            }
        }
        if (on) {
            // fehlt eins, geht nach ein paar Sekunden das nächste aus
            deadWait -= dt
            if (nd < darkWant() && deadWait <= 0f) {
                val i = pickDark()
                if (i >= 0) {
                    killRegion(i, darkLen(lv))
                    spreadDark(i)
                }
                deadWait = r(2f, 8f)
            }
            // bei Glitch-Ausbrüchen fallen kleine Stücke auch kurz aus
            if (burstT > 0f) for (i in 0 until nR) {
                if (!regDOK[i] || regDead[i] > 0f || (burstZone != ZONE_ALL && burstZone != regZone[i])) continue
                if (chance(p(lv / 5f * 0.03f * burstPow))) killRegion(i, r(0.3f, 1.5f))
            }
        }
        // sichtbar aus? beim Aus- und Angehen kurz flackern
        for (i in 0 until nR) {
            val dying = regDeadT[i] - regDead[i] < (if (regDeadT[i] > 5f) 0.35f else 0.16f)
            regDv[i] = regDead[i] > 0f && !((dying || regDead[i] < 0.14f) && chance(0.5f))
        }
    }

    /**
     * Schwarze Stücke neu verteilen: so viele, wie es sonst im Schnitt sind (mit zufälliger Restzeit); one: das erste
     * geht gerade erst aus (beim Verstellen des Reglers, damit man es sieht).
     */
    private fun seedDead(one: Boolean) {
        if (cs == null || regDead.size != nR || regRest.size != nR) return
        for (i in 0 until nR) {
            regDead[i] = 0f
            regDv[i] = false
            regKeep0[i] = Float.NaN
            regKeep1[i] = Float.NaN
            regRest[i] = 0f
            regPend[i] = 0f
        }
        prepDark()
        deadWait = r(2f, 6f)
        if (!darkOn()) return
        val n = darkWant()
        for (k in 0 until n) {
            val i = pickDark()
            if (i < 0) break
            killRegion(i, darkLen(dark))
            if (!(one && k == 0)) regDead[i] *= rnd.nextFloat()
        }
    }

    // ---------- Flächenglitch: Bruchstücke leuchten beim Berühren ----------
    // Erst ab FGE_MIN Rissen und nur unter dem Finger: Von den Stücken unter der Fingerkuppe nimmt es das kleinste. Kleine
    // leuchten fast immer, große selten, ganz große (ab 12 % des Bildschirms) nie. Das Stück flackert grau (die Streifen
    // bleiben darüber sichtbar) und blitzt dazwischen weiß wie ein Stroboskop (dann ist dort alles weiß, auch die
    // Streifen). Jedes Aufblitzen ist nach 0,3 bis 0,7 Sekunden vorbei; bleibt der Finger liegen, wird nach einer kurzen
    // Pause neu gewürfelt, kommt er auf ein anderes Stück, sofort. Bei sehr vielen Rissen (ab etwa 24) blitzt ab und zu ein
    // Nachbarstück kurz mit.

    private class RegFlash(val i: Int) {
        var a = 0f
        var next = 0f
        var life = 0f
        /** 0 aus, 1 grau (unter den Streifen), 2 weiß (über allem außer den Rissen) */
        var st = 0
        /** weiße Blitze: schon gezeigt, höchstens */
        var w = 0
        var wmax = 0
        var col = Color.rgb(220, 225, 232)
    }

    private val regFlash = ArrayList<RegFlash>()
    private var flashWait = 0f
    private var flashTouched = IntArray(0)
    private val flashPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

    /** Wie gern ein Stück aufleuchtet (nach seinem Anteil am Bildschirm). */
    private fun fgeChance(i: Int): Float {
        val f = regFrac[i]
        return if (f <= 0.015f) 1f else if (f >= 0.12f) 0f else 1f - 0.9f * (f - 0.015f) / 0.105f
    }

    private fun startFlash(i: Int, life: Float, whites: Int) {
        val f = regFlash.firstOrNull { o -> o.i == i } ?: RegFlash(i).also { regFlash.add(it) }
        f.life = life
        f.next = 0f
        f.w = 0
        f.wmax = whites
    }

    private fun updateFlash() {
        // laufendes Aufblitzen: grau flackern, dazwischen weiße Blitze (nie zwei direkt hintereinander), am Ende schnell aus
        val fade = exp(-dt * 40f)
        val it = regFlash.iterator()
        while (it.hasNext()) {
            val f = it.next()
            f.life -= dt
            if (f.life <= 0f) {
                if (f.st == 2) f.a = 0f
                f.a *= fade
                if (f.a <= 0.01f) it.remove()
                continue
            }
            f.next -= dt
            if (f.next > 0f) continue
            if (f.w < f.wmax && f.st != 2 && (chance(0.4f) || f.life < 0.12f + 0.1f * (f.wmax - f.w))) {
                f.st = 2
                f.w++
                f.a = r(0.9f, 1f)
                f.next = r(0.02f, 0.045f)
            } else if (chance(0.18f)) {
                f.st = 0
                f.a = 0f
                f.next = r(0.02f, 0.06f)
            } else {
                f.st = 1
                f.a = r(0.08f, 0.5f)
                f.next = r(0.03f, 0.09f)
                f.col = Color.rgb(200 + rnd.nextInt(36), 206 + rnd.nextInt(35), 214 + rnd.nextInt(37))
            }
        }
        flashWait -= dt
        if (cs == null) return
        val nC = max(0, crackN)
        val touched = if (touchFlash && nC >= FGE_MIN)
            presses.filter { it.down && it.fi in 0 until nR }.map { it.fi }.distinct().sorted().toIntArray() else IntArray(0)
        if (touched.isEmpty()) {
            flashTouched = touched
            return
        }
        if (touched.contentEquals(flashTouched) && flashWait > 0f) return
        flashTouched = touched
        flashWait = r(1.0f, 2.2f)
        val busy = regFlash.filter { f -> f.life > 0f }.map { f -> f.i }.toSet()
        val nbP = ((nC - 22) / 14f).coerceIn(0f, 1f) * 0.45f
        for (i in touched) {
            if (rnd.nextFloat() >= fgeChance(i)) continue
            // mit dem schnellen Ausklingen zusammen 0,3 bis 0,7 Sekunden, darin ein bis drei weiße Blitze
            startFlash(i, r(0.27f, 0.65f), 1 + rnd.nextInt(3))
            if (chance(nbP)) {
                val nb = regNb[i].filter { j -> j < nR && j !in busy && j !in touched && fgeChance(j) > 0f }
                if (nb.isNotEmpty()) startFlash(nb[rnd.nextInt(nb.size)], r(0.1f, 0.25f), if (chance(0.4f)) 1 else 0)
            }
        }
    }

    /** white = false: graues Flackern (unter den Streifen), true: weiße Blitze (über Streifen und Uhr). */
    private fun drawFlash(c: Canvas, white: Boolean) {
        if (cs == null) return
        for (f in regFlash) {
            if (f.i >= nR || f.a <= 0.01f || (regDv[f.i] && !hasKeep(f.i)) || (f.st == 2) != white) continue
            val path = regPath[f.i] ?: continue
            val col = if (white) Color.WHITE else f.col
            flashPaint.color = Color.argb((f.a * 255f).toInt().coerceIn(0, 255), Color.red(col), Color.green(col), Color.blue(col))
            if (regDv[f.i]) {
                // ausgefallenes Stück: nur die Seite, auf der das Display noch läuft
                c.save()
                c.clipRect(max(regKeep0[f.i], 0f), 0f, min(regKeep1[f.i], w), h)
                c.drawPath(path, flashPaint)
                c.restore()
            } else c.drawPath(path, flashPaint)
        }
    }

    // ---------- Neue Risse blitzen auf ----------

    private class CrackFlash(val path: Path, val t0: Float)

    private val crackFlashes = ArrayList<CrackFlash>()
    private val crackFlashPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private fun drawCrackFlash(c: Canvas) {
        val it = crackFlashes.iterator()
        while (it.hasNext()) {
            val f = it.next()
            val age = t - f.t0
            if (age >= CRACK_FLASH || age < 0f) {
                it.remove()
                continue
            }
            // schnell wie ein Blitz, zweimal kurz hintereinander: 0,05 s an, kurz dunkel, dann schnell verglimmend
            val k = if (age < 0.05f) 1f else if (age < 0.085f) 0.12f else (1f - (age - 0.085f) / (CRACK_FLASH - 0.085f)).coerceAtLeast(0f).let { it * it }
            crackFlashPaint.color = Color.argb((0.95f * k * 255f).toInt().coerceIn(0, 255), 240, 246, 255)
            crackFlashPaint.strokeWidth = max(1f, (1f + 1.8f * k) * density)
            c.drawPath(f.path, crackFlashPaint)
        }
    }

    // ---------- Eigenes Bild ----------
    // Liegt unter allem, zerbricht mit den Rissen (jedes Bruchstück so versetzt wie die Streifen) und lässt sich abdunkeln.

    /** Eigenes Bild abdunkeln 0..90 %. */
    var bgDim = 40
    private var bgSrc: Bitmap? = null
    private var bgStamp = 0L
    private var bgLayer: Bitmap? = null
    private var bgFor: CrackSet? = null
    private var bgShear = -1
    private var bgDimB = -1
    private var bgSrcB: Bitmap? = null
    private val bgPaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val bgDst = RectF()

    /** Eigenes Bild setzen: stamp = Zeitpunkt der Wahl (0 = keins); load wird nur bei einem neuen Bild aufgerufen. */
    fun setBackground(stamp: Long, load: () -> Bitmap?) {
        if (stamp == bgStamp) return
        bgStamp = stamp
        bgSrc?.recycle()
        bgSrc = if (stamp > 0L) try {
            load()
        } catch (e: Throwable) {
            null
        } else null
        bgSrcB = null
    }

    private fun updateBg() {
        val src = bgSrc
        if (src == null) {
            bgLayer?.recycle()
            bgLayer = null
            return
        }
        val bw = max(1, w.toInt())
        val bh = max(1, h.toInt())
        val cur = bgLayer
        if (cur != null && cur.width == bw && cur.height == bh && bgFor === cs && bgShear == shearAmt && bgDimB == bgDim && bgSrcB === src) return
        val bmp = if (cur != null && cur.width == bw && cur.height == bh) cur else {
            cur?.recycle()
            try {
                Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888)
            } catch (e: Throwable) {
                bgLayer = null
                return
            }
        }
        val c = Canvas(bmp)
        c.drawColor(Color.BLACK)
        // so groß, dass das Bild den Bildschirm füllt (Mitte), wie ein normales Hintergrundbild
        val sc = max(bw / src.width.toFloat(), bh / src.height.toFloat())
        val iw = src.width * sc
        val ih = src.height * sc
        val ix = (bw - iw) / 2f
        val iy = (bh - ih) / 2f
        if (cs != null && nR > 1) {
            for (i in 0 until nR) {
                val path = regPath[i] ?: continue
                val dx = round(regS[i] * shearAmt * SHEAR_K * density)
                c.save()
                c.clipPath(path)
                bgDst.set(ix + dx, iy, ix + dx + iw, iy + ih)
                c.drawBitmap(src, null, bgDst, bgPaint)
                c.restore()
            }
        } else {
            bgDst.set(ix, iy, ix + iw, iy + ih)
            c.drawBitmap(src, null, bgDst, bgPaint)
        }
        c.drawColor(Color.argb((bgDim.coerceIn(0, 90) / 100f * 255f).toInt(), 0, 0, 0))
        bgLayer = bmp
        bgFor = cs
        bgShear = shearAmt
        bgDimB = bgDim
        bgSrcB = src
    }

    companion object {
        const val ZONE_ALL = 0
        const val ZONE_TOP = 1
        const val ZONE_MID = 2
        const val ZONE_BOTTOM = 3

        /** „Versatz am Riss“: Stärke je Stufe (noch einmal halb so stark: feiner einstellbar) */
        private const val SHEAR_K = 1.2f * 0.45f * 0.5f

        /** „Riss durch die Uhr“: Versatz der Uhr-Stücke je Stufe zur Seite und nach unten (noch einmal halb so stark) */
        private const val CLOCK_DX = 0.225f
        private const val CLOCK_DY = 0.03f

        /**
         * „Schwarze Stellen zwischen den Rissen“ (1–10): typische Dauer, die ein Stück schwarz bleibt, in Sekunden –
         * Stufe 1 etwa 4 s, Stufe 5 etwa 50 s, Stufe 10 etwa 20 Minuten (jedes Mal halb bis doppelt so lange).
         */
        fun darkMid(lv: Int): Float = 4f * 300f.pow((lv - 1) / 9f)

        /** Flächenglitch erst ab so vielen Rissen */
        const val FGE_MIN = 5

        /** Schwarze Stellen erst ab so vielen Rissen (vorher sind die Stücke zu groß) */
        const val DARK_MIN = 9

        /** Glitzern: wie genau die Neigung passen muss, damit ein Punkt aufblitzt (Anteil der vollen Neigung) */
        private const val GLINT_R = 0.07f

        /** Neue Risse blitzen so lange auf (Sekunden) */
        private const val CRACK_FLASH = 0.2f

        /**
         * 3D der Uhr: wie weit sie beim Neigen mitwandert (dp bei voller Neigung und Regler ganz rechts) und wie tief die
         * Ziffern sind (Seitenwände beim Neigen und Tiefe nach unten, Anteil der Ziffernhöhe). Seit Runde 12 deutlich
         * stärker: Beim Neigen sieht man die Ziffern in die Tiefe gehen.
         */
        private const val D3_AMP = 18f
        private const val D3_WALL = 0.4f
        private const val D3_DEPTH0 = 0.03f
        private const val D3_DEPTH = 0.06f

        /** Größe des Streifen-Vorrats: höchstens 150 Streifen plus Doppellinien. */
        private const val POOL = 172

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
