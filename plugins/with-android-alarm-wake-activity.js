/**
 * Expo config plugin: AlarmWakeActivity
 *
 * Writes AlarmWakeActivity.kt and declares it in AndroidManifest.xml with
 * showWhenLocked / turnScreenOn so FSI can present a native full-screen UI
 * instantly on the lock screen (Android 14–17).
 */
const path = require('path');
const fs = require('fs');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const { ALARM_WAKE_ACTIVITY_KOTLIN } = require('../scripts/alarm-native-lockscreen-block');

const ACTIVITY_SHORT_NAME = '.AlarmWakeActivity';

function getPackageName(config) {
  return (config.android && config.android.package) || 'com.terrykm.ripplealarm';
}

function withAndroidAlarmWakeActivity(config) {
  config = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) {
      return cfg;
    }
    if (!application.activity) {
      application.activity = [];
    }
    const already = application.activity.some((a) => {
      const name = a.$?.['android:name'] ?? '';
      return String(name).includes('AlarmWakeActivity');
    });
    if (!already) {
      application.activity.push({
        $: {
          'android:name': ACTIVITY_SHORT_NAME,
          'android:exported': 'false',
          'android:theme': '@android:style/Theme.Black.NoTitleBar.Fullscreen',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:excludeFromRecents': 'true',
          'android:launchMode': 'singleTask',
          'android:taskAffinity': '',
        },
      });
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const packageName = getPackageName(cfg);
      const pkgPath = packageName.split('.').join(path.sep);
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        pkgPath,
      );
      fs.mkdirSync(dir, { recursive: true });
      const destFile = path.join(dir, 'AlarmWakeActivity.kt');
      const contents = ALARM_WAKE_ACTIVITY_KOTLIN.replace(/PACKAGE_NAME/g, packageName);
      fs.writeFileSync(destFile, contents, 'utf8');
      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidAlarmWakeActivity;
