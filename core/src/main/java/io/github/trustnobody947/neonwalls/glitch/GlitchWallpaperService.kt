package io.github.trustnobody947.neonwalls.glitch

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.graphics.Canvas
import android.os.Build
import android.service.wallpaper.WallpaperService
import android.view.Choreographer
import android.view.SurfaceHolder
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs

/**
 * Der eigentliche Live-Hintergrund „Broken Screen“ (in Neon Walls und in der eigenen App).
 * Zeichnet nur, solange er sichtbar ist, höchstens 60 Bilder pro Sekunde (spart Akku).
 */
class GlitchWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = GlitchEngine()

    inner class GlitchEngine : Engine(), Choreographer.FrameCallback,
        SharedPreferences.OnSharedPreferenceChangeListener {

        private val ctx: Context = this@GlitchWallpaperService
        private val renderer = GlitchRenderer(resources.displayMetrics.density)
        private val prefs = GlitchPrefs.prefs(ctx)
        private val clockPrefs = ClockPrefs.prefs(ctx)
        private val keyguard = ctx.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager?
        private var running = false
        private var last = 0L
        private var lastDraw = 0L
        private var lastLockCheck = 0L
        private var lastAutoCheck = 0L
        private var useHw = true
        private var where = 0

        // Bildschirm an, aus oder entsperrt
        private val screen = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    Intent.ACTION_SCREEN_ON -> {
                        if (!isPreview && prefs.getBoolean(GlitchPrefs.RANDOM_ON_WAKE, false)) GlitchPrefs.newPattern(ctx)
                    }
                }
                updateClockShown()
            }
        }

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            GlitchPrefs.applyTo(ctx, renderer)
            where = ClockPrefs.where(ctx)
            // Risse wechseln mit großen Glitch-Ausbrüchen (nur der echte Hintergrund, nicht die Vorschau der Auswahl)
            renderer.onBigBurst = {
                if (!isPreview && prefs.getInt(GlitchPrefs.AUTO, 0) == 1) GlitchPrefs.newCracks(ctx)
            }
            prefs.registerOnSharedPreferenceChangeListener(this)
            clockPrefs.registerOnSharedPreferenceChangeListener(this)
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_USER_PRESENT)
            }
            if (Build.VERSION.SDK_INT >= 33) {
                ctx.registerReceiver(screen, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                ctx.registerReceiver(screen, filter)
            }
            updateClockShown()
        }

        override fun onDestroy() {
            try {
                ctx.unregisterReceiver(screen)
            } catch (e: Exception) {
            }
            prefs.unregisterOnSharedPreferenceChangeListener(this)
            clockPrefs.unregisterOnSharedPreferenceChangeListener(this)
            stop()
            super.onDestroy()
        }

        override fun onSharedPreferenceChanged(p: SharedPreferences?, key: String?) {
            GlitchPrefs.applyTo(ctx, renderer)
            where = ClockPrefs.where(ctx)
            updateClockShown()
        }

        /** Uhr nur auf dem Start- oder nur auf dem Sperrbildschirm: am Sperrbildschirm erkennen, wo wir gerade sind. */
        private fun updateClockShown() {
            val locked = try {
                keyguard?.isKeyguardLocked ?: false
            } catch (e: Exception) {
                false
            }
            renderer.clockShown = isPreview || ClockPrefs.shown(where, locked)
        }

        private fun checkAuto() {
            if (!isPreview && GlitchPrefs.autoDue(prefs)) GlitchPrefs.newCracks(ctx)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            if (visible) {
                updateClockShown()
                checkAuto()
                if (!isPreview) renderer.wake()
                start()
            } else stop()
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
            lastDraw = 0L
            ch.postFrameCallback(this)
        }

        private fun stop() {
            running = false
            Choreographer.getInstance().removeFrameCallback(this)
        }

        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            // höchstens 60 Bilder pro Sekunde, auch auf 90/120-Hz-Bildschirmen
            if (lastDraw != 0L && frameTimeNanos - lastDraw < 15_000_000L) {
                Choreographer.getInstance().postFrameCallback(this)
                return
            }
            lastDraw = frameTimeNanos
            val dt = if (last == 0L) 0.016f else (frameTimeNanos - last) / 1_000_000_000f
            last = frameTimeNanos
            // zweimal pro Sekunde nachsehen, ob der Sperrbildschirm zu sehen ist; einmal pro Minute die Stunden-Uhr
            if (frameTimeNanos - lastLockCheck > 500_000_000L) {
                lastLockCheck = frameTimeNanos
                if (where != 0) updateClockShown()
            }
            if (frameTimeNanos - lastAutoCheck > 60_000_000_000L) {
                lastAutoCheck = frameTimeNanos
                checkAuto()
            }
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
