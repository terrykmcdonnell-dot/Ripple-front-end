package com.terrykm.ripplealarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

/**
 * Lightweight trampoline for alarm full-screen intents.
 * Shows over the lock screen immediately, forwards notification extras to MainActivity, then exits.
 */
class AlarmRingLaunchActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    showOverLockScreen()
    forwardToMainActivity(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    showOverLockScreen()
    forwardToMainActivity(intent)
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      keyguard?.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
      )
    }
  }

  private fun forwardToMainActivity(sourceIntent: Intent?) {
    val forward = packageManager.getLaunchIntentForPackage(packageName)
    if (forward != null) {
      sourceIntent?.extras?.let { forward.putExtras(it) }
      forward.putExtra("rippleAlarmFullScreen", true)
      forward.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP,
      )
      startActivity(forward)
    }

    finish()
  }
}
