package io.github.trustnobody947.neonwalls.pegel

import android.app.KeyguardManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Canvas
import android.service.wallpaper.WallpaperService
import android.view.Choreographer
import android.view.SurfaceHolder
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs

/**
 * Pegelanzeige als Live-Hintergrund. Läuft nur, solange er sichtbar ist; nur dann wird auch Musik
 * oder Mikrofon abgehört. Ohne Berechtigung oder wenn das Handy den Ton nicht freigibt, läuft der Demo-Beat.
 */
class PegelWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = PegelEngine()

    inner class PegelEngine : Engine(), Choreographer.FrameCallback,
        SharedPreferences.OnSharedPreferenceChangeListener {

        private val renderer = PegelRenderer(resources.displayMetrics.density)
        private val audio = PegelAudio(applicationContext)
        private val prefs = PegelPrefs.prefs(this@PegelWallpaperService)
        private val clockPrefs = ClockPrefs.prefs(this@PegelWallpaperService)
        private var source = 0
        private var running = false
        private var last = 0L
        private var useHw = true
        private val empty = FloatArray(0)
        private val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager?
        private var where = 0
        private var lastLockCheck = 0L

        /** Uhr nur auf dem Start- oder nur auf dem Sperrbildschirm: am Sperrbildschirm erkennen, wo wir gerade sind. */
        private fun updateClockShown() {
            val locked = try {
                keyguard?.isKeyguardLocked ?: false
            } catch (e: Exception) {
                false
            }
            renderer.clockShown = isPreview || ClockPrefs.shown(where, locked)
        }

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            PegelPrefs.applyTo(this@PegelWallpaperService, renderer)
            source = PegelPrefs.source(this@PegelWallpaperService)
            where = ClockPrefs.where(this@PegelWallpaperService)
            updateClockShown()
            prefs.registerOnSharedPreferenceChangeListener(this)
            clockPrefs.registerOnSharedPreferenceChangeListener(this)
        }

        override fun onDestroy() {
            prefs.unregisterOnSharedPreferenceChangeListener(this)
            clockPrefs.unregisterOnSharedPreferenceChangeListener(this)
            stop()
            audio.stop()
            super.onDestroy()
        }

        override fun onSharedPreferenceChanged(p: SharedPreferences?, key: String?) {
            PegelPrefs.applyTo(this@PegelWallpaperService, renderer)
            where = ClockPrefs.where(this@PegelWallpaperService)
            updateClockShown()
            val s = PegelPrefs.source(this@PegelWallpaperService)
            if (s != source) {
                source = s
                if (running) audio.start(source)
            }
        }

        override fun onVisibilityChanged(visible: Boolean) {
            if (visible) {
                updateClockShown()
                start()
                audio.start(source)
                renderer.wake()
            } else {
                stop()
                audio.stop()
            }
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
            // zweimal pro Sekunde nachsehen, ob der Sperrbildschirm zu sehen ist
            if (where != 0 && frameTimeNanos - lastLockCheck > 500_000_000L) {
                lastLockCheck = frameTimeNanos
                updateClockShown()
            }
            audio.bandCount = renderer.bandCount
            val levels = if (source < 2 && audio.status == PegelAudio.Status.OK) (audio.bands ?: empty) else null
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
                if (canvas != null) renderer.frame(canvas, dt, levels)
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
