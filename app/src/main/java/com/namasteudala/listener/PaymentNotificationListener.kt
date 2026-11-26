
package com.namasteudala.listener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread
import kotlin.math.abs

class PaymentNotificationListener : NotificationListenerService() {

    private val dbBase = "https://namaste-udala-default-rtdb.firebaseio.com/udala_v4_master"

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val extras = sbn?.notification?.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val fullMsg = listOf(title, text, bigText).filter { it.isNotBlank() }.joinToString(" ")

        if (fullMsg.isBlank()) return
        if (!Regex("(₹|rs\\.?|inr|utr|upi|paid|received|credited)", RegexOption.IGNORE_CASE).containsMatchIn(fullMsg)) return

        val utr = Regex("\\b(\\d{12})\\b").find(fullMsg)?.groupValues?.getOrNull(1)
            ?: Regex("(?:utr|ref(?:erence)?|upi\\s*ref)[^0-9]*(\\d{10,16})", RegexOption.IGNORE_CASE)
                .find(fullMsg)?.groupValues?.getOrNull(1).orEmpty()

        val amtStr = Regex("(?:rs\\.?|inr|₹|paid|received|credited)\\s*[:\\-]?\\s*([0-9]+(?:\\.[0-9]{1,2})?)", RegexOption.IGNORE_CASE)
            .find(fullMsg)?.groupValues?.getOrNull(1)
            ?: Regex("([0-9]+(?:\\.[0-9]{1,2})?)\\s*(?:rs\\.?|inr|₹)", RegexOption.IGNORE_CASE)
                .find(fullMsg)?.groupValues?.getOrNull(1)

        val amount = amtStr?.toDoubleOrNull()
        if (utr.isBlank() && (amount == null || amount <= 0.0)) return

        thread {
            try {
                if (!tryMatchAndPatch("foodOrders", "Confirmed", utr, amount)) {
                    tryMatchAndPatch("kiranaOrders", "Packed", utr, amount)
                }
            } catch (_: Exception) {
            }
        }
    }

    private fun tryMatchAndPatch(nodeName: String, nextStatus: String, utr: String, amount: Double?): Boolean {
        val raw = httpGet("$dbBase/$nodeName.json") ?: return false
        if (raw == "null" || !raw.startsWith("[")) return false

        val arr = JSONArray(raw)
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val payMode = obj.optString("payMode")
            val verified = obj.optBoolean("utrVerified", false)
            val status = obj.optString("status")
            if (payMode != "UPI" || verified || status == "Cancelled") continue

            val orderUtr = obj.optString("utr")
            val total = obj.optDouble("total", 0.0)
            val utrMatched = utr.isNotBlank() && orderUtr.contains(utr)
            val amtMatched = amount != null && amount > 0.0 && abs(total - amount) < 0.01

            if (utrMatched || amtMatched) {
                val patch = JSONObject().apply {
                    put("utrVerified", true)
                    if (utr.isNotBlank() && orderUtr.isBlank()) put("utr", utr)
                    if (status == "Placed") put("status", nextStatus)
                }
                httpPatch("$dbBase/$nodeName/$i.json", patch.toString())
                httpPatch("$dbBase.json", JSONObject().put("rev", System.currentTimeMillis()).toString())
                return true
            }
        }
        return false
    }

    private fun httpGet(urlStr: String): String? {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 8000
            readTimeout = 8000
        }
        return conn.inputStream.bufferedReader().use { it.readText() }
    }

    private fun httpPatch(urlStr: String, jsonBody: String) {
        val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("X-HTTP-Method-Override", "PATCH")
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 8000
            readTimeout = 8000
        }
        conn.outputStream.use { it.write(jsonBody.toByteArray(Charsets.UTF_8)) }
        conn.responseCode
    }
}
