/**
 * Ensures expo-notifications is compiled from patched node_modules source on Android.
 * Gradle autolinking reads buildFromSource from package.json (not app.json alone).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MODULE_NAME = 'expo-notifications';

function withExpoNotificationsBuildFromSource(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkgPath = path.join(cfg.modRequest.projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.expo = pkg.expo ?? {};
      pkg.expo.autolinking = pkg.expo.autolinking ?? {};
      pkg.expo.autolinking.android = pkg.expo.autolinking.android ?? {};
      const list = Array.isArray(pkg.expo.autolinking.android.buildFromSource)
        ? [...pkg.expo.autolinking.android.buildFromSource]
        : [];
      if (!list.includes(MODULE_NAME)) {
        list.push(MODULE_NAME);
        pkg.expo.autolinking.android.buildFromSource = list;
        fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
        console.log(
          `[with-expo-notifications-source] Added ${MODULE_NAME} to package.json expo.autolinking.android.buildFromSource`,
        );
      }
      return cfg;
    },
  ]);
}

module.exports = withExpoNotificationsBuildFromSource;
