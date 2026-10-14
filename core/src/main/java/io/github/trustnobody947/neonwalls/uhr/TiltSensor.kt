package io.github.trustnobody947.neonwalls.uhr

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.atan2
import kotlin.math.exp
import kotlin.math.sqrt

/**
 * Neigung des Handys für die 3D-Uhr: Schwerkraftsensor (sonst Beschleunigung), umgerechnet in Neigung links/rechts
 * und vor/zurück. Gemessen wird relativ zur Haltung, die sich langsam nachführt (ca. 4 s): Hält man das Handy ruhig,
 * kommt die Uhr wieder zur Mitte. Ergebnis −1..1 je Richtung (22° = voll).
 * Läuft nur zwischen [start] und [stop] (Hintergrund sichtbar, Uhr an, 3D an), 30-mal pro Sekunde.
 */
class TiltSensor(ctx: Context, private val onTilt: (Float, Float) -> Unit) : SensorEventListener {

    private val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager?
    private val sensor: Sensor? = sm?.getDefaultSensor(Sensor.TYPE_GRAVITY) ?: sm?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    private var running = false
    private var restG = 0f
    private var restB = 0f
    private var hasRest = false
    private var lastNs = 0L
    // Beschleunigungssensor: Schwerkraft herausfiltern
    private val gv = FloatArray(3)

    fun start() {
        if (running) return
        val m = sm ?: return
        val s = sensor ?: return
        // 30 Messungen pro Sekunde reichen (die Uhr zieht weich nach) und sparen Akku
        running = m.registerListener(this, s, 33_333)
        hasRest = false
        lastNs = 0L
    }

    fun stop() {
        if (!running) return
        running = false
        sm?.unregisterListener(this)
        onTilt(0f, 0f)
    }

    override fun onSensorChanged(e: SensorEvent) {
        var x = e.values[0]
        var y = e.values[1]
        var z = e.values[2]
        if (e.sensor.type == Sensor.TYPE_ACCELEROMETER) {
            val a = 0.15f
            gv[0] += (x - gv[0]) * a; gv[1] += (y - gv[1]) * a; gv[2] += (z - gv[2]) * a
            x = gv[0]; y = gv[1]; z = gv[2]
        }
        // wie im Browser: gamma = links/rechts, beta = vor/zurück (90° = aufrecht)
        val gamma = Math.toDegrees(-atan2(x, sqrt(y * y + z * z)).toDouble()).toFloat()
        val beta = Math.toDegrees(atan2(y, z).toDouble()).toFloat()
        if (!hasRest) { restG = gamma; restB = beta; hasRest = true }
        val dt = if (lastNs == 0L) 0.02f else ((e.timestamp - lastNs) / 1e9f).coerceIn(0f, 0.2f)
        lastNs = e.timestamp
        val k = 1f - exp(-dt / 4f)
        restG += (gamma - restG) * k
        restB += (beta - restB) * k
        onTilt(((gamma - restG) / 22f).coerceIn(-1f, 1f), ((restB - beta) / 22f).coerceIn(-1f, 1f))
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
