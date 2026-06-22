package com.terrykm.ripplealarmapp

import android.content.Context

object RippleAlarmPrefs {
  private const val PREFS_NAME = "ripple_alarm_native"
  private const val KEY_SNOOZE_MINUTES = "default_snooze_minutes"
  private const val KEY_PENDING_ACTIONS = "pending_alarm_actions"
  private const val KEY_DELIVERED = "alarm_fire_delivered"
  private const val DEFAULT_SNOOZE_MINUTES = 10

  fun getDefaultSnoozeMinutes(context: Context): Int {
    val stored = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getInt(KEY_SNOOZE_MINUTES, DEFAULT_SNOOZE_MINUTES)
    return if (stored > 0) stored else DEFAULT_SNOOZE_MINUTES
  }

  fun setDefaultSnoozeMinutes(context: Context, minutes: Int) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putInt(KEY_SNOOZE_MINUTES, minutes.coerceAtLeast(1))
      .apply()
  }

  fun appendPendingAction(context: Context, jsonLine: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = prefs.getString(KEY_PENDING_ACTIONS, "") ?: ""
    val updated = if (existing.isBlank()) jsonLine else existing + "\n" + jsonLine
    prefs.edit().putString(KEY_PENDING_ACTIONS, updated).apply()
  }

  fun consumePendingActions(context: Context): String {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val existing = prefs.getString(KEY_PENDING_ACTIONS, "") ?: ""
    prefs.edit().remove(KEY_PENDING_ACTIONS).apply()
    return existing
  }

  fun markAlarmFireDelivered(context: Context, alarmId: Int, fireAtMs: Long) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_DELIVERED, "{}") ?: "{}"
    val map = try {
      org.json.JSONObject(raw)
    } catch (_: Exception) {
      org.json.JSONObject()
    }
    val key = alarmId.toString()
    val existing = map.optLong(key, Long.MIN_VALUE)
    if (existing < fireAtMs) {
      map.put(key, fireAtMs)
      prefs.edit().putString(KEY_DELIVERED, map.toString()).apply()
    }
  }

  fun getDeliveredMapJson(context: Context): String {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_DELIVERED, "{}") ?: "{}"
  }
}
