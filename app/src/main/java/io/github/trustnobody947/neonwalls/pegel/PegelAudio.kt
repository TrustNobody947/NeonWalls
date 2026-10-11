package io.github.trustnobody947.neonwalls.pegel

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.audiofx.Visualizer
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * Liefert die Lautstärke je Frequenzband: aus der Musik, die gerade auf dem Handy läuft (Visualizer, Ausgabe-Mix),
 * oder aus dem Mikrofon (eigene Frequenzanalyse). Beides braucht die Mikrofon-Berechtigung.
 * Die Werte passen sich automatisch an die Lautstärke an und liegen zwischen 0 und 1.
 */
class PegelAudio(private val ctx: Context) {

    enum class Status { OFF, OK, NO_PERMISSION, FAILED }

    @Volatile var bands: FloatArray? = null
        private set
    @Volatile var status = Status.OFF
        private set
    @Volatile var bandCount = 16

    private var source = -1
    private var vis: Visualizer? = null
    private var micThread: Thread? = null
    @Volatile private var micRunning = false
    private var ref = 0f
    private var lastPub = 0L
    private var silence = 0f

    fun hasPermission(): Boolean =
        ctx.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    /** Quelle starten: 0 = Musik vom Handy, 1 = Mikrofon, sonst nichts (Demo). */
    fun start(src: Int) {
        stop()
        source = src
        when (src) {
            0 -> startMusic()
            1 -> startMic()
        }
    }

    fun stop() {
        micRunning = false
        micThread?.let { try { it.join(400) } catch (e: InterruptedException) { } }
        micThread = null
        vis?.let {
            try { it.enabled = false } catch (e: Throwable) { }
            try { it.release() } catch (e: Throwable) { }
        }
        vis = null
        status = Status.OFF
        bands = null
        lastPub = 0L
    }

    @SuppressLint("MissingPermission")
    private fun startMusic() {
        if (!hasPermission()) { status = Status.NO_PERMISSION; return }
        silence = 4f; ref = 30f
        try {
            val v = Visualizer(0)
            v.enabled = false
            val range = Visualizer.getCaptureSizeRange()
            v.captureSize = 1024.coerceIn(range[0], range[1])
            v.scalingMode = Visualizer.SCALING_MODE_NORMALIZED
            v.setDataCaptureListener(object : Visualizer.OnDataCaptureListener {
                override fun onWaveFormDataCapture(visualizer: Visualizer?, waveform: ByteArray?, samplingRate: Int) {}
                override fun onFftDataCapture(visualizer: Visualizer?, fft: ByteArray?, samplingRate: Int) {
                    if (fft != null && fft.size >= 4) onFftBytes(fft, samplingRate / 1000f)
                }
            }, Visualizer.getMaxCaptureRate() / 2, false, true)
            v.enabled = true
            vis = v
            status = Status.OK
        } catch (e: Throwable) {
            vis = null
            status = Status.FAILED
        }
    }

    // Visualizer-Format: [0] = Gleichanteil, [1] = höchste Frequenz, danach Paare aus Real- und Imaginärteil
    private fun onFftBytes(fft: ByteArray, rate: Float) {
        val n = fft.size / 2
        val mags = FloatArray(n)
        mags[0] = kotlin.math.abs(fft[0].toFloat())
        for (k in 1 until n) mags[k] = hypot(fft[2 * k].toFloat(), fft[2 * k + 1].toFloat())
        publish(mags, if (rate > 1000f) rate else 44100f, fft.size)
    }

    @SuppressLint("MissingPermission")
    private fun startMic() {
        if (!hasPermission()) { status = Status.NO_PERMISSION; return }
        silence = -30f; ref = 0f
        micRunning = true
        val th = Thread {
            val rate = 44100
            val min = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val rec: AudioRecord? = try {
                AudioRecord(MediaRecorder.AudioSource.MIC, rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, max(min, 8192))
            } catch (e: Throwable) { null }
            if (rec == null || rec.state != AudioRecord.STATE_INITIALIZED) {
                status = Status.FAILED
                try { rec?.release() } catch (e: Throwable) { }
                return@Thread
            }
            val n = 1024
            val buf = ShortArray(n)
            val re = FloatArray(n)
            val im = FloatArray(n)
            val win = FloatArray(n) { (0.5 - 0.5 * cos(2.0 * PI * it / (n - 1))).toFloat() }
            try {
                rec.startRecording()
                status = Status.OK
                while (micRunning) {
                    var got = 0
                    while (got < n && micRunning) {
                        val r = rec.read(buf, got, n - got)
                        if (r <= 0) break
                        got += r
                    }
                    if (got < n) { Thread.sleep(10); continue }
                    for (i in 0 until n) { re[i] = buf[i] / 32768f * win[i]; im[i] = 0f }
                    fft(re, im)
                    val mags = FloatArray(n / 2) { hypot(re[it], im[it]) }
                    publish(mags, rate.toFloat(), n)
                }
            } catch (e: Throwable) {
                status = Status.FAILED
            } finally {
                try { rec.stop() } catch (e: Throwable) { }
                try { rec.release() } catch (e: Throwable) { }
            }
        }
        th.isDaemon = true
        micThread = th
        th.start()
    }

    /** Spektrum auf logarithmisch verteilte Bänder abbilden und an die Lautstärke anpassen. */
    private fun publish(mags: FloatArray, rate: Float, n: Int) {
        val nb = bandCount.coerceIn(1, 64)
        val binHz = rate / n
        val fLo = 40f
        val fHi = min(16000f, rate / 2f - binHz)
        val db = FloatArray(nb)
        var loudest = -200f
        for (b in 0 until nb) {
            val f0 = fLo * (fHi / fLo).pow(b.toFloat() / nb)
            val f1 = fLo * (fHi / fLo).pow((b + 1).toFloat() / nb)
            val i0 = (f0 / binHz).toInt().coerceIn(1, mags.size - 1)
            val i1 = (f1 / binHz).toInt().coerceIn(i0, mags.size - 1)
            var m = 0f
            for (i in i0..i1) if (mags[i] > m) m = mags[i]
            val d = 20f * log10(m + 1e-6f) + 10f * b / nb
            db[b] = d
            if (d > loudest) loudest = d
        }
        val now = System.nanoTime()
        val dt = if (lastPub == 0L) 0.05f else ((now - lastPub) / 1e9f).coerceIn(0.001f, 0.5f)
        lastPub = now
        // Bezugspegel: springt bei lauten Stellen sofort hoch und sinkt langsam wieder
        ref = if (loudest > ref) loudest else max(silence + 20f, ref - dt * 6f)
        val range = 42f
        val out = FloatArray(nb)
        if (loudest > silence) for (b in 0 until nb) out[b] = ((db[b] - (ref - range)) / range).coerceIn(0f, 1f)
        bands = out
    }

    // schnelle Fourier-Transformation (Radix 2, in place)
    private fun fft(re: FloatArray, im: FloatArray) {
        val n = re.size
        var j = 0
        for (i in 1 until n) {
            var bit = n shr 1
            while (j and bit != 0) { j = j xor bit; bit = bit shr 1 }
            j = j xor bit
            if (i < j) {
                val tr = re[i]; re[i] = re[j]; re[j] = tr
                val ti = im[i]; im[i] = im[j]; im[j] = ti
            }
        }
        var len = 2
        while (len <= n) {
            val ang = -2.0 * PI / len
            val wr = cos(ang).toFloat()
            val wi = sin(ang).toFloat()
            val half = len / 2
            var i = 0
            while (i < n) {
                var cr = 1f
                var ci = 0f
                for (k in 0 until half) {
                    val a = i + k
                    val b = a + half
                    val vr = re[b] * cr - im[b] * ci
                    val vi = re[b] * ci + im[b] * cr
                    re[b] = re[a] - vr; im[b] = im[a] - vi
                    re[a] += vr; im[a] += vi
                    val ncr = cr * wr - ci * wi
                    ci = cr * wi + ci * wr
                    cr = ncr
                }
                i += len
            }
            len = len shl 1
        }
    }
}
