/** Kotlin inserted into ExpoNotificationBuilder.kt for alarm lock-screen presentation. */
const MARKER_V4 = 'Ripple alarm presentation v7';

/**
 * v7: FSI now targets MainActivity directly instead of a translucent trampoline.
 *
 * Why: a translucent trampoline activity that calls finish() immediately is a
 * known cause of FSI being suppressed on Android 12+ (the system sees the
 * activity finish before drawing anything and treats the FSI as cancelled).
 * MainActivity is opaque, has android:showWhenLocked / android:turnScreenOn
 * declared in the manifest, and the manifest patch already applies
 * applyAlarmLaunchWindowFlags() inside onCreate / onNewIntent.
 */
const BLOCK_V4 = `    val isRippleAlarmFire =
      notification.notificationRequest.identifier.startsWith("ripple_alarm_fire_") ||
        notificationContent.categoryId == "ripple_alarm_fire" ||
        (notificationContent.body?.toString()?.contains("\\"type\\":\\"ripple_alarm_fire\\"") == true) ||
        (notificationContent.body?.toString()?.contains("ripple_alarm_fire") == true)
    if (isRippleAlarmFire) {
      // Ripple alarm presentation v7
      builder.setCategory(NotificationCompat.CATEGORY_ALARM)
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      builder.setPriority(NotificationCompat.PRIORITY_MAX)
      builder.setOnlyAlertOnce(false)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        builder.setColorized(true)
      }
      val fsiAction =
        NotificationAction(NotificationResponse.DEFAULT_ACTION_IDENTIFIER, null, true)
      // Target MainActivity directly. MainActivity is declared with
      // android:showWhenLocked="true" and android:turnScreenOn="true" and
      // applies the alarm window flags inside its onCreate / onNewIntent.
      val alarmLaunchIntent = android.content.Intent().apply {
        setClassName(context.packageName, context.packageName + ".MainActivity")
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
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
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
