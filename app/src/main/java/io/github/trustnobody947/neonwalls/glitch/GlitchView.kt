package io.github.trustnobody947.neonwalls.glitch

import android.content.Context
import android.graphics.Canvas
import android.view.View

/** Live-Vorschau in der App. */
class GlitchView(ctx: Context) : View(ctx) {
    val renderer = GlitchRenderer(resources.displayMetrics.density)
    private var last = 0L

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val now = System.nanoTime()
        val dt = if (last == 0L) 0.016f else (now - last) / 1_000_000_000f
        last = now
        renderer.frame(canvas, dt)
        postInvalidateOnAnimation()
    }
}
