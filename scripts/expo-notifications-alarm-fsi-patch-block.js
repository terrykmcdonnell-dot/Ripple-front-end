/** Kotlin inserted into ExpoNotificationBuilder.kt for alarm lock-screen presentation. */
const MARKER_V4 = 'Ripple alarm presentation v9';
const MARKER_V4_LEGACY = [
  'Ripple alarm presentation v7',
  'Ripple alarm presentation v8',
  'Ripple alarm presentation v9',
];

/**
 * v9: AlarmWakeActivity FSI + setOngoing(true) + setAutoCancel(false) per Android alarm spec.
 * Android 14+: ActivityOptions background-start on FSI PendingIntent.
 */
const BLOCK_V4 = `    val isRippleAlarmFire =
      notification.notificationRequest.identifier.startsWith("ripple_alarm_fire_") ||
        notificationContent.categoryId == "ripple_alarm_fire" ||
        (notificationContent.body?.toString()?.contains("\\"type\\":\\"ripple_alarm_fire\\"") == true) ||
        (notificationContent.body?.toString()?.contains("ripple_alarm_fire") == true)
    if (isRippleAlarmFire) {
      // Ripple alarm presentation v9
      builder.setCategory(NotificationCompat.CATEGORY_ALARM)
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      builder.setPriority(NotificationCompat.PRIORITY_MAX)
      builder.setOnlyAlertOnce(false)
      builder.setOngoing(true)
      builder.setAutoCancel(false)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        builder.setColorized(true)
      }
      val fsiAction =
        NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
      val alarmLaunchIntent = android.content.Intent().apply {
        setClassName(context.packageName, context.packageName + ".AlarmWakeActivity")
        putExtra("rippleAlarmFullScreen", true)
        putExtra("alarmTitle", notificationContent.title?.toString() ?: "Alarm")
        putExtra("alarmBody", notificationContent.body?.toString() ?: "Ringing")
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
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
      } else {
        android.app.PendingIntent.FLAG_UPDATE_CURRENT
      }
      val fsiRequestCode = ("ripple_alarm_fsi_" + notification.notificationRequest.identifier).hashCode()
      val notificationManager =
        context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
      val canFsi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        notificationManager.canUseFullScreenIntent()
      } else {
        true
      }
      if (canFsi) {
        val fsiPending = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          val options = android.app.ActivityOptions.makeBasic()
          options.setPendingIntentBackgroundActivityStartMode(
            android.app.ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
          )
          android.app.PendingIntent.getActivity(
            context,
            fsiRequestCode,
            alarmLaunchIntent,
            fsiFlags,
            options.toBundle()
          )
        } else {
          android.app.PendingIntent.getActivity(
            context,
            fsiRequestCode,
            alarmLaunchIntent,
            fsiFlags
          )
        }
        builder.setFullScreenIntent(fsiPending, true)
      } else {
        Log.w("expo-notifications", "Ripple alarm: canUseFullScreenIntent() is false — FSI suppressed.")
      }
    }
`;

const OLD_BLOCK_REGEX =
  /    (?:val isRippleAlarmFire =[\s\S]*?|if \(notificationContent\.categoryId == "ripple_alarm_fire"\)) \{[\s\S]*?\n    \}\n\n(?=    if \(notificationContent\.containsImage\(\)\))/;

module.exports = { MARKER_V4, MARKER_V4_LEGACY, BLOCK_V4, OLD_BLOCK_REGEX };
