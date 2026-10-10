package io.github.trustnobody947.neonwalls

import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import io.github.trustnobody947.neonwalls.glitch.GlitchPrefs
import io.github.trustnobody947.neonwalls.glitch.GlitchView
import io.github.trustnobody947.neonwalls.glitch.GlitchWallpaperService

/**
 * Startbildschirm: Live-Vorschau mit Einstellungen.
 * Antippen der Vorschau blendet die Einstellungen ein oder aus.
 */
class MainActivity : Activity() {

    private lateinit var preview: GlitchView
    private lateinit var panel: LinearLayout

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)
    private fun dpi(v: Int) = dp(v.toFloat()).toInt()

    private val accent = Color.rgb(25, 230, 25)
    private val fg = Color.rgb(232, 236, 242)
    private val muted = Color.rgb(138, 147, 163)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)

        preview = GlitchView(this)
        GlitchPrefs.applyTo(this, preview.renderer)
        preview.setOnClickListener {
            panel.visibility = if (panel.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }
        root.addView(preview, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.argb(230, 12, 14, 18))
                cornerRadii = floatArrayOf(dp(18f), dp(18f), dp(18f), dp(18f), 0f, 0f, 0f, 0f)
            }
        }

        panel.addView(TextView(this).apply {
            text = getString(R.string.wp_glitch_name)
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

        addSlider(getString(R.string.s_calm), GlitchPrefs.CALM, 4, 0, 10, ::level)
        addSlider(getString(R.string.s_burst), GlitchPrefs.BURST, 5, 0, 10, ::level)
        addSlider(getString(R.string.s_count), GlitchPrefs.COUNT, 30, 10, 60) { it.toString() }
        addSlider(getString(R.string.s_shear), GlitchPrefs.SHEAR, 5, 0, 10, ::level)

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dpi(8), 0, 0)
        }
        row.addView(makeButton(getString(R.string.b_new), false) {
            GlitchPrefs.newPattern(this)
            GlitchPrefs.applyTo(this, preview.renderer)
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { marginEnd = dpi(8) })
        row.addView(makeButton(getString(R.string.b_glitch), false) {
            preview.renderer.triggerBurst()
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        panel.addView(row)

        panel.addView(makeButton(getString(R.string.b_set), true) { setAsWallpaper() },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dpi(10)
            })

        root.addView(panel, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM
        ))

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

        setContentView(root)
    }

    private fun level(v: Int): String = when {
        v == 0 -> getString(R.string.l_off)
        v < 4 -> getString(R.string.l_low)
        v < 7 -> getString(R.string.l_mid)
        else -> getString(R.string.l_high)
    }

    private fun addSlider(label: String, key: String, def: Int, min: Int, max: Int, fmt: (Int) -> String) {
        val prefs = GlitchPrefs.prefs(this)
        val value = prefs.getInt(key, def)

        val head = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val name = TextView(this).apply { text = label; setTextColor(muted); textSize = 14f }
        val out = TextView(this).apply {
            text = fmt(value); setTextColor(fg); textSize = 13f; typeface = Typeface.MONOSPACE
            gravity = Gravity.END
        }
        head.addView(name, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        head.addView(out, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        panel.addView(head, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dpi(6)
        })

        val bar = SeekBar(this).apply {
            this.min = min
            this.max = max
            progress = value
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) {
                    out.text = fmt(p)
                    GlitchPrefs.prefs(this@MainActivity).edit().putInt(key, p).apply()
                    GlitchPrefs.applyTo(this@MainActivity, preview.renderer)
                }
                override fun onStartTrackingTouch(s: SeekBar?) {}
                override fun onStopTrackingTouch(s: SeekBar?) {}
            })
        }
        panel.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    private fun makeButton(label: String, primary: Boolean, onClick: () -> Unit): Button =
        Button(this).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            setTextColor(if (primary) Color.BLACK else fg)
            background = GradientDrawable().apply {
                cornerRadius = dp(12f)
                if (primary) setColor(accent) else {
                    setColor(Color.argb(20, 255, 255, 255))
                    setStroke(dpi(1), Color.argb(40, 255, 255, 255))
                }
            }
            setPadding(dpi(12), dpi(12), dpi(12), dpi(12))
            setOnClickListener { onClick() }
        }

    private fun setAsWallpaper() {
        val component = ComponentName(this, GlitchWallpaperService::class.java)
        val direct = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER)
            .putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
        try {
            startActivity(direct)
        } catch (e: Exception) {
            try {
                startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER))
            } catch (e2: Exception) {
                Toast.makeText(this, R.string.err_picker, Toast.LENGTH_LONG).show()
            }
        }
    }
}
