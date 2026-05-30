/**
 * Patches expo-notifications so alarm-fire notifications use Android full-screen intents
 * targeting MainActivity (lock-screen takeover → ring UI).
 *
 * Idempotent — safe on every postinstall.
 */
const fs = require('fs');
const path = require('path');

const { BLOCK_V4, MARKER_V4, OLD_BLOCK_REGEX } = require('./expo-notifications-alarm-fsi-patch-block');

const RELATIVE =
  'node_modules/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/presentation/builders/ExpoNotificationBuilder.kt';

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
  console.log(`[patch-expo-fsi] Applied alarm full-screen intent patch (${MARKER_V4}).`);
}

applyFullScreenIntentPatch(path.join(__dirname, '..'));
