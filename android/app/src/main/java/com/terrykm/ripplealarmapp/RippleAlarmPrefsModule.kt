package com.terrykm.ripplealarmapp

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
}
