package io.github.trustnobody947.neonwalls.uhr

import android.content.Context
import android.content.SharedPreferences

/** Einstellungen der Uhr, gemeinsam für alle Hintergründe. Pro Hintergrund ein eigener Schalter. */
object ClockPrefs {
    const val NAME = "clock_prefs"

    const val ON_GLITCH = "on_glitch"
    const val ON_PEGEL = "on_pegel"
    const val POS = "pos"
    const val SIZE = "size"
    const val DATE = "date"
    const val FINISH = "finish"
    const val CRACK = "crack"

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    /** Uhr für einen Hintergrund: eingeschaltet → (wiederverwendetes) Zifferblatt mit aktuellen Einstellungen, sonst null. */
    fun face(ctx: Context, onKey: String, old: ClockFace?): ClockFace? {
        val p = prefs(ctx)
        if (!p.getBoolean(onKey, false)) return null
        val f = old ?: ClockFace()
        f.configure(p.getInt(POS, 0), p.getInt(SIZE, 5), p.getInt(DATE, 0), p.getInt(FINISH, 0))
        return f
    }

    fun crack(ctx: Context): Int = prefs(ctx).getInt(CRACK, 5)
}
