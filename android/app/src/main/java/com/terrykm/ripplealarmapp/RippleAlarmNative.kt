package com.terrykm.ripplealarmapp

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.AlarmManagerCompat
import expo.modules.notifications.service.NotificationsService
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject

object RippleAlarmNative {
  const val ACTION_DISMISS = "com.terrykm.ripplealarmapp.ALARM_ACTION_DISMISS"
  const val ACTION_SNOOZE = "com.terrykm.ripplealarmapp.ALARM_ACTION_SNOOZE"
  const val EXTRA_SOUND_NAME = "soundName"
  const val EXTRA_ALARM_TITLE = "alarmTitle"
  const val EXTRA_ALARM_BODY = "alarmBody"
  const val EXTRA_ALARM_IDENTIFIER = "alarmIdentifier"
  const val EXTRA_ALARM_PAYLOAD = "alarmPayload"
  const val ACTION_STOP = "com.terrykm.ripplealarmapp.STOP_ALARM_SOUND"
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

  fun handleMissed(context: Context, source: Intent?) {
    dismissExpoNotification(context, source?.getStringExtra(EXTRA_ALARM_IDENTIFIER))
    queueAction(context, source, "missed", 0)
  }

  /** Cancels a native AlarmManager snooze scheduled from the lock-screen UI. */
  @JvmStatic
  fun cancelNativeSnooze(context: Context) {
    val snoozeIntent = Intent(context, AlarmSnoozeReceiver::class.java)
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    } else {
      PendingIntent.FLAG_UPDATE_CURRENT
    }
    val operation = PendingIntent.getBroadcast(context, SNOOZE_REQUEST_CODE, snoozeIntent, flags)
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarmManager.cancel(operation)
  }

  @JvmStatic
  fun parseAlarmIdFromIntent(intent: Intent?): Int? {
    val identifier = intent?.getStringExtra(EXTRA_ALARM_IDENTIFIER) ?: ""
    if (identifier.startsWith("ripple_alarm_fire_")) {
      val parts = identifier.split("_")
      if (parts.size >= 5) {
        return parts[parts.size - 2].toIntOrNull()
      }
    }
    val payload = intent?.getStringExtra(EXTRA_ALARM_PAYLOAD) ?: return null
    return try {
      val alarmId = JSONObject(payload).optInt("alarmId", -1)
      if (alarmId > 0) alarmId else null
    } catch (_: Exception) {
      null
    }
  }

  /**
   * Blocks stale OS deliveries on background / lock screen before native sound starts.
   * Fails open when JS has never synced (fresh install) or alarm id cannot be parsed.
   *
   * Foreground ring-screen playback uses `ripple_alarm_foreground_*` identifiers — JS has
   * already validated the alarm via `isAlarmFireDeliveryAllowed` before starting the service,
   * so skip the native snapshot check (which can be stale right after an in-place app update).
   */
  @JvmStatic
  fun isNativeAlarmDeliveryAllowed(context: Context, intent: Intent?): Boolean {
    val identifier = intent?.getStringExtra(EXTRA_ALARM_IDENTIFIER) ?: ""
    if (identifier.startsWith("ripple_alarm_foreground_")) {
      return true
    }
    if (!RippleAlarmPrefs.hasEnabledAlarmSnapshot(context)) {
      return true
    }
    val enabledIds = RippleAlarmPrefs.getEnabledAlarmIds(context)
    if (enabledIds.isEmpty()) {
      return false
    }
    val alarmId = parseAlarmIdFromIntent(intent) ?: return true
    return enabledIds.contains(alarmId)
  }

  @JvmStatic
  fun dismissStaleAlarmDelivery(context: Context, intent: Intent?) {
    stopAlarmSound(context)
    dismissExpoNotification(context, intent?.getStringExtra(EXTRA_ALARM_IDENTIFIER))
  }

  /** Marks an alarm occurrence as delivered so sync does not re-fire it in the grace window. */
  @JvmStatic
  fun markAlarmFired(context: Context, identifier: String?, payloadJson: String?) {
    if (identifier.isNullOrBlank() || !identifier.startsWith("ripple_alarm_fire_")) {
      return
    }
    val parts = identifier.split("_")
    if (parts.size < 5) {
      return
    }
    val alarmId = parts[parts.size - 2].toIntOrNull() ?: return
    val fireAtMs = parts.last().toLongOrNull() ?: return
    RippleAlarmPrefs.markAlarmFireDelivered(context, alarmId, fireAtMs)
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
        .put("actionAt", utcNowIso())
        .put("alarmIdentifier", source.getStringExtra(EXTRA_ALARM_IDENTIFIER) ?: "")
        .toString()
      RippleAlarmPrefs.appendPendingAction(context, line)
    } catch (e: Exception) {
      Log.w("RippleAlarmNative", "Queue action failed: " + e.message)
    }
  }

  private fun utcNowIso(): String {
    val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
    format.timeZone = TimeZone.getTimeZone("UTC")
    return format.format(Date())
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
