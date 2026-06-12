/**
 * Patches expo-notifications NotificationPermissionsModule to expose
 * NotificationManager.canUseFullScreenIntent() (Android 14+) and
 * isNotificationPolicyAccessGranted() (DND / Modes access).
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'Ripple androidAlarmPermissions v2';
const MARKER_LEGACY = ['Ripple canUseFullScreenIntent v1', 'Ripple androidAlarmPermissions v2'];
const RELATIVE = [
  'node_modules',
  'expo-notifications',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'notifications',
  'permissions',
  'NotificationPermissionsModule.kt',
];

const NEEDLE = `    AsyncFunction("requestPermissionsAsync") { _: ReadableArguments?, promise: Promise ->
      if (context.applicationContext.applicationInfo.targetSdkVersion >= 33 && Build.VERSION.SDK_INT >= 33) {
        requestPermissionsWithPromiseImplApi33(promise)
      } else {
        getPermissionsWithPromiseImplClassic(promise)
      }
    }
  }`;

const PERMISSIONS_BLOCK = `    // ${MARKER}
    AsyncFunction("canUseFullScreenIntentAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val notificationManager =
          context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        promise.resolve(notificationManager.canUseFullScreenIntent())
      } else {
        promise.resolve(true)
      }
    }

    AsyncFunction("canAccessNotificationPolicyAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val notificationManager =
          context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        promise.resolve(notificationManager.isNotificationPolicyAccessGranted)
      } else {
        promise.resolve(true)
      }
    }
  }`;

const INSERT = `    AsyncFunction("requestPermissionsAsync") { _: ReadableArguments?, promise: Promise ->
      if (context.applicationContext.applicationInfo.targetSdkVersion >= 33 && Build.VERSION.SDK_INT >= 33) {
        requestPermissionsWithPromiseImplApi33(promise)
      } else {
        getPermissionsWithPromiseImplClassic(promise)
      }
    }

${PERMISSIONS_BLOCK}`;

const LEGACY_BLOCK_REGEX =
  /    \/\/ Ripple (?:canUseFullScreenIntent v1|androidAlarmPermissions v2)[\s\S]*?^\  \}/m;

function applyPatch(projectRoot) {
  const filePath = path.join(projectRoot, ...RELATIVE);
  if (!fs.existsSync(filePath)) {
    console.warn('[patch-fsi-permission] NotificationPermissionsModule.kt not found — skipping.');
    return;
  }
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(MARKER) && source.includes('canAccessNotificationPolicyAsync')) {
    return;
  }

  if (MARKER_LEGACY.some((m) => source.includes(m)) && LEGACY_BLOCK_REGEX.test(source)) {
    source = source.replace(LEGACY_BLOCK_REGEX, PERMISSIONS_BLOCK);
    fs.writeFileSync(filePath, source, 'utf8');
    console.log(`[patch-fsi-permission] Upgraded alarm permissions patch (${MARKER}).`);
    return;
  }

  if (!source.includes(NEEDLE)) {
    console.warn('[patch-fsi-permission] Insertion needle not found — skipping.');
    return;
  }
  source = source.replace(NEEDLE, INSERT);
  fs.writeFileSync(filePath, source, 'utf8');
  console.log(`[patch-fsi-permission] Applied: ${MARKER}`);
}

module.exports = { applyPatch };

if (require.main === module) {
  applyPatch(path.join(__dirname, '..'));
}
