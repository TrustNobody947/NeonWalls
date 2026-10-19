package io.github.trustnobody947.neonwalls.glitch

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.graphics.Canvas
import android.os.BatteryManager
import android.os.Build
import android.service.wallpaper.WallpaperService
import android.view.Choreographer
import android.view.MotionEvent
import android.view.SurfaceHolder
import io.github.trustnobody947.neonwalls.uhr.Clock3D
import io.github.trustnobody947.neonwalls.uhr.ClockPrefs
import io.github.trustnobody947.neonwalls.uhr.TiltSensor

/**
 * Der eigentliche Live-Hintergrund „Broken Screen“ (in Neon Walls und in der eigenen App).
 * Zeichnet nur, solange er sichtbar ist, höchstens 60 Bilder pro Sekunde (spart Akku).
 * Neigungssensor (3D-Uhr) und Akkustand laufen nur, solange sie gebraucht werden und der Hintergrund zu sehen ist.
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
        private val tilt = TiltSensor(ctx) { x, y -> renderer.setTilt(x, y) }
        private var running = false
        private var last = 0L
        private var lastDraw = 0L
        private var lastLockCheck = 0L
        private var lastAutoCheck = 0L
        private var useHw = true
        private var mode = ClockPrefs.MODE_OFF
        private var battOn = false

        // Bildschirm an, aus oder entsperrt
        private val screen = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    Intent.ACTION_SCREEN_ON -> {
                        // neues Aussehen beim Einschalten; „Mehr Streifen mit der Zeit“ läuft dabei weiter
                        if (!isPreview && prefs.getBoolean(GlitchPrefs.RANDOM_ON_WAKE, false)) GlitchPrefs.newPattern(ctx, false)
                    }
                }
                updateClockShown()
            }
        }

        // Akkustand für „Mehr Streifen bei sinkendem Akku“
        private val battery = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                readBattery(intent)
            }
        }

        private fun readBattery(intent: Intent?) {
            if (intent == null) return
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
            if (level >= 0 && scale > 0) renderer.battery = (level.toFloat() / scale).coerceIn(0f, 1f)
        }

        private fun register(r: BroadcastReceiver, filter: IntentFilter): Intent? =
            if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(r, filter, Context.RECEIVER_NOT_EXPORTED)
            else ctx.registerReceiver(r, filter)

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            // Finger auf dem Glas: die Streifen darunter glitchen
            setTouchEventsEnabled(true)
            renderer.metal = Clock3D.create()
            GlitchPrefs.applyTo(ctx, renderer)
            mode = ClockPrefs.mode(clockPrefs, ClockPrefs.ON_GLITCH)
            // Risse wechseln mit großen Glitch-Ausbrüchen (nur der echte Hintergrund, nicht die Vorschau der Auswahl)
            renderer.onBigBurst = {
                if (!isPreview && prefs.getInt(GlitchPrefs.AUTO, 0) == 1) GlitchPrefs.newCracks(ctx)
            }
            // „Mehr Streifen mit der Zeit“ ist durch: neues Muster, wieder mit wenigen Streifen
            renderer.onGrowRestart = {
                GlitchPrefs.restartGrowth(ctx)
                GlitchPrefs.applyTo(ctx, renderer)
            }
            // „Mehr Risse mit der Zeit“ ist durch: neue Risse, wieder mit wenigen
            renderer.onCrackRestart = {
                GlitchPrefs.restartCrackGrowth(ctx)
                GlitchPrefs.applyTo(ctx, renderer)
            }
            prefs.registerOnSharedPreferenceChangeListener(this)
            clockPrefs.registerOnSharedPreferenceChangeListener(this)
            val filter = IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_USER_PRESENT)
            }
            register(screen, filter)
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
            mode = ClockPrefs.mode(clockPrefs, ClockPrefs.ON_GLITCH)
            updateClockShown()
        }

        /** Uhr nur auf dem Start- oder nur auf dem Sperrbildschirm: am Sperrbildschirm erkennen, wo wir gerade sind. */
        private fun updateClockShown() {
            val locked = try {
                keyguard?.isKeyguardLocked ?: false
            } catch (e: Exception) {
                false
            }
            // In der Vorschau der Hintergrund-Auswahl ist die Uhr zu sehen, wenn sie irgendwo erscheinen soll
            renderer.clockShown = if (isPreview) mode != ClockPrefs.MODE_OFF else ClockPrefs.shown(mode, locked)
            updateSensors()
        }

        /** Neigungssensor und Akkustand nur, wenn der Hintergrund zu sehen ist und sie gebraucht werden. */
        private fun updateSensors() {
            val vis = running
            val wantTilt = vis && renderer.clock != null && renderer.clockShown && renderer.d3 > 0 && renderer.metal != null
            if (wantTilt) tilt.start() else tilt.stop()
            val wantBatt = vis && prefs.getInt(GlitchPrefs.GROW_BATT, 0) == 1
            if (wantBatt && !battOn) {
                battOn = true
                try {
                    // Der Akkustand kommt sofort beim Anmelden und danach bei jeder Änderung
                    readBattery(register(battery, IntentFilter(Intent.ACTION_BATTERY_CHANGED)))
                } catch (e: Exception) {
                    battOn = false
                }
            } else if (!wantBatt && battOn) {
                battOn = false
                try {
                    ctx.unregisterReceiver(battery)
                } catch (e: Exception) {
                }
            }
        }

        private fun checkAuto() {
            if (!isPreview && GlitchPrefs.autoDue(prefs)) GlitchPrefs.newCracks(ctx)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            if (visible) {
                checkAuto()
                if (!isPreview) renderer.wake()
                start()
                updateClockShown()
            } else {
                stop()
                renderer.touchEnd()
            }
        }

        override fun onTouchEvent(event: MotionEvent) {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN, MotionEvent.ACTION_MOVE -> {
                    for (i in 0 until event.pointerCount) renderer.touch(event.getPointerId(i), event.getX(i), event.getY(i), false)
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                    val i = event.actionIndex
                    renderer.touch(event.getPointerId(i), event.getX(i), event.getY(i), true)
                }
                MotionEvent.ACTION_CANCEL -> renderer.touchEnd()
            }
            super.onTouchEvent(event)
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
            updateSensors()
        }

        private fun stop() {
            running = false
            Choreographer.getInstance().removeFrameCallback(this)
            updateSensors()
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
                if (ClockPrefs.needsLockCheck(mode)) updateClockShown()
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
