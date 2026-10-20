package io.github.trustnobody947.neonwalls.ui

import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.CompoundButton
import android.widget.EditText
import android.widget.SeekBar
import kotlin.math.abs

/**
 * Finger gedrückt halten (ohne zu schieben) blendet die Einstellungen aus, solange er liegt – man sieht das ganze Bild.
 * Beim Loslassen kommen sie zurück. Wirkt auf freien Stellen der Einstellungen (nicht auf Knöpfen, Reglern, Schaltern)
 * und, über [hold], auf der Vorschau.
 *
 * Einbinden: im Behälter der Einstellungen dispatchTouchEvent überschreiben und [dispatch] aufrufen.
 */
class HoldPeek(private val sheet: View) {
    private val handler = Handler(Looper.getMainLooper())
    private val slop = ViewConfiguration.get(sheet.context).scaledTouchSlop
    private var downX = 0f
    private var downY = 0f
    private var armed = false
    private var cancelSent = false

    /** Gerade ausgeblendet, weil ein Finger liegt */
    var peeking = false
        private set

    private val begin = Runnable { if (armed) hold(true) }

    /** Einstellungen ausblenden (true) oder wieder zeigen (false), z. B. für langes Drücken auf der Vorschau. */
    fun hold(on: Boolean) {
        if (on) {
            if (peeking || sheet.visibility != View.VISIBLE) return
            peeking = true
            cancelSent = false
            sheet.animate().cancel()
            sheet.animate().alpha(0f).setDuration(120L).start()
        } else {
            if (!peeking) return
            peeking = false
            sheet.animate().cancel()
            sheet.animate().alpha(1f).setDuration(120L).start()
        }
    }

    /** Alles zurück (Einstellungen sichtbar), z. B. wenn sie per Knopf oder Antippen ein- oder ausgeblendet werden. */
    fun reset() {
        disarm()
        peeking = false
        sheet.animate().cancel()
        sheet.alpha = 1f
    }

    /**
     * Aus dispatchTouchEvent des Behälters der Einstellungen; sup ist das normale dispatchTouchEvent. Solange die
     * Einstellungen ausgeblendet sind, bekommen sie selbst nichts (kein Scrollen, kein Klick beim Loslassen).
     */
    fun dispatch(container: ViewGroup, ev: MotionEvent, sup: (MotionEvent) -> Boolean): Boolean {
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                disarm()
                downX = ev.rawX
                downY = ev.rawY
                armed = !interactiveAt(container, ev.x, ev.y)
                if (armed) handler.postDelayed(begin, HOLD_MS)
            }
            MotionEvent.ACTION_MOVE ->
                if (!peeking && armed && (abs(ev.rawX - downX) > slop || abs(ev.rawY - downY) > slop)) disarm()
            MotionEvent.ACTION_POINTER_DOWN -> if (!peeking) disarm()
        }
        val end = ev.actionMasked == MotionEvent.ACTION_UP || ev.actionMasked == MotionEvent.ACTION_CANCEL
        if (peeking) {
            // die Einstellungen einmal sauber abbrechen (Scrollen, gedrückter Zustand), danach nichts mehr an sie
            if (!cancelSent) {
                cancelSent = true
                val c = MotionEvent.obtain(ev)
                c.action = MotionEvent.ACTION_CANCEL
                sup(c)
                c.recycle()
            }
            if (end) {
                disarm()
                hold(false)
            }
            return true
        }
        if (end) disarm()
        return sup(ev)
    }

    private fun disarm() {
        armed = false
        handler.removeCallbacks(begin)
    }

    /** Liegt an der Stelle (Koordinaten in v) etwas zum Bedienen? */
    private fun interactiveAt(v: View, x: Float, y: Float): Boolean {
        if (v !== sheet && (v.isClickable || v.isLongClickable || v is SeekBar || v is CompoundButton || v is EditText)) return true
        if (v is ViewGroup) {
            for (i in v.childCount - 1 downTo 0) {
                val c = v.getChildAt(i)
                if (c.visibility != View.VISIBLE) continue
                val cx = x + v.scrollX - c.left
                val cy = y + v.scrollY - c.top
                if (cx >= 0f && cy >= 0f && cx < c.width && cy < c.height) return interactiveAt(c, cx, cy)
            }
        }
        return false
    }

    companion object {
        /** So lange muss der Finger liegen (ms) */
        const val HOLD_MS = 400L
    }
}
