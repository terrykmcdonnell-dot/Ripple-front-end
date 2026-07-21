package com.terrykm.ripplealarmapp

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class RippleAlarmPrefsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RippleAlarmPrefs"

  @ReactMethod
  fun setDefaultSnoozeMinutes(minutes: Int) {
    RippleAlarmPrefs.setDefaultSnoozeMinutes(reactApplicationContext, minutes)
  }

  @ReactMethod
  fun consumePendingActionsAsync(promise: Promise) {
    try {
      val pending = RippleAlarmPrefs.consumePendingActions(reactApplicationContext)
      promise.resolve(pending)
    } catch (e: Exception) {
      promise.reject("ERR_PENDING_ACTIONS", e.message, e)
    }
  }

  @ReactMethod
  fun getDeliveredMapAsync(promise: Promise) {
    try {
      promise.resolve(RippleAlarmPrefs.getDeliveredMapJson(reactApplicationContext))
    } catch (e: Exception) {
      promise.reject("ERR_DELIVERED_MAP", e.message, e)
    }
  }

  @ReactMethod
  fun setAlarmFireDelivered(alarmId: Int, fireAtMs: Double) {
    RippleAlarmPrefs.markAlarmFireDelivered(
      reactApplicationContext,
      alarmId,
      fireAtMs.toLong(),
    )
  }

  @ReactMethod
  fun startAlarmSound(
    soundName: String,
    alarmTitle: String,
    alarmBody: String,
    alarmIdentifier: String,
    alarmPayload: String,
    presentationMode: String,
  ) {
    try {
      val svc = Intent().apply {
        setClassName(reactApplicationContext.packageName, reactApplicationContext.packageName + ".AlarmSoundService")
        putExtra(RippleAlarmNative.EXTRA_SOUND_NAME, soundName)
        putExtra(RippleAlarmNative.EXTRA_ALARM_TITLE, alarmTitle)
        putExtra(RippleAlarmNative.EXTRA_ALARM_BODY, alarmBody)
        putExtra(RippleAlarmNative.EXTRA_ALARM_IDENTIFIER, alarmIdentifier)
        putExtra(RippleAlarmNative.EXTRA_ALARM_PAYLOAD, alarmPayload)
        putExtra("alarmPresentationMode", presentationMode)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactApplicationContext.startForegroundService(svc)
      } else {
        reactApplicationContext.startService(svc)
      }
    } catch (_: Exception) {}
  }

  @ReactMethod
  fun setEnabledAlarmIds(ids: com.facebook.react.bridge.ReadableArray) {
    val enabled = mutableListOf<Int>()
    for (i in 0 until ids.size()) {
      enabled.add(ids.getInt(i))
    }
    RippleAlarmPrefs.setEnabledAlarmIds(reactApplicationContext, enabled)
  }

  @ReactMethod
  fun cancelNativeSnoozeAlarm() {
    RippleAlarmNative.cancelNativeSnooze(reactApplicationContext)
  }

  @ReactMethod
  fun stopAlarmSound() {
    try {
      val stop = Intent().apply {
        setClassName(reactApplicationContext.packageName, reactApplicationContext.packageName + ".AlarmSoundService")
        action = RippleAlarmNative.ACTION_STOP
      }
      reactApplicationContext.startService(stop)
    } catch (_: Exception) {}
  }

  @ReactMethod
  fun canScheduleExactAlarmsAsync(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(true)
        return
      }
      val alarmManager =
        reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      promise.resolve(alarmManager.canScheduleExactAlarms())
    } catch (e: Exception) {
      promise.reject("ERR_EXACT_ALARM", e.message, e)
    }
  }
}
