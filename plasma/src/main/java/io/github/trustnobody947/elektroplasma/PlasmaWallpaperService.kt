package io.github.trustnobody947.elektroplasma

import android.content.SharedPreferences
import android.service.wallpaper.WallpaperService
import android.view.MotionEvent
import android.view.SurfaceHolder
import kotlin.math.max

/** Der eigentliche Live-Hintergrund. Zeichnet nur, solange er sichtbar ist (spart Akku). */
class PlasmaWallpaperService : WallpaperService() {

    override fun onCreateEngine(): Engine = PlasmaEngine()

    inner class PlasmaEngine : Engine(), SharedPreferences.OnSharedPreferenceChangeListener {

        private val renderer = PlasmaRenderer()
        private val prefs = PlasmaPrefs.prefs(this@PlasmaWallpaperService)
        private val sensors = PlasmaSensors(this@PlasmaWallpaperService, renderer)
        private var gl: GlThread? = null
        private var surfaceWidth = 1

        override fun onCreate(surfaceHolder: SurfaceHolder) {
            super.onCreate(surfaceHolder)
            setTouchEventsEnabled(true)
            renderer.settings = PlasmaPrefs.load(this@PlasmaWallpaperService)
            prefs.registerOnSharedPreferenceChangeListener(this)
        }

        override fun onDestroy() {
            prefs.unregisterOnSharedPreferenceChangeListener(this)
            sensors.stop()
            gl?.quitAndWait()
            gl = null
            super.onDestroy()
        }

        override fun onSharedPreferenceChanged(p: SharedPreferences?, key: String?) {
            renderer.settings = PlasmaPrefs.load(this@PlasmaWallpaperService)
            if (isVisible) sensors.start(renderer.settings.mode)
        }

        override fun onSurfaceCreated(holder: SurfaceHolder) {
            super.onSurfaceCreated(holder)
            val t = gl ?: GlThread(holder, renderer).also {
                gl = it
                it.start()
            }
            t.onSurfaceCreated()
            t.setPaused(!isVisible)
        }

        override fun onSurfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
            super.onSurfaceChanged(holder, format, width, height)
            surfaceWidth = max(1, width)
            gl?.onSurfaceChanged(width, height)
        }

        override fun onSurfaceDestroyed(holder: SurfaceHolder) {
            gl?.onSurfaceDestroyed()
            super.onSurfaceDestroyed(holder)
        }

        override fun onVisibilityChanged(visible: Boolean) {
            gl?.setPaused(!visible)
            if (visible) {
                sensors.start(renderer.settings.mode)
            } else {
                sensors.stop()
                renderer.releaseAll()
            }
        }

        override fun onTouchEvent(e: MotionEvent) {
            val w = surfaceWidth.toFloat()
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    renderer.releaseAll()
                    renderer.touch(0, e.getX(0) / w, e.getY(0) / w, e.getPointerId(0))
                }
                MotionEvent.ACTION_POINTER_DOWN -> {
                    val i = e.actionIndex
                    renderer.touch(0, e.getX(i) / w, e.getY(i) / w, e.getPointerId(i))
                }
                MotionEvent.ACTION_MOVE -> for (i in 0 until e.pointerCount) {
                    renderer.touch(1, e.getX(i) / w, e.getY(i) / w, e.getPointerId(i))
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                    val i = e.actionIndex
                    renderer.touch(2, e.getX(i) / w, e.getY(i) / w, e.getPointerId(i))
                }
                MotionEvent.ACTION_CANCEL -> renderer.releaseAll()
            }
        }
    }
}
