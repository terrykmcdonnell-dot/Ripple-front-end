package com.terrykm.ripplealarm

import android.app.Activity
import android.app.ActivityOptions
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

/**
 * Native full-screen alarm presenter shown immediately on the lock screen.
 * MainActivity (React Native) is too slow for Android FSI timing on Android 14+;
 * this opaque activity satisfies the system while RN loads the ring screen.
 */
class AlarmWakeActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLockScreenFlags()
    renderAlarmUi()
    forwardToMainActivity(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyLockScreenFlags()
    renderAlarmUi()
    forwardToMainActivity(intent)
  }

  private fun renderAlarmUi() {
    val title = intent?.getStringExtra("alarmTitle") ?: "Alarm"
    val body = intent?.getStringExtra("alarmBody") ?: "Ringing"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0a1423"))
      setPadding(48, 48, 48, 48)
    }
    val titleView = TextView(this).apply {
      text = title
      setTextColor(Color.WHITE)
      textSize = 28f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }
    val bodyView = TextView(this).apply {
      text = body
      setTextColor(Color.parseColor("#8fa3bf"))
      textSize = 18f
      gravity = Gravity.CENTER
      setPadding(0, 24, 0, 0)
    }
    root.addView(titleView)
    root.addView(bodyView)
    setContentView(root)
  }

  private fun applyLockScreenFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      keyguardManager.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun forwardToMainActivity(sourceIntent: Intent?) {
    val payload = sourceIntent?.getStringExtra("alarmPayload")
    val deepLink = buildAlarmRingDeepLink(payload)
    val forward = Intent().apply {
      setClassName(packageName, packageName + ".MainActivity")
      action = Intent.ACTION_VIEW
      deepLink?.let { data = it }
      sourceIntent?.extras?.let { putExtras(it) }
      putExtra("rippleAlarmFullScreen", true)
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP,
      )
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val options = ActivityOptions.makeBasic()
      options.setPendingIntentBackgroundActivityStartMode(
        ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED,
      )
      startActivity(forward, options.toBundle())
    } else {
      startActivity(forward)
    }
  }

  private fun buildAlarmRingDeepLink(payload: String?): Uri? {
    if (payload.isNullOrBlank()) return null
    return try {
      val json = JSONObject(payload)
      val builder = Uri.Builder()
        .scheme("alarm-app")
        .authority("alarm-ring")
      fun appendIfPresent(key: String, value: String?) {
        if (!value.isNullOrBlank()) builder.appendQueryParameter(key, value)
      }
      appendIfPresent("alarmId", json.opt("alarmId")?.toString())
      appendIfPresent("fireAt", json.optString("fireAt", ""))
      appendIfPresent("label", json.optString("label", "Alarm"))
      appendIfPresent("category", json.optString("category", ""))
      appendIfPresent("soundId", json.optString("soundId", ""))
      appendIfPresent("userId", json.opt("userId")?.toString())
      builder.build()
    } catch (_: Exception) {
      null
    }
  }

  override fun onStop() {
    super.onStop()
    if (!isChangingConfigurations) {
      finish()
    }
  }
}
