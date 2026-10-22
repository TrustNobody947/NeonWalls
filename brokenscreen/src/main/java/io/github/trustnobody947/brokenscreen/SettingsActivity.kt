package io.github.trustnobody947.brokenscreen

import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
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
import android.widget.Toast
import io.github.trustnobody947.neonwalls.glitch.GlitchSettings
import io.github.trustnobody947.neonwalls.glitch.GlitchView
import io.github.trustnobody947.neonwalls.glitch.GlitchWallpaperService
import io.github.trustnobody947.neonwalls.ui.HoldPeek
import io.github.trustnobody947.neonwalls.ui.Lang
import io.github.trustnobody947.neonwalls.ui.Sheet
import io.github.trustnobody947.neonwalls.core.R as CoreR

/**
 * Broken Screen als eigene App: hinten die Live-Vorschau, unten die Einstellungen (gleich wie in Neon Walls).
 * Antippen der Vorschau blendet die Einstellungen ein oder aus; beim Wählen der Aufschlagstelle zählt das Antippen dafür.
 * Finger gedrückt halten (auf der Vorschau oder einer freien Stelle der Einstellungen) blendet sie aus, solange er liegt.
 * Werbung, Datenschutz-Abfrage und Kauf über [BsShop]; die Sprache ist oben umschaltbar ([Lang]).
 */
class SettingsActivity : Activity() {

    private lateinit var root: FrameLayout
    private lateinit var sheet: ScrollView
    private lateinit var panel: LinearLayout
    private lateinit var view: GlitchView
    private lateinit var settings: GlitchSettings
    private lateinit var peek: HoldPeek
    private lateinit var shop: BsShop

    private val accent = Color.rgb(25, 230, 25)

    private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics)
    private fun dpi(v: Int) = dp(v.toFloat()).toInt()

    /** Gewählte Sprache (vor Android 13 stellt die App sie selbst ein). */
    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(Lang.wrap(newBase))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        shop = BsShop(this)
        root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)

        view = GlitchView(this)
        root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        panel = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
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
        val hint = GlitchSettings.makeHint(this, root)

        // Bild auch hinter Status- und Navigationsleiste; unten Platz für die Navigationsleiste lassen
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

        settings = GlitchSettings(this, Sheet(this, panel, accent), view, hint, { showPanel(it) }, { openPicker() }, shop)
        settings.build(getString(R.string.app_name))
        view.setOnClickListener {
            if (!settings.handleTap()) showPanel(sheet.visibility != View.VISIBLE)
        }
        view.onHold = { peek.hold(it) }
        setContentView(root)
        // Kauf prüfen, Datenschutz-Abfrage, Anzeigen laden
        shop.start()
    }

    override fun onStart() {
        super.onStart()
        // App geöffnet oder zurückgekommen: Werbung, wenn die letzte mindestens 10 Minuten her ist
        shop.onStart()
    }

    override fun onResume() {
        super.onResume()
        shop.onResume()
    }

    override fun onPause() {
        // falls ein Finger gerade die Einstellungen ausgeblendet hat: wieder zeigen
        peek.reset()
        shop.onPause()
        super.onPause()
    }

    override fun onStop() {
        shop.onStop()
        super.onStop()
    }

    override fun onDestroy() {
        shop.destroy()
        super.onDestroy()
    }

    /** Ergebnis der Bildauswahl (eigenes Hintergrundbild). */
    @Deprecated("Bildauswahl ohne AndroidX")
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (!settings.onActivityResult(requestCode, resultCode, data)) super.onActivityResult(requestCode, resultCode, data)
    }

    /** Einstellungen zeigen, oder ausblenden und Status-/Navigationsleiste verstecken (Vollbild). */
    private fun showPanel(show: Boolean) {
        peek.reset()
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

    private fun openPicker() {
        // die Rückkehr aus der Hintergrund-Auswahl zählt nicht als erneutes Öffnen der App
        shop.leaving()
        val component = ComponentName(this, GlitchWallpaperService::class.java)
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
}
