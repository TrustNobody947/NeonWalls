package io.github.trustnobody947.neonwalls

import android.Manifest
import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import io.github.trustnobody947.neonwalls.glitch.GlitchSettings
import io.github.trustnobody947.neonwalls.glitch.GlitchView
import io.github.trustnobody947.neonwalls.glitch.GlitchWallpaperService
import io.github.trustnobody947.neonwalls.pegel.PegelAudio
import io.github.trustnobody947.neonwalls.pegel.PegelPrefs
import io.github.trustnobody947.neonwalls.pegel.PegelView
import io.github.trustnobody947.neonwalls.pegel.PegelWallpaperService
import io.github.trustnobody947.neonwalls.ui.HoldPeek
import io.github.trustnobody947.neonwalls.ui.Lang
import io.github.trustnobody947.neonwalls.ui.Sheet
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs
import io.github.trustnobody947.neonwalls.core.R as CoreR

/**
 * Startbildschirm: oben die Auswahl der Hintergründe, dahinter die Live-Vorschau, unten die Einstellungen.
 * Antippen der Vorschau blendet die Einstellungen ein oder aus (dann echtes Vollbild). Finger gedrückt halten auf einer
 * freien Stelle der Einstellungen (bei Broken Screen auch auf der Vorschau) blendet sie aus, solange er liegt.
 * Neben den Hintergründen der Knopf für die Sprache ([Lang]).
 */
class MainActivity : Activity() {

    private lateinit var root: FrameLayout
    private lateinit var sheet: ScrollView
    private lateinit var panel: LinearLayout
    private lateinit var ui: Sheet
    private lateinit var hint: TextView
    private lateinit var peek: HoldPeek
    private var preview: View? = null
    private var glitchView: GlitchView? = null
    private var glitchUi: GlitchSettings? = null
    private var pegelView: PegelView? = null
    private var tab = 0
    private var statusView: TextView? = null
    private var pendingSet = false
    private var askedOnce = false
    private val handler = Handler(Looper.getMainLooper())
    private val statusTick = object : Runnable {
        override fun run() {
            updateStatus()
            handler.postDelayed(this, 600)
        }
    }

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)
    private fun dpi(v: Int) = dp(v.toFloat()).toInt()

    private val accent = Color.rgb(25, 230, 25)
    private val fg = Color.rgb(232, 236, 242)

    private fun appPrefs(): SharedPreferences = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)

    /** Gewählte Sprache (vor Android 13 stellt die App sie selbst ein). */
    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(Lang.wrap(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)

        panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        ui = Sheet(this, panel, accent)
        // Einstellungen höchstens zwei Drittel hoch, darüber scrollen
        sheet = object : ScrollView(this) {
            override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                val maxH = (resources.displayMetrics.heightPixels * 0.66f).toInt()
                super.onMeasure(widthMeasureSpec, View.MeasureSpec.makeMeasureSpec(maxH, View.MeasureSpec.AT_MOST))
            }

            // Finger gedrückt halten auf einer freien Stelle: Einstellungen weg, solange er liegt
            override fun dispatchTouchEvent(ev: MotionEvent): Boolean = peek.dispatch(this, ev) { super.dispatchTouchEvent(it) }
        }
        peek = HoldPeek(sheet)
        sheet.background = GradientDrawable().apply {
            setColor(Color.argb(232, 12, 14, 18))
            cornerRadii = floatArrayOf(dp(18f), dp(18f), dp(18f), dp(18f), 0f, 0f, 0f, 0f)
        }
        sheet.isVerticalScrollBarEnabled = false
        sheet.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(sheet, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        hint = GlitchSettings.makeHint(this, root)

        // Platz für die Navigationsleiste unten lassen
        val pad = dpi(18)
        panel.setPadding(pad, pad, pad, pad)
        root.setOnApplyWindowInsetsListener { _, insets ->
            val bottom = if (Build.VERSION.SDK_INT >= 30) {
                insets.getInsets(WindowInsets.Type.systemBars()).bottom
            } else {
                @Suppress("DEPRECATION")
                insets.systemWindowInsetBottom
            }
            panel.setPadding(pad, pad, pad, pad + bottom)
            insets
        }

        tab = appPrefs().getInt("tab", 0).coerceIn(0, 1)
        build()
        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        if (tab == 1) startPegelAudio()
        handler.post(statusTick)
    }

    override fun onPause() {
        peek.reset()
        pegelView?.audio?.stop()
        handler.removeCallbacks(statusTick)
        super.onPause()
    }

    /** Ergebnis der Bildauswahl (eigenes Hintergrundbild für Broken Screen). */
    @Deprecated("Bildauswahl ohne AndroidX")
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (glitchUi?.onActivityResult(requestCode, resultCode, data) != true) super.onActivityResult(requestCode, resultCode, data)
    }

    /** Vorschau und Einstellungen für den gewählten Hintergrund aufbauen. */
    private fun build() {
        preview?.let { root.removeView(it) }
        pegelView?.audio?.stop()
        glitchUi?.cancelTap()
        glitchView = null
        glitchUi = null
        pegelView = null
        val v: View = if (tab == 0) {
            GlitchView(this).also {
                glitchView = it
                it.onHold = { on -> peek.hold(on) }
            }
        } else {
            PegelView(this).also {
                PegelPrefs.applyTo(this, it.renderer)
                it.source = PegelPrefs.source(this)
                pegelView = it
            }
        }
        // Antippen: beim Wählen der Aufschlagstelle zählt das Antippen dafür, sonst Einstellungen ein/aus
        v.setOnClickListener {
            if (glitchUi?.handleTap() != true) showPanel(sheet.visibility != View.VISIBLE)
        }
        root.addView(v, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        preview = v

        panel.removeAllViews()
        statusView = null
        addTabs()
        if (tab == 0) buildGlitch() else buildPegel()
        sheet.scrollTo(0, 0)
        if (tab == 1) {
            startPegelAudio()
            maybeAskMic()
            pegelView?.renderer?.wake()
        }
    }

    private fun addTabs() {
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val names = listOf(getString(R.string.wp_glitch_name), getString(R.string.wp_pegel_name))
        names.forEachIndexed { i, name ->
            val b = ui.makeButton(name, i == tab) {
                if (tab != i) {
                    tab = i
                    appPrefs().edit().putInt("tab", i).apply()
                    build()
                }
            }
            row.addView(b, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dpi(8)
            })
        }
        // Sprache: kleiner Knopf mit Weltkugel
        val lang = ui.makeButton("\uD83C\uDF10", false) { Lang.choose(this) }
        row.addView(lang, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        panel.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dpi(12)
        })
    }

    // ---------- Broken Screen (gemeinsam mit der eigenen App) ----------
    private fun buildGlitch() {
        val gv = glitchView ?: return
        val gs = GlitchSettings(this, ui, gv, hint, { showPanel(it) }, { openPicker(GlitchWallpaperService::class.java) })
        glitchUi = gs
        gs.build(getString(R.string.wp_glitch_name), langRow = false)
    }

    // ---------- Pegelanzeige ----------
    private fun buildPegel() {
        ui.addTitle(getString(R.string.wp_pegel_name), getString(R.string.hint_tap))
        val p = PegelPrefs.prefs(this)
        val reapply = { pegelView?.let { PegelPrefs.applyTo(this, it.renderer) }; Unit }
        statusView = TextView(this).apply {
            setTextColor(fg)
            textSize = 13f
            setPadding(dpi(12), dpi(10), dpi(12), dpi(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(10f)
                setColor(Color.argb(18, 255, 255, 255))
            }
            setOnClickListener { if (!hasMic()) askMic() }
        }
        panel.addView(statusView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dpi(4)
        })
        ui.addChoice(getString(R.string.p_source), p, PegelPrefs.SOURCE, 0,
            listOf(getString(R.string.p_src_music), getString(R.string.p_src_mic), getString(R.string.p_src_demo))) { src ->
            if (src < 2 && !hasMic()) askMic()
            startPegelAudio()
            updateStatus()
        }
        ui.addChoice(getString(R.string.p_style), p, PegelPrefs.STYLE, 0,
            listOf(getString(R.string.p_bars), getString(R.string.p_mirror_style))) { reapply() }
        ui.addChoice(getString(R.string.p_color), p, PegelPrefs.COLOR, 0,
            listOf(getString(R.string.p_col_classic), getString(R.string.p_col_cyan), getString(R.string.p_col_pink),
                getString(R.string.p_col_amber), getString(R.string.p_col_rainbow))) { reapply() }
        ui.addSlider(getString(R.string.p_gain), p, PegelPrefs.GAIN, 6, 1, 10, 1, { it.toString() }, reapply)
        ui.addSlider(getString(R.string.p_bands), p, PegelPrefs.BANDS, 16, 8, 32, 4, { it.toString() }, reapply)
        ui.addSlider(getString(R.string.p_after), p, PegelPrefs.AFTER, 5, 0, 10, 1, ui::level, reapply)
        ui.addChoice(getString(R.string.p_peaks), p, PegelPrefs.PEAKS, 0, listOf(getString(CoreR.string.on), getString(CoreR.string.off))) { reapply() }
        ui.addChoice(getString(R.string.p_reflect), p, PegelPrefs.MIRROR, 0, listOf(getString(CoreR.string.on), getString(CoreR.string.off))) { reapply() }
        ui.addChoice(getString(R.string.p_pos), p, PegelPrefs.POS, 1, listOf(getString(R.string.p_mid), getString(R.string.p_bottom))) { reapply() }
        GlitchSettings.addClockSection(this, ui, ClockPrefs.ON_PEGEL, false, false, reapply)
        ui.addButtonRow(
            getString(R.string.b_test) to { pegelView?.renderer?.wake(); Unit },
            getString(R.string.b_drop) to { pegelView?.renderer?.bassDrop(); Unit },
            getString(CoreR.string.b_fullscreen) to { showPanel(false) }
        )
        ui.addPrimaryButton(getString(CoreR.string.b_set)) { setAsWallpaper() }
        updateStatus()
    }

    private fun hasMic() = checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun askMic() {
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_MIC)
    }

    private fun maybeAskMic() {
        if (!askedOnce && PegelPrefs.source(this) < 2 && !hasMic()) {
            askedOnce = true
            askMic()
        }
    }

    private fun startPegelAudio() {
        val v = pegelView ?: return
        v.source = PegelPrefs.source(this)
        v.audio.start(v.source)
    }

    private fun updateStatus() {
        val sv = statusView ?: return
        val v = pegelView ?: return
        val src = v.source
        sv.text = getString(
            when {
                src >= 2 -> R.string.st_demo
                v.audio.status == PegelAudio.Status.OK -> if (src == 0) R.string.st_music else R.string.st_mic
                v.audio.status == PegelAudio.Status.NO_PERMISSION -> R.string.st_perm
                v.audio.status == PegelAudio.Status.FAILED -> if (src == 0) R.string.st_fail_music else R.string.st_fail_mic
                else -> R.string.st_wait
            }
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_MIC) return
        startPegelAudio()
        updateStatus()
        if (pendingSet) {
            pendingSet = false
            openPicker(PegelWallpaperService::class.java)
        }
    }

    /** Einstellungen zeigen, oder ausblenden und Status-/Navigationsleiste verstecken (Vollbild). */
    private fun showPanel(show: Boolean) {
        peek.reset()
        sheet.visibility = if (show) View.VISIBLE else View.GONE
        setFullscreen(!show)
    }

    @Suppress("DEPRECATION")
    private fun setFullscreen(on: Boolean) {
        if (Build.VERSION.SDK_INT >= 30) {
            val c = window.insetsController ?: return
            if (on) {
                c.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                c.hide(WindowInsets.Type.systemBars())
            } else {
                c.show(WindowInsets.Type.systemBars())
            }
        } else {
            val layout = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            window.decorView.systemUiVisibility = if (on) {
                layout or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            } else layout
        }
    }

    private fun setAsWallpaper() {
        if (tab == 1 && PegelPrefs.source(this) < 2 && !hasMic()) {
            pendingSet = true
            askMic()
            return
        }
        openPicker(if (tab == 0) GlitchWallpaperService::class.java else PegelWallpaperService::class.java)
    }

    private fun openPicker(cls: Class<*>) {
        val component = ComponentName(this, cls)
        val direct = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
            .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
        try {
            startActivity(direct)
        } catch (e: Exception) {
            try {
                startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER))
            } catch (e2: Exception) {
                Toast.makeText(this, CoreR.string.err_picker_any, Toast.LENGTH_LONG).show()
            }
        }
    }

    private companion object {
        const val REQ_MIC = 41
    }
}
