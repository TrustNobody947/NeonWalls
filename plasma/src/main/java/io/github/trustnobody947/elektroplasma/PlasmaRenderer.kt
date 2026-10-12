package io.github.trustnobody947.elektroplasma

import android.opengl.GLES20
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Zeichnet das Plasma mit OpenGL ES 2.0 – für den Live-Hintergrund und für die Vorschau in den Einstellungen.
 * Erst wird das Plasma in ein kleineres Bild gerechnet (höchstens 600 Pixel breit, wie in der Vorschau im Browser),
 * dann weich auf den ganzen Bildschirm gezogen. Alle Methoden außer [touch], [demoTouch], [newPattern] und den
 * Feldern [settings], [battery], [tilt], [heading] laufen im Grafik-Thread.
 */
class PlasmaRenderer {

    @Volatile var settings = PlasmaSettings()
    // Sensorwerte, von außen gesetzt: Akku 0..1, Neigung und Kompass als Bruchteil eines Kreises; NaN = unbekannt
    @Volatile var battery = Float.NaN
    @Volatile var tilt = Float.NaN
    @Volatile var heading = Float.NaN
    /** Fehlermeldung, falls der Shader auf diesem Handy nicht läuft. */
    @Volatile var error: String? = null
        private set

    private class Touch(val id: Int, var x: Float, var y: Float, var on: Boolean, var life: Float) {
        var amp = 0f
    }
    private val touches = ArrayList<Touch>()

    // Zustand der Animation (nur im Grafik-Thread)
    private var t = 0f
    private var tz = Random.nextFloat() * 200f
    private var driftX = Random.nextFloat() * 50f
    private var driftY = Random.nextFloat() * 50f
    private var col: Tri = PlasmaColors.tri(PlasmaColors.PRESETS[0])
    private var colReady = false
    private var lastMode = -1
    private var randFrom: Tri? = null
    private var randTo: Tri? = null
    private var randT = 0f
    private var randNext = 0f
    private var cycleT = 0f
    private var touchWasOn = true
    @Volatile private var pendingNewPattern = false

    // GL-Objekte
    private var prog = 0
    private var blit = 0
    private var fbo = 0
    private var tex = 0
    @Volatile private var sw = 1
    @Volatile private var sh = 1
    private var rw = 1
    private var rh = 1
    private val quad: FloatBuffer = ByteBuffer.allocateDirect(6 * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
        put(floatArrayOf(-1f, -1f, 3f, -1f, -1f, 3f))
        position(0)
    }
    private val touchData = FloatArray(16)
    private var uRes = -1
    private var uAsp = -1
    private var uT = -1
    private var uF = -1
    private var uSym = -1
    private var uMove = -1
    private var uThick = -1
    private var uK = -1
    private var uG = -1
    private var uH = -1
    private var uDrift = -1
    private var uTouch = -1
    private var uLook = -1
    private var uOct = -1
    private var uBlitTex = -1

    /** Neuer Grafik-Kontext: Shader und Zwischenbild neu anlegen. */
    fun onSurfaceCreated() {
        fbo = 0
        tex = 0
        error = null
        prog = program(PlasmaShader.VERTEX, PlasmaShader.FRAGMENT)
        blit = program(PlasmaShader.BLIT_VERTEX, PlasmaShader.BLIT_FRAGMENT)
        if (prog != 0) {
            fun u(n: String) = GLES20.glGetUniformLocation(prog, n)
            uRes = u("uRes"); uAsp = u("uAsp"); uT = u("uT"); uF = u("uF"); uSym = u("uSym"); uMove = u("uMove")
            uThick = u("uThick"); uK = u("uK"); uG = u("uG"); uH = u("uH"); uDrift = u("uDrift"); uTouch = u("uTouch")
            uLook = u("uLook"); uOct = u("uOct")
        }
        if (blit != 0) uBlitTex = GLES20.glGetUniformLocation(blit, "t")
    }

    fun onSurfaceChanged(w: Int, h: Int) {
        sw = max(1, w)
        sh = max(1, h)
        rw = min(sw, 600)
        rh = max(1, (rw.toLong() * sh / sw).toInt())
        makeFbo()
    }

    /** Finger: x und y in Bildschirmbreiten, y von oben gezählt. type 0 = aufgesetzt, 1 = bewegt, 2 = losgelassen. */
    fun touch(type: Int, x: Float, y: Float, id: Int) {
        if (!settings.touch) return
        synchronized(touches) {
            val o = touches.lastOrNull { it.id == id && it.on }
            if (type == 0) {
                touches.add(Touch(id, x, y, true, -1f))
                if (touches.size > 8) touches.removeAt(0)
            } else if (o != null) {
                o.x = x
                o.y = y
                if (type == 2) o.on = false
            }
        }
    }

    /** Alle Finger loslassen (z. B. wenn eine Berührung abgebrochen wurde). */
    fun releaseAll() {
        synchronized(touches) {
            for (o in touches) o.on = false
        }
    }

    /** Kurz einen Finger vorführen (Ringe an zufälliger Stelle). */
    fun demoTouch() {
        val asp = sh.toFloat() / sw
        synchronized(touches) {
            touches.add(Touch(-99, 0.25f + Random.nextFloat() * 0.5f, (0.4f + Random.nextFloat() * 0.5f) * asp, true, 0.9f))
        }
    }

    fun newPattern() {
        pendingNewPattern = true
    }

    fun drawFrame(dt: Float) {
        val s = settings
        update(s, dt)
        if (prog == 0) {
            GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
            GLES20.glViewport(0, 0, sw, sh)
            GLES20.glClearColor(0.25f, 0f, 0f, 1f)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
            return
        }
        val direct = fbo == 0 || blit == 0
        val w = if (direct) sw else rw
        val h = if (direct) sh else rh
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, if (direct) 0 else fbo)
        GLES20.glViewport(0, 0, w, h)
        GLES20.glUseProgram(prog)
        val f = FREQ[s.complexity - 1]
        val thick = 0.17f * sqrt(FREQ[2] / f) * (0.55f + 0.09f * s.glow)
        GLES20.glUniform2f(uRes, w.toFloat(), h.toFloat())
        GLES20.glUniform1f(uAsp, h.toFloat() / w)
        GLES20.glUniform1f(uT, tz)
        GLES20.glUniform1f(uF, f)
        GLES20.glUniform1f(uSym, s.sym.toFloat())
        GLES20.glUniform1f(uMove, if (s.move) 1f else 0f)
        GLES20.glUniform1f(uThick, thick)
        GLES20.glUniform3f(uK, col.k[0], col.k[1], col.k[2])
        GLES20.glUniform3f(uG, col.g[0], col.g[1], col.g[2])
        GLES20.glUniform3f(uH, col.h[0], col.h[1], col.h[2])
        GLES20.glUniform2f(uDrift, driftX, driftY)
        GLES20.glUniform4fv(uTouch, 4, touchData, 0)
        // Aussehen wie in der Vorschau: Abfall des Scheins, Nebelstärke, –, Helligkeit; Stärke der feineren Lagen
        GLES20.glUniform4f(uLook, 1.1f, 0.75f, 0f, 1.3f)
        GLES20.glUniform3f(uOct, 0.25f, 0.1f, 0.05f)
        drawQuad()
        if (!direct) {
            GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
            GLES20.glViewport(0, 0, sw, sh)
            GLES20.glUseProgram(blit)
            GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
            GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex)
            GLES20.glUniform1i(uBlitTex, 0)
            drawQuad()
        }
    }

    // ---------- Animation ----------

    private fun update(s: PlasmaSettings, dt: Float) {
        if (pendingNewPattern) {
            pendingNewPattern = false
            tz = Random.nextFloat() * 400f
            driftX = Random.nextFloat() * 50f
            driftY = Random.nextFloat() * 50f
        }
        if (s.mode != lastMode) {
            randTo = null
            cycleT = 0f
            lastMode = s.mode
        }
        t += dt
        val r = 0.02f + 0.52f * (s.speed / 100f).pow(1.6f)
        tz += dt * r
        if (tz > 4000f) tz -= 4000f
        // komplexe Bewegung: das Muster gleitet zusätzlich, in langsam wechselnder Richtung
        if (s.move) {
            val a = t * 0.07f + sin(t * 0.13f) * 1.6f
            driftX += cos(a) * dt * 0.45f * r
            driftY += sin(a) * dt * 0.45f * r
        }
        // Farbe weich nachführen
        val target = targetColor(s, dt)
        col = if (!colReady) target else PlasmaColors.mixTri(col, target, 1f - exp(-dt * 6f))
        colReady = true
        // Berührungen: unter dem Finger wächst der Hügel schnell, nach dem Loslassen sinkt er weich zurück
        synchronized(touches) {
            // Berührung ausgeschaltet: Finger weg (vorgeführte Berührungen gehen trotzdem)
            if (!s.touch && touchWasOn) touches.clear()
            touchWasOn = s.touch
            val it = touches.iterator()
            while (it.hasNext()) {
                val o = it.next()
                if (o.life > 0f) {
                    o.life -= dt
                    if (o.life <= 0f) o.on = false
                }
                val goal = if (o.on) 2.6f else 0f
                o.amp += (goal - o.amp) * (1f - exp(-dt * (if (o.on) 9f else 4.5f)))
                if (!o.on && o.amp < 0.01f) it.remove()
            }
            touchData.fill(0f)
            val n = touches.size
            val start = max(0, n - 4)
            for (i in start until n) {
                val o = touches[i]
                val j = (i - start) * 4
                touchData[j] = o.x
                touchData[j + 1] = o.y
                touchData[j + 2] = o.amp
            }
        }
    }

    private fun targetColor(s: PlasmaSettings, dt: Float): Tri {
        val base = PlasmaColors.tri(s.layers())
        return when (s.mode) {
            1 -> { // Zufall: alle paar Sekunden zu einer neuen, kräftigen Farbe überblenden
                randNext -= dt
                val rt = randTo
                if (rt == null || randNext <= 0f) {
                    randFrom = if (rt != null) PlasmaColors.mixTri(randFrom ?: base, rt, PlasmaColors.smooth(randT.coerceIn(0f, 1f))) else base
                    val h = Random.nextFloat()
                    val h2 = ((h + Random.nextFloat() * 0.12f - 0.06f) % 1f + 1f) % 1f
                    randTo = Tri(base.k, PlasmaColors.hue(h), PlasmaColors.hue(h2))
                    randT = 0f
                    randNext = 4f + Random.nextFloat() * 4f
                }
                randT += dt / 1.4f
                PlasmaColors.mixTri(randFrom ?: base, randTo ?: base, PlasmaColors.smooth(randT.coerceIn(0f, 1f)))
            }
            2 -> { // Wechsel: der Reihe nach durch die Voreinstellungen
                cycleT += dt / 3.5f
                val n = PlasmaColors.CYCLE.size
                val i = floor(cycleT).toInt() % n
                val k = ((cycleT % 1f - 0.55f) / 0.45f).coerceIn(0f, 1f)
                PlasmaColors.mixTri(PlasmaColors.CYCLE[i], PlasmaColors.CYCLE[(i + 1) % n], PlasmaColors.smooth(k))
            }
            3 -> { // Akku: leer rot … voll blau
                val v = if (!battery.isNaN()) battery else 0.5f + 0.5f * sin(t * 0.15f)
                PlasmaColors.fromOne(PlasmaColors.listColor(PlasmaColors.BATTERY, v, false), base)
            }
            4 -> { // Neigung
                val v = if (!tilt.isNaN()) tilt else t * 0.04f
                PlasmaColors.fromOne(PlasmaColors.listColor(PlasmaColors.COMPASS, v, true), base)
            }
            5 -> { // Kompass
                val v = if (!heading.isNaN()) heading else t * 0.025f
                PlasmaColors.fromOne(PlasmaColors.listColor(PlasmaColors.COMPASS, v, true), base)
            }
            else -> base
        }
    }

    // ---------- GL-Helfer ----------

    private fun drawQuad() {
        quad.position(0)
        GLES20.glEnableVertexAttribArray(0)
        GLES20.glVertexAttribPointer(0, 2, GLES20.GL_FLOAT, false, 0, quad)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 3)
    }

    private fun shader(type: Int, src: String): Int {
        val s = GLES20.glCreateShader(type)
        GLES20.glShaderSource(s, src)
        GLES20.glCompileShader(s)
        val ok = IntArray(1)
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0)
        if (ok[0] == 0) {
            error = "Shader: " + GLES20.glGetShaderInfoLog(s)
            GLES20.glDeleteShader(s)
            return 0
        }
        return s
    }

    private fun program(vs: String, fs: String): Int {
        val v = shader(GLES20.GL_VERTEX_SHADER, vs)
        val f = shader(GLES20.GL_FRAGMENT_SHADER, fs)
        if (v == 0 || f == 0) return 0
        val p = GLES20.glCreateProgram()
        GLES20.glAttachShader(p, v)
        GLES20.glAttachShader(p, f)
        GLES20.glBindAttribLocation(p, 0, "a")
        GLES20.glLinkProgram(p)
        val ok = IntArray(1)
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0)
        if (ok[0] == 0) {
            error = "Programm: " + GLES20.glGetProgramInfoLog(p)
            GLES20.glDeleteProgram(p)
            return 0
        }
        return p
    }

    private fun makeFbo() {
        if (fbo != 0) GLES20.glDeleteFramebuffers(1, intArrayOf(fbo), 0)
        if (tex != 0) GLES20.glDeleteTextures(1, intArrayOf(tex), 0)
        fbo = 0
        tex = 0
        if (prog == 0 || blit == 0 || rw >= sw) return  // ohne Verkleinerung direkt auf den Bildschirm
        val ids = IntArray(1)
        GLES20.glGenTextures(1, ids, 0)
        tex = ids[0]
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, rw, rh, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null)
        GLES20.glGenFramebuffers(1, ids, 0)
        fbo = ids[0]
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, fbo)
        GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0, GLES20.GL_TEXTURE_2D, tex, 0)
        val status = GLES20.glCheckFramebufferStatus(GLES20.GL_FRAMEBUFFER)
        GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
        if (status != GLES20.GL_FRAMEBUFFER_COMPLETE) {
            GLES20.glDeleteFramebuffers(1, intArrayOf(fbo), 0)
            GLES20.glDeleteTextures(1, intArrayOf(tex), 0)
            fbo = 0
            tex = 0
        }
    }

    private companion object {
        /** Grundfrequenz je Komplexitätsstufe (Linien je Bildschirmbreite). */
        val FREQ = floatArrayOf(1.8f, 2.4f, 3.1f, 4.0f, 5.2f)
    }
}
