package io.github.trustnobody947.neonwalls.ui

import android.app.Activity
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import io.github.trustnobody947.neonwalls.core.R

/**
 * Bausteine für die Einstellungen unten im Bildschirm (Regler, Auswahlknöpfe, Schalter, Knöpfe), gemeinsam für
 * Neon Walls und die einzelnen Apps. Alles wird in [panel] eingefügt und sofort in den Einstellungen gespeichert.
 */
class Sheet(private val act: Activity, val panel: LinearLayout, val accent: Int) {

    val fg = Color.rgb(232, 236, 242)
    val muted = Color.rgb(138, 147, 163)

    fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, act.resources.displayMetrics)
    fun dpi(v: Int) = dp(v.toFloat()).toInt()

    private fun full(top: Int = 0) =
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = top }

    /** Stufen 0..10 als Wort (aus, leicht, mittel, stark). */
    fun level(v: Int): String = act.getString(
        when {
            v == 0 -> R.string.l_off
            v < 4 -> R.string.l_low
            v < 7 -> R.string.l_mid
            else -> R.string.l_high
        }
    )

    /** Überschrift in Akzentfarbe, darunter optional ein Hinweis. */
    fun addTitle(name: String, hint: String?, top: Int = 0) {
        panel.addView(TextView(act).apply {
            text = name
            setTextColor(accent)
            textSize = 13f
            typeface = Typeface.MONOSPACE
            letterSpacing = 0.1f
            isAllCaps = true
        }, full(top))
        if (hint != null) addNote(hint, 2)
    }

    /** Kleiner grauer Hinweistext. */
    fun addNote(text: String, top: Int = 6): TextView {
        val v = TextView(act).apply {
            this.text = text
            setTextColor(muted)
            textSize = 12f
            setPadding(0, dpi(top), 0, dpi(4))
        }
        panel.addView(v)
        return v
    }

    /** Schieberegler; step > 1 rastet in Schritten ein. */
    fun addSlider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                  fmt: (Int) -> String, onChange: () -> Unit): SeekBar =
        slider(label, prefs, key, def, min, max, step, fmt, onChange, null)

    /** Schieberegler wie oben; onRelease wird beim Loslassen aufgerufen (für Änderungen, die nicht laufend gehen). */
    fun addSlider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                  fmt: (Int) -> String, onChange: () -> Unit, onRelease: () -> Unit): SeekBar =
        slider(label, prefs, key, def, min, max, step, fmt, onChange, onRelease)

    /**
     * Schieberegler, bei dem das Menü beim Schieben zurücktritt: Nur dieser Regler bleibt zu sehen, dahinter ist das
     * Bild frei (z. B. Anzahl Streifen und Risse).
     */
    fun addFocusSlider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                       fmt: (Int) -> String, onChange: () -> Unit): SeekBar =
        slider(label, prefs, key, def, min, max, step, fmt, onChange, null, true)

    private fun slider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                       fmt: (Int) -> String, onChange: () -> Unit, onRelease: (() -> Unit)?, focus: Boolean = false): SeekBar {
        val value = prefs.getInt(key, def).coerceIn(min, max)
        val head = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL }
        val name = TextView(act).apply { text = label; setTextColor(muted); textSize = 14f }
        val out = TextView(act).apply {
            text = fmt(value); setTextColor(fg); textSize = 13f; typeface = Typeface.MONOSPACE
            gravity = Gravity.END
        }
        head.addView(name, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        head.addView(out, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        // Regler mit Fokus: Überschrift und Regler in einem eigenen Kasten, der beim Schieben dunkel hinterlegt wird.
        // Innenabstand und negative Ränder heben sich auf, damit nichts verrutscht.
        val box: LinearLayout? = if (focus) LinearLayout(act).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dpi(10), dpi(6), dpi(10), dpi(6))
        } else null
        if (box != null) {
            box.addView(head, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            panel.addView(box, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = dpi(2); bottomMargin = -dpi(6); leftMargin = -dpi(10); rightMargin = -dpi(10)
            })
        } else panel.addView(head, full(dpi(8)))
        val bar = SeekBar(act).apply {
            this.max = (max - min) / step
            progress = (value - min) / step
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) {
                    val v = min + p * step
                    out.text = fmt(v)
                    prefs.edit().putInt(key, v).apply()
                    onChange()
                }

                override fun onStartTrackingTouch(s: SeekBar?) {
                    if (box != null) enterFocus(box)
                }

                override fun onStopTrackingTouch(s: SeekBar?) {
                    if (box != null) exitFocus()
                    onRelease?.invoke()
                }
            })
        }
        if (box != null) box.addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        else panel.addView(bar, full())
        return bar
    }

    // ---------- Menü tritt beim Schieben zurück ----------

    private var focusBox: View? = null
    private val focusHidden = ArrayList<View>()

    /** Schiebt gerade jemand einen Regler mit Fokus (dann sind die anderen Einträge ausgeblendet)? */
    val inFocus: Boolean get() = focusBox != null

    private fun enterFocus(box: View) {
        if (focusBox != null) return
        focusBox = box
        focusHidden.clear()
        for (i in 0 until panel.childCount) {
            val v = panel.getChildAt(i)
            if (v !== box && v.visibility == View.VISIBLE) {
                v.visibility = View.INVISIBLE
                focusHidden.add(v)
            }
        }
        box.background = GradientDrawable().apply {
            cornerRadius = dp(10f)
            setColor(Color.argb(209, 12, 14, 18))
        }
        // der Hintergrund der Einstellungen wird durchsichtig
        (panel.parent as? View)?.background?.alpha = 0
    }

    private fun exitFocus() {
        val box = focusBox ?: return
        focusBox = null
        for (v in focusHidden) if (v.visibility == View.INVISIBLE) v.visibility = View.VISIBLE
        focusHidden.clear()
        box.background = null
        (panel.parent as? View)?.background?.alpha = 255
    }

    /**
     * Auswahlknöpfe, höchstens perRow pro Zeile (Standard drei). Gibt eine Funktion zurück, die die Auswahl von außen
     * umstellt.
     */
    fun addChoice(label: String, prefs: SharedPreferences, key: String, def: Int, options: List<String>,
                  perRow: Int = 3, onChange: (Int) -> Unit): (Int) -> Unit {
        panel.addView(TextView(act).apply { text = label; setTextColor(muted); textSize = 14f }, full(dpi(10)))
        val buttons = ArrayList<Button>()
        val cur = prefs.getInt(key, def)
        val n = perRow.coerceAtLeast(1)
        options.chunked(n).forEachIndexed { r, chunk ->
            val row = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL }
            chunk.forEachIndexed { j, o ->
                val idx = r * n + j
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
            // Platzhalter, damit die Knöpfe in kurzen Zeilen gleich breit bleiben
            for (k in chunk.size until minOf(n, options.size)) {
                row.addView(View(act), LinearLayout.LayoutParams(0, 1, 1f).apply { marginStart = dpi(6) })
            }
            panel.addView(row, full(dpi(6)))
        }
        return { idx -> buttons.forEachIndexed { k, x -> styleButton(x, k == idx) } }
    }

    /** Statuszeile (Text wird von außen gesetzt), anfangs ausgeblendet. */
    fun addInfo(): TextView {
        val v = TextView(act).apply {
            setTextColor(fg)
            textSize = 12f
            typeface = Typeface.MONOSPACE
            setPadding(0, dpi(6), 0, dpi(2))
            visibility = View.GONE
        }
        panel.addView(v, full())
        return v
    }

    fun addSwitch(label: String, prefs: SharedPreferences, key: String, def: Boolean, onChange: () -> Unit): Switch {
        val sw = Switch(act).apply {
            text = label
            setTextColor(fg)
            textSize = 14f
            isChecked = prefs.getBoolean(key, def)
            setOnCheckedChangeListener { _, on ->
                prefs.edit().putBoolean(key, on).apply()
                onChange()
            }
        }
        panel.addView(sw, full(dpi(10)))
        return sw
    }

    fun addButtonRow(vararg items: Pair<String, () -> Unit>): List<Button> {
        val row = LinearLayout(act).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dpi(12), 0, 0)
        }
        val out = ArrayList<Button>()
        items.forEachIndexed { i, (label, action) ->
            val b = makeButton(label, false) { action() }
            out.add(b)
            row.addView(b, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (i < items.size - 1) marginEnd = dpi(8)
            })
        }
        panel.addView(row)
        return out
    }

    fun addPrimaryButton(label: String, onClick: () -> Unit) {
        panel.addView(makeButton(label, true) { onClick() }, full(dpi(10)))
    }

    fun styleButton(b: Button, primary: Boolean) {
        b.setTextColor(if (primary) Color.BLACK else fg)
        b.background = GradientDrawable().apply {
            cornerRadius = dp(12f)
            if (primary) setColor(accent) else {
                setColor(Color.argb(20, 255, 255, 255))
                setStroke(dpi(1), Color.argb(40, 255, 255, 255))
            }
        }
    }

    fun makeButton(label: String, primary: Boolean, onClick: () -> Unit): Button =
        Button(act).apply {
            text = label
            isAllCaps = false
            textSize = 15f
            styleButton(this, primary)
            setPadding(dpi(10), dpi(12), dpi(10), dpi(12))
            setOnClickListener { onClick() }
        }
}
