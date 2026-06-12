const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const { BLOCK_V4, MARKER_V4, OLD_BLOCK_REGEX } = require('../scripts/expo-notifications-alarm-fsi-patch-block');
const {
  MARKER_SCHEDULING,
  MARKER_SCHEDULING_LEGACY,
  IMPORT_LINES,
  TRIGGER_REPLACEMENT,
  SETUP_ALARM_REPLACEMENT,
} = require('../scripts/expo-notifications-alarm-scheduling-patch-block');

const BUILDER_RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt';

const SCHEDULING_RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoSchedulingDelegate.kt';
const LIFECYCLE_RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoNotificationLifecycleListener.java';
const LIFECYCLE_MARKER = 'Ripple direct MainActivity notification response v1';

const INSERT_NEEDLE = `    )

    if (notificationContent.containsImage()) {`;

const TRIGGER_PATCHED_REGEX =
  /  override fun triggerNotification\(identifier: String\) \{[\s\S]*?Ripple alarm scheduling v[0-9]+[\s\S]*?^\  \}/m;
const SETUP_PATCHED_REGEX =
  /  private fun setupAlarm\(triggerAtMillis: Long, operation: PendingIntent, identifier: String = ""\) \{[\s\S]*?Ripple alarm scheduling v[0-9]+[\s\S]*?^\  \}/m;

function applySchedulingPatch(projectRoot) {
  const file = path.join(projectRoot, ...SCHEDULING_RELATIVE.split('/'));
  if (!fs.existsSync(file)) {
    console.warn('[with-android-alarm-fsi] ExpoSchedulingDelegate not found; skip scheduling patch.');
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
    if (TRIGGER_PATCHED_REGEX.test(s)) {
      s = s.replace(TRIGGER_PATCHED_REGEX, TRIGGER_REPLACEMENT);
    }
    if (SETUP_PATCHED_REGEX.test(s)) {
      s = s.replace(SETUP_PATCHED_REGEX, SETUP_ALARM_REPLACEMENT);
    }
    fs.writeFileSync(file, s, 'utf8');
    console.log(`[with-android-alarm-fsi] Upgraded alarm scheduling patch (${MARKER_SCHEDULING}).`);
    return;
  }

  const triggerOld = `  override fun triggerNotification(identifier: String) {
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

  const setupAlarmOld = `  private fun setupAlarm(triggerAtMillis: Long, operation: PendingIntent) {
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

  if (!s.includes(triggerOld)) {
    console.warn('[with-android-alarm-fsi] Scheduling triggerNotification block missing; skip.');
    return;
  }
  s = s.replace(triggerOld, TRIGGER_REPLACEMENT);

  const scheduleCallOld =
    'setupAlarm(nextTriggerDate.time, NotificationsService.createNotificationTrigger(context, request.identifier))';
  if (s.includes(scheduleCallOld)) {
    s = s.replace(
      scheduleCallOld,
      'setupAlarm(nextTriggerDate.time, NotificationsService.createNotificationTrigger(context, request.identifier), request.identifier)',
    );
  }

  if (s.includes(setupAlarmOld)) {
    s = s.replace(setupAlarmOld, SETUP_ALARM_REPLACEMENT);
    fs.writeFileSync(file, s, 'utf8');
    console.log(`[with-android-alarm-fsi] Applied alarm scheduling patch (${MARKER_SCHEDULING}).`);
  }
}

function applyFullScreenIntentPatch(projectRoot) {
  const file = path.join(projectRoot, ...BUILDER_RELATIVE.split('/'));
  if (!fs.existsSync(file)) {
    console.warn('[with-android-alarm-fsi] expo-notifications builder not found; skip.');
    return;
  }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARKER_V4)) {
    return;
  }
  if (OLD_BLOCK_REGEX.test(s)) {
    s = s.replace(OLD_BLOCK_REGEX, '');
  }
  if (!s.includes(INSERT_NEEDLE)) {
    console.warn('[with-android-alarm-fsi] Insertion point missing (expo-notifications version mismatch?).');
    return;
  }
  const replacement = `    )

${BLOCK_V4}
    if (notificationContent.containsImage()) {`;
  s = s.replace(INSERT_NEEDLE, replacement);
  fs.writeFileSync(file, s, 'utf8');
  console.log(`[with-android-alarm-fsi] Applied alarm full-screen intent patch (${MARKER_V4}).`);
}

function applyMainActivityResponsePatch(projectRoot) {
  const file = path.join(projectRoot, ...LIFECYCLE_RELATIVE.split('/'));
  if (!fs.existsSync(file)) {
    console.warn('[with-android-alarm-fsi] ExpoNotificationLifecycleListener not found; skip response patch.');
    return;
  }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(LIFECYCLE_MARKER)) {
    return;
  }

  const importNeedle = 'import expo.modules.notifications.notifications.NotificationManager;\n';
  if (s.includes(importNeedle) && !s.includes('import expo.modules.notifications.notifications.model.NotificationResponse;')) {
    s = s.replace(
      importNeedle,
      `${importNeedle}import expo.modules.notifications.notifications.model.NotificationResponse;\nimport expo.modules.notifications.service.NotificationsService;\n`,
    );
  }

  const onCreateOld = `                if (extras.containsKey(NOTIFICATION_RESPONSE_KEY) || extras.containsKey(TEXT_INPUT_NOTIFICATION_RESPONSE_KEY)) {
                    Log.d("ReactNativeJS", "[native] ExpoNotificationLifecycleListener contains an unmarshalled notification response. Skipping.");
                    return;
                }`;
  const onCreateNew = `                if (extras.containsKey(NOTIFICATION_RESPONSE_KEY) || extras.containsKey(TEXT_INPUT_NOTIFICATION_RESPONSE_KEY)) {
                    // ${LIFECYCLE_MARKER}
                    NotificationResponse response = NotificationsService.Companion.getNotificationResponseFromOpenIntent(intent);
                    if (response != null) {
                        mNotificationManager.onNotificationResponseReceived(response);
                    }
                    return;
                }`;
  if (!s.includes(onCreateOld)) {
    console.warn('[with-android-alarm-fsi] Lifecycle onCreate response block missing; skip response patch.');
    return;
  }
  s = s.replace(onCreateOld, onCreateNew);

  const onNewIntentOld = `            if (extras.containsKey(NOTIFICATION_RESPONSE_KEY) || extras.containsKey(TEXT_INPUT_NOTIFICATION_RESPONSE_KEY)) {
                intent.removeExtra(NOTIFICATION_RESPONSE_KEY);
                intent.removeExtra(TEXT_INPUT_NOTIFICATION_RESPONSE_KEY);
                // response events are already handled by
                // NotificationForwarderActivity -> NotificationsService.onReceiveNotificationResponse -> NotificationEmitter.onNotificationResponseReceived
                return ReactActivityLifecycleListener.super.onNewIntent(intent);
            }`;
  const onNewIntentNew = `            if (extras.containsKey(NOTIFICATION_RESPONSE_KEY) || extras.containsKey(TEXT_INPUT_NOTIFICATION_RESPONSE_KEY)) {
                NotificationResponse response = NotificationsService.Companion.getNotificationResponseFromOpenIntent(intent);
                if (response != null) {
                    mNotificationManager.onNotificationResponseReceived(response);
                }
                intent.removeExtra(NOTIFICATION_RESPONSE_KEY);
                intent.removeExtra(TEXT_INPUT_NOTIFICATION_RESPONSE_KEY);
                return ReactActivityLifecycleListener.super.onNewIntent(intent);
            }`;
  if (!s.includes(onNewIntentOld)) {
    console.warn('[with-android-alarm-fsi] Lifecycle onNewIntent response block missing; skip response patch.');
    return;
  }
  s = s.replace(onNewIntentOld, onNewIntentNew);

  fs.writeFileSync(file, s, 'utf8');
  console.log(`[with-android-alarm-fsi] Applied lifecycle response patch (${LIFECYCLE_MARKER}).`);
}

function withAndroidNotificationForwarderLockscreen(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application?.activity?.length) {
      return cfg;
    }
    for (const activity of application.activity) {
      const name = activity.$?.['android:name'];
      if (!name) {
        continue;
      }
      const leaf = String(name);
      if (leaf.includes('NotificationForwarderActivity')) {
        activity.$['android:showWhenLocked'] = 'true';
        activity.$['android:turnScreenOn'] = 'true';
      }
    }
    return cfg;
  });
}

/**
 * Patches expo-notifications at prebuild so alarm-fire notifications use Android full-screen intents.
 */
function applyFsiPermissionPatch(projectRoot) {
  try {
    const { applyPatch } = require('../scripts/patch-expo-notifications-fsi-permission');
    applyPatch(projectRoot);
  } catch (e) {
    console.warn('[with-android-alarm-fsi] FSI permission patch skipped:', e.message);
  }
}

function withAndroidAlarmFullScreenIntent(config) {
  config = withAndroidNotificationForwarderLockscreen(config);
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      applyFullScreenIntentPatch(cfg.modRequest.projectRoot);
      applyMainActivityResponsePatch(cfg.modRequest.projectRoot);
      applySchedulingPatch(cfg.modRequest.projectRoot);
      applyFsiPermissionPatch(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
}

module.exports = withAndroidAlarmFullScreenIntent;
