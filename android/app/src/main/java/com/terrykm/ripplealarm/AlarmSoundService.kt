package com.terrykm.ripplealarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.ActivityOptions
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
 * Started by ExpoSchedulingDelegate when an alarm fires; stopped when MainActivity
 * opens so the ring screen's expo-av takes over.
 */
class AlarmSoundService : Service() {
  private var mediaPlayer: MediaPlayer? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStopRunnable = Runnable { stopSelf() }

  companion object {
    const val ACTION_STOP = "com.terrykm.ripplealarm.STOP_ALARM_SOUND"
    const val EXTRA_SOUND_NAME = "soundName"
    const val EXTRA_ALARM_TITLE = "alarmTitle"
    const val EXTRA_ALARM_BODY = "alarmBody"
    const val EXTRA_ALARM_IDENTIFIER = "alarmIdentifier"
    const val EXTRA_ALARM_PAYLOAD = "alarmPayload"
    private const val FOREGROUND_NOTIF_ID = 9_001
    private const val CHANNEL_ID = "ripple_alarm_fullscreen_v2"
    private const val AUTO_STOP_MS = 90_000L
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopPlayback()
      stopSelf()
      return START_NOT_STICKY
    }
    ensureChannel()
    val notification = buildNotification(intent)
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

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val chan = NotificationChannel(
        CHANNEL_ID,
        "Full-screen Alarms",
        NotificationManager.IMPORTANCE_HIGH
      ).apply {
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setSound(null, null)
        enableVibration(false)
      }
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
        .createNotificationChannel(chan)
    }
  }

  private fun buildNotification(sourceIntent: Intent?): Notification {
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
    val alarmPi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val options = ActivityOptions.makeBasic()
      options.setPendingIntentBackgroundActivityStartMode(
        ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
      )
      PendingIntent.getActivity(this, requestCode, alarmIntent, piFlags, options.toBundle())
    } else {
      PendingIntent.getActivity(this, requestCode, alarmIntent, piFlags)
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(title)
      .setContentText(body)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setFullScreenIntent(alarmPi, true)
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(alarmPi)
      .build()
  }

  override fun onDestroy() {
    handler.removeCallbacks(autoStopRunnable)
    stopPlayback()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
