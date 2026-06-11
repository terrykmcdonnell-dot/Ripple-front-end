/**
 * Native lock-screen alarm UI: AlarmWakeActivity with Snooze/Dismiss,
 * snooze receiver, prefs bridge, and pending action queue for JS sync.
 */
const path = require('path');
const fs = require('fs');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const {
  ALARM_WAKE_ACTIVITY_KOTLIN,
  RIPPLE_ALARM_PREFS_KOTLIN,
  RIPPLE_ALARM_NATIVE_KOTLIN,
  ALARM_SNOOZE_RECEIVER_KOTLIN,
  RIPPLE_ALARM_PREFS_MODULE_KOTLIN,
  RIPPLE_ALARM_PREFS_PACKAGE_KOTLIN,
} = require('../scripts/alarm-native-lockscreen-block');

const RECEIVER_SHORT_NAME = '.AlarmSnoozeReceiver';

function getPackageName(config) {
  return (config.android && config.android.package) || 'com.terrykm.ripplealarm';
}

function writeKotlinFile(dir, filename, source, packageName) {
  const contents = source.replace(/PACKAGE_NAME/g, packageName);
  fs.writeFileSync(path.join(dir, filename), contents, 'utf8');
}

function withAndroidAlarmNativeLockscreen(config) {
  config = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) {
      return cfg;
    }
    if (!application.receiver) {
      application.receiver = [];
    }
    const already = application.receiver.some((r) => {
      const name = r.$?.['android:name'] ?? '';
      return String(name).includes('AlarmSnoozeReceiver');
    });
    if (!already) {
      application.receiver.push({
        $: {
          'android:name': RECEIVER_SHORT_NAME,
          'android:exported': 'false',
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

      writeKotlinFile(dir, 'AlarmWakeActivity.kt', ALARM_WAKE_ACTIVITY_KOTLIN, packageName);
      writeKotlinFile(dir, 'RippleAlarmPrefs.kt', RIPPLE_ALARM_PREFS_KOTLIN, packageName);
      writeKotlinFile(dir, 'RippleAlarmNative.kt', RIPPLE_ALARM_NATIVE_KOTLIN, packageName);
      writeKotlinFile(dir, 'AlarmSnoozeReceiver.kt', ALARM_SNOOZE_RECEIVER_KOTLIN, packageName);
      writeKotlinFile(dir, 'RippleAlarmPrefsModule.kt', RIPPLE_ALARM_PREFS_MODULE_KOTLIN, packageName);
      writeKotlinFile(dir, 'RippleAlarmPrefsPackage.kt', RIPPLE_ALARM_PREFS_PACKAGE_KOTLIN, packageName);

      const mainAppPath = path.join(dir, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        let mainApp = fs.readFileSync(mainAppPath, 'utf8');
        if (!mainApp.includes('RippleAlarmPrefsPackage')) {
          mainApp = mainApp.replace(
            '// add(MyReactNativePackage())',
            'add(RippleAlarmPrefsPackage())',
          );
        }
        fs.writeFileSync(mainAppPath, mainApp, 'utf8');
      }

      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidAlarmNativeLockscreen;
