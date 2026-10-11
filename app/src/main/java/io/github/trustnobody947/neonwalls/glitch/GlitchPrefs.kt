package io.github.trustnobody947.neonwalls.glitch

import android.content.Context
import android.content.SharedPreferences
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs

/** Gespeicherte Einstellungen, gemeinsam für Vorschau und Live-Hintergrund. */
object GlitchPrefs {
    const val NAME = "glitch_prefs"

    const val CALM = "calm"
    const val BURST = "burst"
    const val COUNT_POS = "count_pos"
    const val SHEAR = "shear"
    const val SEED = "seed"
    const val RANDOM_ON_WAKE = "random_on_wake"
    const val MUTATE = "mutate_on_glitch"

    /** Regler-Position 0..100 -> Anzahl Streifen 3..150 (exponentiell: unten fein, oben krass). */
    fun countFromPos(pos: Int): Int = Math.round(3.0 * Math.pow(50.0, pos / 100.0)).toInt()

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun seed(p: SharedPreferences): Long {
        var s = p.getLong(SEED, 0L)
        if (s == 0L) {
            s = System.nanoTime() or 1L
            p.edit().putLong(SEED, s).apply()
        }
        return s
    }

    fun newPattern(ctx: Context) {
        prefs(ctx).edit().putLong(SEED, System.nanoTime() or 1L).apply()
    }

    fun applyTo(ctx: Context, r: GlitchRenderer) {
        val p = prefs(ctx)
        r.mutate = p.getBoolean(MUTATE, false)
        r.clock = ClockPrefs.face(ctx, ClockPrefs.ON_GLITCH, r.clock)
        r.clockCrack = ClockPrefs.crack(ctx)
        r.configure(
            calm = p.getInt(CALM, 4),
            burst = p.getInt(BURST, 5),
            count = countFromPos(p.getInt(COUNT_POS, 59)),
            shear = p.getInt(SHEAR, 5),
            seed = seed(p)
        )
    }
}
