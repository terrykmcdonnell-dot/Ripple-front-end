/** Kotlin patches ExpoSchedulingDelegate.kt for lock-screen alarm takeover. */
const MARKER_SCHEDULING = 'Ripple alarm scheduling v1';

const IMPORT_LINES = [
  'import android.content.Intent',
  'import expo.modules.notifications.notifications.model.Notification',
  'import expo.modules.notifications.notifications.model.NotificationAction',
  'import expo.modules.notifications.notifications.model.NotificationResponse',
];

const TRIGGER_REPLACEMENT = `  override fun triggerNotification(identifier: String) {
    try {
      val notificationRequest: NotificationRequest = store.getNotificationRequest(identifier)!!
      // Ripple alarm scheduling v1 — launch ring UI directly when AlarmManager fires.
      // FSI alone is blocked on Android 14+ without the user granting full-screen intents;
      // starting MainActivity from the alarm callback still opens the app over the lock screen.
      if (identifier.startsWith("ripple_alarm_fire_")) {
        try {
          val notification = Notification(notificationRequest)
          val fsiAction =
            NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
          val alarmLaunchIntent = Intent().apply {
            setClassName(context.packageName, context.packageName + ".MainActivity")
            putExtra("rippleAlarmFullScreen", true)
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
          context.startActivity(alarmLaunchIntent)
        } catch (e: Exception) {
          Log.w("expo-notifications", "Ripple alarm: could not launch MainActivity for " + identifier + ": " + e.message)
        }
      }
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
    // Ripple alarm scheduling v1 — treat alarm fires as alarm-clock alarms for the system.
    if (identifier.startsWith("ripple_alarm_fire_") && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      try {
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
          val showFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
          } else {
            PendingIntent.FLAG_UPDATE_CURRENT
          }
          val showIntent = PendingIntent.getActivity(
            context,
            ("ripple_alarm_clock_show_" + identifier).hashCode(),
            launch,
            showFlags
          )
          val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent)
          alarmManager.setAlarmClock(alarmClockInfo, operation)
          return
        }
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
  IMPORT_LINES,
  TRIGGER_REPLACEMENT,
  SETUP_ALARM_REPLACEMENT,
};
