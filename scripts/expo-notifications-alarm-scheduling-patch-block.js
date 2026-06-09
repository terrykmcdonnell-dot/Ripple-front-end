/** Kotlin patches ExpoSchedulingDelegate.kt for lock-screen alarm takeover. */
const MARKER_SCHEDULING = 'Ripple alarm scheduling v4';
const MARKER_SCHEDULING_LEGACY = [
  'Ripple alarm scheduling v1',
  'Ripple alarm scheduling v2',
  'Ripple alarm scheduling v3',
  'Ripple alarm scheduling v4',
];

const IMPORT_LINES = [
  'import android.app.ActivityOptions',
  'import android.content.Intent',
  'import expo.modules.notifications.notifications.model.Notification',
  'import expo.modules.notifications.notifications.model.NotificationAction',
  'import expo.modules.notifications.notifications.model.NotificationResponse',
];

const TRIGGER_REPLACEMENT = `  override fun triggerNotification(identifier: String) {
    try {
      val notificationRequest: NotificationRequest = store.getNotificationRequest(identifier)!!
      val isRippleAlarm = identifier.startsWith("ripple_alarm_fire_")
      // Ripple alarm scheduling v4 — synchronous AlarmWakeActivity launch then FSI notification.
      if (isRippleAlarm) {
        // 1. Start alarm sound foreground service immediately.
        try {
          val svcIntent = android.content.Intent().apply {
            setClassName(context.packageName, context.packageName + ".AlarmSoundService")
            putExtra("soundName", notificationRequest.content.soundName ?: "")
          }
          if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(svcIntent)
          } else {
            context.startService(svcIntent)
          }
        } catch (e: Exception) {
          Log.w("expo-notifications", "Ripple AlarmSoundService start failed: " + e.message)
        }
        // 2. Launch AlarmWakeActivity SYNCHRONOUSLY while still inside the BroadcastReceiver
        //    execution window. setAlarmClock grants background-activity-start privilege only
        //    during onReceive(); using Handler.postDelayed() lets that window close first,
        //    which causes a silent "not allowed to start activity from background" failure on
        //    Android 14+. This must happen before NotificationsService.receive().
        try {
          val notification = Notification(notificationRequest)
          val fsiAction =
            NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
          val wakeIntent = Intent().apply {
            setClassName(context.packageName, context.packageName + ".AlarmWakeActivity")
            putExtra("rippleAlarmFullScreen", true)
            putExtra("alarmTitle", notificationRequest.content.title ?: "Alarm")
            putExtra("alarmBody", notificationRequest.content.body ?: "Ringing")
            NotificationsService.setNotificationResponseToIntent(
              this,
              NotificationResponse(fsiAction, notification)
            )
            addFlags(
              Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_CLEAR_TOP
            )
          }
          context.startActivity(wakeIntent)
        } catch (e: Exception) {
          Log.w("expo-notifications", "Ripple AlarmWakeActivity launch failed for " + identifier + ": " + e.message)
        }
      }
      // 3. Post the notification (with FSI as additional lock-screen signal).
      NotificationsService.receive(context, Notification(notificationRequest))
      NotificationsService.schedule(context, notificationRequest)
    } catch (e: ClassNotFoundException) {
      Log.e("expo-notifications", "An exception occurred while triggering notification " + identifier + ", removing. " + e.message)
      e.printStackTrace()
      NotificationsService.removeScheduledNotification(context, identifier)
    } catch (e: InvalidClassException) {
      Log.e("expo-notifications", "An exception occurred while triggering notification " + identifier + ", removing. " + e.message)
      e.printStackTrace()
      NotificationsService.removeScheduledNotification(context, identifier)
    } catch (e: NullPointerException) {
      Log.e("expo-notifications", "An exception occurred while triggering notification " + identifier + ", removing. " + e.message)
      e.printStackTrace()
      NotificationsService.removeScheduledNotification(context, identifier)
    }
  }`;

const SETUP_ALARM_REPLACEMENT = `  private fun setupAlarm(triggerAtMillis: Long, operation: PendingIntent, identifier: String = "") {
    // Ripple alarm scheduling v4 — treat alarm fires as alarm-clock alarms for the system.
    if (identifier.startsWith("ripple_alarm_fire_") && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      try {
        val showLaunch = Intent().apply {
          setClassName(context.packageName, context.packageName + ".AlarmWakeActivity")
          putExtra("rippleAlarmFullScreen", true)
          putExtra("alarmTitle", "Alarm")
          putExtra("alarmBody", "Ringing")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val showFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
          PendingIntent.FLAG_UPDATE_CURRENT
        }
        val showRequestCode = ("ripple_alarm_clock_show_" + identifier).hashCode()
        val showIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          val options = ActivityOptions.makeBasic()
          options.setPendingIntentBackgroundActivityStartMode(
            ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
          )
          PendingIntent.getActivity(
            context,
            showRequestCode,
            showLaunch,
            showFlags,
            options.toBundle()
          )
        } else {
          PendingIntent.getActivity(context, showRequestCode, showLaunch, showFlags)
        }
        val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent)
        alarmManager.setAlarmClock(alarmClockInfo, operation)
        return
      } catch (e: Exception) {
        Log.w("expo-notifications", "Ripple alarm: setAlarmClock failed for " + identifier + ", falling back: " + e.message)
      }
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
      AlarmManagerCompat.setExactAndAllowWhileIdle(
        alarmManager,
        AlarmManager.RTC_WAKEUP,
        triggerAtMillis,
        operation
      )
    } else {
      AlarmManagerCompat.setAndAllowWhileIdle(
        alarmManager,
        AlarmManager.RTC_WAKEUP,
        triggerAtMillis,
        operation
      )
    }
  }`;

module.exports = {
  MARKER_SCHEDULING,
  MARKER_SCHEDULING_LEGACY,
  IMPORT_LINES,
  TRIGGER_REPLACEMENT,
  SETUP_ALARM_REPLACEMENT,
};
