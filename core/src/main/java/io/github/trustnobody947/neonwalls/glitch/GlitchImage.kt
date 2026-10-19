package io.github.trustnobody947.neonwalls.glitch

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Point
import android.graphics.Rect
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.view.WindowManager
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Eigenes Hintergrundbild übernehmen: aus der Bildauswahl laden (richtig gedreht), auf das Format des Bildschirms
 * zuschneiden (Mitte), höchstens so groß wie der Bildschirm, und im internen Speicher der App ablegen. Vorschau und
 * Live-Hintergrund laden es von dort ([GlitchPrefs.loadBackground]).
 */
object GlitchImage {

    /** true = übernommen. Läuft länger (Bild dekodieren), also nicht auf dem Haupt-Thread aufrufen. */
    fun import(ctx: Context, uri: Uri): Boolean {
        val (sw, sh) = screenSize(ctx)
        val src = decode(ctx, uri, sw, sh) ?: return false
        try {
            // Ausschnitt mit dem Seitenverhältnis des Bildschirms aus der Mitte des Bildes
            val scale = max(sw / src.width.toFloat(), sh / src.height.toFloat())
            val cw = (sw / scale).roundToInt().coerceIn(1, src.width)
            val ch = (sh / scale).roundToInt().coerceIn(1, src.height)
            val cx = (src.width - cw) / 2
            val cy = (src.height - ch) / 2
            // nicht größer als der Bildschirm (spart Speicher, sieht genauso aus)
            val k = min(1f, sw / cw.toFloat())
            val tw = max(1, (cw * k).roundToInt())
            val th = max(1, (ch * k).roundToInt())
            val out = Bitmap.createBitmap(tw, th, Bitmap.Config.ARGB_8888)
            Canvas(out).drawBitmap(src, Rect(cx, cy, cx + cw, cy + ch), Rect(0, 0, tw, th), Paint(Paint.FILTER_BITMAP_FLAG))
            val file = File(ctx.filesDir, GlitchPrefs.BG_FILE)
            val tmp = File(ctx.filesDir, GlitchPrefs.BG_FILE + ".neu")
            FileOutputStream(tmp).use { out.compress(Bitmap.CompressFormat.JPEG, 92, it) }
            out.recycle()
            if (!tmp.renameTo(file)) {
                tmp.copyTo(file, overwrite = true)
                tmp.delete()
            }
            GlitchPrefs.prefs(ctx).edit().putLong(GlitchPrefs.BG_STAMP, System.currentTimeMillis()).apply()
            return true
        } finally {
            src.recycle()
        }
    }

    /** Größe des ganzen Bildschirms im Hochformat (Breite, Höhe). */
    private fun screenSize(ctx: Context): Pair<Int, Int> {
        var w = ctx.resources.displayMetrics.widthPixels
        var h = ctx.resources.displayMetrics.heightPixels
        try {
            val wm = ctx.getSystemService(WindowManager::class.java)
            if (wm != null) {
                if (Build.VERSION.SDK_INT >= 30) {
                    val b = wm.maximumWindowMetrics.bounds
                    w = b.width()
                    h = b.height()
                } else {
                    val p = Point()
                    @Suppress("DEPRECATION")
                    wm.defaultDisplay.getRealSize(p)
                    w = p.x
                    h = p.y
                }
            }
        } catch (e: Exception) {
        }
        return Pair(max(1, min(w, h)), max(1, max(w, h)))
    }

    /**
     * Bild laden: so weit verkleinert, dass es den Bildschirm gerade noch füllt (bei sehr breiten oder hohen Bildern
     * etwas kleiner, damit der Speicher reicht); richtig herum gedreht.
     */
    private fun decode(ctx: Context, uri: Uri, sw: Int, sh: Int): Bitmap? {
        val cr = ctx.contentResolver
        val limit = 3.0 * sw * sh
        if (Build.VERSION.SDK_INT >= 28) {
            return try {
                ImageDecoder.decodeBitmap(ImageDecoder.createSource(cr, uri)) { decoder, info, _ ->
                    val s = info.size
                    val iw = max(1, s.width).toDouble()
                    val ih = max(1, s.height).toDouble()
                    var sc = min(1.0, max(sw / iw, sh / ih))
                    if (iw * ih * sc * sc > limit) sc = Math.sqrt(limit / (iw * ih))
                    decoder.setTargetSize(max(1, (iw * sc).roundToInt()), max(1, (ih * sc).roundToInt()))
                    decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                }
            } catch (e: Throwable) {
                null
            }
        }
        return try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
            var k = 1
            while (bounds.outWidth / (2 * k) >= sw && bounds.outHeight / (2 * k) >= sh) k *= 2
            while (bounds.outWidth.toDouble() * bounds.outHeight / (k.toDouble() * k) > limit) k *= 2
            val opts = BitmapFactory.Options().apply { inSampleSize = k }
            val bmp = cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) } ?: return null
            // Handyfotos sind oft nur über die Bildangaben gedreht
            val deg = try {
                cr.openInputStream(uri)?.use {
                    when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                        ExifInterface.ORIENTATION_ROTATE_90 -> 90
                        ExifInterface.ORIENTATION_ROTATE_180 -> 180
                        ExifInterface.ORIENTATION_ROTATE_270 -> 270
                        else -> 0
                    }
                } ?: 0
            } catch (e: Exception) {
                0
            }
            if (deg == 0) bmp else {
                val m = Matrix().apply { postRotate(deg.toFloat()) }
                val r = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
                if (r !== bmp) bmp.recycle()
                r
            }
        } catch (e: Throwable) {
            null
        }
    }
}
