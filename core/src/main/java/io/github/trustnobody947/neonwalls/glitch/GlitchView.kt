package io.github.trustnobody947.neonwalls.glitch

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.view.MotionEvent
import android.view.View

/** Live-Vorschau in den Einstellungen. Merkt sich die zuletzt angetippte Stelle (für „Aufschlag antippen“). */
class GlitchView(ctx: Context) : View(ctx) {
    val renderer = GlitchRenderer(resources.displayMetrics.density)
    private var last = 0L
    var lastX = 0f
        private set
    var lastY = 0f
        private set

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val now = System.nanoTime()
        val dt = if (last == 0L) 0.016f else (now - last) / 1_000_000_000f
        last = now
        renderer.frame(canvas, dt)
        postInvalidateOnAnimation()
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.actionMasked == MotionEvent.ACTION_DOWN || event.actionMasked == MotionEvent.ACTION_UP) {
            lastX = event.x
            lastY = event.y
        }
        return super.onTouchEvent(event)
    }
}
