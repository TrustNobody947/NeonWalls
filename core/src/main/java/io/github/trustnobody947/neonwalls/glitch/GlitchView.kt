package io.github.trustnobody947.neonwalls.glitch

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Canvas
import android.os.BatteryManager
import android.os.Build
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import io.github.trustnobody947.neonwalls.uhr.Clock3D
import io.github.trustnobody947.neonwalls.uhr.TiltSensor
import kotlin.math.abs

/**
 * Live-Vorschau in den Einstellungen. Finger auf der Vorschau lassen die Streifen darunter glitchen; kurzes Antippen
 * gilt als Klick (Einstellungen ein/aus bzw. „Aufschlag antippen“, dafür merkt sie sich die angetippte Stelle).
 * Solange sie zu sehen ist, laufen Neigungssensor (3D-Uhr) und Akkustand.
 */
class GlitchView(ctx: Context) : View(ctx) {
    val renderer = GlitchRenderer(resources.displayMetrics.density)
    /** Nach jedem Bild (für Statuszeile und Zeitraffer der Einstellungen). */
    var onFrame: (() -> Unit)? = null
    private var last = 0L
    var lastX = 0f
        private set
    var lastY = 0f
        private set

    private val tilt = TiltSensor(ctx) { x, y -> renderer.setTilt(x, y) }
    private val slop = ViewConfiguration.get(ctx).scaledTouchSlop
    private var downX = 0f
    private var downY = 0f
    private var downT = 0L
    private var moved = false
    private var multi = false
    private var active = false
    private var battOn = false

    private val battery = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            readBattery(intent)
        }
    }

    init {
        renderer.metal = Clock3D.create()
    }

    private fun readBattery(intent: Intent?) {
        if (intent == null) return
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        if (level >= 0 && scale > 0) renderer.battery = (level.toFloat() / scale).coerceIn(0f, 1f)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val now = System.nanoTime()
        val dt = if (last == 0L) 0.016f else (now - last) / 1_000_000_000f
        last = now
        renderer.frame(canvas, dt)
        onFrame?.invoke()
        postInvalidateOnAnimation()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        setActive(windowVisibility == VISIBLE)
    }

    override fun onDetachedFromWindow() {
        setActive(false)
        super.onDetachedFromWindow()
    }

    override fun onWindowVisibilityChanged(visibility: Int) {
        super.onWindowVisibilityChanged(visibility)
        setActive(visibility == VISIBLE && isAttachedToWindow)
    }

    /** Sensoren nur, solange die Vorschau zu sehen ist. */
    private fun setActive(on: Boolean) {
        if (on == active) return
        active = on
        if (on) {
            if (renderer.metal != null) tilt.start()
            try {
                val f = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
                val sticky = if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(battery, f, Context.RECEIVER_NOT_EXPORTED)
                else context.registerReceiver(battery, f)
                battOn = true
                readBattery(sticky)
            } catch (e: Exception) {
                battOn = false
            }
            last = 0L
        } else {
            tilt.stop()
            if (battOn) {
                battOn = false
                try {
                    context.unregisterReceiver(battery)
                } catch (e: Exception) {
                }
            }
            renderer.touchEnd()
        }
    }

    private fun feed(e: MotionEvent) {
        for (i in 0 until e.pointerCount) renderer.touch(e.getPointerId(i), e.getX(i), e.getY(i), false)
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.x
                downY = event.y
                downT = event.eventTime
                moved = false
                multi = false
                lastX = event.x
                lastY = event.y
                feed(event)
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                multi = true
                feed(event)
            }
            MotionEvent.ACTION_MOVE -> {
                if (abs(event.x - downX) > slop || abs(event.y - downY) > slop) moved = true
                feed(event)
            }
            MotionEvent.ACTION_POINTER_UP -> {
                val i = event.actionIndex
                renderer.touch(event.getPointerId(i), event.getX(i), event.getY(i), true)
            }
            MotionEvent.ACTION_UP -> {
                renderer.touch(event.getPointerId(0), event.x, event.y, true)
                lastX = event.x
                lastY = event.y
                // nur kurzes Antippen ist ein Klick; Finger liegen lassen oder wischen zeigt nur den Glitch
                if (!moved && !multi && event.eventTime - downT < 500L) performClick()
            }
            MotionEvent.ACTION_CANCEL -> renderer.touchEnd()
        }
        return true
    }

    override fun performClick(): Boolean = super.performClick()
}
