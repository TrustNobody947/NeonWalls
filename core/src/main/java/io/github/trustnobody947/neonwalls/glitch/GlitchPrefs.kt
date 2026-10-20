package io.github.trustnobody947.neonwalls.glitch

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs
import java.io.File

/** Gespeicherte Einstellungen, gemeinsam für Vorschau und Live-Hintergrund. */
object GlitchPrefs {
    const val NAME = "glitch_prefs"

    const val CALM = "calm"
    const val BURST = "burst"
    const val COUNT_POS = "count_pos"       // Anzahl Streifen „von“ (Regler 0..100)
    const val COUNT_MAX = "count_max"       // Anzahl Streifen „bis“ (Regler 0..100)
    const val GROW_TIME = "grow_time"       // mehr Streifen mit der Zeit: 0 aus, 1 an
    const val GROW_HOURS = "grow_hours"     // in wie vielen Stunden von „von“ bis „bis“ (1..24)
    const val GROW_BATT = "grow_batt"       // mehr Streifen bei sinkendem Akku: 0 aus, 1 an
    const val GROW_START = "grow_start"     // Beginn des aktuellen Durchgangs (ms)
    const val TOUCH_FX = "touch_fx"         // Glitch unter dem Finger: 0 aus, 1 an
    const val TOUCH_FLASH = "touch_flash"   // Flächenglitch (Bruchstücke leuchten beim Berühren): 0 aus, 1 an
    const val SHEAR = "shear"
    const val DARK = "dark"                 // schwarze Stellen zwischen den Rissen 0..10
    const val SEED = "seed"                 // Streifen
    const val RANDOM_ON_WAKE = "random_on_wake"
    const val MUTATE = "mutate_on_glitch"

    // Glasrisse
    const val CRACKS = "cracks"             // Anzahl Hauptrisse „von“ 0..14
    const val CRACKS_MAX = "cracks_max"     // Anzahl Hauptrisse „bis“ 0..14
    const val CRACK_GROW = "crack_grow"     // mehr Risse mit der Zeit: 0 aus, 1 an
    const val CRACK_HOURS = "crack_hours"   // in wie vielen Stunden von „von“ bis „bis“ (1..24)
    const val CRACK_START = "crack_start"   // Beginn des aktuellen Durchgangs (ms)
    const val IMPACTS = "impacts"           // Anzahl Aufschläge − 1 (0..2)
    const val IMPACT = "impact"             // 0 zufällig, 1 selbst angetippt
    const val PX = "impact_x"               // angetippter Aufschlag (Anteil der Breite) …
    const val PY = "impact_y"               // … und der Höhe
    const val TX = "target_x"               // angetippte Richtung
    const val TY = "target_y"
    const val HSHARE = "hshare"             // Anteil der Risse, die waagerecht quer übers Bild laufen (0..100 %)
    const val SPLINTER = "splinter"         // 0 aus, 1 wenig, 2 viel
    const val AUTO = "auto"                 // Risse wechseln von selbst: 0 aus, 1 bei Glitches, 2 nach Stunden
    const val HOURS = "hours"               // 1..24
    const val CRACK_SEED = "crack_seed"
    const val CRACK_TIME = "crack_time"     // Zeitpunkt des letzten Wechsels (ms)

    // Eigenes Bild
    const val BG_STAMP = "bg_stamp"         // Zeitpunkt der Wahl (0 = kein eigenes Bild)
    const val BG_DIM = "bg_dim"             // abdunkeln 0..90 %
    const val BG_FILE = "eigenes_bild.jpg"  // im internen Speicher der App

    /** Gespeicherte Stellen je Aufschlag: der erste wie bisher, weitere mit Nummer (impact_x2, impact_x3 …). */
    private fun key(base: String, k: Int) = if (k == 0) base else base + (k + 1)

    /** Regler-Position 0..100 -> Anzahl Streifen 3..150 (exponentiell: unten fein, oben krass). */
    fun countFromPos(pos: Int): Int = Math.round(3.0 * Math.pow(50.0, pos / 100.0)).toInt()

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    private fun newSeed() = System.nanoTime() or 1L

    fun seed(p: SharedPreferences): Long {
        var s = p.getLong(SEED, 0L)
        if (s == 0L) {
            s = newSeed()
            p.edit().putLong(SEED, s).apply()
        }
        return s
    }

    fun crackSeed(p: SharedPreferences): Long {
        var s = p.getLong(CRACK_SEED, 0L)
        if (s == 0L) {
            s = newSeed()
            p.edit().putLong(CRACK_SEED, s).putLong(CRACK_TIME, System.currentTimeMillis()).apply()
        }
        return s
    }

    /** Anzahl Aufschläge 1..3. */
    fun impacts(p: SharedPreferences) = p.getInt(IMPACTS, 0).coerceIn(0, 2) + 1

    /**
     * Neues Muster: neue Streifen und neue Risse (angetippte Aufschlagstellen bleiben, nur der Verlauf ändert sich).
     * restartGrowth: „Mehr Streifen/Risse mit der Zeit“ beginnen wieder mit wenigen (nicht beim Einschalten des Bildschirms).
     */
    fun newPattern(ctx: Context, restartGrowth: Boolean = true) {
        val now = System.currentTimeMillis()
        val e = prefs(ctx).edit().putLong(SEED, newSeed()).putLong(CRACK_SEED, newSeed() xor 0x5DEECE66DL)
            .putLong(CRACK_TIME, now)
        if (restartGrowth) e.putLong(GROW_START, now).putLong(CRACK_START, now)
        e.apply()
    }

    /** Nur neue Risse (für „Risse wechseln von selbst“). */
    fun newCracks(ctx: Context) {
        prefs(ctx).edit().putLong(CRACK_SEED, newSeed()).putLong(CRACK_TIME, System.currentTimeMillis()).apply()
    }

    /**
     * „Mehr Streifen mit der Zeit“ ist durch: neue Streifen, es geht mit wenigen von vorn los.
     * false = hat schon eine andere Ansicht erledigt (Vorschau und Hintergrund laufen gleichzeitig).
     */
    fun restartGrowth(ctx: Context): Boolean {
        val p = prefs(ctx)
        val now = System.currentTimeMillis()
        val start = p.getLong(GROW_START, 0L)
        val span = p.getInt(GROW_HOURS, 6).coerceIn(1, 24) * 3_600_000L
        if (start > 0L && now >= start && now - start < span) return false
        p.edit().putLong(SEED, newSeed()).putLong(GROW_START, now).apply()
        return true
    }

    /**
     * „Mehr Risse mit der Zeit“ ist durch: neues Rissmuster, es geht mit wenigen Rissen von vorn los.
     * false = hat schon eine andere Ansicht erledigt.
     */
    fun restartCrackGrowth(ctx: Context): Boolean {
        val p = prefs(ctx)
        val now = System.currentTimeMillis()
        val start = p.getLong(CRACK_START, 0L)
        val span = p.getInt(CRACK_HOURS, 6).coerceIn(1, 24) * 3_600_000L
        if (start > 0L && now >= start && now - start < span) return false
        p.edit().putLong(CRACK_SEED, newSeed()).putLong(CRACK_TIME, now).putLong(CRACK_START, now).apply()
        return true
    }

    /** „Mehr Streifen mit der Zeit“ ein- oder ausgeschaltet: der Durchgang beginnt jetzt. */
    fun setGrowTime(ctx: Context, on: Boolean) {
        prefs(ctx).edit().putInt(GROW_TIME, if (on) 1 else 0).putLong(GROW_START, System.currentTimeMillis()).apply()
    }

    /** „Mehr Risse mit der Zeit“ ein- oder ausgeschaltet: der Durchgang beginnt jetzt. */
    fun setCrackGrow(ctx: Context, on: Boolean) {
        prefs(ctx).edit().putInt(CRACK_GROW, if (on) 1 else 0).putLong(CRACK_START, System.currentTimeMillis()).apply()
    }

    /**
     * Selbst angetippte Aufschlagstellen speichern (je Aufschlag Stelle x, y und Richtung x, y als Anteile von Breite
     * und Höhe) und neue Risse dorthin legen.
     */
    fun setImpacts(ctx: Context, pts: FloatArray) {
        val e = prefs(ctx).edit()
        val n = pts.size / 4
        for (k in 0 until n) {
            e.putFloat(key(PX, k), pts[4 * k]).putFloat(key(PY, k), pts[4 * k + 1])
                .putFloat(key(TX, k), pts[4 * k + 2]).putFloat(key(TY, k), pts[4 * k + 3])
        }
        e.putInt(IMPACT, 1).putLong(CRACK_SEED, newSeed()).putLong(CRACK_TIME, System.currentTimeMillis()).apply()
    }

    fun hasImpact(p: SharedPreferences, k: Int) = p.getFloat(key(PX, k), -1f) >= 0f && p.getFloat(key(TX, k), -1f) >= 0f

    /** Sind alle gewählten Aufschläge angetippt? */
    fun allTapped(p: SharedPreferences): Boolean {
        for (k in 0 until impacts(p)) if (!hasImpact(p, k)) return false
        return true
    }

    /** „Nach Stunden“: Ist es Zeit für neue Risse? */
    fun autoDue(p: SharedPreferences): Boolean {
        if (p.getInt(AUTO, 0) != 2) return false
        val hours = p.getInt(HOURS, 6).coerceIn(1, 24)
        val last = p.getLong(CRACK_TIME, 0L)
        val now = System.currentTimeMillis()
        return last <= 0L || now - last >= hours * 3_600_000L || now < last
    }

    /** Eigenes Bild laden (null = keins oder nicht lesbar). */
    fun loadBackground(ctx: Context): Bitmap? {
        val f = File(ctx.filesDir, BG_FILE)
        if (!f.exists()) return null
        return try {
            BitmapFactory.decodeFile(f.path)
        } catch (e: Throwable) {
            null
        }
    }

    /** Eigenes Bild entfernen. */
    fun clearBackground(ctx: Context) {
        try {
            File(ctx.filesDir, BG_FILE).delete()
        } catch (e: Exception) {
        }
        prefs(ctx).edit().putLong(BG_STAMP, 0L).apply()
    }

    fun applyTo(ctx: Context, r: GlitchRenderer) {
        val p = prefs(ctx)
        val now = System.currentTimeMillis()
        r.mutate = p.getBoolean(MUTATE, false)
        r.clock = ClockPrefs.face(ctx, ClockPrefs.ON_GLITCH, r.clock)
        r.clockCrack = ClockPrefs.crack(ctx)
        r.d3 = ClockPrefs.d3(ctx)
        r.configure(
            calm = p.getInt(CALM, 4),
            burst = p.getInt(BURST, 5),
            shear = p.getInt(SHEAR, 5),
            seed = seed(p)
        )
        // Anzahl Streifen von – bis, mehr mit der Zeit und/oder mit sinkendem Akku
        r.countFrom = countFromPos(p.getInt(COUNT_POS, 59))
        r.countTo = countFromPos(p.getInt(COUNT_MAX, 85))
        r.growTime = p.getInt(GROW_TIME, 0) == 1
        r.growHours = p.getInt(GROW_HOURS, 6).coerceIn(1, 24)
        r.growBatt = p.getInt(GROW_BATT, 0) == 1
        var start = p.getLong(GROW_START, 0L)
        if (r.growTime && start <= 0L) {
            start = now
            p.edit().putLong(GROW_START, start).apply()
        }
        r.growStart = start
        r.touchFx = p.getInt(TOUCH_FX, 1) == 1
        r.touchFlash = p.getInt(TOUCH_FLASH, 1) == 1
        r.dark = p.getInt(DARK, 5).coerceIn(0, 10)
        // Risse: von – bis, mehr mit der Zeit, Aufschläge (zufällig oder selbst angetippt), waagerechte Risse
        val crackGrow = p.getInt(CRACK_GROW, 0) == 1
        var crackStart = p.getLong(CRACK_START, 0L)
        if (crackGrow && crackStart <= 0L) {
            crackStart = now
            p.edit().putLong(CRACK_START, crackStart).apply()
        }
        val n = impacts(p)
        val tapped = p.getInt(IMPACT, 0) == 1
        val manual = Array(n) { k ->
            if (tapped && hasImpact(p, k)) floatArrayOf(
                p.getFloat(key(PX, k), 0.5f), p.getFloat(key(PY, k), 0.5f),
                p.getFloat(key(TX, k), 0.5f), p.getFloat(key(TY, k), 0.2f)
            ) else null
        }
        val ck = r.clock
        // Der Riss durch die Uhr richtet sich nach der Höhe, bei der der Regler losgelassen wurde
        val cp = ClockPrefs.prefs(ctx)
        val clockKey = if (ck == null) "aus" else "${ClockPrefs.cyAim(cp)}|${ck.size}|${ck.date}|${r.clockCrack > 0}"
        r.configureCracks(
            from = p.getInt(CRACKS, 3).coerceIn(0, Cracks.MAX),
            to = p.getInt(CRACKS_MAX, 10).coerceIn(0, Cracks.MAX),
            grow = crackGrow,
            hours = p.getInt(CRACK_HOURS, 6).coerceIn(1, 24),
            start = crackStart,
            splinter = p.getInt(SPLINTER, 1).coerceIn(0, 2),
            seed = crackSeed(p),
            impacts = n,
            manual = manual,
            hshare = p.getInt(HSHARE, 30).coerceIn(0, 100),
            clockKey = clockKey
        )
        // eigenes Bild (wird nur neu geladen, wenn ein anderes gewählt wurde)
        r.bgDim = p.getInt(BG_DIM, 40).coerceIn(0, 90)
        r.setBackground(p.getLong(BG_STAMP, 0L)) { loadBackground(ctx) }
    }
}
