package io.github.trustnobody947.neonwalls.glitch

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.MediaStore
import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import io.github.trustnobody947.neonwalls.core.R
import io.github.trustnobody947.neonwalls.ui.Lang
import io.github.trustnobody947.neonwalls.ui.Sheet
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs
import java.text.NumberFormat
import java.util.Date
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Einstellungen für Broken Screen – gemeinsam für Neon Walls und die eigene App „Broken Screen“.
 * Baut die Regler, verbindet sie mit der Vorschau und führt durch „Aufschlag antippen“ (je Aufschlag erst die Stelle,
 * dann die Richtung des Risses). Statuszeilen für wachsende Streifen und Risse und ein Zeitraffer zum Ausprobieren
 * (1 Stunde in 3 Sekunden). Eigenes Hintergrundbild über die Bildauswahl des Handys (die Activity reicht das Ergebnis
 * mit [onActivityResult] weiter). Sprache der App oben umschaltbar ([Lang]).
 * Mit [shop] (nur Broken Screen als eigene App) sind Extras gesperrt: frei 24 Stunden nach einem Werbevideo oder für
 * immer mit dem Kauf, das eigene Bild nur mit dem Kauf ([Unlock]); oben steht der Stand mit „Freischalten“.
 */
class GlitchSettings(
    private val act: Activity,
    private val ui: Sheet,
    private val view: GlitchView,
    private val hint: TextView,
    private val showPanel: (Boolean) -> Unit,
    private val onSetWallpaper: () -> Unit,
    private val shop: Shop? = null
) {
    private val p = GlitchPrefs.prefs(act)
    /** Antippen: 0 = aus, sonst Nummer des nächsten Tipps (1 = erster Aufschlag, 2 = seine Richtung, 3 = zweiter …) */
    private var tapStep = 0
    private var tapPts = FloatArray(0)
    private var tapPx = FloatArray(0)
    private var setImpactChoice: ((Int) -> Unit)? = null
    private val handler = Handler(Looper.getMainLooper())
    private val hideHint = Runnable { hint.visibility = View.GONE }
    private var info: TextView? = null
    private var crackInfo: TextView? = null
    private var bgNote: TextView? = null
    private var lapse = false
    private var lapseBtn: Button? = null
    private var lastTick = 0L

    private fun s(id: Int) = act.getString(id)

    private var usedHint = false

    /**
     * Nach dem Tippen auf einen Knopf das Bild zeigen, damit man die Änderung sieht (Antippen holt die Einstellungen
     * zurück); beim ersten Mal mit kurzem Hinweis. hint = false: ohne Hinweis (der Knopf zeigt schon selbst eine Meldung).
     */
    private fun show(hint: Boolean = true) {
        if (tapStep != 0) return
        showPanel(false)
        if (hint && !usedHint) {
            usedHint = true
            showHint(s(R.string.show_hint), 2500)
        }
    }

    /** „Schwarze Stellen“: statt der Stufe die typische Dauer (aus, ca. 4 s … ca. 20 Min.), Zahlen in der Schreibweise der Sprache */
    private fun darkLabel(v: Int): String {
        if (v <= 0) return s(R.string.l_off)
        val sec = GlitchRenderer.darkMid(v)
        val nf = NumberFormat.getNumberInstance(act.resources.configuration.locales.get(0)).apply { maximumFractionDigits = 1 }
        return when {
            sec < 59.5f -> act.getString(R.string.dark_s, sec.roundToInt())
            sec < 600f -> act.getString(R.string.dark_m, nf.format((sec / 30f).roundToInt() / 2.0))
            else -> act.getString(R.string.dark_m, nf.format((sec / 60f).roundToInt().toLong()))
        }
    }

    // ---------- Freischaltung (nur mit Shop) ----------

    private var entNote: TextView? = null
    private var entBtn: Button? = null
    private var privBtn: Button? = null
    private var privRow: View? = null
    private var lastEx = true
    private var lastBought = false

    /** Zeile oben: kostenlose Version / Extras frei bis … / Vollversion, dazu die Knöpfe. */
    private fun updateEnt() {
        val sh = shop ?: return
        val bought = Unlock.bought(act)
        val until = Unlock.until(act)
        entNote?.text = when {
            bought -> s(R.string.u_full)
            until > 0L -> act.getString(R.string.u_day, DateFormat.getTimeFormat(act).format(Date(until)))
            else -> s(R.string.u_free)
        }
        entBtn?.visibility = if (bought) View.GONE else View.VISIBLE
        // Datenschutz-Knopf nur, wo die Werbung ihn verlangt (EU); im Testbetrieb daneben „Zurücksetzen“
        val priv = sh.privacyRequired()
        privBtn?.visibility = if (priv) View.VISIBLE else View.GONE
        privRow?.visibility = if (priv || sh.test) View.VISIBLE else View.GONE
        updateBgNote()
    }

    /** Freischaltung hat sich geändert: Sperren nachziehen, Vorschau neu einstellen. */
    private fun entChanged() {
        lastEx = GlitchPrefs.extras(act)
        lastBought = Unlock.bought(act)
        ui.refreshLocks()
        updateEnt()
        reapply()
    }

    /** Oben: Stand der Freischaltung, „Freischalten“ und die Sprache. */
    private fun addEnt(sh: Shop) {
        val note = ui.addNote("", 8)
        note.setTextColor(ui.fg)
        note.textSize = 13f
        entNote = note
        val row = LinearLayout(act).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, ui.dpi(4), 0, 0)
        }
        val unlock = ui.makeButton(s(R.string.u_btn), true) { sh.ask(Unlock.DAY_OR_BUY) }
        row.addView(unlock, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = ui.dpi(8) })
        row.addView(Lang.button(act, ui), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        ui.panel.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        entBtn = unlock
        sh.onChange = { entChanged() }
        lastEx = GlitchPrefs.extras(act)
        lastBought = Unlock.bought(act)
    }

    /** Ganz unten: Datenschutz der Werbung (wo nötig) und im Testbetrieb „Zurücksetzen“. */
    private fun addPrivacy(sh: Shop) {
        val items = ArrayList<Pair<String, () -> Unit>>()
        items.add(s(R.string.u_privacy) to { sh.showPrivacy() })
        if (sh.test) items.add(s(R.string.u_test_reset) to {
            sh.testReset()
            Toast.makeText(act, R.string.u_test_reset_done, Toast.LENGTH_SHORT).show()
            Unit
        })
        val btns = ui.addButtonRow(*items.toTypedArray())
        privBtn = btns[0]
        privRow = btns[0].parent as? View
        updateEnt()
    }

    /** Antippen eingeschaltet (gehört zu den Extras: gesperrt zufällig)? */
    private fun tappedMode() = GlitchPrefs.extras(act) && p.getInt(GlitchPrefs.IMPACT, 0) == 1

    /** Neue Einstellungen an die Vorschau geben (der Hintergrund liest sie selbst aus den gespeicherten Werten). */
    fun reapply() {
        GlitchPrefs.applyTo(act, view.renderer)
    }

    /**
     * Einstellungen aufbauen. langRow: Knopf für die Sprache (Neon Walls hat ihn schon oben neben den Hintergründen).
     * Gesperrte Einträge (nur mit [shop]): 24 h = Werbevideo oder Kauf, Kauf = nur mit Kauf.
     */
    fun build(title: String, langRow: Boolean = true) {
        val sh = shop
        ui.gate = sh
        ui.addTitle(title, s(R.string.bs_hint))
        if (sh != null) addEnt(sh)
        else if (langRow) ui.panel.addView(Lang.button(act, ui), LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = ui.dpi(8) })
        reapply()
        // Risse wechseln bei großen Glitch-Ausbrüchen auch in der Vorschau
        view.renderer.onBigBurst = {
            if (GlitchPrefs.auto(act) == 1) {
                GlitchPrefs.newCracks(act)
                reapply()
            }
        }
        // „Mehr Streifen mit der Zeit“ ist durch: neues Muster, wieder mit wenigen Streifen
        view.renderer.onGrowRestart = {
            GlitchPrefs.restartGrowth(act)
            reapply()
        }
        // „Mehr Risse mit der Zeit“ ist durch: neue Risse, wieder mit wenigen
        view.renderer.onCrackRestart = {
            GlitchPrefs.restartCrackGrowth(act)
            reapply()
        }
        view.onFrame = { tick() }
        val re = { reapply() }
        val offOn = listOf(s(R.string.off), s(R.string.on))
        val day = Unlock.DAY_OR_BUY
        val buy = Unlock.BUY

        // Glasrisse: Anzahl von – bis, mehr mit der Zeit
        ui.addFocusSlider(s(R.string.s_cracks), p, GlitchPrefs.CRACKS, 3, 0, Cracks.MAX, 1,
            { if (it == 0) s(R.string.cracks_none) else it.toString() }, re)
        ui.addLockedSlider(s(R.string.s_cracks_max), p, GlitchPrefs.CRACKS_MAX, 10, 0, Cracks.MAX, 1, { it.toString() },
            day, 10, onChange = re)
        ui.addChoice(s(R.string.s_crack_grow), p, GlitchPrefs.CRACK_GROW, 0, offOn, lock = day, free = 0) { idx ->
            // ein- oder ausgeschaltet: der Durchgang beginnt jetzt
            GlitchPrefs.setCrackGrow(act, idx == 1)
            reapply()
            show()
        }
        ui.addLockedSlider(s(R.string.s_grow_hours), p, GlitchPrefs.CRACK_HOURS, 6, 1, 24, 1, this::hours, day, 6, onChange = re)
        crackInfo = ui.addInfo()
        // Aufschläge: wie viele, zufällig oder selbst angetippt (2 und 3 und Antippen gehören zu den Extras)
        ui.addChoice(s(R.string.s_impacts), p, GlitchPrefs.IMPACTS, 0, listOf("1", "2", "3"),
            lockOpts = intArrayOf(0, day, day), free = 0) {
            // „Selbst angetippt“ und für einen Aufschlag fehlt noch die Stelle: gleich antippen lassen
            if (tappedMode() && !GlitchPrefs.allTapped(p)) startTap()
            else {
                cancelTap()
                reapply()
                show()
            }
        }
        setImpactChoice = ui.addChoice(s(R.string.s_impact), p, GlitchPrefs.IMPACT, 0,
            listOf(s(R.string.impact_random), s(R.string.impact_tap)), lockOpts = intArrayOf(0, day), free = 0) { idx ->
            if (idx == 1 && !GlitchPrefs.allTapped(p)) startTap()
            else {
                cancelTap()
                GlitchPrefs.newCracks(act)
                reapply()
                show()
            }
        }
        ui.addLockedSlider(s(R.string.s_hshare), p, GlitchPrefs.HSHARE, 30, 0, 100, 5, { "$it %" }, day, 30, onChange = re)
        ui.addChoice(s(R.string.s_splinter), p, GlitchPrefs.SPLINTER, 1,
            listOf(s(R.string.spl_0), s(R.string.spl_1), s(R.string.spl_2))) { reapply(); show() }
        // Glitzern der Risse beim Neigen (braucht den Neigungssensor, solange der Hintergrund zu sehen ist)
        ui.addChoice(s(R.string.s_glint), p, GlitchPrefs.GLINT, 1, offOn, lock = day, free = 0) { reapply(); show() }
        ui.addChoice(s(R.string.s_auto), p, GlitchPrefs.AUTO, 0,
            listOf(s(R.string.auto_0), s(R.string.auto_1), s(R.string.auto_2)), lockOpts = intArrayOf(0, day, day), free = 0) {
            restartAutoClock(); show()
        }
        ui.addLockedSlider(s(R.string.s_hours), p, GlitchPrefs.HOURS, 6, 1, 24, 1, this::hours, day, 6) { restartAutoClock() }
        ui.addFocusSlider(s(R.string.s_shear), p, GlitchPrefs.SHEAR, 5, 0, 10, 1, ui::level, re)
        // „Schwarze Stellen“: der Regler stellt vor allem ein, wie lange ein Stück schwarz bleibt (die Anzeige sagt es);
        // sie kommen erst ab 9 Rissen
        ui.addFocusSlider(s(R.string.s_dark), p, GlitchPrefs.DARK, 5, 0, 10, 1, this::darkLabel) {
            reapply()
            if (p.getInt(GlitchPrefs.DARK, 5) > 0 && view.renderer.shownCracks < GlitchRenderer.DARK_MIN)
                showHint(act.getString(R.string.dark_min, GlitchRenderer.DARK_MIN), 3000)
        }

        // Streifen und Glitches
        ui.addFocusSlider(s(R.string.s_calm), p, GlitchPrefs.CALM, 4, 0, 10, 1, ui::level, re)
        ui.addFocusSlider(s(R.string.s_burst), p, GlitchPrefs.BURST, 5, 0, 10, 1, ui::level, re)
        ui.addFocusSlider(s(R.string.s_count), p, GlitchPrefs.COUNT_POS, 59, 0, 100, 1,
            { GlitchPrefs.countFromPos(it).toString() }, re)
        ui.addLockedSlider(s(R.string.s_count_max), p, GlitchPrefs.COUNT_MAX, 85, 0, 100, 1,
            { GlitchPrefs.countFromPos(it).toString() }, day, 85, onChange = re)
        ui.addChoice(s(R.string.s_grow_time), p, GlitchPrefs.GROW_TIME, 0, offOn, lock = day, free = 0) { idx ->
            // ein- oder ausgeschaltet: der Durchgang beginnt jetzt
            GlitchPrefs.setGrowTime(act, idx == 1)
            reapply()
            show()
        }
        ui.addLockedSlider(s(R.string.s_grow_hours), p, GlitchPrefs.GROW_HOURS, 6, 1, 24, 1, this::hours, day, 6, onChange = re)
        ui.addChoice(s(R.string.s_grow_batt), p, GlitchPrefs.GROW_BATT, 0, offOn, lock = day, free = 0) { reapply(); show() }
        ui.addNote(s(R.string.grow_note))
        info = ui.addInfo()
        lapseBtn = ui.addButtonRow(s(R.string.b_lapse) to { toggleLapse(); show(false) }).firstOrNull()
        ui.addChoice(s(R.string.s_touch), p, GlitchPrefs.TOUCH_FX, 1, offOn, lock = day, free = 0) { reapply(); show() }
        ui.addChoice(s(R.string.s_touch_flash), p, GlitchPrefs.TOUCH_FLASH, 1, offOn, lock = day, free = 0) { reapply(); show() }
        ui.addNote(s(R.string.touch_note))
        ui.addSwitch(s(R.string.s_random), p, GlitchPrefs.RANDOM_ON_WAKE, false, day) { reapply(); show() }
        ui.addSwitch(s(R.string.s_mutate), p, GlitchPrefs.MUTATE, false, day) { reapply(); show() }

        // Eigenes Bild (nur mit dem Kauf)
        ui.addTitle(s(R.string.bg_title), null, ui.dpi(22))
        bgNote = ui.addNote("")
        ui.addButtonRow(
            s(R.string.b_bg_pick) to { if (ui.allowed(buy)) pickImage() },
            s(R.string.b_bg_clear) to { if (ui.allowed(buy)) { clearImage(); show(false) } }
        ).forEach { ui.lockButton(it, buy) }
        ui.addLockedSlider(s(R.string.s_bg_dim), p, GlitchPrefs.BG_DIM, 40, 0, 90, 5, { "$it %" }, buy, 40, onChange = re)
        updateBgNote()

        addClockSection(act, ui, ClockPrefs.ON_GLITCH, true, view.renderer.metal != null, re) { show() }

        ui.addButtonRow(
            s(R.string.b_new) to {
                GlitchPrefs.newPattern(act)
                reapply()
                show()
            },
            s(R.string.b_glitch) to {
                if (view.renderer.triggerBurst() && GlitchPrefs.auto(act) == 1) {
                    GlitchPrefs.newCracks(act)
                    reapply()
                }
                show()
            }
        )
        val tapBtns = ui.addButtonRow(
            s(R.string.b_impact) to { if (ui.allowed(day)) startTap() },
            s(R.string.b_fullscreen) to { showPanel(false) }
        )
        ui.lockButton(tapBtns[0], day)
        ui.addPrimaryButton(s(R.string.b_set)) { onSetWallpaper() }
        if (sh != null) addPrivacy(sh)
        updateInfo()
    }

    private fun hours(v: Int) = if (v == 1) s(R.string.hours_1) else act.getString(R.string.hours_n, v)

    // ---------- Statuszeilen und Zeitraffer ----------

    /** Nach jedem Bild der Vorschau, wirkt höchstens viermal pro Sekunde. */
    private fun tick() {
        val now = SystemClock.uptimeMillis()
        if (now - lastTick < 250L) return
        val dt = if (lastTick == 0L) 0L else now - lastTick
        lastTick = now
        // Zeitraffer: die Zeit läuft 1200-mal so schnell (1 Stunde in 3 Sekunden)
        if (lapse && dt in 1L..2000L) shiftTime(dt * 1199L)
        // „Risse wechseln nach Stunden“ auch in der Vorschau
        if (GlitchPrefs.autoDue(act)) {
            GlitchPrefs.newCracks(act)
            reapply()
        }
        // Freischaltung geändert (24 Stunden um, Werbevideo angesehen, gekauft)?
        if (shop != null) {
            val ex = GlitchPrefs.extras(act)
            if (ex != lastEx || Unlock.bought(act) != lastBought) {
                val expired = lastEx && !ex
                entChanged()
                if (expired) showHint(s(R.string.u_expired), 4000)
            }
        }
        updateInfo()
    }

    /** Beginn der Durchgänge und letzten Risswechsel vorverlegen (gilt auch für den Hintergrund). */
    private fun shiftTime(ms: Long) {
        val now = System.currentTimeMillis()
        val e = p.edit()
        var any = false
        if (p.getInt(GlitchPrefs.GROW_TIME, 0) == 1) {
            e.putLong(GlitchPrefs.GROW_START, p.getLong(GlitchPrefs.GROW_START, now) - ms)
            any = true
        }
        if (p.getInt(GlitchPrefs.CRACK_GROW, 0) == 1) {
            e.putLong(GlitchPrefs.CRACK_START, p.getLong(GlitchPrefs.CRACK_START, now) - ms)
            any = true
        }
        if (GlitchPrefs.auto(act) == 2) {
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

    private fun setInfo(tv: TextView?, t: String) {
        if (tv == null) return
        if (t.isEmpty()) {
            if (tv.visibility != View.GONE) tv.visibility = View.GONE
            return
        }
        if (tv.text.toString() != t) tv.text = t
        if (tv.visibility != View.VISIBLE) tv.visibility = View.VISIBLE
    }

    /** „Jetzt N Streifen · Neustart in … · Akku … %“ und „Jetzt N Risse · Neustart in …“ (nur wenn sie wachsen). */
    private fun updateInfo() {
        // während ein Regler mit Fokus geschoben wird, bleibt alles andere ausgeblendet
        if (ui.inFocus) return
        val r = view.renderer
        val now = System.currentTimeMillis()
        // gesperrt gelten die freien Werte (aus)
        val ex = GlitchPrefs.extras(act)
        val gt = ex && p.getInt(GlitchPrefs.GROW_TIME, 0) == 1
        val gb = ex && p.getInt(GlitchPrefs.GROW_BATT, 0) == 1
        if (gt || gb) {
            val sb = StringBuilder(act.getString(R.string.gi_now, r.shownCount))
            if (gt) sb.append(" · ").append(act.getString(R.string.gi_restart, dur(max(0L, r.growRemainingMs(now)))))
            if (gb) sb.append(" · ").append(act.getString(R.string.gi_batt, (r.battery * 100f).roundToInt()))
            if (lapse) sb.append(" · ").append(s(R.string.gi_lapse))
            setInfo(info, sb.toString())
        } else setInfo(info, "")
        if (ex && p.getInt(GlitchPrefs.CRACK_GROW, 0) == 1) {
            val a = p.getInt(GlitchPrefs.CRACKS, 3)
            val b = p.getInt(GlitchPrefs.CRACKS_MAX, 10)
            if (b <= a) setInfo(crackInfo, act.getString(R.string.ci_flat, a))
            else {
                val sb = StringBuilder(act.getString(R.string.ci_now, r.shownCracks))
                sb.append(" · ").append(act.getString(R.string.gi_restart, dur(max(0L, r.crackRemainingMs(now)))))
                if (lapse) sb.append(" · ").append(s(R.string.gi_lapse))
                setInfo(crackInfo, sb.toString())
            }
        } else setInfo(crackInfo, "")
    }

    /** „Nach Stunden“: Zeit ab jetzt neu zählen. */
    private fun restartAutoClock() {
        p.edit().putLong(GlitchPrefs.CRACK_TIME, System.currentTimeMillis()).apply()
    }

    // ---------- Eigenes Bild ----------

    private fun updateBgNote() {
        val has = p.getLong(GlitchPrefs.BG_STAMP, 0L) > 0L
        bgNote?.text = s(when {
            !has -> R.string.bg_note_none
            Unlock.ok(act, Unlock.BUY) -> R.string.bg_note_set
            else -> R.string.bg_note_locked
        })
    }

    private fun pickImage() {
        shop?.leaving()
        // Android 13 und neuer: die Fotoauswahl des Systems (braucht keine Berechtigung), sonst die Dateiauswahl
        val i = if (Build.VERSION.SDK_INT >= 33) Intent(MediaStore.ACTION_PICK_IMAGES).setType("image/*")
        else Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")
        try {
            act.startActivityForResult(i, REQ_IMAGE)
        } catch (e: Exception) {
            try {
                act.startActivityForResult(Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*"), REQ_IMAGE)
            } catch (e2: Exception) {
                Toast.makeText(act, R.string.bg_err, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun clearImage() {
        GlitchPrefs.clearBackground(act)
        reapply()
        updateBgNote()
        Toast.makeText(act, R.string.bg_cleared, Toast.LENGTH_SHORT).show()
    }

    /** Ergebnis der Bildauswahl (von der Activity weitergereicht). true = war für uns. */
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQ_IMAGE) return false
        val uri = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) return true
        Toast.makeText(act, R.string.bg_loading, Toast.LENGTH_SHORT).show()
        // Bild laden und zuschneiden dauert einen Moment: nicht auf dem Haupt-Thread
        Thread {
            val ok = try {
                GlitchImage.import(act.applicationContext, uri)
            } catch (e: Throwable) {
                false
            }
            handler.post {
                if (act.isFinishing || act.isDestroyed) return@post
                reapply()
                updateBgNote()
                Toast.makeText(act, if (ok) R.string.bg_set else R.string.bg_err, Toast.LENGTH_LONG).show()
            }
        }.start()
        return true
    }

    // ---------- Aufschlag antippen ----------

    private fun tapHint() {
        val n = GlitchPrefs.impacts(p)
        val k = (tapStep - 1) / 2 + 1
        val t = if (tapStep % 2 == 1) {
            if (n == 1) s(R.string.tap_1) else act.getString(R.string.tap_1n, k, n)
        } else {
            if (n == 1) s(R.string.tap_2) else act.getString(R.string.tap_2n, k)
        }
        showHint(t, 0)
    }

    fun startTap() {
        tapStep = 1
        tapPts = FloatArray(0)
        tapPx = FloatArray(0)
        view.renderer.marks = null
        showPanel(false)
        tapHint()
    }

    fun cancelTap() {
        if (tapStep == 0) return
        tapStep = 0
        view.renderer.marks = null
        hint.visibility = View.GONE
    }

    /**
     * Antippen der Vorschau: im Auswahlmodus je Aufschlag erst die Stelle, dann die Richtung. true = verbraucht.
     */
    fun handleTap(): Boolean {
        if (tapStep == 0) return false
        val x = view.lastX
        val y = view.lastY
        val w = max(1, view.width).toFloat()
        val h = max(1, view.height).toFloat()
        tapPts += floatArrayOf((x / w).coerceIn(0f, 1f), (y / h).coerceIn(0f, 1f))
        tapPx += floatArrayOf(x, y)
        val n = GlitchPrefs.impacts(p)
        if (tapPts.size < 4 * n) {
            tapStep++
            view.renderer.marks = tapPx
            tapHint()
            return true
        }
        tapStep = 0
        view.renderer.marks = null
        GlitchPrefs.setImpacts(act, tapPts)
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
        /** Anfrage-Nummer der Bildauswahl (für onActivityResult der Activity). */
        const val REQ_IMAGE = 4711

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
         * onUse: nach dem Tippen auf einen Knopf (z. B. das Bild zeigen); damit treten auch beim Schieben der Regler die
         * Einstellungen zurück. Mit Freischaltung (ui.gate) gehören 3D, Riss durch die Uhr und die Oberflächen außer
         * Chrom und Weiß zu den Extras.
         */
        fun addClockSection(act: Activity, ui: Sheet, onKey: String, broken: Boolean, has3d: Boolean, reapply: () -> Unit,
                            onUse: (() -> Unit)? = null) {
            val cp = ClockPrefs.prefs(act)
            val focus = onUse != null
            val day = Unlock.DAY_OR_BUY
            fun slider(label: String, key: String, def: Int, min: Int, max: Int, fmt: (Int) -> String, lock: Int = 0) =
                if (lock > 0) ui.addLockedSlider(label, cp, key, def, min, max, 1, fmt, lock, 0, focus, reapply)
                else if (focus) ui.addFocusSlider(label, cp, key, def, min, max, 1, fmt, reapply)
                else ui.addSlider(label, cp, key, def, min, max, 1, fmt, reapply)
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
                onUse?.invoke()
            }
            note = ui.addNote("")
            showNote(mode)
            if (broken) {
                if (has3d) slider(s(R.string.c_3d), ClockPrefs.D3, 5, 0, 10, ui::level, day)
                else ui.addNote(s(R.string.c_3d_none))
            }
            // Höhe: die Uhr wandert gleich mit, der Riss durch die Uhr wird erst beim Loslassen neu gelegt
            val cyRelease = {
                cp.edit().putInt(ClockPrefs.CY_AIM, ClockPrefs.cy(cp)).apply()
                reapply()
            }
            if (focus) ui.addFocusSlider(s(R.string.c_cy), cp, ClockPrefs.CY, ClockPrefs.cy(cp), 0, 100, 1, { "$it %" }, reapply, cyRelease)
            else ui.addSlider(s(R.string.c_cy), cp, ClockPrefs.CY, ClockPrefs.cy(cp), 0, 100, 1, { "$it %" }, reapply, cyRelease)
            if (broken) slider(s(R.string.c_crack), ClockPrefs.CRACK, 5, 0, 10, ui::level, day)
            slider(s(R.string.c_size), ClockPrefs.SIZE, 5, 1, 10, { it.toString() })
            ui.addChoice(s(R.string.c_date), cp, ClockPrefs.DATE, 0,
                listOf(s(R.string.c_date_orig), s(R.string.c_date_de), s(R.string.off))) { reapply(); onUse?.invoke() }
            // Chrom und Weiß sind frei, die anderen Oberflächen gehören zu den Extras
            val finLock = IntArray(8) { if (ClockPrefs.finishFree(it)) 0 else day }
            ui.addChoice(s(R.string.c_finish), cp, ClockPrefs.FINISH, ClockFace.WHITE, listOf(
                s(R.string.f_chrome), s(R.string.f_gold), s(R.string.f_steel),
                s(R.string.f_rose), s(R.string.f_black), s(R.string.f_copper),
                s(R.string.f_neon), s(R.string.f_white)), lockOpts = finLock, free = ClockFace.WHITE) { reapply(); onUse?.invoke() }
        }
    }
}
