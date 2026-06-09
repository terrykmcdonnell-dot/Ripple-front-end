/**
 * Patches expo-notifications so alarm-fire notifications use Android full-screen intents
 * targeting MainActivity (real full-screen ring UI).
 *
 * Idempotent — safe on every postinstall.
 */
const fs = require('fs');
const path = require('path');

const { BLOCK_V4, MARKER_V4, MARKER_V4_LEGACY, OLD_BLOCK_REGEX } = require('./expo-notifications-alarm-fsi-patch-block');

const RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt';
const LIFECYCLE_RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoNotificationLifecycleListener.java';
const LIFECYCLE_MARKER = 'Ripple direct MainActivity notification response v1';

const INSERT_NEEDLE = `    )

    if (notificationContent.containsImage()) {`;

function applyFullScreenIntentPatch(projectRoot) {
  const file = path.join(projectRoot, ...RELATIVE.split('/'));
  if (!fs.existsSync(file)) {
    console.warn('[patch-expo-fsi] expo-notifications builder not found; skip.');
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
    console.error('[patch-expo-fsi] Insertion point missing (expo-notifications version mismatch?).');
    process.exit(1);
  }
  const replacement = `    )

${BLOCK_V4}
    if (notificationContent.containsImage()) {`;
  s = s.replace(INSERT_NEEDLE, replacement);
  fs.writeFileSync(file, s, 'utf8');
  const upgraded = MARKER_V4_LEGACY.some((m) => m !== MARKER_V4 && s.includes(m));
  console.log(
    `[patch-expo-fsi] ${upgraded ? 'Upgraded' : 'Applied'} alarm full-screen intent patch (${MARKER_V4}).`,
  );
}

function applyMainActivityResponsePatch(projectRoot) {
  const file = path.join(projectRoot, ...LIFECYCLE_RELATIVE.split('/'));
  if (!fs.existsSync(file)) {
    console.warn('[patch-expo-fsi] ExpoNotificationLifecycleListener not found; skip response patch.');
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
    console.error('[patch-expo-fsi] Lifecycle onCreate response block missing.');
    process.exit(1);
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
    console.error('[patch-expo-fsi] Lifecycle onNewIntent response block missing.');
    process.exit(1);
  }
  s = s.replace(onNewIntentOld, onNewIntentNew);

  fs.writeFileSync(file, s, 'utf8');
  console.log(`[patch-expo-fsi] Applied lifecycle response patch (${LIFECYCLE_MARKER}).`);
}

function applyAlarmFullScreenIntentPatches(projectRoot) {
  applyFullScreenIntentPatch(projectRoot);
  applyMainActivityResponsePatch(projectRoot);
}

applyAlarmFullScreenIntentPatches(path.join(__dirname, '..'));
