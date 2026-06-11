package com.terrykm.ripplealarm

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
}
