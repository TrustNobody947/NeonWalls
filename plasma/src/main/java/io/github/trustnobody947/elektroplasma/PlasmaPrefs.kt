package io.github.trustnobody947.elektroplasma

import android.content.Context
import android.content.SharedPreferences

/** Alle Einstellungen auf einen Blick (unveränderlich, damit der Grafik-Thread sie gefahrlos lesen kann). */
data class PlasmaSettings(
    val color: Int = 0,            // 0..6 Voreinstellung, 7 = eigene
    val k1: Float = 100f,          // Mittellinie (Spektrum 0..100)
    val k2: Float = 60.5f,         // Rand
    val k3: Float = 66f,           // Nebel
    val mode: Int = 0,             // 0 fest, 1 Zufall, 2 Wechsel, 3 Akku, 4 Neigung, 5 Kompass
    val speed: Int = 78,           // 0..100
    val complexity: Int = 3,       // 1..5
    val glow: Int = 5,             // 1..10 Linienstärke
    val sym: Int = 0,              // 0 asymmetrisch, 1 gespiegelt, 2 zweifach gespiegelt
    val touch: Boolean = true,
    val move: Boolean = false
) {
    /** Die drei Reglerstellungen der aktuellen Farbe. */
    fun layers(): FloatArray = if (color in 0 until PlasmaColors.CUSTOM) PlasmaColors.PRESETS[color] else floatArrayOf(k1, k2, k3)
}

object PlasmaPrefs {
    const val NAME = "plasma_prefs"
    const val COLOR = "color"
    const val K1 = "k1"
    const val K2 = "k2"
    const val K3 = "k3"
    const val MODE = "mode"
    const val SPEED = "speed"
    const val COMPLEXITY = "complexity"
    const val GLOW = "glow"
    const val SYM = "sym"
    const val TOUCH = "touch"
    const val MOVE = "move"

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    fun load(ctx: Context): PlasmaSettings {
        val p = prefs(ctx)
        val d = PlasmaSettings()
        return PlasmaSettings(
            color = p.getInt(COLOR, d.color).coerceIn(0, PlasmaColors.CUSTOM),
            k1 = p.getFloat(K1, d.k1).coerceIn(0f, 100f),
            k2 = p.getFloat(K2, d.k2).coerceIn(0f, 100f),
            k3 = p.getFloat(K3, d.k3).coerceIn(0f, 100f),
            mode = p.getInt(MODE, d.mode).coerceIn(0, 5),
            speed = p.getInt(SPEED, d.speed).coerceIn(0, 100),
            complexity = p.getInt(COMPLEXITY, d.complexity).coerceIn(1, 5),
            glow = p.getInt(GLOW, d.glow).coerceIn(1, 10),
            sym = p.getInt(SYM, d.sym).coerceIn(0, 2),
            touch = p.getBoolean(TOUCH, d.touch),
            move = p.getBoolean(MOVE, d.move)
        )
    }
}
