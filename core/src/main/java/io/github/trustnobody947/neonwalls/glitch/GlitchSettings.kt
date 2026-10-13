package io.github.trustnobody947.neonwalls.glitch

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView
import io.github.trustnobody947.neonwalls.core.R
import io.github.trustnobody947.neonwalls.ui.Sheet
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs
import kotlin.math.max

/**
 * Einstellungen für Broken Screen – gemeinsam für Neon Walls und die eigene App „Broken Screen“.
 * Baut die Regler, verbindet sie mit der Vorschau und führt durch „Aufschlag antippen“
 * (erst die Aufschlagstelle, dann die Richtung des Risses).
 */
class GlitchSettings(
    private val act: Activity,
    private val ui: Sheet,
    private val view: GlitchView,
    private val hint: TextView,
    private val showPanel: (Boolean) -> Unit,
    private val onSetWallpaper: () -> Unit
) {
    private val p = GlitchPrefs.prefs(act)
    private var tapStep = 0
    private var tapX = 0f
    private var tapY = 0f
    private var setImpactChoice: ((Int) -> Unit)? = null
    private val handler = Handler(Looper.getMainLooper())
    private val hideHint = Runnable { hint.visibility = View.GONE }

    private fun s(id: Int) = act.getString(id)

    /** Neue Einstellungen an die Vorschau geben (der Hintergrund liest sie selbst aus den gespeicherten Werten). */
    fun reapply() {
        GlitchPrefs.applyTo(act, view.renderer)
    }

    fun build(title: String) {
        ui.addTitle(title, s(R.string.bs_hint))
        reapply()
        // Risse wechseln bei großen Glitch-Ausbrüchen auch in der Vorschau
        view.renderer.onBigBurst = {
            if (p.getInt(GlitchPrefs.AUTO, 0) == 1) {
                GlitchPrefs.newCracks(act)
                reapply()
            }
        }
        val re = { reapply() }

        // Glasrisse
        ui.addSlider(s(R.string.s_cracks), p, GlitchPrefs.CRACKS, 3, 0, 6, 1,
            { if (it == 0) s(R.string.cracks_none) else it.toString() }, re)
        setImpactChoice = ui.addChoice(s(R.string.s_impact), p, GlitchPrefs.IMPACT, 0,
            listOf(s(R.string.impact_random), s(R.string.impact_tap))) { idx ->
            // „Selbst angetippt“ ohne angetippte Stelle: gleich antippen lassen
            if (idx == 1 && !GlitchPrefs.hasImpact(p)) startTap()
            else {
                cancelTap()
                GlitchPrefs.newCracks(act)
                reapply()
            }
        }
        ui.addChoice(s(R.string.s_splinter), p, GlitchPrefs.SPLINTER, 1,
            listOf(s(R.string.spl_0), s(R.string.spl_1), s(R.string.spl_2))) { reapply() }
        ui.addChoice(s(R.string.s_auto), p, GlitchPrefs.AUTO, 0,
            listOf(s(R.string.auto_0), s(R.string.auto_1), s(R.string.auto_2))) { restartAutoClock() }
        ui.addSlider(s(R.string.s_hours), p, GlitchPrefs.HOURS, 6, 1, 24, 1,
            { if (it == 1) s(R.string.hours_1) else act.getString(R.string.hours_n, it) }) { restartAutoClock() }
        ui.addSlider(s(R.string.s_shear), p, GlitchPrefs.SHEAR, 5, 0, 10, 1, ui::level, re)

        // Streifen und Glitches
        ui.addSlider(s(R.string.s_calm), p, GlitchPrefs.CALM, 4, 0, 10, 1, ui::level, re)
        ui.addSlider(s(R.string.s_burst), p, GlitchPrefs.BURST, 5, 0, 10, 1, ui::level, re)
        ui.addSlider(s(R.string.s_count), p, GlitchPrefs.COUNT_POS, 59, 0, 100, 1,
            { GlitchPrefs.countFromPos(it).toString() }, re)
        ui.addSwitch(s(R.string.s_random), p, GlitchPrefs.RANDOM_ON_WAKE, false, re)
        ui.addSwitch(s(R.string.s_mutate), p, GlitchPrefs.MUTATE, false, re)

        addClockSection(act, ui, ClockPrefs.ON_GLITCH, true, re)

        ui.addButtonRow(
            s(R.string.b_new) to {
                GlitchPrefs.newPattern(act)
                reapply()
            },
            s(R.string.b_glitch) to {
                if (view.renderer.triggerBurst() && p.getInt(GlitchPrefs.AUTO, 0) == 1) {
                    GlitchPrefs.newCracks(act)
                    reapply()
                }
            }
        )
        ui.addButtonRow(
            s(R.string.b_impact) to { startTap() },
            s(R.string.b_fullscreen) to { showPanel(false) }
        )
        ui.addPrimaryButton(s(R.string.b_set)) { onSetWallpaper() }
    }

    /** „Nach Stunden“: Zeit ab jetzt neu zählen. */
    private fun restartAutoClock() {
        p.edit().putLong(GlitchPrefs.CRACK_TIME, System.currentTimeMillis()).apply()
    }

    // ---------- Aufschlag antippen ----------

    fun startTap() {
        tapStep = 1
        view.renderer.marker = null
        showPanel(false)
        showHint(s(R.string.tap_1), 0)
    }

    fun cancelTap() {
        if (tapStep == 0) return
        tapStep = 0
        view.renderer.marker = null
        hint.visibility = View.GONE
    }

    /** Antippen der Vorschau: im Auswahlmodus erst die Aufschlagstelle, dann die Richtung. true = verbraucht. */
    fun handleTap(): Boolean {
        if (tapStep == 0) return false
        val x = view.lastX
        val y = view.lastY
        val w = max(1, view.width).toFloat()
        val h = max(1, view.height).toFloat()
        if (tapStep == 1) {
            tapX = x / w
            tapY = y / h
            tapStep = 2
            view.renderer.marker = floatArrayOf(x, y)
            showHint(s(R.string.tap_2), 0)
            return true
        }
        tapStep = 0
        view.renderer.marker = null
        GlitchPrefs.setImpact(act, tapX, tapY, (x / w).coerceIn(0f, 1f), (y / h).coerceIn(0f, 1f))
        setImpactChoice?.invoke(1)
        reapply()
        showHint(s(R.string.tap_done), 5000)
        return true
    }

    private fun showHint(text: String, ms: Long) {
        hint.text = text
        hint.visibility = View.VISIBLE
        handler.removeCallbacks(hideHint)
        if (ms > 0) handler.postDelayed(hideHint, ms)
    }

    companion object {
        /** Hinweis-Feld unten über der Vorschau (für „Aufschlag antippen“). */
        fun makeHint(act: Activity, root: FrameLayout): TextView {
            val d = act.resources.displayMetrics.density
            val tv = TextView(act).apply {
                setTextColor(Color.rgb(232, 236, 242))
                textSize = 14f
                gravity = Gravity.CENTER
                setPadding((16 * d).toInt(), (10 * d).toInt(), (16 * d).toInt(), (10 * d).toInt())
                background = GradientDrawable().apply {
                    cornerRadius = 14 * d
                    setColor(Color.argb(232, 12, 14, 18))
                    setStroke((1 * d).toInt(), Color.argb(40, 255, 255, 255))
                }
                visibility = View.GONE
            }
            root.addView(tv, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply {
                bottomMargin = (64 * d).toInt()
                leftMargin = (16 * d).toInt()
                rightMargin = (16 * d).toInt()
            })
            return tv
        }

        /** Uhr-Einstellungen (für alle Hintergründe gleich, je Hintergrund ein eigener Schalter). */
        fun addClockSection(act: Activity, ui: Sheet, onKey: String, withCrack: Boolean, reapply: () -> Unit) {
            val cp = ClockPrefs.prefs(act)
            fun s(id: Int) = act.getString(id)
            ui.addTitle(s(R.string.c_title), s(R.string.c_note), ui.dpi(22))
            ui.addSwitch(s(R.string.c_show), cp, onKey, false, reapply)
            ui.addChoice(s(R.string.c_where), cp, ClockPrefs.WHERE, 0,
                listOf(s(R.string.where_0), s(R.string.where_1), s(R.string.where_2))) { reapply() }
            ui.addNote(s(R.string.where_note))
            ui.addChoice(s(R.string.c_finish), cp, ClockPrefs.FINISH, ClockFace.WHITE, listOf(
                s(R.string.f_chrome), s(R.string.f_gold), s(R.string.f_steel),
                s(R.string.f_rose), s(R.string.f_black), s(R.string.f_copper),
                s(R.string.f_neon), s(R.string.f_white))) { reapply() }
            ui.addChoice(s(R.string.c_pos), cp, ClockPrefs.POS, 0,
                listOf(s(R.string.c_top), s(R.string.c_mid), s(R.string.c_bottom))) { reapply() }
            ui.addSlider(s(R.string.c_size), cp, ClockPrefs.SIZE, 5, 1, 10, 1, { it.toString() }, reapply)
            ui.addChoice(s(R.string.c_date), cp, ClockPrefs.DATE, 0,
                listOf(s(R.string.c_date_orig), s(R.string.c_date_de), s(R.string.off))) { reapply() }
            if (withCrack) ui.addSlider(s(R.string.c_crack), cp, ClockPrefs.CRACK, 5, 0, 10, 1, ui::level, reapply)
        }
    }
}
