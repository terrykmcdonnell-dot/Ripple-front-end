/**
 * Patches expo-notifications so ripple alarm fires use setAlarmClock, AlarmSoundService,
 * and AlarmWakeActivity (instant native full-screen) when AlarmManager triggers.
 */
const fs = require('fs');
const path = require('path');

const {
  MARKER_SCHEDULING,
  MARKER_SCHEDULING_LEGACY,
  IMPORT_LINES,
  TRIGGER_REPLACEMENT,
  SETUP_ALARM_REPLACEMENT,
} = require('./expo-notifications-alarm-scheduling-patch-block');

const RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoSchedulingDelegate.kt';

const TRIGGER_OLD = `  override fun triggerNotification(identifier: String) {
    try {
      val notificationRequest: NotificationRequest = store.getNotificationRequest(identifier)!!
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

const SETUP_ALARM_OLD = `  private fun setupAlarm(triggerAtMillis: Long, operation: PendingIntent) {
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

const SCHEDULE_CALL_OLD =
  'setupAlarm(nextTriggerDate.time, NotificationsService.createNotificationTrigger(context, request.identifier))';

/** Replace a previously patched triggerNotification (v1–v4) with the latest block. */
const TRIGGER_PATCHED_REGEX =
  /  override fun triggerNotification\(identifier: String\) \{[\s\S]*?Ripple alarm scheduling v(?:[1-9]|10)[\s\S]*?^\  \}/m;

/** Replace a previously patched setupAlarm with the latest block. */
const SETUP_PATCHED_REGEX =
  /  private fun setupAlarm\(triggerAtMillis: Long, operation: PendingIntent, identifier: String = ""\) \{[\s\S]*?Ripple alarm scheduling v(?:[1-9]|10)[\s\S]*?^\  \}/m;

function applySchedulingPatch(projectRoot) {
  const file = path.join(projectRoot, ...RELATIVE.split('/'));
  if (!fs.existsSync(file)) {
    console.warn('[patch-expo-scheduling] ExpoSchedulingDelegate not found; skip.');
    return;
  }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARKER_SCHEDULING)) {
    return;
  }

  for (const line of IMPORT_LINES) {
    if (!s.includes(line)) {
      s = s.replace(
        'import expo.modules.notifications.service.interfaces.SchedulingDelegate',
        `import expo.modules.notifications.service.interfaces.SchedulingDelegate\n${line}`,
      );
    }
  }

  if (MARKER_SCHEDULING_LEGACY.some((m) => s.includes(m))) {
    if (!TRIGGER_PATCHED_REGEX.test(s)) {
      console.error('[patch-expo-scheduling] Legacy scheduling patch found but block shape unknown.');
      process.exit(1);
    }
    s = s.replace(TRIGGER_PATCHED_REGEX, TRIGGER_REPLACEMENT);
    if (SETUP_PATCHED_REGEX.test(s)) {
      s = s.replace(SETUP_PATCHED_REGEX, SETUP_ALARM_REPLACEMENT);
    }
    fs.writeFileSync(file, s, 'utf8');
    console.log(`[patch-expo-scheduling] Upgraded alarm scheduling patch (${MARKER_SCHEDULING}).`);
    return;
  }

  if (!s.includes(TRIGGER_OLD)) {
    console.error('[patch-expo-scheduling] triggerNotification block not found (expo-notifications version mismatch?).');
    process.exit(1);
  }
  s = s.replace(TRIGGER_OLD, TRIGGER_REPLACEMENT);

  if (!s.includes(SCHEDULE_CALL_OLD)) {
    console.error('[patch-expo-scheduling] setupAlarm call site not found.');
    process.exit(1);
  }
  s = s.replace(
    SCHEDULE_CALL_OLD,
    'setupAlarm(nextTriggerDate.time, NotificationsService.createNotificationTrigger(context, request.identifier), request.identifier)',
  );

  if (!s.includes(SETUP_ALARM_OLD)) {
    console.error('[patch-expo-scheduling] setupAlarm block not found.');
    process.exit(1);
  }
  s = s.replace(SETUP_ALARM_OLD, SETUP_ALARM_REPLACEMENT);

  fs.writeFileSync(file, s, 'utf8');
  console.log(`[patch-expo-scheduling] Applied alarm scheduling patch (${MARKER_SCHEDULING}).`);
}

applySchedulingPatch(path.join(__dirname, '..'));
