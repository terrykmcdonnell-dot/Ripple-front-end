package com.terrykm.ripplealarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.AlarmManagerCompat
import expo.modules.notifications.service.NotificationsService
import org.json.JSONObject

object RippleAlarmNative {
  const val EXTRA_SOUND_NAME = "soundName"
  const val EXTRA_ALARM_TITLE = "alarmTitle"
  const val EXTRA_ALARM_BODY = "alarmBody"
  const val EXTRA_ALARM_IDENTIFIER = "alarmIdentifier"
  const val EXTRA_ALARM_PAYLOAD = "alarmPayload"
  const val ACTION_STOP = "com.terrykm.ripplealarm.STOP_ALARM_SOUND"
  private const val SNOOZE_REQUEST_CODE = 880_012

  fun handleDismiss(context: Context, source: Intent?) {
    stopAlarmSound(context)
    dismissExpoNotification(context, source?.getStringExtra(EXTRA_ALARM_IDENTIFIER))
    queueAction(context, source, "dismiss", 0)
  }

  fun handleSnooze(context: Context, source: Intent?, minutes: Int) {
    stopAlarmSound(context)
    dismissExpoNotification(context, source?.getStringExtra(EXTRA_ALARM_IDENTIFIER))
    queueAction(context, source, "snooze", minutes)
    scheduleNativeSnooze(context, source, minutes)
  }

  private fun stopAlarmSound(context: Context) {
    try {
      val stop = Intent().apply {
        setClassName(context.packageName, context.packageName + ".AlarmSoundService")
        action = ACTION_STOP
      }
      context.startService(stop)
    } catch (e: Exception) {
      Log.w("RippleAlarmNative", "Stop alarm sound failed: " + e.message)
    }
  }

  private fun dismissExpoNotification(context: Context, identifier: String?) {
    if (identifier.isNullOrBlank()) return
    try {
      NotificationsService.dismiss(context, arrayOf(identifier), null)
    } catch (e: Exception) {
      Log.w("RippleAlarmNative", "Dismiss notification failed: " + e.message)
    }
  }

  private fun queueAction(context: Context, source: Intent?, type: String, snoozeMinutes: Int) {
    val payload = source?.getStringExtra(EXTRA_ALARM_PAYLOAD) ?: return
    try {
      val json = JSONObject(payload)
      val line = JSONObject()
        .put("type", type)
        .put("alarmId", json.opt("alarmId"))
        .put("fireAt", json.optString("fireAt", ""))
        .put("label", json.optString("label", "Alarm"))
        .put("category", json.optString("category", ""))
        .put("soundId", json.optString("soundId", ""))
        .put("userId", json.opt("userId"))
        .put("snoozeMinutes", snoozeMinutes)
        .put("alarmIdentifier", source.getStringExtra(EXTRA_ALARM_IDENTIFIER) ?: "")
        .toString()
      RippleAlarmPrefs.appendPendingAction(context, line)
    } catch (e: Exception) {
      Log.w("RippleAlarmNative", "Queue action failed: " + e.message)
    }
  }

  private fun scheduleNativeSnooze(context: Context, source: Intent?, minutes: Int) {
    if (source == null) return
    val triggerAt = System.currentTimeMillis() + minutes.coerceAtLeast(1) * 60_000L
    val snoozeIntent = Intent(context, AlarmSnoozeReceiver::class.java).apply {
      putExtra(EXTRA_SOUND_NAME, source.getStringExtra(EXTRA_SOUND_NAME) ?: "")
      putExtra(EXTRA_ALARM_TITLE, source.getStringExtra(EXTRA_ALARM_TITLE) ?: "Alarm")
      putExtra(EXTRA_ALARM_BODY, source.getStringExtra(EXTRA_ALARM_BODY) ?: "Ringing")
      putExtra(EXTRA_ALARM_IDENTIFIER, "ripple_snooze_" + System.currentTimeMillis())
      putExtra(EXTRA_ALARM_PAYLOAD, source.getStringExtra(EXTRA_ALARM_PAYLOAD) ?: "")
    }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val operation = PendingIntent.getBroadcast(context, SNOOZE_REQUEST_CODE, snoozeIntent, flags)
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        val info = AlarmManager.AlarmClockInfo(triggerAt, operation)
        alarmManager.setAlarmClock(info, operation)
      } else {
        AlarmManagerCompat.setExactAndAllowWhileIdle(
          alarmManager,
          AlarmManager.RTC_WAKEUP,
          triggerAt,
          operation,
        )
      }
    } catch (e: Exception) {
      Log.w("RippleAlarmNative", "Schedule snooze failed: " + e.message)
    }
  }
}
