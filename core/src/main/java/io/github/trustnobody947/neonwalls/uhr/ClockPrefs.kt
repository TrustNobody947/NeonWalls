package io.github.trustnobody947.neonwalls.uhr

import android.content.Context
import android.content.SharedPreferences

/** Einstellungen der Uhr, gemeinsam für alle Hintergründe. Wo die Uhr erscheint, gilt je Hintergrund. */
object ClockPrefs {
    const val NAME = "clock_prefs"

    // Schlüssel je Hintergrund (früher Schalter an/aus, jetzt Grundlage für „Uhr zeigen“)
    const val ON_GLITCH = "on_glitch"
    const val ON_PEGEL = "on_pegel"
    const val POS = "pos"           // alt: 0 oben, 1 Mitte, 2 unten (nur noch zum Übernehmen)
    /** Höhe der Uhr in Prozent der Bildschirmhöhe (Mitte von Uhr und Datum), 15 = wie beim Original. */
    const val CY = "cy"
    /** Höhe, durch die der Riss gelegt wurde (wird erst beim Loslassen des Reglers übernommen). */
    const val CY_AIM = "cy_aim"
    const val SIZE = "size"
    const val DATE = "date"
    const val FINISH = "finish"
    const val CRACK = "crack"
    /** 3D-Effekt beim Neigen 0..10 (0 = aus). */
    const val D3 = "d3"
    /** alt: 0 überall, 1 nur Start, 2 nur Sperrbild (gemeinsam für alle Hintergründe, nur noch zum Übernehmen) */
    const val WHERE = "where"

    // „Uhr zeigen“ je Hintergrund
    const val MODE_LOCK = 0
    const val MODE_HOME = 1
    const val MODE_BOTH = 2
    const val MODE_OFF = 3

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun modeKey(onKey: String) = "mode_$onKey"

    /** Wo die Uhr dieses Hintergrunds erscheint (übernimmt beim ersten Mal die alten Einstellungen). */
    fun mode(p: SharedPreferences, onKey: String): Int {
        val k = modeKey(onKey)
        if (p.contains(k)) return p.getInt(k, MODE_OFF).coerceIn(0, 3)
        if (!p.getBoolean(onKey, false)) return MODE_OFF
        return when (p.getInt(WHERE, 0)) {
            1 -> MODE_HOME
            2 -> MODE_LOCK
            else -> MODE_BOTH
        }
    }

    fun mode(ctx: Context, onKey: String): Int = mode(prefs(ctx), onKey)

    /** Höhe in Prozent (übernimmt beim ersten Mal die alte Wahl oben/Mitte/unten). */
    fun cy(p: SharedPreferences): Int =
        if (p.contains(CY)) p.getInt(CY, 15).coerceIn(0, 100) else intArrayOf(15, 42, 66)[p.getInt(POS, 0).coerceIn(0, 2)]

    fun cyAim(p: SharedPreferences): Int = if (p.contains(CY_AIM)) p.getInt(CY_AIM, 15) else cy(p)

    fun d3(ctx: Context): Int = prefs(ctx).getInt(D3, 5).coerceIn(0, 10)

    /** Uhr für einen Hintergrund: eingeschaltet → (wiederverwendetes) Zifferblatt mit aktuellen Einstellungen, sonst null. */
    fun face(ctx: Context, onKey: String, old: ClockFace?): ClockFace? {
        val p = prefs(ctx)
        if (mode(p, onKey) == MODE_OFF) return null
        val f = old ?: ClockFace()
        f.configure(cy(p), p.getInt(SIZE, 5), p.getInt(DATE, 0), p.getInt(FINISH, ClockFace.WHITE))
        return f
    }

    fun crack(ctx: Context): Int = prefs(ctx).getInt(CRACK, 5)

    /** Soll die Uhr gerade zu sehen sein? locked = der Sperrbildschirm ist gerade zu sehen. */
    fun shown(mode: Int, locked: Boolean): Boolean = when (mode) {
        MODE_LOCK -> locked
        MODE_HOME -> !locked
        MODE_BOTH -> true
        else -> false
    }

    /** Muss nachgesehen werden, ob der Sperrbildschirm zu sehen ist? */
    fun needsLockCheck(mode: Int) = mode == MODE_LOCK || mode == MODE_HOME
}
