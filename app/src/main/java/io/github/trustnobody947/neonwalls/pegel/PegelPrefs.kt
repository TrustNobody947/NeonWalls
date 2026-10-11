package io.github.trustnobody947.neonwalls.pegel

import android.content.Context
import android.content.SharedPreferences
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs

/** Gespeicherte Einstellungen der Pegelanzeige, gemeinsam für Vorschau und Live-Hintergrund. */
object PegelPrefs {
    const val NAME = "pegel_prefs"

    const val SOURCE = "source"   // 0 = Musik vom Handy, 1 = Mikrofon, 2 = Demo-Beat
    const val STYLE = "style"     // 0 = Balken, 1 = Spiegel
    const val COLOR = "color"     // 0 = Klassisch, 1 = Cyan, 2 = Pink, 3 = Bernstein, 4 = Regenbogen
    const val BANDS = "bands"     // 8..32
    const val PEAKS = "peaks"     // 0 = an, 1 = aus
    const val AFTER = "after"     // 0..10
    const val MIRROR = "mirror"   // 0 = an, 1 = aus
    const val POS = "pos"         // 0 = Mitte, 1 = Unten
    const val GAIN = "gain"       // 1..10

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun source(ctx: Context): Int = prefs(ctx).getInt(SOURCE, 0)

    fun applyTo(ctx: Context, r: PegelRenderer) {
        val p = prefs(ctx)
        r.clock = ClockPrefs.face(ctx, ClockPrefs.ON_PEGEL, r.clock)
        r.configure(
            style = p.getInt(STYLE, 0),
            colorScheme = p.getInt(COLOR, 0),
            bands = p.getInt(BANDS, 16).coerceIn(8, 32),
            peaks = p.getInt(PEAKS, 0) == 0,
            after = p.getInt(AFTER, 5),
            mirror = p.getInt(MIRROR, 0) == 0,
            bottom = p.getInt(POS, 1) == 1,
            gain = p.getInt(GAIN, 6)
        )
    }
}
