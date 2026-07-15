package com.terrykm.ripplealarmapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class AlarmSnoozeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!RippleAlarmNative.isNativeAlarmDeliveryAllowed(context, intent)) {
      RippleAlarmNative.dismissStaleAlarmDelivery(context, intent)
      return
    }
    val svcIntent = Intent().apply {
      setClassName(context.packageName, context.packageName + ".AlarmSoundService")
      putExtra(RippleAlarmNative.EXTRA_SOUND_NAME, intent.getStringExtra(RippleAlarmNative.EXTRA_SOUND_NAME) ?: "")
      putExtra(
        RippleAlarmNative.EXTRA_ALARM_TITLE,
        "Snooze · " + (intent.getStringExtra(RippleAlarmNative.EXTRA_ALARM_TITLE) ?: "Alarm"),
      )
      putExtra(RippleAlarmNative.EXTRA_ALARM_BODY, intent.getStringExtra(RippleAlarmNative.EXTRA_ALARM_BODY) ?: "Ringing")
      putExtra(RippleAlarmNative.EXTRA_ALARM_IDENTIFIER, intent.getStringExtra(RippleAlarmNative.EXTRA_ALARM_IDENTIFIER) ?: "")
      putExtra(RippleAlarmNative.EXTRA_ALARM_PAYLOAD, intent.getStringExtra(RippleAlarmNative.EXTRA_ALARM_PAYLOAD) ?: "")
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(svcIntent)
    } else {
      context.startService(svcIntent)
    }
  }
}
