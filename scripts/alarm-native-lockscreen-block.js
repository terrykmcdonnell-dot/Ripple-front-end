/**
 * Native lock-screen alarm UI and helpers (AlarmWakeActivity, snooze receiver, prefs).
 * Used by plugins/with-android-alarm-native-lockscreen.js
 */

const ALARM_WAKE_ACTIVITY_KOTLIN = `package PACKAGE_NAME

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

    val snoozeButton = makeActionButton("Snooze \${snoozeMinutes}m", Color.parseColor("#1e3a5f")) {
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
`;

const RIPPLE_ALARM_PREFS_KOTLIN = `package PACKAGE_NAME

import android.content.Context

object RippleAlarmPrefs {
  private const val PREFS_NAME = "ripple_alarm_native"
  private const val KEY_SNOOZE_MINUTES = "default_snooze_minutes"
  private const val KEY_PENDING_ACTIONS = "pending_alarm_actions"
  private const val KEY_DELIVERED = "alarm_fire_delivered"
  private const val KEY_ENABLED_ALARM_IDS = "enabled_alarm_ids"
  private const val KEY_ENABLED_ALARM_IDS_KNOWN = "enabled_alarm_ids_known"
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
    val updated = if (existing.isBlank()) jsonLine else existing + "\\n" + jsonLine
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

  fun setEnabledAlarmIds(context: Context, ids: Collection<Int>) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_ENABLED_ALARM_IDS, ids.joinToString(","))
      .putBoolean(KEY_ENABLED_ALARM_IDS_KNOWN, true)
      .apply()
  }

  fun hasEnabledAlarmSnapshot(context: Context): Boolean {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_ENABLED_ALARM_IDS_KNOWN, false)
  }

  fun getEnabledAlarmIds(context: Context): Set<Int> {
    val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_ENABLED_ALARM_IDS, "") ?: ""
    if (raw.isBlank()) {
      return emptySet()
    }
    return raw.split(",").mapNotNull { it.toIntOrNull() }.toSet()
  }
}
`;

const RIPPLE_ALARM_NATIVE_KOTLIN = `package PACKAGE_NAME

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
  const val ACTION_DISMISS = "PACKAGE_NAME.ALARM_ACTION_DISMISS"
  const val ACTION_SNOOZE = "PACKAGE_NAME.ALARM_ACTION_SNOOZE"
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

  @JvmStatic
  fun isNativeAlarmDeliveryAllowed(context: Context, intent: Intent?): Boolean {
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
`;

const ALARM_ACTION_RECEIVER_KOTLIN = `package PACKAGE_NAME

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
`;

const ALARM_SNOOZE_RECEIVER_KOTLIN = `package PACKAGE_NAME

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
`;

const RIPPLE_ALARM_PREFS_MODULE_KOTLIN = `package PACKAGE_NAME

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
`;

const RIPPLE_ALARM_PREFS_PACKAGE_KOTLIN = `package PACKAGE_NAME

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RippleAlarmPrefsPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(RippleAlarmPrefsModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

module.exports = {
  ALARM_WAKE_ACTIVITY_KOTLIN,
  RIPPLE_ALARM_PREFS_KOTLIN,
  RIPPLE_ALARM_NATIVE_KOTLIN,
  ALARM_ACTION_RECEIVER_KOTLIN,
  ALARM_SNOOZE_RECEIVER_KOTLIN,
  RIPPLE_ALARM_PREFS_MODULE_KOTLIN,
  RIPPLE_ALARM_PREFS_PACKAGE_KOTLIN,
};
