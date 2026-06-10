/**
 * Postinstall patch — ExpoSchedulingDelegate: start AlarmSoundService
 *
 * Injects a foreground-service start call (AlarmSoundService) into the existing
 * ripple_alarm_fire_ block so the alarm plays on STREAM_ALARM even before the
 * ring screen has mounted or when FSI is blocked.
 *
 * Requires patch v1 (expo-notifications-alarm-scheduling-patch-block.js) to
 * already be present so the ripple_alarm_fire_ block exists.
 */
const fs = require('fs');
const path = require('path');

const MARKER = 'Ripple alarm sound service v2';
const RELATIVE_PATH = [
  'node_modules',
  'expo-notifications',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'notifications',
  'service',
  'delegates',
  'ExpoSchedulingDelegate.kt',
];

// The NEEDLE is the first line of the v1 ripple_alarm_fire_ inner try block.
// We inject our service start BEFORE this line so it fires even if startActivity fails.
const NEEDLE = '        try {\n          val notification = Notification(notificationRequest)';

const INSERT = `        // ${MARKER}
        try {
          val svcIntent = android.content.Intent().apply {
            setClassName(context.packageName, context.packageName + ".AlarmSoundService")
            putExtra("soundName", notificationRequest.content.soundName ?: "")
          }
          if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(svcIntent)
          } else {
            context.startService(svcIntent)
          }
        } catch (e: Exception) {
          Log.w("expo-notifications", "Ripple AlarmSoundService start failed: " + e.message)
        }
`;

function applyPatch(projectRoot) {
  const filePath = path.join(projectRoot, ...RELATIVE_PATH);

  if (!fs.existsSync(filePath)) {
    console.warn('[patch-alarm-svc] ExpoSchedulingDelegate.kt not found — skipping.');
    return;
  }

  let source = fs.readFileSync(filePath, 'utf8');

  if (
    source.includes(MARKER) ||
    source.includes('Ripple alarm scheduling v2') ||
    source.includes('Ripple alarm scheduling v3') ||
    source.includes('Ripple alarm scheduling v4') ||
    source.includes('Ripple alarm scheduling v5') ||
    source.includes('Ripple alarm scheduling v6') ||
    source.includes('Ripple alarm scheduling v7')
  ) {
    console.log('[patch-alarm-svc] Already applied (or bundled in scheduling v2) — skipping.');
    return;
  }

  if (!source.includes(NEEDLE)) {
    console.warn(
      '[patch-alarm-svc] v1 scheduling patch needle not found. ' +
        'Run patch-expo-notifications-alarm-scheduling.js first.',
    );
    return;
  }

  source = source.replace(NEEDLE, INSERT + NEEDLE);
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('[patch-alarm-svc] Applied: ' + MARKER);
}

applyPatch(path.join(__dirname, '..'));
