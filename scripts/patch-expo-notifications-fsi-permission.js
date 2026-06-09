/**
 * Patches expo-notifications NotificationPermissionsModule to expose
 * NotificationManager.canUseFullScreenIntent() (Android 14+).
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'Ripple canUseFullScreenIntent v1';
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

const INSERT = `    AsyncFunction("requestPermissionsAsync") { _: ReadableArguments?, promise: Promise ->
      if (context.applicationContext.applicationInfo.targetSdkVersion >= 33 && Build.VERSION.SDK_INT >= 33) {
        requestPermissionsWithPromiseImplApi33(promise)
      } else {
        getPermissionsWithPromiseImplClassic(promise)
      }
    }

    // ${MARKER}
    AsyncFunction("canUseFullScreenIntentAsync") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val notificationManager =
          context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        promise.resolve(notificationManager.canUseFullScreenIntent())
      } else {
        promise.resolve(true)
      }
    }
  }`;

function applyPatch(projectRoot) {
  const filePath = path.join(projectRoot, ...RELATIVE);
  if (!fs.existsSync(filePath)) {
    console.warn('[patch-fsi-permission] NotificationPermissionsModule.kt not found — skipping.');
    return;
  }
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(MARKER)) {
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
