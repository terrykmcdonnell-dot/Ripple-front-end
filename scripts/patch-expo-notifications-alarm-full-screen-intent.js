/**
 * Patches expo-notifications so alarm-fire notifications use Android's full-screen intent
 * (lock-screen takeover → opens app to ring UI) when category matches ripple_alarm_fire.
 *
 * Idempotent — safe on every postinstall.
 */
const fs = require('fs');
const path = require('path');

const RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt';

const MARKER = 'notificationContent.categoryId == "ripple_alarm_fire"';

const BLOCK = `    if (notificationContent.categoryId == "ripple_alarm_fire") {
      builder.setCategory(NotificationCompat.CATEGORY_ALARM)
      builder.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        builder.setColorized(true)
      }
      builder.setFullScreenIntent(
        createNotificationResponseIntent(
          context,
          notification,
          defaultAction
        ),
        true
      )
    }
`;

function main() {
  const root = path.join(__dirname, '..');
  const file = path.join(root, ...RELATIVE.split('/'));
  if (!fs.existsSync(file)) {
    console.warn('[patch-expo-fsi] expo-notifications builder not found; skip.');
    return;
  }
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARKER)) {
    return;
  }
  const needle = `    )

    if (notificationContent.containsImage()) {`;
  if (!s.includes(needle)) {
    console.error(
      '[patch-expo-fsi] Insertion point missing (expo-notifications version mismatch?).',
    );
    process.exit(1);
  }
  const replacement = `    )

${BLOCK}
    if (notificationContent.containsImage()) {`;
  s = s.replace(needle, replacement);
  fs.writeFileSync(file, s, 'utf8');
  console.log('[patch-expo-fsi] Applied alarm full-screen intent patch.');
}

main();
