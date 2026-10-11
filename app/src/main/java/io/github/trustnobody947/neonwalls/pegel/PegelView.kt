package io.github.trustnobody947.neonwalls.pegel

import android.content.Context
import android.graphics.Canvas
import android.view.View

/** Live-Vorschau der Pegelanzeige in der App, mit eigener Audio-Quelle. */
class PegelView(ctx: Context) : View(ctx) {
    val renderer = PegelRenderer(resources.displayMetrics.density)
    val audio = PegelAudio(ctx.applicationContext)
    var source = 0
    private var last = 0L
    private val empty = FloatArray(0)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val now = System.nanoTime()
        val dt = if (last == 0L) 0.016f else (now - last) / 1_000_000_000f
        last = now
        audio.bandCount = renderer.bandCount
        val levels = if (source < 2 && audio.status == PegelAudio.Status.OK) (audio.bands ?: empty) else null
        renderer.frame(canvas, dt, levels)
        postInvalidateOnAnimation()
    }
}
