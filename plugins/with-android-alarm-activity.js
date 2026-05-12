const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Ensures MainActivity can show over the lock screen when opened from a full-screen alarm intent.
 * Without this, prebuild-generated manifests omit showWhenLocked / turnScreenOn.
 */
function withAndroidAlarmActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application?.activity?.length) {
      return cfg;
    }
    for (const activity of application.activity) {
      const name = activity.$?.['android:name'];
      if (!name) continue;
      const leaf = String(name).split('.').pop();
      if (leaf === 'MainActivity') {
        activity.$['android:showWhenLocked'] = 'true';
        activity.$['android:turnScreenOn'] = 'true';
        break;
      }
    }
    return cfg;
  });
}

module.exports = withAndroidAlarmActivity;
