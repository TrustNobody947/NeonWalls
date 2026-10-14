package io.github.trustnobody947.neonwalls.uhr

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build

/**
 * Metall-Uhr in 3D: zeichnet die Uhr mit Spiegelung, Seitenwänden und Neigung in einem Durchgang auf der
 * Grafikkarte. Die Uhr kann dabei in Bruchstücke zerfallen (Karte der Bruchstücke, je Stück eigener Versatz).
 * Umgesetzt in [MetalClock] (ab Android 13); auf älteren Handys gibt es kein 3D, die Uhr bleibt wie bisher.
 */
interface Clock3D {
    /** Rand um die Uhr (Platz für Seitenwände und Neigung) und Größe der Zeichenfläche. */
    val pad: Int
    val w3: Int
    val h3: Int

    /** Normalenkarte der Uhr übernehmen; neu gerechnet wird nur, wenn sich die Uhr oder der Rand geändert haben. */
    fun setFace(ck: ClockFace, pad: Int): Boolean

    /** Karte der Bruchstücke: Rotwert = Nummer des Stücks (1..8), 0 = keins. */
    fun setRegions(map: Bitmap)

    /**
     * Werte für dieses Bild. tilt: Neigung −1..1; depth: Tiefe der Ziffern als Verschiebung (Richtung der Seitenwände);
     * sub: Bruchteil eines Pixels der Lage; regOrg: Lage der Bruchstück-Karte relativ zur Zeichenfläche.
     */
    fun setFrame(ck: ClockFace, tiltX: Float, tiltY: Float, depthX: Float, depthY: Float, dateDepth: Float,
                 subX: Float, subY: Float, regOrgX: Float, regOrgY: Float)

    /** Je Stück: Versatz (x, y), Deckkraft (0 = nicht zeichnen), Farbblitz (r, g, b, Stärke); Bänder (x0, x1, Stück, an). */
    fun setPieces(off: FloatArray, alpha: FloatArray, tint: FloatArray, bands: FloatArray)

    fun draw(c: Canvas, x: Float, y: Float, alpha: Int)

    companion object {
        const val MAX_PIECES = 8
        const val MAX_BANDS = 10

        /** Metall-Uhr, falls das Handy sie kann (Android 13 und neuer), sonst null. */
        fun create(): Clock3D? = if (Build.VERSION.SDK_INT >= 33) MetalClock.create() else null
    }
}
