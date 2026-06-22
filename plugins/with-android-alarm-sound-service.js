/**
 * Expo config plugin: AlarmSoundService
 *
 * 1. Writes AlarmSoundService.kt into the Android project.
 * 2. Declares the service in AndroidManifest.xml with foregroundServiceType="mediaPlayback".
 * 3. Ensures the FOREGROUND_SERVICE and FOREGROUND_SERVICE_MEDIA_PLAYBACK permissions are present.
 */
const path = require('path');
const fs = require('fs');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const { AndroidConfig } = require('expo/config-plugins');
const { KOTLIN_SOURCE } = require('../scripts/alarm-sound-service-block');

const SERVICE_SHORT_NAME = '.AlarmSoundService';
const FOREGROUND_PERMISSION = 'android.permission.FOREGROUND_SERVICE';
const FOREGROUND_MEDIA_PERMISSION = 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK';
const DISABLE_KEYGUARD_PERMISSION = 'android.permission.DISABLE_KEYGUARD';

function getPackageName(config) {
  return (config.android && config.android.package) || 'com.terrykm.ripplealarmapp';
}

function withAndroidAlarmSoundService(config) {
  // Step 1: Add permissions and service declaration to AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application && manifest.application[0];
    if (!application) return cfg;

    AndroidConfig.Permissions.ensurePermission(cfg.modResults, FOREGROUND_PERMISSION);
    AndroidConfig.Permissions.ensurePermission(cfg.modResults, FOREGROUND_MEDIA_PERMISSION);
    AndroidConfig.Permissions.ensurePermission(cfg.modResults, DISABLE_KEYGUARD_PERMISSION);

    if (!application.service) application.service = [];
    const alreadyDeclared = application.service.some((s) => {
      const name = (s.$ && s.$['android:name']) || '';
      return name.includes('AlarmSoundService');
    });
    if (!alreadyDeclared) {
      application.service.push({
        $: {
          'android:name': SERVICE_SHORT_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    }
    return cfg;
  });

  // Step 2: Write AlarmSoundService.kt
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
      const destFile = path.join(dir, 'AlarmSoundService.kt');
      const contents = KOTLIN_SOURCE.replace(/PACKAGE_NAME/g, packageName);
      fs.writeFileSync(destFile, contents, 'utf8');
      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidAlarmSoundService;
