package com.terrykm.ripplealarm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Clock-style lock-screen alarm UI. Stays on the lock screen; does not open React Native.
 */
class AlarmWakeActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    applyLockScreenFlags()
    renderAlarmUi()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyLockScreenFlags()
    renderAlarmUi()
  }

  private fun renderAlarmUi() {
    val title = intent?.getStringExtra(RippleAlarmNative.EXTRA_ALARM_TITLE)?.takeIf { it.isNotBlank() } ?: "Alarm"
    val body = intent?.getStringExtra(RippleAlarmNative.EXTRA_ALARM_BODY)?.takeIf { it.isNotBlank() } ?: "Ringing"
    val snoozeMinutes = RippleAlarmPrefs.getDefaultSnoozeMinutes(this)

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
      setPadding(0, 16, 0, 48)
    }

    val snoozeButton = makeActionButton("Snooze ${snoozeMinutes}m", Color.parseColor("#1e3a5f")) {
      RippleAlarmNative.handleSnooze(this, intent, snoozeMinutes)
      finishLockScreen()
    }
    val dismissButton = makeActionButton("Dismiss", Color.parseColor("#3d1f28")) {
      RippleAlarmNative.handleDismiss(this, intent)
      finishLockScreen()
    }

    val actions = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }
    val buttonLp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
      marginEnd = 12
    }
    val dismissLp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
      marginStart = 12
    }
    actions.addView(snoozeButton, buttonLp)
    actions.addView(dismissButton, dismissLp)

    root.addView(titleView)
    root.addView(bodyView)
    root.addView(actions)
    setContentView(root)
  }

  private fun makeActionButton(label: String, bg: Int, onClick: () -> Unit): Button {
    return Button(this).apply {
      text = label
      setTextColor(Color.WHITE)
      textSize = 16f
      isAllCaps = false
      background = GradientDrawable().apply {
        cornerRadius = 24f
        setColor(bg)
      }
      setOnClickListener { onClick() }
    }
  }

  private fun applyLockScreenFlags() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun finishLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      finishAndRemoveTask()
    } else {
      finish()
    }
  }
}
