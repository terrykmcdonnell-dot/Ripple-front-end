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
    private const val FOREGROUND_NOTIF_ID = 9_001
    private const val CHANNEL_ID = "ripple_alarm_svc_v1"
    private const val AUTO_STOP_MS = 90_000L
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopPlayback()
      stopSelf()
      return START_NOT_STICKY
    }
    ensureChannel()
    val notification = buildNotification()
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
        "Alarm Sound Service",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        setSound(null, null)
        enableVibration(false)
      }
      (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
        .createNotificationChannel(chan)
    }
  }

  private fun buildNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    else
      PendingIntent.FLAG_UPDATE_CURRENT
    val contentPi = launchIntent?.let { PendingIntent.getActivity(this, 0, it, piFlags) }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Ripple Alarm")
      .setContentText("Alarm ringing…")
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setSilent(true)
      .setOngoing(true)
      .apply { if (contentPi != null) setContentIntent(contentPi) }
      .build()
  }

  override fun onDestroy() {
    handler.removeCallbacks(autoStopRunnable)
    stopPlayback()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null
}
