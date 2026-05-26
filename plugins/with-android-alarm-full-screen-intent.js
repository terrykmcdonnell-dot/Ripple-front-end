const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const { BLOCK_V4, MARKER_V4, OLD_BLOCK_REGEX } = require('../scripts/expo-notifications-alarm-fsi-patch-block');

const RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt';

const INSERT_NEEDLE = `    )

    if (notificationContent.containsImage()) {`;

function applyFullScreenIntentPatch(projectRoot) {
  const file = path.join(projectRoot, ...RELATIVE.split('/'));
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
  console.log('[with-android-alarm-fsi] Applied alarm full-screen intent patch (v5).');
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
function withAndroidAlarmFullScreenIntent(config) {
  config = withAndroidNotificationForwarderLockscreen(config);
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      applyFullScreenIntentPatch(cfg.modRequest.projectRoot);
      return cfg;
    },
  ]);
}

module.exports = withAndroidAlarmFullScreenIntent;
