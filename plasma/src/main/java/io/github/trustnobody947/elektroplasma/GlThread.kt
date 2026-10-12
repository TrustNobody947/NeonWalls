package io.github.trustnobody947.elektroplasma

import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.os.SystemClock
import android.view.SurfaceHolder

/**
 * Eigener Grafik-Thread für den Live-Hintergrund (ein WallpaperService hat kein GLSurfaceView).
 * Richtet OpenGL ES 2.0 auf der Fläche des Hintergrunds ein und zeichnet höchstens 60 Bilder pro Sekunde,
 * solange der Hintergrund sichtbar ist. Unsichtbar wartet der Thread und verbraucht nichts.
 */
class GlThread(private val holder: SurfaceHolder, private val renderer: PlasmaRenderer) : Thread("ElektroPlasma-GL") {

    private val lock = Object()

    // geschützt durch lock
    private var quit = false
    private var paused = true
    private var hasSurface = false
    private var surfaceAlive = false   // EGL-Fläche existiert oder wird gerade angelegt
    private var width = 0
    private var height = 0
    private var sizeChanged = true

    // nur im Grafik-Thread
    private var display: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var context: EGLContext = EGL14.EGL_NO_CONTEXT
    private var surface: EGLSurface = EGL14.EGL_NO_SURFACE
    private var config: EGLConfig? = null
    private var contextFresh = false
    private var failed = false

    // ---------- Aufrufe aus dem Haupt-Thread ----------

    fun onSurfaceCreated() = synchronized(lock) {
        hasSurface = true
        sizeChanged = true
        lock.notifyAll()
    }

    fun onSurfaceChanged(w: Int, h: Int) = synchronized(lock) {
        width = w
        height = h
        sizeChanged = true
        lock.notifyAll()
    }

    /** Wartet, bis die EGL-Fläche wirklich freigegeben ist – erst danach darf Android die Fläche abbauen. */
    fun onSurfaceDestroyed() = synchronized(lock) {
        hasSurface = false
        lock.notifyAll()
        val until = SystemClock.uptimeMillis() + 2000
        while (surfaceAlive && isAlive) {
            val left = until - SystemClock.uptimeMillis()
            if (left <= 0) break
            lock.wait(left)
        }
    }

    fun setPaused(p: Boolean) = synchronized(lock) {
        paused = p
        lock.notifyAll()
    }

    /** Thread beenden und warten, bis alles aufgeräumt ist. */
    fun quitAndWait() {
        synchronized(lock) {
            quit = true
            lock.notifyAll()
        }
        try {
            join(2000)
        } catch (e: InterruptedException) {
        }
    }

    // ---------- Grafik-Thread ----------

    override fun run() {
        try {
            loop()
        } catch (e: InterruptedException) {
        } finally {
            releaseContext()
            synchronized(lock) {
                surfaceAlive = false
                lock.notifyAll()
            }
        }
    }

    private fun loop() {
        var last = 0L
        while (true) {
            var w: Int
            var h: Int
            var changed: Boolean
            synchronized(lock) {
                while (true) {
                    if (quit) return
                    // Fläche weg: EGL-Fläche sofort freigeben und dem Haupt-Thread Bescheid sagen
                    if (!hasSurface && surfaceAlive) {
                        releaseSurface()
                        surfaceAlive = false
                        lock.notifyAll()
                    }
                    if (hasSurface && !paused && !failed && width > 0 && height > 0) break
                    last = 0L
                    lock.wait()
                }
                w = width
                h = height
                changed = sizeChanged
                sizeChanged = false
                // ab hier gilt die Fläche als belegt, bis sie wieder freigegeben ist
                surfaceAlive = true
            }

            if (context == EGL14.EGL_NO_CONTEXT) {
                if (!initContext()) {
                    releaseContext()
                    failed = true
                    synchronized(lock) {
                        surfaceAlive = false
                        lock.notifyAll()
                    }
                    continue
                }
                contextFresh = true
            }
            if (surface == EGL14.EGL_NO_SURFACE) {
                if (!createSurface()) {
                    synchronized(lock) {
                        surfaceAlive = false
                        lock.notifyAll()
                    }
                    // Fläche gerade nicht nutzbar: kurz warten und erneut versuchen
                    Thread.sleep(50)
                    continue
                }
                changed = true
            }
            if (contextFresh) {
                contextFresh = false
                renderer.onSurfaceCreated()
                changed = true
            }
            if (changed) renderer.onSurfaceChanged(w, h)

            val now = SystemClock.elapsedRealtimeNanos()
            val dt = if (last == 0L) 1f / 60f else ((now - last) / 1e9f).coerceIn(0f, 0.05f)
            last = now
            renderer.drawFrame(dt)
            if (!EGL14.eglSwapBuffers(display, surface)) {
                val err = EGL14.eglGetError()
                releaseSurface()
                // Grafik-Kontext verloren (z. B. nach Energiesparen): alles neu anlegen
                if (err == EGL14.EGL_CONTEXT_LOST) releaseContext()
                synchronized(lock) {
                    surfaceAlive = false
                    lock.notifyAll()
                }
                Thread.sleep(20)
                continue
            }
            // höchstens 60 Bilder pro Sekunde (spart Akku auf 90/120-Hz-Bildschirmen)
            val spent = (SystemClock.elapsedRealtimeNanos() - now) / 1_000_000L
            val rest = 16L - spent
            if (rest > 1) Thread.sleep(rest)
        }
    }

    private fun initContext(): Boolean {
        display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        if (display == EGL14.EGL_NO_DISPLAY) return false
        val version = IntArray(2)
        if (!EGL14.eglInitialize(display, version, 0, version, 1)) {
            display = EGL14.EGL_NO_DISPLAY
            return false
        }
        val c = chooseConfig() ?: return false
        config = c
        val ctx = EGL14.eglCreateContext(display, c, EGL14.EGL_NO_CONTEXT,
            intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0)
        if (ctx == null || ctx == EGL14.EGL_NO_CONTEXT) return false
        context = ctx
        return true
    }

    /** Farbtiefe 8/8/8, am liebsten ohne Alphakanal; einen Tiefenpuffer braucht das Plasma nicht. */
    private fun chooseConfig(): EGLConfig? {
        val attribs = intArrayOf(
            EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8, EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGL14.EGL_SURFACE_TYPE, EGL14.EGL_WINDOW_BIT,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<EGLConfig>(32)
        val num = IntArray(1)
        if (!EGL14.eglChooseConfig(display, attribs, 0, configs, 0, configs.size, num, 0) || num[0] <= 0) return null
        val v = IntArray(1)
        fun attr(c: EGLConfig, a: Int): Int = if (EGL14.eglGetConfigAttrib(display, c, a, v, 0)) v[0] else 99
        var best: EGLConfig? = null
        var bestScore = Int.MAX_VALUE
        for (i in 0 until minOf(num[0], configs.size)) {
            val c = configs[i] ?: continue
            if (attr(c, EGL14.EGL_RED_SIZE) != 8 || attr(c, EGL14.EGL_GREEN_SIZE) != 8 || attr(c, EGL14.EGL_BLUE_SIZE) != 8) continue
            val score = attr(c, EGL14.EGL_ALPHA_SIZE) * 4 + attr(c, EGL14.EGL_DEPTH_SIZE) + attr(c, EGL14.EGL_STENCIL_SIZE)
            if (score < bestScore) {
                bestScore = score
                best = c
            }
        }
        return best ?: configs[0]
    }

    private fun createSurface(): Boolean {
        val s = try {
            EGL14.eglCreateWindowSurface(display, config, holder.surface, intArrayOf(EGL14.EGL_NONE), 0)
        } catch (e: Exception) {
            null
        }
        if (s == null || s == EGL14.EGL_NO_SURFACE) return false
        if (!EGL14.eglMakeCurrent(display, s, s, context)) {
            val err = EGL14.eglGetError()
            EGL14.eglDestroySurface(display, s)
            if (err == EGL14.EGL_CONTEXT_LOST) releaseContext()
            return false
        }
        surface = s
        return true
    }

    private fun releaseSurface() {
        if (surface != EGL14.EGL_NO_SURFACE) {
            EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
            EGL14.eglDestroySurface(display, surface)
            surface = EGL14.EGL_NO_SURFACE
        }
    }

    private fun releaseContext() {
        releaseSurface()
        if (context != EGL14.EGL_NO_CONTEXT) {
            EGL14.eglDestroyContext(display, context)
            context = EGL14.EGL_NO_CONTEXT
        }
        if (display != EGL14.EGL_NO_DISPLAY) {
            EGL14.eglTerminate(display)
            display = EGL14.EGL_NO_DISPLAY
        }
    }
}
