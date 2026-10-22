package io.github.trustnobody947.neonwalls.ui

import android.app.Activity
import android.app.AlertDialog
import android.app.LocaleManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import android.widget.Button
import io.github.trustnobody947.neonwalls.core.R
import java.util.Locale

/**
 * Sprache der App, umschaltbar in den Einstellungen: „Automatisch“ (wie das Handy) oder eine der zehn Sprachen.
 * Ab Android 13 über die Spracheinstellung je App des Systems (dort ist sie dann auch zu sehen), vorher merkt sich die
 * App die Wahl selbst und jede Activity übernimmt sie in [wrap] (attachBaseContext).
 * Texte: values = Englisch (gilt auch für alle Sprachen ohne eigene Übersetzung), values-de = Deutsch, dazu es, pt
 * (Brasilien), fr, it, pl, tr, ru und in (Indonesisch).
 */
object Lang {
    /** Kennung (BCP 47; "" = wie das Handy) und Name in der eigenen Sprache. */
    val TAGS = arrayOf("", "de", "en", "es", "pt-BR", "fr", "it", "pl", "tr", "ru", "id")
    private val NAMES = arrayOf("", "Deutsch", "English", "Español", "Português (Brasil)", "Français", "Italiano",
        "Polski", "Türkçe", "Русский", "Bahasa Indonesia")

    private const val PREFS = "lang_prefs"
    private const val KEY = "lang"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Kennung auf die Liste abbilden (Indonesisch heißt in alten Java-Versionen „in“, Portugiesisch hier immer Brasilien). */
    private fun norm(tag: String): String {
        val t = tag.replace('_', '-')
        val lang = t.substringBefore('-').lowercase(Locale.ROOT)
        return when (lang) {
            "" -> ""
            "in" -> "id"
            "pt" -> "pt-BR"
            else -> if (lang in TAGS) lang else ""
        }
    }

    /** Gewählte Sprache ("" = automatisch). */
    fun get(ctx: Context): String {
        if (Build.VERSION.SDK_INT >= 33) {
            val lm = ctx.getSystemService(LocaleManager::class.java)
            val l = lm?.applicationLocales
            return if (l == null || l.isEmpty) "" else norm(l.get(0).toLanguageTag())
        }
        return norm(prefs(ctx).getString(KEY, "") ?: "")
    }

    /** Name der gewählten Sprache für die Anzeige (kurz). */
    fun name(ctx: Context): String {
        val i = TAGS.indexOf(get(ctx)).coerceAtLeast(0)
        return if (i == 0) ctx.getString(R.string.lang_auto_short) else NAMES[i]
    }

    /** Knopf „🌐 Sprache“ für die Einstellungen (öffnet die Auswahl). */
    fun button(act: Activity, ui: Sheet): Button =
        ui.makeButton("🌐 " + name(act), false) { choose(act) }

    /** Sprache wählen: Ab Android 13 macht das System den Rest (die Activity startet neu), vorher selbst neu starten. */
    fun set(act: Activity, tag: String) {
        prefs(act).edit().putString(KEY, tag).apply()
        if (Build.VERSION.SDK_INT >= 33) {
            val lm = act.getSystemService(LocaleManager::class.java)
            if (lm != null) {
                lm.applicationLocales = if (tag.isEmpty()) LocaleList.getEmptyLocaleList() else LocaleList.forLanguageTags(tag)
                return
            }
        }
        act.recreate()
    }

    /** Für attachBaseContext jeder Activity: vor Android 13 die gewählte Sprache einstellen. */
    fun wrap(base: Context): Context {
        if (Build.VERSION.SDK_INT >= 33) return base
        val tag = norm(prefs(base).getString(KEY, "") ?: "")
        if (tag.isEmpty()) return base
        val loc = Locale.forLanguageTag(tag)
        val cfg = Configuration(base.resources.configuration)
        cfg.setLocale(loc)
        cfg.setLocales(LocaleList(loc))
        return base.createConfigurationContext(cfg)
    }

    /** Auswahl als Liste anbieten. */
    fun choose(act: Activity) {
        val cur = TAGS.indexOf(get(act)).coerceAtLeast(0)
        val items = Array(TAGS.size) { i -> if (i == 0) act.getString(R.string.lang_auto) else NAMES[i] }
        AlertDialog.Builder(act)
            .setTitle(R.string.s_lang)
            .setSingleChoiceItems(items, cur) { d, which ->
                d.dismiss()
                if (which != cur) set(act, TAGS[which])
            }
            .setNegativeButton(R.string.u_cancel, null)
            .show()
    }
}
