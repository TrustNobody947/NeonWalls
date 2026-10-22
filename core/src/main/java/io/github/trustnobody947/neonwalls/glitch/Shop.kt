package io.github.trustnobody947.neonwalls.glitch

import io.github.trustnobody947.neonwalls.ui.Sheet

/**
 * Werbung, Kauf und Datenschutz-Abfrage für die Einstellungen (umgesetzt in der App Broken Screen, Modul brokenscreen;
 * Neon Walls hat keinen Shop, dort ist alles frei). Was gerade frei ist, steht in [Unlock].
 */
interface Shop : Sheet.Gate {
    /** Wird aufgerufen, wenn sich die Freischaltung ändert (Werbevideo angesehen, gekauft, Kauf wiederhergestellt). */
    var onChange: (() -> Unit)?

    /** Muss die App einen Weg zu den Datenschutz-Einstellungen der Werbung anbieten (EU)? */
    fun privacyRequired(): Boolean

    /** Datenschutz-Einstellungen der Werbung zeigen. */
    fun showPrivacy()

    /** Testbetrieb (Test-Anzeigen, Kauf lässt sich nachstellen und zurücksetzen). */
    val test: Boolean

    /** Nur im Testbetrieb: zurück zur kostenlosen Version. */
    fun testReset()

    /**
     * Die App öffnet gleich selbst etwas (Bildauswahl, Hintergrund-Auswahl): Die Rückkehr zählt nicht als erneutes
     * Öffnen der App (keine Werbung beim Zurückkommen).
     */
    fun leaving()
}
