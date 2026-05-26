/** Kotlin inserted into ExpoNotificationBuilder.kt for alarm lock-screen presentation. */
const MARKER_V4 = 'Ripple alarm presentation v5';

const BLOCK_V4 = `    val isRippleAlarmFire =
      notification.notificationRequest.identifier.startsWith("ripple_alarm_fire_") ||
        notificationContent.categoryId == "ripple_alarm_fire" ||
        (notificationContent.body?.toString()?.contains("\\"type\\":\\"ripple_alarm_fire\\"") == true) ||
        (notificationContent.body?.toString()?.contains("ripple_alarm_fire") == true)
    if (isRippleAlarmFire) {
      // ${MARKER_V4}
      builder.setCategory(NotificationCompat.CATEGORY_ALARM)
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      builder.setPriority(NotificationCompat.PRIORITY_MAX)
      builder.setOnlyAlertOnce(false)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        builder.setColorized(true)
      }
      val fsiAction =
        NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
      val alarmLaunchIntent = android.content.Intent().apply {
        setClassName(context.packageName, context.packageName + ".AlarmRingLaunchActivity")
        putExtra("rippleAlarmFullScreen", true)
        NotificationsService.setNotificationResponseToIntent(
          this,
          NotificationResponse(fsiAction, notification)
        )
        addFlags(
          android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            or android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
            or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
        )
      }
      val fsiFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
      } else {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT
      }
      val fsiPending = android.app.PendingIntent.getActivity(
        context,
        ("ripple_alarm_fsi_" + notification.notificationRequest.identifier).hashCode(),
        alarmLaunchIntent,
        fsiFlags
      )
      builder.setFullScreenIntent(fsiPending, true)
    }
`;

const OLD_BLOCK_REGEX =
  /    (?:val isRippleAlarmFire =[\s\S]*?|if \(notificationContent\.categoryId == "ripple_alarm_fire"\)) \{[\s\S]*?\n    \}\n\n(?=    if \(notificationContent\.containsImage\(\)\))/;

module.exports = { MARKER_V4, BLOCK_V4, OLD_BLOCK_REGEX };
