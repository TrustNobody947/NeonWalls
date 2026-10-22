package io.github.trustnobody947.neonwalls.glitch

import android.content.Context
import android.content.SharedPreferences
import io.github.trustnobody947.neonwalls.core.R

/**
 * Freischaltung in drei Stufen (nur wo [active], also in Broken Screen als eigener App; in Neon Walls ist alles frei):
 *  0 = frei,
 *  1 = Extras: 24 Stunden nach einem Werbevideo oder für immer mit dem Kauf,
 *  2 = nur mit dem Kauf (eigenes Bild).
 * Gespeichert in eigenen Einstellungen, damit auch der Hintergrund weiß, was gerade frei ist: Gesperrte Einstellungen
 * nutzen dort die freien Werte (die eigenen bleiben gespeichert und gelten wieder, sobald sie frei sind).
 * Werbung und Kauf selbst laufen in der App (Modul brokenscreen), hier nur der Stand.
 */
object Unlock {
    private const val NAME = "unlock_prefs"
    /** Extras frei bis (Uhrzeit in ms), nach einem ganz angesehenen Werbevideo. */
    const val UNTIL = "until"
    /** Gekauft: alles für immer frei, ohne Werbung. */
    const val BOUGHT = "bought"

    const val FREE = 0
    const val DAY_OR_BUY = 1
    const val BUY = 2

    /** So lange gilt ein Werbevideo. */
    const val DAY_MS = 24L * 3600L * 1000L

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    /** Gibt es in dieser App gesperrte Teile? (Ressource monetized, nur Broken Screen setzt sie auf true) */
    fun active(ctx: Context): Boolean = try {
        ctx.resources.getBoolean(R.bool.monetized)
    } catch (e: Exception) {
        false
    }

    /** Ist Stufe tier gerade frei? */
    fun ok(ctx: Context, tier: Int): Boolean {
        if (tier <= FREE || !active(ctx)) return true
        val p = prefs(ctx)
        if (p.getBoolean(BOUGHT, false)) return true
        return tier == DAY_OR_BUY && System.currentTimeMillis() < p.getLong(UNTIL, 0L)
    }

    fun bought(ctx: Context): Boolean = prefs(ctx).getBoolean(BOUGHT, false)

    /** Extras frei bis (ms), 0 = gerade nicht. */
    fun until(ctx: Context): Long {
        val u = prefs(ctx).getLong(UNTIL, 0L)
        return if (u > System.currentTimeMillis()) u else 0L
    }

    /** Werbevideo ganz angesehen: 24 Stunden alle Extras. */
    fun grantDay(ctx: Context) {
        prefs(ctx).edit().putLong(UNTIL, System.currentTimeMillis() + DAY_MS).apply()
    }

    /** Kauf bestätigt (oder zurückgenommen, z. B. erstattet). */
    fun setBought(ctx: Context, b: Boolean) {
        if (bought(ctx) != b) prefs(ctx).edit().putBoolean(BOUGHT, b).apply()
    }

    /** Zurück zur kostenlosen Version (nur Testbetrieb). */
    fun reset(ctx: Context) {
        prefs(ctx).edit().putBoolean(BOUGHT, false).putLong(UNTIL, 0L).apply()
    }
}
