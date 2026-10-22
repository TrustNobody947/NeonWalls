package io.github.trustnobody947.neonwalls.ui

import android.app.Activity
import android.content.SharedPreferences
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
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
 *
 * Freischaltung: Mit [gate] lassen sich Einträge (lock) oder einzelne Möglichkeiten (lockOpts) sperren. Gesperrt zeigen
 * sie den freien Wert, ein Schild („24 h“ oder „Kauf“) bzw. ein Schloss und öffnen beim Antippen die Freischaltung;
 * die eigene Einstellung bleibt gespeichert. Nach einer Änderung der Freischaltung [refreshLocks] aufrufen.
 */
class Sheet(private val act: Activity, val panel: LinearLayout, val accent: Int) {

    val fg = Color.rgb(232, 236, 242)
    val muted = Color.rgb(138, 147, 163)

    /** Freischaltung: welche Stufe gerade frei ist, und Freischalten anbieten. null = alles frei (z. B. Neon Walls). */
    interface Gate {
        fun ok(tier: Int): Boolean
        fun ask(tier: Int)
    }

    var gate: Gate? = null
    private val lockRefresh = ArrayList<() -> Unit>()

    /** Schilder, Schlösser und angezeigte Werte nachziehen (nach einer Änderung der Freischaltung). */
    fun refreshLocks() {
        for (f in lockRefresh) f()
    }

    private fun locked(tier: Int) = tier > 0 && gate?.ok(tier) == false

    /** Schild an gesperrten Einträgen: „24 h“ (Werbevideo oder Kauf) gelb, „Kauf“ rosa. */
    private fun badge(tier: Int): TextView = TextView(act).apply {
        text = act.getString(if (tier >= 2) R.string.lock_buy else R.string.lock_day)
        setTextColor(Color.rgb(17, 17, 17))
        textSize = 10f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        setPadding(dpi(7), dpi(1), dpi(7), dpi(1))
        background = GradientDrawable().apply {
            cornerRadius = dp(99f)
            setColor(if (tier >= 2) Color.rgb(255, 155, 224) else Color.rgb(255, 211, 77))
        }
    }

    /** Kleines Schloss an gesperrten Möglichkeiten (z. B. „2“ und „3“ bei den Aufschlägen). */
    private fun lockIcon(): Drawable = LockIcon(dp(11f)).also { it.setBounds(0, 0, it.intrinsicWidth, it.intrinsicHeight) }

    /** Ein Knopf, der nur freigeschaltet geht (Schloss, halb durchsichtig); die Aktion prüft selbst mit [allowed]. */
    fun lockButton(b: Button, tier: Int) {
        if (tier <= 0) return
        val icon = lockIcon()
        val refresh = {
            val lk = locked(tier)
            b.alpha = if (lk) 0.5f else 1f
            b.setCompoundDrawablesRelative(null, null, if (lk) icon else null, null)
            b.compoundDrawablePadding = dpi(6)
        }
        lockRefresh.add(refresh)
        refresh()
    }

    /** Darf das jetzt? Wenn nicht, die Freischaltung anbieten und false. */
    fun allowed(tier: Int): Boolean {
        if (!locked(tier)) return true
        gate?.ask(tier)
        return false
    }

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

    /** Wie oben; onRelease wird beim Loslassen aufgerufen. */
    fun addFocusSlider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                       fmt: (Int) -> String, onChange: () -> Unit, onRelease: () -> Unit): SeekBar =
        slider(label, prefs, key, def, min, max, step, fmt, onChange, onRelease, true)

    /**
     * Regler, der nur freigeschaltet geht (lock: Stufe, siehe [Gate]); gesperrt zeigt er den Wert free. focus wie bei
     * [addFocusSlider].
     */
    fun addLockedSlider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                        fmt: (Int) -> String, lock: Int, free: Int, focus: Boolean = true, onChange: () -> Unit): SeekBar =
        slider(label, prefs, key, def, min, max, step, fmt, onChange, null, focus, lock, free)

    private fun slider(label: String, prefs: SharedPreferences, key: String, def: Int, min: Int, max: Int, step: Int,
                       fmt: (Int) -> String, onChange: () -> Unit, onRelease: (() -> Unit)?, focus: Boolean = false,
                       lock: Int = 0, free: Int = def): SeekBar {
        val value = prefs.getInt(key, def).coerceIn(min, max)
        val head = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val name = TextView(act).apply { text = label; setTextColor(muted); textSize = 14f }
        val out = TextView(act).apply {
            text = fmt(value); setTextColor(fg); textSize = 13f; typeface = Typeface.MONOSPACE
            gravity = Gravity.END
        }
        head.addView(name, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        val tag = if (lock > 0) badge(lock) else null
        if (tag != null) head.addView(tag, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            marginStart = dpi(6); marginEnd = dpi(8)
        })
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
        // beim Umstellen von außen (Freischaltung) nichts speichern
        var quiet = false
        val bar = SeekBar(act).apply {
            this.max = (max - min) / step
            progress = (value - min) / step
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) {
                    if (quiet) return
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
        if (tag != null) {
            // gesperrt: der Regler nimmt nichts an, Antippen bietet die Freischaltung an
            bar.setOnTouchListener { _, ev ->
                if (!locked(lock)) false
                else {
                    if (ev.actionMasked == MotionEvent.ACTION_UP) gate?.ask(lock)
                    true
                }
            }
            head.setOnClickListener { if (locked(lock)) gate?.ask(lock) }
            val refresh = {
                val lk = locked(lock)
                tag.visibility = if (lk) View.VISIBLE else View.GONE
                bar.alpha = if (lk) 0.35f else 1f
                val v = if (lk) free.coerceIn(min, max) else prefs.getInt(key, def).coerceIn(min, max)
                quiet = true
                bar.progress = (v - min) / step
                quiet = false
                out.text = fmt(v)
            }
            lockRefresh.add(refresh)
            refresh()
        }
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
     * umstellt. Freischaltung: lock sperrt die ganze Auswahl, lockOpts einzelne Möglichkeiten (Stufe je Möglichkeit);
     * gesperrt gilt die Möglichkeit free.
     */
    fun addChoice(label: String, prefs: SharedPreferences, key: String, def: Int, options: List<String>,
                  perRow: Int = 3, lock: Int = 0, lockOpts: IntArray? = null, free: Int = def,
                  onChange: (Int) -> Unit): (Int) -> Unit {
        val title = TextView(act).apply { text = label; setTextColor(muted); textSize = 14f }
        val tag = if (lock > 0) badge(lock) else null
        if (tag == null) panel.addView(title, full(dpi(10)))
        else {
            val head = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
            head.addView(title, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            head.addView(tag, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginStart = dpi(8) })
            head.setOnClickListener { if (locked(lock)) gate?.ask(lock) }
            panel.addView(head, full(dpi(10)))
        }
        fun tierOf(i: Int) = if (lock > 0) lock else lockOpts?.getOrNull(i) ?: 0
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
                    if (!allowed(tierOf(idx))) return@setOnClickListener
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
        if (lock > 0 || lockOpts != null) {
            // gesperrt: die freie Möglichkeit ist gewählt, gesperrte Möglichkeiten halb durchsichtig mit Schloss
            val icon = lockIcon()
            val refresh = {
                val all = lock > 0 && locked(lock)
                tag?.visibility = if (all) View.VISIBLE else View.GONE
                val c = prefs.getInt(key, def)
                val eff = if (locked(tierOf(c))) free else c
                buttons.forEachIndexed { k, x ->
                    styleButton(x, k == eff)
                    val one = lockOpts != null && locked(tierOf(k))
                    x.alpha = if (all || one) 0.5f else 1f
                    x.setCompoundDrawablesRelative(null, null, if (one) icon else null, null)
                    x.compoundDrawablePadding = dpi(4)
                }
            }
            lockRefresh.add(refresh)
            refresh()
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

    /** Schalter; lock: geht nur freigeschaltet (gesperrt aus, mit Schild). */
    fun addSwitch(label: String, prefs: SharedPreferences, key: String, def: Boolean, lock: Int = 0, onChange: () -> Unit): Switch {
        var quiet = false
        val sw = Switch(act).apply {
            text = label
            setTextColor(fg)
            textSize = 14f
            isChecked = prefs.getBoolean(key, def)
            setOnCheckedChangeListener { _, on ->
                if (quiet) return@setOnCheckedChangeListener
                prefs.edit().putBoolean(key, on).apply()
                onChange()
            }
        }
        if (lock <= 0) {
            panel.addView(sw, full(dpi(10)))
            return sw
        }
        val row = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val tag = badge(lock)
        row.addView(tag, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginEnd = dpi(8) })
        row.addView(sw, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        panel.addView(row, full(dpi(10)))
        sw.setOnTouchListener { _, ev ->
            if (!locked(lock)) false
            else {
                if (ev.actionMasked == MotionEvent.ACTION_UP) gate?.ask(lock)
                true
            }
        }
        val refresh = {
            val lk = locked(lock)
            tag.visibility = if (lk) View.VISIBLE else View.GONE
            sw.alpha = if (lk) 0.5f else 1f
            quiet = true
            sw.isChecked = if (lk) false else prefs.getBoolean(key, def)
            quiet = false
        }
        lockRefresh.add(refresh)
        refresh()
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

/** Kleines weißes Schloss (Bügel und Körper), size: Kantenlänge in Pixeln. */
private class LockIcon(private val size: Float) : Drawable() {
    private val body = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.FILL }
    private val bow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.STROKE; strokeWidth = size * 0.13f }
    private val r = RectF()

    override fun draw(canvas: Canvas) {
        val b = bounds
        val x = b.left.toFloat()
        val y = b.top.toFloat()
        val w = b.width().toFloat()
        val h = b.height().toFloat()
        r.set(x + w * 0.3f, y + h * 0.06f, x + w * 0.7f, y + h * 0.56f)
        canvas.drawArc(r, 180f, 180f, false, bow)
        canvas.drawLine(x + w * 0.3f, y + h * 0.31f, x + w * 0.3f, y + h * 0.48f, bow)
        canvas.drawLine(x + w * 0.7f, y + h * 0.31f, x + w * 0.7f, y + h * 0.48f, bow)
        r.set(x + w * 0.16f, y + h * 0.45f, x + w * 0.84f, y + h * 0.97f)
        canvas.drawRoundRect(r, w * 0.12f, w * 0.12f, body)
    }

    override fun setAlpha(alpha: Int) {
        body.alpha = alpha
        bow.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        body.colorFilter = colorFilter
        bow.colorFilter = colorFilter
    }

    @Deprecated("Drawable.getOpacity ist veraltet, wird aber noch abgefragt")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    override fun getIntrinsicWidth(): Int = size.toInt()
    override fun getIntrinsicHeight(): Int = size.toInt()
}
