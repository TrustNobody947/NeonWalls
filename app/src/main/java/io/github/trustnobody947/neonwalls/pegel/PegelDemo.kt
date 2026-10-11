package io.github.trustnobody947.neonwalls.pegel

import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * Erfundener Song für die Pegelanzeige, wenn keine echte Musik anliegt (Demo-Beat oder fehlende Berechtigung).
 * Bassdrum, Snare, Hi-Hats, Bass, Melodie und Flächen; alle paar Takte wechseln Intro, Hauptteil, Breakdown, Aufbau und Drop.
 */
class PegelDemo {
    private class Voice(val type: Int, val t0: Float, val vel: Float, val x: Float, val dec: Float, val w: Float)

    private val voices = ArrayList<Voice>()
    private val rnd = Random(System.nanoTime())
    private var t = 0f
    private var beat = 0f
    private var lastStep = -1
    private var prog = intArrayOf(0, 5, 3, 4)
    private var kickVar = false
    private var bassRh = intArrayOf(0, 3, 6, 8, 11, 14)
    private val lead = IntArray(16)
    private var tilt = 0f
    private var barOff = 4
    private var sec = MAIN
    private var bed = 0f
    private var pump = 1f
    var drop = 0f
        private set
    var bpm = 124f

    init {
        newSong()
    }

    fun newSong() {
        val progs = arrayOf(intArrayOf(0, 5, 3, 4), intArrayOf(0, 3, 5, 4), intArrayOf(0, 6, 5, 3), intArrayOf(0, 4, 5, 3))
        val rhythms = arrayOf(intArrayOf(0, 3, 6, 8, 11, 14), intArrayOf(0, 2, 4, 8, 10, 12), intArrayOf(0, 6, 8, 14))
        prog = progs[rnd.nextInt(progs.size)]
        kickVar = rnd.nextBoolean()
        bassRh = rhythms[rnd.nextInt(rhythms.size)]
        for (i in 0 until 16) lead[i] = if (rnd.nextFloat() < 0.7f) rnd.nextInt(8) else -1
        tilt = rnd.nextFloat() * 0.3f - 0.15f
        barOff = if (rnd.nextBoolean()) 4 else 8
        voices.clear()
    }

    /** Nach dem Selbsttest im nächsten Takt sauber weiterspielen. */
    fun resync() {
        beat = floor(beat / 4f + 1f) * 4f
        lastStep = floor(beat * 4f).toInt() - 1
    }

    fun bassDrop() {
        drop = 1f
        repeat(6) { hit(KICK, 1.2f, 0.06f, 0.4f, 0.12f) }
        hit(SNARE, 1f, 0.5f, 0.5f, 0.45f)
        hit(OHAT, 0.9f, 0.85f, 0.5f, 0.2f)
    }

    fun step(dt: Float, play: Boolean) {
        t += dt
        if (play) {
            beat += dt * bpm / 60f
            val step = floor(beat * 4f).toInt()
            if (step != lastStep) {
                for (s in (lastStep + 1)..step) if (s >= 0 && s > step - 4) onStep(s)
                lastStep = step
            }
        }
        voices.removeAll { t - it.t0 > it.dec * 6f }
        val target = if (play) BED[sec] else 0f
        bed += (target - bed) * min(1f, dt * 1.5f)
        var ke = 0f
        for (o in voices) if (o.type == KICK) ke = maxOf(ke, exp(-(t - o.t0) / 0.25f))
        pump = 1f - 0.6f * ke
        drop *= exp(-dt * 2.5f)
    }

    /** Pegel an der Frequenzstelle x (0 = tief, 1 = hoch). */
    fun level(x: Float): Float {
        var v = 0f
        for (o in voices) {
            val age = t - o.t0
            val e = o.vel * exp(-age / o.dec)
            when (o.type) {
                KICK -> {
                    val c = o.x - min(0.04f, age * 0.3f)
                    v += e * g((x - c) / o.w) * 1.05f
                }
                SNARE -> v += e * (0.55f * g((x - o.x) / o.w) + 0.25f * rnd.nextFloat() * (if (x > 0.25f) 1f else 0.3f))
                HAT, OHAT -> v += e * g((x - o.x) / o.w) * (0.7f + 0.3f * rnd.nextFloat())
                PAD -> {
                    val sw = 0.5f + 0.5f * sin(age * 2f)
                    v += 0.32f * o.vel * min(1f, age * 3f) * exp(-age / o.dec) * g((x - o.x) / o.w) * (0.8f + 0.2f * sw)
                }
                else -> v += e * (g((x - o.x) / o.w) + 0.45f * g((x - o.x - 0.11f) / o.w) + 0.25f * g((x - o.x - 0.18f) / o.w))
            }
        }
        v += bed * pump * g((x - 0.42f) / 0.33f)
        return v * (1f + tilt * (x - 0.5f) * 2f)
    }

    private fun g(u: Float) = exp(-u * u)

    private fun hit(type: Int, vel: Float, x: Float, dec: Float, w: Float) {
        voices.add(Voice(type, t, vel, x, dec, w))
    }

    private fun noteX(deg: Int, base: Float) = base + SCALE[((deg % 8) + 8) % 8] / 12f * 0.11f

    private fun section(bar: Int): Int {
        val b = (bar + barOff) % 32
        return when {
            b < 4 -> INTRO
            b < 16 -> MAIN
            b < 20 -> BREAK
            b < 24 -> BUILD
            else -> DROP
        }
    }

    private fun onStep(step: Int) {
        val bar = step / 16
        val s = step % 16
        sec = section(bar)
        val root = prog[bar % 4]
        val bIn = (bar + barOff) % 32
        val kick = sec == INTRO || sec == MAIN || sec == DROP
        if (kick && (s % 4 == 0 || (kickVar && s == 14 && bar % 2 == 1))) hit(KICK, 1f, 0.07f, 0.17f, 0.07f)
        if ((sec == MAIN || sec == DROP) && (s == 4 || s == 12)) hit(SNARE, 0.85f, 0.48f, 0.18f, 0.28f)
        if (sec == BUILD) {
            val k = bIn - 20
            val every = if (k < 1) 4 else if (k < 2) 2 else 1
            if (s % every == 0) hit(SNARE, 0.35f + 0.15f * k + 0.04f * s / 16f * k, 0.5f + 0.03f * k, 0.1f, 0.25f)
        }
        if (sec != BREAK && (s % 2 == 0 || sec == DROP)) hit(HAT, if (s % 4 == 2) 0.75f else 0.45f, 0.9f, 0.05f, 0.08f)
        if (sec == DROP && s % 4 == 2) hit(OHAT, 0.6f, 0.84f, 0.22f, 0.13f)
        if ((sec == MAIN || sec == DROP) && bassRh.contains(s)) hit(BASS, 0.8f, noteX(root, 0.1f), 0.22f, 0.035f)
        if ((sec == BREAK || sec == DROP || (sec == MAIN && bar % 2 == 1)) && lead[s] >= 0) hit(LEAD, 0.6f, noteX(root + lead[s], 0.36f), 0.16f, 0.03f)
        if (s == 0 && (sec == BREAK || sec == INTRO || sec == BUILD)) hit(PAD, 0.5f, noteX(root, 0.3f), 1.6f, 0.18f)
    }

    private companion object {
        const val KICK = 0
        const val SNARE = 1
        const val HAT = 2
        const val OHAT = 3
        const val BASS = 4
        const val LEAD = 5
        const val PAD = 6
        const val INTRO = 0
        const val MAIN = 1
        const val BREAK = 2
        const val BUILD = 3
        const val DROP = 4
        val BED = floatArrayOf(0.1f, 0.2f, 0.17f, 0.2f, 0.28f)
        val SCALE = intArrayOf(0, 2, 3, 5, 7, 8, 10, 12)
    }
}
