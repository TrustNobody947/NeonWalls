package io.github.trustnobody947.neonwalls.glitch

import android.content.SharedPreferences
import android.graphics.Canvas
import android.service.wallpaper.WallpaperService
import android.view.Choreographer
import android.view.SurfaceHolder

/** Der eigentliche Live-Hintergrund. Läuft nur, solange er sichtbar ist (spart Akku). */
class GlitchWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = GlitchEngine()

    inner class GlitchEngine : Engine(), Choreographer.FrameCallback,
        SharedPreferences.OnSharedPreferenceChangeListener {

        private val renderer = GlitchRenderer(resources.displayMetrics.density)
        private val prefs = GlitchPrefs.prefs(this@GlitchWallpaperService)
        private var running = false
        private var last = 0L
        private var useHw = true

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            GlitchPrefs.applyTo(this@GlitchWallpaperService, renderer)
            prefs.registerOnSharedPreferenceChangeListener(this)
        }

        override fun onDestroy() {
            prefs.unregisterOnSharedPreferenceChangeListener(this)
            stop()
            super.onDestroy()
        }

        override fun onSharedPreferenceChanged(p: SharedPreferences?, key: String?) {
            GlitchPrefs.applyTo(this@GlitchWallpaperService, renderer)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            if (visible) start() else stop()
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            if (isVisible) start()
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            stop()
            super.onSurfaceDestroyed(holder)
        }

        private fun start() {
            val ch = Choreographer.getInstance()
            ch.removeFrameCallback(this)
            running = true
            last = 0L
            ch.postFrameCallback(this)
        }

        private fun stop() {
            running = false
            Choreographer.getInstance().removeFrameCallback(this)
        }

        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            val dt = if (last == 0L) 0.016f else (frameTimeNanos - last) / 1_000_000_000f
            last = frameTimeNanos
            val holder = surfaceHolder
            var canvas: Canvas? = null
            try {
                canvas = if (useHw) {
                    try {
                        holder.lockHardwareCanvas()
                    } catch (e: Exception) {
                        useHw = false
                        holder.lockCanvas()
                    }
                } else holder.lockCanvas()
                if (canvas != null) renderer.frame(canvas, dt)
            } catch (e: Exception) {
                // Oberfläche gerade nicht verfügbar, nächstes Bild versuchen
            } finally {
                if (canvas != null) {
                    try {
                        holder.unlockCanvasAndPost(canvas)
                    } catch (e: Exception) {
                    }
                }
            }
            if (running) Choreographer.getInstance().postFrameCallback(this)
        }
    }
}
