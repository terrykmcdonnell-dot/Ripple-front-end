package com.terrykm.ripplealarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Plays the alarm sound in a loop on STREAM_ALARM (bypasses ringer/silent mode).
 * Started by ExpoSchedulingDelegate when an alarm fires in background or on lock screen.
 * Presentation mode controls heads-up banner vs full-screen intent only.
 */
class AlarmSoundService : Service() {
  private var mediaPlayer: MediaPlayer? = null
  private val handler = Handler(Looper.getMainLooper())
  private var activeAlarmIntent: Intent? = null
  private val autoStopRunnable = Runnable {
    RippleAlarmNative.handleMissed(this, activeAlarmIntent)
    activeAlarmIntent = null
    stopSelf()
  }

  companion object {
    const val ACTION_STOP = "com.terrykm.ripplealarm.STOP_ALARM_SOUND"
    const val EXTRA_SOUND_NAME = "soundName"
    const val EXTRA_ALARM_TITLE = "alarmTitle"
    const val EXTRA_ALARM_BODY = "alarmBody"
    const val EXTRA_ALARM_IDENTIFIER = "alarmIdentifier"
    const val EXTRA_ALARM_PAYLOAD = "alarmPayload"
    const val EXTRA_ALARM_PRESENTATION_MODE = "alarmPresentationMode"
    const val MODE_LOCKSCREEN = "lockscreen"
    const val MODE_BACKGROUND = "background"
    private const val FOREGROUND_NOTIF_ID = 9_001
    private const val CHANNEL_LOCKSCREEN = "ripple_alarm_lockscreen_v1"
    private const val CHANNEL_BACKGROUND = "ripple_alarm_background_v1"
    private const val AUTO_STOP_MS = 5 * 60 * 1_000L
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      activeAlarmIntent = null
      stopPlayback()
      stopSelf()
      return START_NOT_STICKY
    }
    activeAlarmIntent = intent?.let { Intent(it) }
    val mode = intent?.getStringExtra(EXTRA_ALARM_PRESENTATION_MODE) ?: MODE_LOCKSCREEN
    RippleAlarmNative.markAlarmFired(
      this,
      intent?.getStringExtra(EXTRA_ALARM_IDENTIFIER),
      intent?.getStringExtra(EXTRA_ALARM_PAYLOAD),
    )
    ensureChannels()
    val notification = buildNotification(intent, mode)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(FOREGROUND_NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(FOREGROUND_NOTIF_ID, notification)
    }
    startPlayback(intent?.getStringExtra(EXTRA_SOUND_NAME) ?: "")
    handler.removeCallbacks(autoStopRunnable)
    handler.postDelayed(autoStopRunnable, AUTO_STOP_MS)
    return START_NOT_STICKY
  }

  private fun startPlayback(soundName: String) {
    stopPlayback()
    val baseName = soundName
      .substringBeforeLast('.')
      .lowercase()
      .replace('-', '_')
      .replace(' ', '_')
    if (baseName.isEmpty()) {
      Log.w("AlarmSoundService", "Empty sound name; skipping playback.")
      return
    }
    val resId = resources.getIdentifier(baseName, "raw", packageName)
    if (resId == 0) {
      Log.w("AlarmSoundService", "Sound resource not found: $baseName")
      return
    }
    try {
      val mp = MediaPlayer()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        mp.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
            .build()
        )
      } else {
        @Suppress("DEPRECATION")
        mp.setAudioStreamType(AudioManager.STREAM_ALARM)
      }
      resources.openRawResourceFd(resId)?.use { afd ->
        mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
      }
      mp.isLooping = true
      mp.prepare()
      mp.start()
      mediaPlayer = mp
      Log.d("AlarmSoundService", "Playing $baseName on STREAM_ALARM.")
    } catch (e: Exception) {
      Log.e("AlarmSoundService", "Playback error: ${e.message}")
    }
  }

  private fun stopPlayback() {
    try { mediaPlayer?.stop() } catch (_: Exception) {}
    try { mediaPlayer?.release() } catch (_: Exception) {}
    mediaPlayer = null
  }

  private fun ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    val lockscreenChan = NotificationChannel(
      CHANNEL_LOCKSCREEN,
      "Lock-screen Alarms",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setSound(null, null)
      enableVibration(false)
      setShowBadge(false)
    }
    val backgroundChan = NotificationChannel(
      CHANNEL_BACKGROUND,
      "Alarm Alerts",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setSound(null, null)
      enableVibration(true)
    }
    nm.createNotificationChannel(lockscreenChan)
    nm.createNotificationChannel(backgroundChan)
  }

  private fun buildNotification(sourceIntent: Intent?, mode: String): Notification {
    val title = sourceIntent?.getStringExtra(EXTRA_ALARM_TITLE)?.takeIf { it.isNotBlank() } ?: "Ripple Alarm"
    val body = sourceIntent?.getStringExtra(EXTRA_ALARM_BODY)?.takeIf { it.isNotBlank() } ?: "Alarm ringing"
    val alarmIntent = Intent().apply {
      setClassName(packageName, packageName + ".AlarmWakeActivity")
      putExtra("rippleAlarmFullScreen", true)
      putExtra("alarmTitle", title)
      putExtra("alarmBody", body)
      sourceIntent?.getStringExtra(EXTRA_ALARM_PAYLOAD)?.let { putExtra(EXTRA_ALARM_PAYLOAD, it) }
      sourceIntent?.extras?.let { putExtras(it) }
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_NO_USER_ACTION
      )
    }
    val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    else
      PendingIntent.FLAG_UPDATE_CURRENT
    val requestCode = (sourceIntent?.getStringExtra(EXTRA_ALARM_IDENTIFIER) ?: "ripple_alarm_fullscreen").hashCode()
    val alarmPi = PendingIntent.getActivity(this, requestCode, alarmIntent, piFlags)
    val isBackground = mode == MODE_BACKGROUND
    val channelId = if (isBackground) CHANNEL_BACKGROUND else CHANNEL_LOCKSCREEN
    val builder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(alarmPi)
      .addAction(
        android.R.drawable.ic_media_pause,
        "Snooze",
        buildActionPendingIntent(sourceIntent, RippleAlarmNative.ACTION_SNOOZE, "snooze"),
      )
      .addAction(
        android.R.drawable.ic_menu_close_clear_cancel,
        "Dismiss",
        buildActionPendingIntent(sourceIntent, RippleAlarmNative.ACTION_DISMISS, "dismiss"),
      )
    if (isBackground) {
      builder
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
    } else {
      // Lock screen: keep the alarm notification strong enough for Android to launch FSI.
      builder
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setFullScreenIntent(alarmPi, true)
    }
    return builder.build()
  }

  private fun buildActionPendingIntent(sourceIntent: Intent?, action: String, suffix: String): PendingIntent {
    val actionIntent = Intent(this, AlarmActionReceiver::class.java).apply {
      this.action = action
      sourceIntent?.extras?.let { putExtras(it) }
    }
    val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    else
      PendingIntent.FLAG_UPDATE_CURRENT
    val requestCode = ((sourceIntent?.getStringExtra(EXTRA_ALARM_IDENTIFIER) ?: "ripple_alarm") + "_" + suffix).hashCode()
    return PendingIntent.getBroadcast(this, requestCode, actionIntent, piFlags)
  }

  override fun onDestroy() {
    handler.removeCallbacks(autoStopRunnable)
    stopPlayback()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
