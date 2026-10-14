package io.github.trustnobody947.neonwalls.glitch

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import io.github.trustnobody947.neonwalls.core.R
import io.github.trustnobody947.neonwalls.ui.Sheet
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Einstellungen für Broken Screen – gemeinsam für Neon Walls und die eigene App „Broken Screen“.
 * Baut die Regler, verbindet sie mit der Vorschau und führt durch „Aufschlag antippen“
 * (erst die Aufschlagstelle, dann die Richtung des Risses). Statuszeile für wachsende Streifen und ein Zeitraffer
 * zum Ausprobieren (1 Stunde in 3 Sekunden).
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
    private var info: TextView? = null
    private var lapse = false
    private var lapseBtn: Button? = null
    private var lastTick = 0L

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
        // „Mehr Streifen mit der Zeit“ ist durch: neues Muster, wieder mit wenigen Streifen
        view.renderer.onGrowRestart = {
            GlitchPrefs.restartGrowth(act)
            reapply()
        }
        view.onFrame = { tick() }
        val re = { reapply() }
        val offOn = listOf(s(R.string.off), s(R.string.on))

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
        ui.addSlider(s(R.string.s_hours), p, GlitchPrefs.HOURS, 6, 1, 24, 1, this::hours, { restartAutoClock() })
        ui.addSlider(s(R.string.s_shear), p, GlitchPrefs.SHEAR, 5, 0, 10, 1, ui::level, re)

        // Streifen und Glitches
        ui.addSlider(s(R.string.s_calm), p, GlitchPrefs.CALM, 4, 0, 10, 1, ui::level, re)
        ui.addSlider(s(R.string.s_burst), p, GlitchPrefs.BURST, 5, 0, 10, 1, ui::level, re)
        ui.addSlider(s(R.string.s_count), p, GlitchPrefs.COUNT_POS, 59, 0, 100, 1,
            { GlitchPrefs.countFromPos(it).toString() }, re)
        ui.addSlider(s(R.string.s_count_max), p, GlitchPrefs.COUNT_MAX, 85, 0, 100, 1,
            { GlitchPrefs.countFromPos(it).toString() }, re)
        ui.addChoice(s(R.string.s_grow_time), p, GlitchPrefs.GROW_TIME, 0, offOn) { idx ->
            // ein- oder ausgeschaltet: der Durchgang beginnt jetzt
            GlitchPrefs.setGrowTime(act, idx == 1)
            reapply()
        }
        ui.addSlider(s(R.string.s_grow_hours), p, GlitchPrefs.GROW_HOURS, 6, 1, 24, 1, this::hours, re)
        ui.addChoice(s(R.string.s_grow_batt), p, GlitchPrefs.GROW_BATT, 0, offOn) { reapply() }
        ui.addNote(s(R.string.grow_note))
        info = ui.addInfo()
        lapseBtn = ui.addButtonRow(s(R.string.b_lapse) to { toggleLapse() }).firstOrNull()
        ui.addChoice(s(R.string.s_touch), p, GlitchPrefs.TOUCH_FX, 1, offOn) { reapply() }
        ui.addNote(s(R.string.touch_note))
        ui.addSwitch(s(R.string.s_random), p, GlitchPrefs.RANDOM_ON_WAKE, false, re)
        ui.addSwitch(s(R.string.s_mutate), p, GlitchPrefs.MUTATE, false, re)

        addClockSection(act, ui, ClockPrefs.ON_GLITCH, true, view.renderer.metal != null, re)

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
        updateInfo()
    }

    private fun hours(v: Int) = if (v == 1) s(R.string.hours_1) else act.getString(R.string.hours_n, v)

    // ---------- Statuszeile und Zeitraffer ----------

    /** Nach jedem Bild der Vorschau, wirkt höchstens viermal pro Sekunde. */
    private fun tick() {
        val now = SystemClock.uptimeMillis()
        if (now - lastTick < 250L) return
        val dt = if (lastTick == 0L) 0L else now - lastTick
        lastTick = now
        // Zeitraffer: die Zeit läuft 1200-mal so schnell (1 Stunde in 3 Sekunden)
        if (lapse && dt in 1L..2000L) shiftTime(dt * 1199L)
        // „Risse wechseln nach Stunden“ auch in der Vorschau
        if (GlitchPrefs.autoDue(p)) {
            GlitchPrefs.newCracks(act)
            reapply()
        }
        updateInfo()
    }

    /** Beginn des Durchgangs und letzten Risswechsel vorverlegen (gilt auch für den Hintergrund). */
    private fun shiftTime(ms: Long) {
        val now = System.currentTimeMillis()
        val e = p.edit()
        var any = false
        if (p.getInt(GlitchPrefs.GROW_TIME, 0) == 1) {
            e.putLong(GlitchPrefs.GROW_START, p.getLong(GlitchPrefs.GROW_START, now) - ms)
            any = true
        }
        if (p.getInt(GlitchPrefs.AUTO, 0) == 2) {
            e.putLong(GlitchPrefs.CRACK_TIME, p.getLong(GlitchPrefs.CRACK_TIME, now) - ms)
            any = true
        }
        if (!any) return
        e.apply()
        reapply()
    }

    private fun toggleLapse() {
        lapse = !lapse
        lastTick = 0L
        lapseBtn?.text = s(if (lapse) R.string.b_lapse_off else R.string.b_lapse)
        Toast.makeText(act, if (lapse) R.string.lapse_on else R.string.lapse_off, Toast.LENGTH_LONG).show()
        updateInfo()
    }

    private fun dur(ms: Long): String {
        val sec = (ms / 1000L).toInt()
        val h = sec / 3600
        val m = sec % 3600 / 60
        return when {
            h > 0 -> act.getString(R.string.dur_h, h, m)
            m > 0 -> act.getString(R.string.dur_m, m, sec % 60)
            else -> act.getString(R.string.dur_s, sec % 60)
        }
    }

    /** „Jetzt N Streifen · Neustart in … · Akku … %“ (nur wenn Streifen wachsen). */
    private fun updateInfo() {
        val tv = info ?: return
        val gt = p.getInt(GlitchPrefs.GROW_TIME, 0) == 1
        val gb = p.getInt(GlitchPrefs.GROW_BATT, 0) == 1
        if (!gt && !gb) {
            if (tv.visibility != View.GONE) tv.visibility = View.GONE
            return
        }
        val r = view.renderer
        val sb = StringBuilder(act.getString(R.string.gi_now, r.shownCount))
        if (gt) sb.append(" · ").append(act.getString(R.string.gi_restart, dur(max(0L, r.growRemainingMs(System.currentTimeMillis())))))
        if (gb) sb.append(" · ").append(act.getString(R.string.gi_batt, (r.battery * 100f).roundToInt()))
        if (lapse) sb.append(" · ").append(s(R.string.gi_lapse))
        val t = sb.toString()
        if (tv.text.toString() != t) tv.text = t
        if (tv.visibility != View.VISIBLE) tv.visibility = View.VISIBLE
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

        /**
         * Uhr-Einstellungen (für alle Hintergründe gleich; wo die Uhr erscheint, gilt je Hintergrund).
         * broken: Broken Screen (Riss durch die Uhr, 3D); has3d: Metall-Uhr in 3D läuft auf diesem Handy.
         */
        fun addClockSection(act: Activity, ui: Sheet, onKey: String, broken: Boolean, has3d: Boolean, reapply: () -> Unit) {
            val cp = ClockPrefs.prefs(act)
            fun s(id: Int) = act.getString(id)
            ui.addTitle(s(R.string.c_title), s(R.string.c_note), ui.dpi(22))
            var note: TextView? = null
            fun showNote(m: Int) {
                val n = note ?: return
                val t = when (m) {
                    ClockPrefs.MODE_LOCK -> s(R.string.mode_note_lock)
                    ClockPrefs.MODE_HOME -> s(R.string.mode_note_home)
                    else -> ""
                }
                n.text = t
                n.visibility = if (t.isEmpty()) View.GONE else View.VISIBLE
            }
            val mode = ClockPrefs.mode(cp, onKey)
            ui.addChoice(s(R.string.c_where), cp, ClockPrefs.modeKey(onKey), mode,
                listOf(s(R.string.mode_lock), s(R.string.mode_home), s(R.string.mode_both), s(R.string.off)), 4) { m ->
                showNote(m)
                reapply()
            }
            note = ui.addNote("")
            showNote(mode)
            if (broken) {
                if (has3d) ui.addSlider(s(R.string.c_3d), cp, ClockPrefs.D3, 5, 0, 10, 1, ui::level, reapply)
                else ui.addNote(s(R.string.c_3d_none))
            }
            // Höhe: die Uhr wandert gleich mit, der Riss durch die Uhr wird erst beim Loslassen neu gelegt
            ui.addSlider(s(R.string.c_cy), cp, ClockPrefs.CY, ClockPrefs.cy(cp), 0, 100, 1, { "$it %" }, reapply) {
                cp.edit().putInt(ClockPrefs.CY_AIM, ClockPrefs.cy(cp)).apply()
                reapply()
            }
            if (broken) ui.addSlider(s(R.string.c_crack), cp, ClockPrefs.CRACK, 5, 0, 10, 1, ui::level, reapply)
            ui.addSlider(s(R.string.c_size), cp, ClockPrefs.SIZE, 5, 1, 10, 1, { it.toString() }, reapply)
            ui.addChoice(s(R.string.c_date), cp, ClockPrefs.DATE, 0,
                listOf(s(R.string.c_date_orig), s(R.string.c_date_de), s(R.string.off))) { reapply() }
            ui.addChoice(s(R.string.c_finish), cp, ClockPrefs.FINISH, ClockFace.WHITE, listOf(
                s(R.string.f_chrome), s(R.string.f_gold), s(R.string.f_steel),
                s(R.string.f_rose), s(R.string.f_black), s(R.string.f_copper),
                s(R.string.f_neon), s(R.string.f_white))) { reapply() }
        }
    }
}
