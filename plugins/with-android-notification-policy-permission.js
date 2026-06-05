const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const PERMISSION = 'android.permission.ACCESS_NOTIFICATION_POLICY';

/**
 * Ensures ACCESS_NOTIFICATION_POLICY is in AndroidManifest.xml so Ripple appears in
 * Settings → Modes access / Do Not Disturb access (NOTIFICATION_POLICY_ACCESS_SETTINGS).
 *
 * app.json `android.permissions` should also list this; the plugin guarantees prebuild/EAS
 * never omits it when merging manifests.
 */
function withAndroidNotificationPolicyPermission(config) {
  return withAndroidManifest(config, (cfg) => {
    // ensurePermission mutates the manifest and returns boolean; do not assign its return value.
    AndroidConfig.Permissions.ensurePermission(cfg.modResults, PERMISSION);
    return cfg;
  });
}

module.exports = withAndroidNotificationPolicyPermission;
