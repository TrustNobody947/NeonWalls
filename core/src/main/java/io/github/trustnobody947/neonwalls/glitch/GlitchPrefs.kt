package io.github.trustnobody947.neonwalls.glitch

import android.content.Context
import android.content.SharedPreferences
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs

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
    const val SHEAR = "shear"
    const val SEED = "seed"                 // Streifen
    const val RANDOM_ON_WAKE = "random_on_wake"
    const val MUTATE = "mutate_on_glitch"

    // Glasrisse
    const val CRACKS = "cracks"             // Anzahl Hauptrisse 0..6
    const val IMPACT = "impact"             // 0 zufällig, 1 selbst angetippt
    const val PX = "impact_x"               // angetippter Aufschlag (Anteil der Breite) …
    const val PY = "impact_y"               // … und der Höhe
    const val TX = "target_x"               // angetippte Richtung
    const val TY = "target_y"
    const val SPLINTER = "splinter"         // 0 aus, 1 wenig, 2 viel
    const val AUTO = "auto"                 // Risse wechseln von selbst: 0 aus, 1 bei Glitches, 2 nach Stunden
    const val HOURS = "hours"               // 1..24
    const val CRACK_SEED = "crack_seed"
    const val CRACK_TIME = "crack_time"     // Zeitpunkt des letzten Wechsels (ms)

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

    /**
     * Neues Muster: neue Streifen und neue Risse (eine angetippte Aufschlagstelle bleibt, nur der Verlauf ändert sich).
     * restartGrowth: „Mehr Streifen mit der Zeit“ beginnt wieder mit wenigen Streifen (nicht beim Einschalten des Bildschirms).
     */
    fun newPattern(ctx: Context, restartGrowth: Boolean = true) {
        val e = prefs(ctx).edit().putLong(SEED, newSeed()).putLong(CRACK_SEED, newSeed() xor 0x5DEECE66DL)
            .putLong(CRACK_TIME, System.currentTimeMillis())
        if (restartGrowth) e.putLong(GROW_START, System.currentTimeMillis())
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

    /** „Mehr Streifen mit der Zeit“ ein- oder ausgeschaltet: der Durchgang beginnt jetzt. */
    fun setGrowTime(ctx: Context, on: Boolean) {
        prefs(ctx).edit().putInt(GROW_TIME, if (on) 1 else 0).putLong(GROW_START, System.currentTimeMillis()).apply()
    }

    /** Selbst angetippte Aufschlagstelle speichern (Anteile von Breite und Höhe) und neue Risse dorthin legen. */
    fun setImpact(ctx: Context, px: Float, py: Float, tx: Float, ty: Float) {
        prefs(ctx).edit().putFloat(PX, px).putFloat(PY, py).putFloat(TX, tx).putFloat(TY, ty).putInt(IMPACT, 1)
            .putLong(CRACK_SEED, newSeed()).putLong(CRACK_TIME, System.currentTimeMillis()).apply()
    }

    fun hasImpact(p: SharedPreferences) = p.getFloat(PX, -1f) >= 0f && p.getFloat(TX, -1f) >= 0f

    /** „Nach Stunden“: Ist es Zeit für neue Risse? */
    fun autoDue(p: SharedPreferences): Boolean {
        if (p.getInt(AUTO, 0) != 2) return false
        val hours = p.getInt(HOURS, 6).coerceIn(1, 24)
        val last = p.getLong(CRACK_TIME, 0L)
        val now = System.currentTimeMillis()
        return last <= 0L || now - last >= hours * 3_600_000L || now < last
    }

    fun applyTo(ctx: Context, r: GlitchRenderer) {
        val p = prefs(ctx)
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
            start = System.currentTimeMillis()
            p.edit().putLong(GROW_START, start).apply()
        }
        r.growStart = start
        r.touchFx = p.getInt(TOUCH_FX, 1) == 1
        val manual = if (p.getInt(IMPACT, 0) == 1 && hasImpact(p))
            floatArrayOf(p.getFloat(PX, 0.5f), p.getFloat(PY, 0.5f), p.getFloat(TX, 0.5f), p.getFloat(TY, 0.2f)) else null
        val ck = r.clock
        // Der Riss durch die Uhr richtet sich nach der Höhe, bei der der Regler losgelassen wurde
        val cp = ClockPrefs.prefs(ctx)
        val clockKey = if (ck == null) "aus" else "${ClockPrefs.cyAim(cp)}|${ck.size}|${ck.date}|${r.clockCrack > 0}"
        r.configureCracks(
            n = p.getInt(CRACKS, 3).coerceIn(0, 6),
            splinter = p.getInt(SPLINTER, 1).coerceIn(0, 2),
            seed = crackSeed(p),
            manual = manual,
            clockKey = clockKey
        )
    }
}
