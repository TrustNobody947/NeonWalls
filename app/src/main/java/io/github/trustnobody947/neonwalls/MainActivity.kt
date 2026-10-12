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
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import io.github.trustnobody947.neonwalls.glitch.GlitchPrefs
import io.github.trustnobody947.neonwalls.glitch.GlitchView
import io.github.trustnobody947.neonwalls.glitch.GlitchWallpaperService
import io.github.trustnobody947.neonwalls.pegel.PegelAudio
import io.github.trustnobody947.neonwalls.pegel.PegelPrefs
import io.github.trustnobody947.neonwalls.pegel.PegelView
import io.github.trustnobody947.neonwalls.pegel.PegelWallpaperService
import io.github.trustnobody947.neonwalls.uhr.ClockFace
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs

/**
 * Startbildschirm: oben die Auswahl der Hintergründe, dahinter die Live-Vorschau, unten die Einstellungen.
 * Antippen der Vorschau blendet die Einstellungen ein oder aus (dann echtes Vollbild).
 */
class MainActivity : Activity() {

    private lateinit var root: FrameLayout
    private lateinit var sheet: ScrollView
    private lateinit var panel: LinearLayout
    private var preview: View? = null
    private var glitchView: GlitchView? = null
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
    private val muted = Color.rgb(138, 147, 163)

    private fun appPrefs(): SharedPreferences = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)

        panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        // Einstellungen höchstens zwei Drittel hoch, darüber scrollen
        sheet = object : ScrollView(this) {
            override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                val maxH = (resources.displayMetrics.heightPixels * 0.66f).toInt()
                super.onMeasure(widthMeasureSpec, View.MeasureSpec.makeMeasureSpec(maxH, View.MeasureSpec.AT_MOST))
            }
        }
        sheet.background = GradientDrawable().apply {
            setColor(Color.argb(232, 12, 14, 18))
            cornerRadii = floatArrayOf(dp(18f), dp(18f), dp(18f), dp(18f), 0f, 0f, 0f, 0f)
        }
        sheet.isVerticalScrollBarEnabled = false
        sheet.addView(panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(sheet, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))

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
        pegelView?.audio?.stop()
        handler.removeCallbacks(statusTick)
        super.onPause()
    }

    /** Vorschau und Einstellungen für den gewählten Hintergrund aufbauen. */
    private fun build() {
        preview?.let { root.removeView(it) }
        pegelView?.audio?.stop()
        glitchView = null
        pegelView = null
        val v: View = if (tab == 0) {
            GlitchView(this).also { GlitchPrefs.applyTo(this, it.renderer); glitchView = it }
        } else {
            PegelView(this).also {
                PegelPrefs.applyTo(this, it.renderer)
                it.source = PegelPrefs.source(this)
                pegelView = it
            }
        }
        v.setOnClickListener { showPanel(sheet.visibility != View.VISIBLE) }
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
            val b = makeButton(name, i == tab) {
                if (tab != i) {
                    tab = i
                    appPrefs().edit().putInt("tab", i).apply()
                    build()
                }
            }
            row.addView(b, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (i < names.size - 1) marginEnd = dpi(8)
            })
        }
        panel.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = dpi(12)
        })
    }

    private fun addTitle(name: String) {
        panel.addView(TextView(this).apply {
            text = name
            setTextColor(accent)
            textSize = 13f
            typeface = Typeface.MONOSPACE
            letterSpacing = 0.1f
            isAllCaps = true
        })
        panel.addView(TextView(this).apply {
            text = getString(R.string.hint_tap)
            setTextColor(muted)
            textSize = 12f
            setPadding(0, dpi(2), 0, dpi(8))
        })
    }

    // ---------- Broken Screen ----------
    private fun buildGlitch() {
        addTitle(getString(R.string.wp_glitch_name))
        val p = GlitchPrefs.prefs(this)
        val reapply = { glitchView?.let { GlitchPrefs.applyTo(this, it.renderer) }; Unit }
        addSlider(getString(R.string.s_calm), p, GlitchPrefs.CALM, 4, 0, 10, 1, ::level, reapply)
        addSlider(getString(R.string.s_burst), p, GlitchPrefs.BURST, 5, 0, 10, 1, ::level, reapply)
        addSlider(getString(R.string.s_count), p, GlitchPrefs.COUNT_POS, 59, 0, 100, 1, { GlitchPrefs.countFromPos(it).toString() }, reapply)
        addSlider(getString(R.string.s_shear), p, GlitchPrefs.SHEAR, 5, 0, 10, 1, ::level, reapply)
        addSwitch(getString(R.string.s_random), p, GlitchPrefs.RANDOM_ON_WAKE, reapply)
        addSwitch(getString(R.string.s_mutate), p, GlitchPrefs.MUTATE, reapply)
        addClockSection(ClockPrefs.ON_GLITCH, true, reapply)
        addButtonRow(
            getString(R.string.b_new) to {
                GlitchPrefs.newPattern(this)
                reapply()
            },
            getString(R.string.b_glitch) to { glitchView?.renderer?.triggerBurst(); Unit },
            getString(R.string.b_fullscreen) to { showPanel(false) }
        )
        addSetButton()
    }

    // ---------- Pegelanzeige ----------
    private fun buildPegel() {
        addTitle(getString(R.string.wp_pegel_name))
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
        addChoice(getString(R.string.p_source), p, PegelPrefs.SOURCE, 0,
            listOf(getString(R.string.p_src_music), getString(R.string.p_src_mic), getString(R.string.p_src_demo))) { src ->
            if (src < 2 && !hasMic()) askMic()
            startPegelAudio()
            updateStatus()
        }
        addChoice(getString(R.string.p_style), p, PegelPrefs.STYLE, 0,
            listOf(getString(R.string.p_bars), getString(R.string.p_mirror_style))) { reapply() }
        addChoice(getString(R.string.p_color), p, PegelPrefs.COLOR, 0,
            listOf(getString(R.string.p_col_classic), getString(R.string.p_col_cyan), getString(R.string.p_col_pink),
                getString(R.string.p_col_amber), getString(R.string.p_col_rainbow))) { reapply() }
        addSlider(getString(R.string.p_gain), p, PegelPrefs.GAIN, 6, 1, 10, 1, { it.toString() }, reapply)
        addSlider(getString(R.string.p_bands), p, PegelPrefs.BANDS, 16, 8, 32, 4, { it.toString() }, reapply)
        addSlider(getString(R.string.p_after), p, PegelPrefs.AFTER, 5, 0, 10, 1, ::level, reapply)
        addChoice(getString(R.string.p_peaks), p, PegelPrefs.PEAKS, 0, listOf(getString(R.string.on), getString(R.string.off))) { reapply() }
        addChoice(getString(R.string.p_reflect), p, PegelPrefs.MIRROR, 0, listOf(getString(R.string.on), getString(R.string.off))) { reapply() }
        addChoice(getString(R.string.p_pos), p, PegelPrefs.POS, 1, listOf(getString(R.string.p_mid), getString(R.string.p_bottom))) { reapply() }
        addClockSection(ClockPrefs.ON_PEGEL, false, reapply)
        addButtonRow(
            getString(R.string.b_test) to { pegelView?.renderer?.wake(); Unit },
            getString(R.string.b_drop) to { pegelView?.renderer?.bassDrop(); Unit },
            getString(R.string.b_fullscreen) to { showPanel(false) }
        )
        addSetButton()
        updateStatus()
    }

    // ---------- Uhr (für alle Hintergründe gleich, je Hintergrund ein Schalter) ----------
    private fun addClockSection(onKey: String, withCrack: Boolean, reapply: () -> Unit) {
        val cp = ClockPrefs.prefs(this)
        panel.addView(TextView(this).apply {
            text = getString(R.string.c_title)
            setTextColor(accent)
            textSize = 13f
            typeface = Typeface.MONOSPACE
            letterSpacing = 0.1f
            isAllCaps = true
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dpi(22) })
        panel.addView(TextView(this).apply {
            text = getString(R.string.c_note)
            setTextColor(muted)
            textSize = 12f
            setPadding(0, dpi(2), 0, 0)
        })
        addSwitch(getString(R.string.c_show), cp, onKey, reapply)
        addChoice(getString(R.string.c_finish), cp, ClockPrefs.FINISH, ClockFace.WHITE, listOf(
            getString(R.string.f_chrome), getString(R.string.f_gold), getString(R.string.f_steel),
            getString(R.string.f_rose), getString(R.string.f_black), getString(R.string.f_copper),
            getString(R.string.f_neon), getString(R.string.f_white))) { reapply() }
        addChoice(getString(R.string.c_pos), cp, ClockPrefs.POS, 0,
            listOf(getString(R.string.c_top), getString(R.string.p_mid), getString(R.string.p_bottom))) { reapply() }
        addSlider(getString(R.string.c_size), cp, ClockPrefs.SIZE, 5, 1, 10, 1, { it.toString() }, reapply)
        addChoice(getString(R.string.c_date), cp, ClockPrefs.DATE, 0,
            listOf(getString(R.string.c_date_orig), getString(R.string.c_date_de), getString(R.string.off))) { reapply() }
        if (withCrack) addSlider(getString(R.string.c_crack), cp, ClockPrefs.CRACK, 5, 0, 10, 1, ::level, reapply)
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

    // ---------- Bausteine ----------
    /** Einstellungen zeigen, oder ausblenden und Status-/Navigationsleiste verstecken (Vollbild). */
    private fun showPanel(show: Boolean) {
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

    private fun level(v: Int): String = when {
        v == 0 -> getString(R.string.l_off)
        v < 4 -> getString(R.string.l_low)
        v < 7 -> getString(R.string.l_mid)
        else -> getString(R.string.l_high)
    }

    /** Schieberegler; step > 1 rastet in Schritten ein (z. B. Bänder 8, 12, 16 …). */
    private fun addSlider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                          fmt: (Int) -> String, onChange: () -> Unit) {
        val value = prefs.getInt(key, def).coerceIn(min, max)
        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val name = TextView(this).apply { text = label; setTextColor(muted); textSize = 14f }
        val out = TextView(this).apply {
            text = fmt(value); setTextColor(fg); textSize = 13f; typeface = Typeface.MONOSPACE
            gravity = Gravity.END
        }
        head.addView(name, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        head.addView(out, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        panel.addView(head, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dpi(8)
        })
        val bar = SeekBar(this).apply {
            this.max = (max - min) / step
            progress = (value - min) / step
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) {
                    val v = min + p * step
                    out.text = fmt(v)
                    prefs.edit().putInt(key, v).apply()
                    onChange()
                }
                override fun onStartTrackingTouch(s: SeekBar?) {}
                override fun onStopTrackingTouch(s: SeekBar?) {}
            })
        }
        panel.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    /** Auswahlknöpfe, höchstens drei pro Zeile. */
    private fun addChoice(label: String, prefs: SharedPreferences, key: String, def: Int, options: List<String>, onChange: (Int) -> Unit) {
        panel.addView(TextView(this).apply { text = label; setTextColor(muted); textSize = 14f },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dpi(10) })
        val buttons = ArrayList<Button>()
        val cur = prefs.getInt(key, def)
        options.chunked(3).forEachIndexed { r, chunk ->
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            chunk.forEachIndexed { j, o ->
                val idx = r * 3 + j
                val b = makeButton(o, idx == cur) {}
                b.textSize = 13f
                b.setPadding(dpi(4), dpi(9), dpi(4), dpi(9))
                b.setOnClickListener {
                    prefs.edit().putInt(key, idx).apply()
                    buttons.forEachIndexed { k, x -> styleButton(x, k == idx) }
                    onChange(idx)
                }
                buttons.add(b)
                row.addView(b, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                    if (j < chunk.size - 1) marginEnd = dpi(6)
                })
            }
            // Platzhalter, damit die Knöpfe in kurzen Zeilen gleich breit bleiben
            for (k in chunk.size until minOf(3, options.size)) row.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f).apply { marginStart = dpi(6) })
            panel.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dpi(6)
            })
        }
    }

    private fun addSwitch(label: String, prefs: SharedPreferences, key: String, onChange: () -> Unit) {
        val sw = Switch(this).apply {
            text = label
            setTextColor(fg)
            textSize = 14f
            isChecked = prefs.getBoolean(key, false)
            setOnCheckedChangeListener { _, on ->
                prefs.edit().putBoolean(key, on).apply()
                onChange()
            }
        }
        panel.addView(sw, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dpi(10)
        })
    }

    private fun addButtonRow(vararg items: Pair<String, () -> Unit>) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dpi(12), 0, 0)
        }
        items.forEachIndexed { i, (label, action) ->
            row.addView(makeButton(label, false) { action() }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (i < items.size - 1) marginEnd = dpi(8)
            })
        }
        panel.addView(row)
    }

    private fun addSetButton() {
        panel.addView(makeButton(getString(R.string.b_set), true) { setAsWallpaper() },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dpi(10)
            })
    }

    private fun styleButton(b: Button, primary: Boolean) {
        b.setTextColor(if (primary) Color.BLACK else fg)
        b.background = GradientDrawable().apply {
            cornerRadius = dp(12f)
            if (primary) setColor(accent) else {
                setColor(Color.argb(20, 255, 255, 255))
                setStroke(dpi(1), Color.argb(40, 255, 255, 255))
            }
        }
    }

    private fun makeButton(label: String, primary: Boolean, onClick: () -> Unit): Button =
        Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            styleButton(this, primary)
            setPadding(dpi(10), dpi(12), dpi(10), dpi(12))
            setOnClickListener { onClick() }
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
                Toast.makeText(this, R.string.err_picker_any, Toast.LENGTH_LONG).show()
            }
        }
    }

    private companion object {
        const val REQ_MIC = 41
    }
}
