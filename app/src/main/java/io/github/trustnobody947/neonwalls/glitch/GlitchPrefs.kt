package io.github.trustnobody947.neonwalls.glitch

import android.content.Context
import android.content.SharedPreferences

/** Gespeicherte Einstellungen, gemeinsam für Vorschau und Live-Hintergrund. */
object GlitchPrefs {
    const val NAME = "glitch_prefs"

    const val CALM = "calm"
    const val BURST = "burst"
    const val COUNT = "count"
    const val SHEAR = "shear"
    const val SEED = "seed"
    const val RANDOM_ON_WAKE = "random_on_wake"

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
        r.configure(
            calm = p.getInt(CALM, 4),
            burst = p.getInt(BURST, 5),
            count = p.getInt(COUNT, 30),
            shear = p.getInt(SHEAR, 5),
            seed = seed(p)
        )
    }
}
