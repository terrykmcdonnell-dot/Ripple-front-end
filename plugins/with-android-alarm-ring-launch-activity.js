const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const KOTLIN_SOURCE = `package PACKAGE_NAME

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

/** Trampoline for alarm full-screen intents — lock screen + forward to MainActivity. */
class AlarmRingLaunchActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    showOverLockScreen()
    forwardToMainActivity(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    showOverLockScreen()
    forwardToMainActivity(intent)
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      window.addFlags(
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON,
      )
      val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      keyguard?.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
      )
    }
  }

  private fun forwardToMainActivity(sourceIntent: Intent?) {
    val forward = packageManager.getLaunchIntentForPackage(packageName)
    if (forward != null) {
      sourceIntent?.extras?.let { forward.putExtras(it) }
      forward.putExtra("rippleAlarmFullScreen", true)
      forward.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_CLEAR_TOP,
      )
      startActivity(forward)
    }

    finish()
  }
}
`;

function getPackageName(config) {
  return config.android?.package ?? 'com.terrykm.ripplealarm';
}

function withAndroidAlarmRingLaunchActivity(config) {
  const packageName = getPackageName(config);

  config = withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) {
      return cfg;
    }
    if (!application.activity) {
      application.activity = [];
    }
    const activities = application.activity;
    const already = activities.some((a) => {
      const name = a.$?.['android:name'] ?? '';
      return String(name).includes('AlarmRingLaunchActivity');
    });
    if (!already) {
      activities.push({
        $: {
          'android:name': '.AlarmRingLaunchActivity',
          'android:exported': 'false',
          'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:excludeFromRecents': 'true',
          'android:noHistory': 'true',
          'android:launchMode': 'singleInstance',
          'android:taskAffinity': '',
        },
      });
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkgPath = packageName.replace(/\./g, path.sep);
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        pkgPath,
      );
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, 'AlarmRingLaunchActivity.kt');
      const contents = KOTLIN_SOURCE.replace(/PACKAGE_NAME/g, packageName);
      fs.writeFileSync(file, contents, 'utf8');
      return cfg;
    },
  ]);

  return config;
}

module.exports = withAndroidAlarmRingLaunchActivity;
