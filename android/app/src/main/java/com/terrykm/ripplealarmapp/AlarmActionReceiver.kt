package com.terrykm.ripplealarmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      RippleAlarmNative.ACTION_DISMISS -> {
        RippleAlarmNative.handleDismiss(context, intent)
      }
      RippleAlarmNative.ACTION_SNOOZE -> {
        RippleAlarmNative.handleSnooze(
          context,
          intent,
          RippleAlarmPrefs.getDefaultSnoozeMinutes(context),
        )
      }
    }
  }
}
