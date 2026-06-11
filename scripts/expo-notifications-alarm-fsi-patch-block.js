/** Kotlin inserted into ExpoNotificationBuilder.kt for alarm lock-screen presentation. */
const MARKER_V4 = 'Ripple alarm presentation v13';
const MARKER_V4_LEGACY = [
  'Ripple alarm presentation v7',
  'Ripple alarm presentation v8',
  'Ripple alarm presentation v9',
  'Ripple alarm presentation v10',
  'Ripple alarm presentation v11',
  'Ripple alarm presentation v12',
  'Ripple alarm presentation v13',
];

/**
 * v13: Lock-screen UI is native AlarmWakeActivity via AlarmSoundService FSI only.
 * Expo's alarm-fire notification keeps alarm category/priority but no longer sets
 * a competing full-screen intent that launches MainActivity (React Native).
 *
 * v12: Drops ActivityOptions on full-screen PendingIntents — Android 14+ throws if
 * pendingIntentBackgroundActivityStartMode is set when creating a notification FSI.
 *
 * v11: Full-screen intent launches the app's MainActivity directly.
 *
 * Why this is the fix: a full-screen intent must target an activity Android can
 * display immediately over the lock screen. Earlier versions targeted
 * plugin-generated `.AlarmWakeActivity`, then Expo's translucent
 * `NotificationForwarderActivity`; both paths can degrade to a heads-up banner
 * if the activity is missing or behaves as a trampoline. `MainActivity` is
 * always present, is declared showWhenLocked/turnScreenOn by our config plugin,
 * and receives Expo's notification response extras so JS can route to
 * `/alarm-ring`.
 *
 * The FSI is set unconditionally: when the user granted the full-screen-intent
 * permission Android shows it full screen over the lock screen; otherwise it
 * degrades to a heads-up notification automatically. There is no downside to
 * always setting it, so the prior `canUseFullScreenIntent()` gate is removed.
 */
const BLOCK_V4 = `    val isRippleAlarmFire =
      notification.notificationRequest.identifier.startsWith("ripple_alarm_fire_") ||
        notificationContent.categoryId == "ripple_alarm_fire" ||
        (notificationContent.body?.toString()?.contains("\\"type\\":\\"ripple_alarm_fire\\"") == true) ||
        (notificationContent.body?.toString()?.contains("ripple_alarm_fire") == true)
    if (isRippleAlarmFire) {
      // Ripple alarm presentation v13
      builder.setCategory(NotificationCompat.CATEGORY_ALARM)
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      builder.setPriority(NotificationCompat.PRIORITY_MAX)
      builder.setOnlyAlertOnce(false)
      builder.setOngoing(true)
      builder.setAutoCancel(false)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        builder.setColorized(true)
      }
    }
`;

const OLD_BLOCK_REGEX =
  /    (?:val isRippleAlarmFire =[\s\S]*?|if \(notificationContent\.categoryId == "ripple_alarm_fire"\)) \{[\s\S]*?\n    \}\n\n(?=    if \(notificationContent\.containsImage\(\)\))/;

module.exports = { MARKER_V4, MARKER_V4_LEGACY, BLOCK_V4, OLD_BLOCK_REGEX };
