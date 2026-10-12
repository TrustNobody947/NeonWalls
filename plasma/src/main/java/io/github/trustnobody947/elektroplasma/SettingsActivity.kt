package io.github.trustnobody947.elektroplasma

import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.opengl.GLSurfaceView
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
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
import javax.microedition.khronos.egl.EGL10
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.egl.EGLDisplay
import javax.microedition.khronos.opengles.GL10
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Einstellungen mit Live-Vorschau: hinten läuft das Plasma, unten liegen die Regler (wie bei Neon Walls).
 * Antippen der Vorschau blendet die Einstellungen ein oder aus, Wischen verformt das Plasma.
 */
class SettingsActivity : Activity() {

    private lateinit var root: FrameLayout
    private lateinit var sheet: ScrollView
    private lateinit var panel: LinearLayout
    private lateinit var glView: GLSurfaceView
    private lateinit var prefs: SharedPreferences
    private lateinit var sensors: PlasmaSensors
    private val renderer = PlasmaRenderer()
    private val handler = Handler(Looper.getMainLooper())

    private val colorButtons = ArrayList<Button>()
    private val layers = ArrayList<LayerSlider>()
    private var modeNote: TextView? = null
    private var errorView: TextView? = null

    // Antippen erkennen (kurz und ohne Wischen)
    private var downX = 0f
    private var downY = 0f
    private var downTime = 0L
    private var moved = false

    private val accent = Color.rgb(90, 140, 255)
    private val fg = Color.rgb(232, 236, 242)
    private val muted = Color.rgb(138, 147, 163)

    private val errorCheck = object : Runnable {
        override fun run() {
            val e = renderer.error
            val v = errorView
            if (e != null && v != null && v.visibility != View.VISIBLE) {
                v.text = getString(R.string.err_gl) + "\n" + e
                v.visibility = View.VISIBLE
            }
            handler.postDelayed(this, 1500)
        }
    }

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)
    private fun dpi(v: Int) = dp(v.toFloat()).roundToInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = PlasmaPrefs.prefs(this)
        sensors = PlasmaSensors(this, renderer)
        renderer.settings = PlasmaPrefs.load(this)

        root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)

        glView = GLSurfaceView(this)
        glView.setEGLContextClientVersion(2)
        glView.setEGLConfigChooser { egl, display -> chooseConfig(egl, display) }
        glView.preserveEGLContextOnPause = true
        glView.setRenderer(object : GLSurfaceView.Renderer {
            private var last = 0L
            override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
                renderer.onSurfaceCreated()
                last = 0L
            }

            override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
                renderer.onSurfaceChanged(width, height)
            }

            override fun onDrawFrame(gl: GL10?) {
                val now = SystemClock.elapsedRealtimeNanos()
                val dt = if (last == 0L) 1f / 60f else ((now - last) / 1e9f).coerceIn(0f, 0.05f)
                last = now
                renderer.drawFrame(dt)
            }
        })
        glView.setOnTouchListener { v, e -> previewTouch(v, e); true }
        root.addView(glView, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

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

        // Plasma auch hinter Status- und Navigationsleiste; unten Platz für die Navigationsleiste lassen
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
        edgeToEdge()

        build()
        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        glView.onResume()
        sensors.start(renderer.settings.mode)
        handler.postDelayed(errorCheck, 1500)
    }

    override fun onPause() {
        handler.removeCallbacks(errorCheck)
        sensors.stop()
        renderer.releaseAll()
        glView.onPause()
        super.onPause()
    }

    /** Neue Einstellungen sofort an die Vorschau geben (der Hintergrund bekommt sie über die gespeicherten Werte). */
    private fun applySettings() {
        renderer.settings = PlasmaPrefs.load(this)
    }

    // ---------- Aufbau ----------

    private fun build() {
        panel.removeAllViews()
        colorButtons.clear()
        layers.clear()

        panel.addView(TextView(this).apply {
            text = getString(R.string.app_name)
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
            setPadding(0, dpi(2), 0, dpi(4))
        })
        errorView = TextView(this).apply {
            setTextColor(Color.rgb(255, 120, 110))
            textSize = 12f
            setPadding(0, dpi(4), 0, dpi(4))
            visibility = View.GONE
            setTextIsSelectable(true)
        }
        panel.addView(errorView)

        addColorGrid()
        addLayer(getString(R.string.s_core), PlasmaPrefs.K1, 0)
        addLayer(getString(R.string.s_rim), PlasmaPrefs.K2, 1)
        addLayer(getString(R.string.s_fog), PlasmaPrefs.K3, 2)

        addChoice(getString(R.string.s_mode), PlasmaPrefs.MODE, 0, listOf(
            getString(R.string.m_fixed), getString(R.string.m_random), getString(R.string.m_cycle),
            getString(R.string.m_battery), getString(R.string.m_tilt), getString(R.string.m_compass))) {
            applySettings()
            sensors.start(renderer.settings.mode)
            updateModeNote()
        }
        modeNote = TextView(this).apply {
            setTextColor(muted)
            textSize = 12f
            setPadding(0, dpi(6), 0, 0)
        }
        panel.addView(modeNote)
        updateModeNote()

        val d = PlasmaSettings()
        addSlider(getString(R.string.s_speed), PlasmaPrefs.SPEED, d.speed, 0, 100) { it.toString() }
        val levels = listOf(R.string.cx_1, R.string.cx_2, R.string.cx_3, R.string.cx_4, R.string.cx_5)
        addSlider(getString(R.string.s_complexity), PlasmaPrefs.COMPLEXITY, d.complexity, 1, 5) { getString(levels[it - 1]) }
        addSlider(getString(R.string.s_glow), PlasmaPrefs.GLOW, d.glow, 1, 10) { it.toString() }
        addChoice(getString(R.string.s_sym), PlasmaPrefs.SYM, d.sym, listOf(
            getString(R.string.sym_0), getString(R.string.sym_1), getString(R.string.sym_2))) { applySettings() }
        addSwitch(getString(R.string.s_touch), PlasmaPrefs.TOUCH, d.touch)
        addSwitch(getString(R.string.s_move), PlasmaPrefs.MOVE, d.move)

        addButtonRow(
            getString(R.string.b_new) to { renderer.newPattern() },
            getString(R.string.b_ring) to { renderer.demoTouch() },
            getString(R.string.b_fullscreen) to { showPanel(false) }
        )
        panel.addView(makeButton(getString(R.string.b_set), true) { openPicker() },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dpi(10)
            })
    }

    // ---------- Farbe: Voreinstellungen und drei Regler ----------

    private fun currentLayers(): FloatArray {
        val d = PlasmaSettings()
        return floatArrayOf(prefs.getFloat(PlasmaPrefs.K1, d.k1), prefs.getFloat(PlasmaPrefs.K2, d.k2), prefs.getFloat(PlasmaPrefs.K3, d.k3))
    }

    private fun addColorGrid() {
        addLabel(getString(R.string.s_color))
        val names = listOf(R.string.c_blue, R.string.c_green, R.string.c_purple, R.string.c_red, R.string.c_fire,
            R.string.c_yellow, R.string.c_white, R.string.c_custom).map { getString(it) }
        names.chunked(3).forEachIndexed { r, chunk ->
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            chunk.forEachIndexed { j, label ->
                val idx = r * 3 + j
                val b = Button(this).apply {
                    text = label
                    isAllCaps = false
                    textSize = 13f
                    maxLines = 1
                    setPadding(dpi(4), dpi(9), dpi(4), dpi(13))
                    setOnClickListener { pickColor(idx) }
                }
                colorButtons.add(b)
                row.addView(b, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                    if (j < chunk.size - 1) marginEnd = dpi(6)
                })
            }
            for (k in chunk.size until 3) row.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f).apply { marginStart = dpi(6) })
            panel.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dpi(6)
            })
        }
        styleColorButtons()
    }

    /** Knöpfe der Farben: unten ein Streifen im Querschnitt einer Plasma-Linie (Nebel – Rand – Mitte – Rand – Nebel). */
    private fun styleColorButtons() {
        val cur = prefs.getInt(PlasmaPrefs.COLOR, 0)
        val custom = currentLayers()
        colorButtons.forEachIndexed { i, b ->
            val k = if (i < PlasmaColors.CUSTOM) PlasmaColors.PRESETS[i] else custom
            val rim = PlasmaColors.argb(PlasmaColors.spec(k[1]))
            val selected = i == cur
            val base = GradientDrawable().apply {
                cornerRadius = dp(12f)
                if (selected) {
                    setColor(Color.argb(70, Color.red(rim), Color.green(rim), Color.blue(rim)))
                    setStroke(dpi(2), rim)
                } else {
                    setColor(Color.argb(20, 255, 255, 255))
                    setStroke(dpi(1), Color.argb(40, 255, 255, 255))
                }
            }
            val bar = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(
                PlasmaColors.argb(PlasmaColors.spec(k[2])), rim, PlasmaColors.argb(PlasmaColors.spec(k[0])),
                rim, PlasmaColors.argb(PlasmaColors.spec(k[2])))).apply { cornerRadius = dp(2f) }
            val ld = LayerDrawable(arrayOf<Drawable>(base, bar))
            ld.setLayerGravity(1, Gravity.BOTTOM or Gravity.FILL_HORIZONTAL)
            ld.setLayerHeight(1, dpi(3))
            ld.setLayerInset(1, dpi(14), 0, dpi(14), dpi(6))
            b.background = ld
            b.setTextColor(if (selected) Color.WHITE else fg)
            b.typeface = if (selected) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }
    }

    private fun pickColor(idx: Int) {
        val e = prefs.edit().putInt(PlasmaPrefs.COLOR, idx)
        if (idx < PlasmaColors.CUSTOM) {
            // Voreinstellung: die Regler springen auf ihre Farben
            val k = PlasmaColors.PRESETS[idx]
            e.putFloat(PlasmaPrefs.K1, k[0]).putFloat(PlasmaPrefs.K2, k[1]).putFloat(PlasmaPrefs.K3, k[2])
            layers.forEachIndexed { i, s -> s.set(k[i]) }
        }
        e.apply()
        styleColorButtons()
        applySettings()
    }

    /** Ein Regler über das ganze Farbspektrum: ganz links aus, dann Rot … Pink, ganz rechts Weiß. */
    private inner class LayerSlider(val key: String) {
        lateinit var bar: SeekBar
        lateinit var out: TextView
        val thumb = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setSize(dpi(24), dpi(24))
            setStroke(dpi(2), Color.WHITE)
        }

        fun set(v: Float) {
            bar.progress = (v * 2f).roundToInt()
            show(v)
        }

        fun show(v: Float) {
            val c = PlasmaColors.spec(v)
            thumb.setColor(PlasmaColors.argb(c))
            out.text = PlasmaColors.name(v)
            // Name in seiner Farbe, außer wenn sie zu dunkel zum Lesen ist
            val lum = 0.3f * c[0] + 0.59f * c[1] + 0.11f * c[2]
            out.setTextColor(if (lum > 0.35f) PlasmaColors.argb(c) else fg)
            bar.invalidate()
        }
    }

    private fun addLayer(label: String, key: String, i: Int) {
        val s = LayerSlider(key)
        val value = currentLayers()[i].coerceIn(0f, 100f)
        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        head.addView(TextView(this).apply { text = label; setTextColor(muted); textSize = 14f },
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        s.out = TextView(this).apply { textSize = 13f; typeface = Typeface.MONOSPACE; gravity = Gravity.END }
        head.addView(s.out, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        panel.addView(head, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dpi(10)
        })

        // Spur mit dem ganzen Farbspektrum
        val colors = IntArray(41) { PlasmaColors.argb(PlasmaColors.spec(it * 2.5f)) }
        val track = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, colors).apply { cornerRadius = dp(4f) }
        val trackLayer = LayerDrawable(arrayOf<Drawable>(track))
        trackLayer.setLayerGravity(0, Gravity.CENTER_VERTICAL or Gravity.FILL_HORIZONTAL)
        trackLayer.setLayerHeight(0, dpi(8))

        s.bar = SeekBar(this).apply {
            max = 200
            progressDrawable = trackLayer
            thumb = s.thumb
            splitTrack = false
            progressTintList = null
            progressBackgroundTintList = null
            thumbTintList = null
            setPadding(dpi(14), dpi(8), dpi(14), dpi(8))
            progress = (value * 2f).roundToInt()
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar?, p: Int, fromUser: Boolean) {
                    if (!fromUser) return
                    val v = p / 2f
                    s.show(v)
                    val e = prefs.edit().putFloat(key, v)
                    // Regler bewegt: ab jetzt eigene Farbe
                    if (prefs.getInt(PlasmaPrefs.COLOR, 0) != PlasmaColors.CUSTOM) e.putInt(PlasmaPrefs.COLOR, PlasmaColors.CUSTOM)
                    e.apply()
                    styleColorButtons()
                    applySettings()
                }

                override fun onStartTrackingTouch(sb: SeekBar?) {}
                override fun onStopTrackingTouch(sb: SeekBar?) {}
            })
        }
        s.show(value)
        layers.add(s)
        panel.addView(s.bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    // ---------- Farbwechsel ----------

    private fun updateModeNote() {
        val v = modeNote ?: return
        val mode = prefs.getInt(PlasmaPrefs.MODE, 0)
        val res = when {
            mode < 3 -> 0
            !PlasmaSensors.available(this, mode) -> R.string.m_note_nosensor
            mode == 3 -> R.string.m_note_battery
            mode == 4 -> R.string.m_note_tilt
            else -> R.string.m_note_compass
        }
        if (res == 0) {
            v.visibility = View.GONE
        } else {
            v.text = getString(res)
            v.visibility = View.VISIBLE
        }
    }

    // ---------- Vorschau ----------

    private fun previewTouch(v: View, e: MotionEvent) {
        val w = v.width.coerceAtLeast(1).toFloat()
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = e.x
                downY = e.y
                downTime = e.eventTime
                moved = false
                renderer.releaseAll()
                renderer.touch(0, e.getX(0) / w, e.getY(0) / w, e.getPointerId(0))
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                moved = true
                val i = e.actionIndex
                renderer.touch(0, e.getX(i) / w, e.getY(i) / w, e.getPointerId(i))
            }
            MotionEvent.ACTION_MOVE -> {
                val slop = ViewConfiguration.get(this).scaledTouchSlop
                if (abs(e.x - downX) > slop || abs(e.y - downY) > slop) moved = true
                for (i in 0 until e.pointerCount) renderer.touch(1, e.getX(i) / w, e.getY(i) / w, e.getPointerId(i))
            }
            MotionEvent.ACTION_POINTER_UP -> {
                val i = e.actionIndex
                renderer.touch(2, e.getX(i) / w, e.getY(i) / w, e.getPointerId(i))
            }
            MotionEvent.ACTION_UP -> {
                renderer.touch(2, e.getX(0) / w, e.getY(0) / w, e.getPointerId(0))
                // kurz angetippt: Einstellungen ein- oder ausblenden
                if (!moved && e.eventTime - downTime < 350) showPanel(sheet.visibility != View.VISIBLE)
            }
            MotionEvent.ACTION_CANCEL -> renderer.releaseAll()
        }
    }

    /** Farbtiefe 8/8/8, am liebsten ohne Alphakanal und ohne Tiefenpuffer – mit Ausweichlösung statt Absturz. */
    private fun chooseConfig(egl: EGL10, display: EGLDisplay): javax.microedition.khronos.egl.EGLConfig {
        val attribs = intArrayOf(EGL10.EGL_RED_SIZE, 8, EGL10.EGL_GREEN_SIZE, 8, EGL10.EGL_BLUE_SIZE, 8,
            EGL10.EGL_RENDERABLE_TYPE, 4 /* EGL_OPENGL_ES2_BIT */, EGL10.EGL_NONE)
        val num = IntArray(1)
        egl.eglChooseConfig(display, attribs, null, 0, num)
        var n = num[0]
        var list = attribs
        if (n <= 0) {
            list = intArrayOf(EGL10.EGL_RENDERABLE_TYPE, 4, EGL10.EGL_NONE)
            egl.eglChooseConfig(display, list, null, 0, num)
            n = num[0]
        }
        require(n > 0) { "Keine passende Grafik-Einstellung" }
        val configs = arrayOfNulls<javax.microedition.khronos.egl.EGLConfig>(n)
        egl.eglChooseConfig(display, list, configs, n, num)
        val v = IntArray(1)
        fun attr(c: javax.microedition.khronos.egl.EGLConfig, a: Int) = if (egl.eglGetConfigAttrib(display, c, a, v)) v[0] else 99
        var best = configs[0]
        var bestScore = Int.MAX_VALUE
        for (c in configs) {
            if (c == null) continue
            val rgb = abs(attr(c, EGL10.EGL_RED_SIZE) - 8) + abs(attr(c, EGL10.EGL_GREEN_SIZE) - 8) + abs(attr(c, EGL10.EGL_BLUE_SIZE) - 8)
            val score = rgb * 100 + attr(c, EGL10.EGL_ALPHA_SIZE) * 4 + attr(c, EGL10.EGL_DEPTH_SIZE) + attr(c, EGL10.EGL_STENCIL_SIZE)
            if (score < bestScore) {
                bestScore = score
                best = c
            }
        }
        return best!!
    }

    // ---------- Bausteine (wie bei Neon Walls) ----------

    /** Einstellungen zeigen, oder ausblenden und Status-/Navigationsleiste verstecken (Vollbild). */
    private fun showPanel(show: Boolean) {
        sheet.visibility = if (show) View.VISIBLE else View.GONE
        setFullscreen(!show)
    }

    @Suppress("DEPRECATION")
    private fun edgeToEdge() {
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
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

    private fun addLabel(label: String) {
        panel.addView(TextView(this).apply { text = label; setTextColor(muted); textSize = 14f },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dpi(10) })
    }

    private fun addSlider(label: String, key: String, def: Int, min: Int, max: Int, fmt: (Int) -> String) {
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
            topMargin = dpi(10)
        })
        val bar = SeekBar(this).apply {
            this.max = max - min
            progress = value - min
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) {
                    val v = min + p
                    out.text = fmt(v)
                    prefs.edit().putInt(key, v).apply()
                    applySettings()
                }

                override fun onStartTrackingTouch(s: SeekBar?) {}
                override fun onStopTrackingTouch(s: SeekBar?) {}
            })
        }
        panel.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    /** Auswahlknöpfe, höchstens drei pro Zeile. */
    private fun addChoice(label: String, key: String, def: Int, options: List<String>, onChange: (Int) -> Unit) {
        addLabel(label)
        val buttons = ArrayList<Button>()
        val cur = prefs.getInt(key, def)
        options.chunked(3).forEachIndexed { r, chunk ->
            val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            chunk.forEachIndexed { j, o ->
                val idx = r * 3 + j
                val b = makeButton(o, idx == cur) {}
                b.textSize = 13f
                b.maxLines = 1
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
            for (k in chunk.size until minOf(3, options.size)) row.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f).apply { marginStart = dpi(6) })
            panel.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dpi(6)
            })
        }
    }

    private fun addSwitch(label: String, key: String, def: Boolean) {
        val sw = Switch(this).apply {
            text = label
            setTextColor(fg)
            textSize = 14f
            isChecked = prefs.getBoolean(key, def)
            setOnCheckedChangeListener { _, on ->
                prefs.edit().putBoolean(key, on).apply()
                applySettings()
            }
        }
        panel.addView(sw, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dpi(12)
        })
    }

    private fun addButtonRow(vararg items: Pair<String, () -> Unit>) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dpi(14), 0, 0)
        }
        items.forEachIndexed { i, (label, action) ->
            row.addView(makeButton(label, false) { action() }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (i < items.size - 1) marginEnd = dpi(8)
            })
        }
        panel.addView(row)
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

    private fun openPicker() {
        val component = ComponentName(this, PlasmaWallpaperService::class.java)
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
}
