package io.github.trustnobody947.brokenscreen

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.format.DateFormat
import android.widget.Toast
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import io.github.trustnobody947.neonwalls.glitch.Shop
import io.github.trustnobody947.neonwalls.glitch.Unlock
import java.util.Date
import io.github.trustnobody947.neonwalls.core.R as CoreR

/**
 * Werbung, Datenschutz-Abfrage und Kauf für Broken Screen. Was gerade frei ist, steht in [Unlock] (gemeinsam mit dem
 * Hintergrund, der gesperrte Einstellungen mit den freien Werten zeichnet).
 *
 * - Beim Öffnen der App kurz eine Anzeige (App-Start-Anzeige von Google). Danach erst wieder, wenn seit der letzten
 *   Anzeige mindestens 10 Minuten vergangen sind und man die App erneut öffnet oder zu den Einstellungen zurückkommt.
 *   Nie mitten in der Bedienung, nie nach dem Kauf.
 * - Werbevideo (Anzeige mit Prämie): bis zum Ende angesehen → 24 Stunden alle Extras.
 * - Kauf [PRODUCT] (einmalig, in der Play Console als Produkt anlegen, Preis dort 1,40 €): alles für immer, ohne Werbung.
 * - Datenschutz-Abfrage für die Werbung (EU) mit der UMP-Bibliothek von Google, bevor Anzeigen geladen werden.
 *
 * Testbetrieb ([TEST]): Test-Anzeigen von Google (mit „Test Ad“ beschriftet). Ist der Kauf noch nicht eingerichtet
 * (App nicht über Google Play installiert), wird er nur nachgestellt; „Zurücksetzen“ geht zurück zur kostenlosen
 * Version. Für die Veröffentlichung: TEST = false, die eigenen Anzeigenblock-IDs unten und die eigene App-ID im
 * Manifest eintragen (beides aus dem AdMob-Konto).
 */
class BsShop(private val act: Activity) : Shop, PurchasesUpdatedListener {

    override var onChange: (() -> Unit)? = null
    override val test = TEST

    private val prefs = act.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val consent: ConsentInformation = UserMessagingPlatform.getConsentInformation(act)
    private val handler = Handler(Looper.getMainLooper())
    private val billing: BillingClient = BillingClient.newBuilder(act.applicationContext)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()
    private var product: ProductDetails? = null

    private var adsStarted = false
    private var adsReady = false
    private var openAd: AppOpenAd? = null
    private var openAdAt = 0L
    private var openLoading = false
    /** Bis wann (uptime) die App-Start-Anzeige noch gezeigt wird, wenn sie bis dahin geladen ist; 0 = gerade nicht. */
    private var openUntil = 0L
    private var reward: RewardedAd? = null
    private var rewardLoading = false
    private var rewardWanted = false
    private var showing = false
    private var resumed = false
    private var skipStart = false
    private var destroyed = false
    private val rewardTimeout = Runnable {
        if (rewardWanted) {
            rewardWanted = false
            toast(CoreR.string.u_ad_none)
        }
    }

    private fun changed() {
        if (!destroyed) onChange?.invoke()
    }

    private fun toast(id: Int, vararg args: Any) {
        if (destroyed) return
        val t = if (args.isEmpty()) act.getString(id) else act.getString(id, *args)
        Toast.makeText(act, t, Toast.LENGTH_LONG).show()
    }

    // ---------- Ablauf (von der Activity aufgerufen) ----------

    /** Beim Erstellen der Activity: Kauf prüfen, Datenschutz-Abfrage, dann Anzeigen laden. */
    fun start() {
        billing.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) act.runOnUiThread {
                    if (destroyed) return@runOnUiThread
                    restore()
                    queryProduct()
                }
            }

            override fun onBillingServiceDisconnected() {
                // verbindet sich von selbst neu (enableAutoServiceReconnection)
            }
        })
        // Datenschutz-Abfrage bei jedem Start auf den neuesten Stand bringen, Anzeigen erst danach laden
        consent.requestConsentInfoUpdate(act, ConsentRequestParameters.Builder().build(), {
            if (destroyed) return@requestConsentInfoUpdate
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(act) { _ ->
                if (destroyed) return@loadAndShowConsentFormIfRequired
                if (consent.canRequestAds() || TEST) startAds()
                changed()
            }
        }, { _ ->
            if (!destroyed && (consent.canRequestAds() || TEST)) startAds()
        })
        // schon bei einem früheren Start zugestimmt: gleich anfangen
        if (consent.canRequestAds()) startAds()
    }

    /** Activity wird sichtbar: App geöffnet oder zurückgekommen. */
    fun onStart() {
        val skip = skipStart || skipOnce
        skipStart = false
        skipOnce = false
        if (skip || !adDue()) return
        openUntil = SystemClock.uptimeMillis() + OPEN_WAIT_MS
        loadOpen()
    }

    fun onResume() {
        resumed = true
        tryOpen()
        // Käufe auch nachträglich übernehmen (z. B. ausstehende, die inzwischen bestätigt sind)
        if (billing.isReady) restore()
    }

    fun onPause() {
        resumed = false
    }

    fun onStop() {
        openUntil = 0L
        // Neu aufbauen (z. B. andere Sprache gewählt) ist kein erneutes Öffnen der App
        if (act.isChangingConfigurations) skipOnce = true
    }

    fun destroy() {
        destroyed = true
        onChange = null
        handler.removeCallbacks(rewardTimeout)
        try {
            billing.endConnection()
        } catch (e: Exception) {
        }
    }

    override fun leaving() {
        skipStart = true
    }

    // ---------- Freischaltung (Sheet.Gate) ----------

    override fun ok(tier: Int) = Unlock.ok(act, tier)

    /** Freischalten anbieten: Werbevideo (24 Stunden, nur für die Extras) oder Kauf. */
    override fun ask(tier: Int) {
        if (destroyed || act.isFinishing) return
        val buyOnly = tier >= Unlock.BUY
        val canAd = !buyOnly && !Unlock.ok(act, Unlock.DAY_OR_BUY)
        if (canAd) loadReward()
        val b = AlertDialog.Builder(act)
            .setTitle(if (buyOnly) CoreR.string.u_title_buy else CoreR.string.u_title_day)
            .setMessage(if (buyOnly) CoreR.string.u_text_buy else CoreR.string.u_text_day)
            .setPositiveButton(buyLabel()) { _, _ -> buy() }
            .setNegativeButton(CoreR.string.u_cancel, null)
        if (canAd) b.setNeutralButton(CoreR.string.u_ad) { _, _ -> watchAd() }
        b.show()
    }

    override fun privacyRequired(): Boolean =
        consent.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED

    override fun showPrivacy() {
        UserMessagingPlatform.showPrivacyOptionsForm(act) { _ -> changed() }
    }

    override fun testReset() {
        if (!TEST) return
        Unlock.reset(act)
        changed()
    }

    // ---------- Anzeigen ----------

    private fun startAds() {
        if (adsStarted || destroyed) return
        adsStarted = true
        val app = act.applicationContext
        // empfohlen: auf einem eigenen Thread starten (das dauert einen Moment)
        Thread {
            MobileAds.initialize(app) { _ ->
                act.runOnUiThread {
                    if (destroyed) return@runOnUiThread
                    adsReady = true
                    loadOpen()
                    loadReward()
                }
            }
        }.start()
    }

    /** Ist eine App-Start-Anzeige dran? (nicht gekauft, letzte Anzeige mindestens 10 Minuten her) */
    private fun adDue(): Boolean {
        if (Unlock.bought(act) || showing) return false
        val last = prefs.getLong(LAST_AD, 0L)
        val now = System.currentTimeMillis()
        // last > now: die Uhr des Handys wurde zurückgestellt
        return last > now || now - last >= AD_GAP_MS
    }

    private fun markAd() {
        prefs.edit().putLong(LAST_AD, System.currentTimeMillis()).apply()
    }

    private fun loadOpen() {
        if (!adsReady || openLoading || destroyed || Unlock.bought(act)) return
        if (openAd != null && SystemClock.elapsedRealtime() - openAdAt < OPEN_MAX_AGE_MS) {
            tryOpen()
            return
        }
        openAd = null
        openLoading = true
        AppOpenAd.load(act, UNIT_OPEN, AdRequest.Builder().build(), object : AppOpenAd.AppOpenAdLoadCallback() {
            override fun onAdLoaded(ad: AppOpenAd) {
                openLoading = false
                openAd = ad
                openAdAt = SystemClock.elapsedRealtime()
                tryOpen()
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
                openLoading = false
            }
        })
    }

    /** App-Start-Anzeige zeigen, wenn sie dran und geladen ist und die App gerade geöffnet wurde. */
    private fun tryOpen() {
        if (!resumed || destroyed || openUntil == 0L || SystemClock.uptimeMillis() > openUntil || !adDue()) return
        val ad = openAd
        if (ad == null || SystemClock.elapsedRealtime() - openAdAt >= OPEN_MAX_AGE_MS) {
            loadOpen()
            return
        }
        openAd = null
        openUntil = 0L
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                showing = true
                markAd()
            }

            override fun onAdDismissedFullScreenContent() {
                showing = false
                loadOpen()
            }

            override fun onAdFailedToShowFullScreenContent(error: AdError) {
                showing = false
                loadOpen()
            }
        }
        ad.show(act)
    }

    private fun loadReward() {
        if (!adsReady || rewardLoading || reward != null || destroyed) return
        rewardLoading = true
        RewardedAd.load(act, UNIT_REWARD, AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) {
                rewardLoading = false
                reward = ad
                if (rewardWanted) {
                    rewardWanted = false
                    handler.removeCallbacks(rewardTimeout)
                    showReward()
                }
            }

            override fun onAdFailedToLoad(error: LoadAdError) {
                rewardLoading = false
                if (rewardWanted) {
                    rewardWanted = false
                    handler.removeCallbacks(rewardTimeout)
                    toast(CoreR.string.u_ad_none)
                }
            }
        })
    }

    /** „Werbevideo ansehen“: gleich zeigen, sonst laden und zeigen, sobald es da ist (höchstens 15 Sekunden warten). */
    private fun watchAd() {
        if (reward != null) {
            showReward()
            return
        }
        if (!adsStarted) {
            if (consent.canRequestAds() || TEST) startAds()
            else {
                toast(CoreR.string.u_ad_none)
                return
            }
        }
        rewardWanted = true
        toast(CoreR.string.u_ad_loading)
        loadReward()
        handler.removeCallbacks(rewardTimeout)
        handler.postDelayed(rewardTimeout, 15_000L)
    }

    private fun showReward() {
        val ad = reward ?: return
        if (destroyed) return
        reward = null
        var earned = false
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdShowedFullScreenContent() {
                showing = true
                markAd()
            }

            override fun onAdDismissedFullScreenContent() {
                showing = false
                if (earned) {
                    toast(CoreR.string.u_ad_done, DateFormat.getTimeFormat(act).format(Date(Unlock.until(act))))
                    changed()
                } else toast(CoreR.string.u_ad_skip)
                loadReward()
            }

            override fun onAdFailedToShowFullScreenContent(error: AdError) {
                showing = false
                toast(CoreR.string.u_ad_none)
                loadReward()
            }
        }
        // bis zum Ende angesehen: sofort freischalten (falls die App danach beendet wird)
        ad.show(act) { _ ->
            earned = true
            Unlock.grantDay(act)
        }
    }

    // ---------- Kauf ----------

    private fun offer(): ProductDetails.OneTimePurchaseOfferDetails? =
        product?.oneTimePurchaseOfferDetailsList?.firstOrNull()

    private fun buyLabel(): String {
        val price = offer()?.formattedPrice
        return if (price.isNullOrEmpty()) act.getString(CoreR.string.u_buy_np) else act.getString(CoreR.string.u_buy, price)
    }

    private fun queryProduct() {
        val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PRODUCT)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )).build()
        billing.queryProductDetailsAsync(params) { result, details ->
            act.runOnUiThread {
                if (!destroyed && result.responseCode == BillingClient.BillingResponseCode.OK)
                    product = details.productDetailsList.firstOrNull()
            }
        }
    }

    private fun buy() {
        val pd = product
        val of = offer()
        if (pd == null || of == null || !billing.isReady) {
            if (TEST) {
                // Testbetrieb ohne eingerichteten Kauf: nur nachstellen
                Unlock.setBought(act, true)
                toast(CoreR.string.u_test_buy)
                changed()
            } else {
                toast(CoreR.string.u_buy_none)
                if (billing.isReady) queryProduct()
            }
            return
        }
        val pp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd)
        // Angebots-Kennung (fehlt bei älteren Produkten ohne mehrere Kaufoptionen)
        of.offerToken?.let { pp.setOfferToken(it) }
        val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(pp.build())).build()
        val r = billing.launchBillingFlow(act, params)
        when (r.responseCode) {
            BillingClient.BillingResponseCode.OK, BillingClient.BillingResponseCode.USER_CANCELED -> {}
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> restore()
            else -> toast(CoreR.string.u_buy_none)
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        act.runOnUiThread {
            if (destroyed) return@runOnUiThread
            when (result.responseCode) {
                BillingClient.BillingResponseCode.OK -> purchases?.forEach { handle(it, true) }
                BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> restore()
                BillingClient.BillingResponseCode.USER_CANCELED -> {}
                else -> toast(CoreR.string.u_buy_none)
            }
        }
    }

    /** Einen Kauf übernehmen (bestätigen, sonst erstattet Google ihn nach drei Tagen). true = gekauft. */
    private fun handle(pu: Purchase, fresh: Boolean): Boolean {
        if (PRODUCT !in pu.products) return false
        when (pu.purchaseState) {
            Purchase.PurchaseState.PURCHASED -> {
                if (!pu.isAcknowledged) {
                    billing.acknowledgePurchase(
                        AcknowledgePurchaseParams.newBuilder().setPurchaseToken(pu.purchaseToken).build()
                    ) { _ -> }
                }
                if (!Unlock.bought(act)) {
                    Unlock.setBought(act, true)
                    if (fresh) toast(CoreR.string.u_buy_done)
                    changed()
                }
                return true
            }
            Purchase.PurchaseState.PENDING -> if (fresh) toast(CoreR.string.u_buy_pending)
        }
        return false
    }

    /** Gekaufte Produkte von Google Play holen (neues Handy, App neu installiert, Erstattung). */
    private fun restore() {
        billing.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        ) { result, list ->
            act.runOnUiThread {
                if (destroyed || result.responseCode != BillingClient.BillingResponseCode.OK) return@runOnUiThread
                var owned = false
                for (pu in list) if (handle(pu, false)) owned = true
                // nicht (mehr) gekauft, z. B. erstattet; im Testbetrieb bleibt ein nachgestellter Kauf
                if (!owned && !TEST && Unlock.bought(act)) {
                    Unlock.setBought(act, false)
                    changed()
                }
            }
        }
    }

    companion object {
        /** Testbetrieb: Test-Anzeigen, Kauf nachstellbar. Für die Veröffentlichung auf false setzen. */
        const val TEST = true

        /** Anzeigenblöcke (jetzt die Test-IDs von Google; für die Veröffentlichung die eigenen aus AdMob). */
        private const val UNIT_OPEN = "ca-app-pub-3940256099942544/9257395921"
        private const val UNIT_REWARD = "ca-app-pub-3940256099942544/5224354917"

        /** Produkt-ID des Kaufs in der Play Console (einmaliges Produkt). */
        const val PRODUCT = "vollversion"

        /** Mindestabstand der App-Start-Anzeigen. */
        private const val AD_GAP_MS = 10L * 60L * 1000L
        /** So lange nach dem Öffnen darf die App-Start-Anzeige noch erscheinen (falls sie erst geladen werden muss). */
        private const val OPEN_WAIT_MS = 5000L
        /** Geladene App-Start-Anzeigen gelten 4 Stunden. */
        private const val OPEN_MAX_AGE_MS = 4L * 3600L * 1000L

        private const val PREFS = "shop_prefs"
        private const val LAST_AD = "last_ad"

        /** Die Activity wird gerade neu aufgebaut (Sprache, Drehen): Das nächste onStart zählt nicht als Öffnen. */
        private var skipOnce = false
    }
}
