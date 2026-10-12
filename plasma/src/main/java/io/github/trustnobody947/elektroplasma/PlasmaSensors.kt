package io.github.trustnobody947.elektroplasma

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.BatteryManager
import android.os.Build
import android.os.SystemClock
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.sin

/**
 * Liefert dem Plasma die Werte für den Farbwechsel nach Akku, Neigung und Kompass.
 * Es läuft immer nur der Sensor, den die gewählte Einstellung braucht, und nur solange das Plasma sichtbar ist.
 */
class PlasmaSensors(private val ctx: Context, private val renderer: PlasmaRenderer) : SensorEventListener {

    private val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager?
    private var mode = -1
    private var batteryOn = false
    private var listening = false

    // geglättete Richtung als Zeiger (so gibt es beim Sprung von 359° auf 0° keinen Ruck)
    private var cx = 0f
    private var cy = 0f
    private var hasDir = false
    private var lastNs = 0L
    private val grav = FloatArray(3)
    private val mag = FloatArray(3)
    private var hasGrav = false
    private var hasMag = false
    private val rot = FloatArray(9)
    private val ori = FloatArray(3)

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent?) {
            if (i != null) readBattery(i)
        }
    }

    /** Sensor für die Einstellung starten (3 Akku, 4 Neigung, 5 Kompass); andere Einstellungen brauchen keinen. */
    fun start(newMode: Int) {
        if (newMode == mode) return
        stop()
        mode = newMode
        when (newMode) {
            3 -> startBattery()
            4 -> listen(Sensor.TYPE_ACCELEROMETER)
            5 -> if (!listen(Sensor.TYPE_ROTATION_VECTOR) && !listen(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR)) {
                // ältere Handys: Kompass aus Beschleunigung und Magnetfeld
                if (sm?.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null) {
                    listen(Sensor.TYPE_ACCELEROMETER)
                    listen(Sensor.TYPE_MAGNETIC_FIELD)
                }
            }
        }
    }

    fun stop() {
        if (batteryOn) {
            try {
                ctx.unregisterReceiver(batteryReceiver)
            } catch (e: Exception) {
            }
            batteryOn = false
        }
        if (listening) {
            sm?.unregisterListener(this)
            listening = false
        }
        mode = -1
        hasDir = false
        hasGrav = false
        hasMag = false
        lastNs = 0L
    }

    private fun startBattery() {
        // aktueller Stand sofort, danach jede Änderung
        try {
            val sticky = if (Build.VERSION.SDK_INT >= 33) {
                ctx.registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED), Context.RECEIVER_NOT_EXPORTED)
            } else {
                ctx.registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            }
            batteryOn = true
            if (sticky != null) readBattery(sticky)
        } catch (e: Exception) {
        }
        if (renderer.battery.isNaN()) {
            val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager?
            val pct = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
            if (pct in 0..100) renderer.battery = pct / 100f
        }
    }

    private fun readBattery(i: Intent) {
        val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        if (level >= 0 && scale > 0) renderer.battery = (level.toFloat() / scale).coerceIn(0f, 1f)
    }

    private fun listen(type: Int): Boolean {
        val m = sm ?: return false
        val s = m.getDefaultSensor(type) ?: return false
        val ok = m.registerListener(this, s, SensorManager.SENSOR_DELAY_UI)
        if (ok) listening = true
        return ok
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onSensorChanged(e: SensorEvent) {
        when (e.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                if (mode == 4) {
                    // Neigung: Richtung, in die das Handy gekippt ist (aufrecht gehalten = 0)
                    val x = e.values[0]
                    val y = e.values[1]
                    if (x * x + y * y > 0.5f) push(atan2(x, y), e.timestamp)
                } else {
                    System.arraycopy(e.values, 0, grav, 0, 3)
                    hasGrav = true
                    compassFromPair(e.timestamp)
                }
            }
            Sensor.TYPE_MAGNETIC_FIELD -> {
                System.arraycopy(e.values, 0, mag, 0, 3)
                hasMag = true
                compassFromPair(e.timestamp)
            }
            Sensor.TYPE_ROTATION_VECTOR, Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR -> {
                try {
                    SensorManager.getRotationMatrixFromVector(rot, e.values)
                    SensorManager.getOrientation(rot, ori)
                    push(ori[0], e.timestamp)
                } catch (ex: Exception) {
                }
            }
        }
    }

    private fun compassFromPair(ts: Long) {
        if (!hasGrav || !hasMag) return
        if (SensorManager.getRotationMatrix(rot, null, grav, mag)) {
            SensorManager.getOrientation(rot, ori)
            push(ori[0], ts)
        }
    }

    /** Winkel (Bogenmaß) weich übernehmen und als Bruchteil eines Kreises an das Plasma geben. */
    private fun push(angle: Float, ts: Long) {
        val tx = cos(angle)
        val ty = sin(angle)
        val now = if (ts > 0) ts else SystemClock.elapsedRealtimeNanos()
        if (!hasDir) {
            cx = tx
            cy = ty
            hasDir = true
        } else {
            val dt = ((now - lastNs) / 1e9f).coerceIn(0f, 0.5f)
            val k = 1f - exp(-dt * 4f)
            cx += (tx - cx) * k
            cy += (ty - cy) * k
        }
        lastNs = now
        var v = (atan2(cy, cx) / (2 * PI)).toFloat()
        if (v < 0f) v += 1f
        if (mode == 4) renderer.tilt = v else renderer.heading = v
    }

    companion object {
        /** Hat das Handy den Sensor für diese Einstellung? (Akku gibt es immer.) */
        fun available(ctx: Context, mode: Int): Boolean {
            val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager? ?: return mode < 4
            return when (mode) {
                4 -> sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null
                5 -> sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null ||
                    sm.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR) != null ||
                    (sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null && sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null)
                else -> true
            }
        }
    }
}
