const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

const MAIN_ACTIVITY_ALARM_MARKER = 'applyAlarmLaunchWindowFlags';

/**
 * Ensures MainActivity can show over the lock screen when opened from a full-screen alarm intent.
 * Without this, prebuild-generated manifests omit showWhenLocked / turnScreenOn.
 */
function withAndroidAlarmActivity(config) {
  config = withAndroidManifest(config, (cfg) => {
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

  config = withMainActivity(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(MAIN_ACTIVITY_ALARM_MARKER)) {
      return cfg;
    }

    if (!contents.includes('override fun onCreate(savedInstanceState: Bundle?)')) {
      console.warn('[with-android-alarm-activity] MainActivity onCreate not found; skip Kotlin patch.');
      return cfg;
    }

    const imports = `import android.content.Intent
import android.view.WindowManager
`;
    if (!contents.includes('import android.app.KeyguardManager')) {
      contents = contents.replace('import expo.modules.splashscreen.SplashScreenManager\n', 'import expo.modules.splashscreen.SplashScreenManager\n\nimport android.app.KeyguardManager\nimport android.content.Context\n');
    }
    if (!contents.includes('import android.content.Intent')) {
      contents = contents.replace(
        'import android.os.Bundle\n',
        `import android.content.Intent\nimport android.os.Bundle\nimport android.view.WindowManager\n`,
      );
    }

    const onCreateNeedle = '    super.onCreate(null)';
    if (contents.includes(onCreateNeedle) && !contents.includes(MAIN_ACTIVITY_ALARM_MARKER)) {
      contents = contents.replace(
        onCreateNeedle,
        `${onCreateNeedle}\n    applyAlarmLaunchWindowFlags(intent)`,
      );
    } else if (contents.includes('    super.onCreate(savedInstanceState)') && !contents.includes(MAIN_ACTIVITY_ALARM_MARKER)) {
      contents = contents.replace(
        '    super.onCreate(savedInstanceState)',
        `    super.onCreate(savedInstanceState)\n    applyAlarmLaunchWindowFlags(intent)`,
      );
    }

    if (!contents.includes('override fun onNewIntent')) {
      const delegateNeedle = '  override fun getMainComponentName()';
      const onNewIntentBlock = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyAlarmLaunchWindowFlags(intent)
  }

  private fun applyAlarmLaunchWindowFlags(intent: Intent?) {
    if (!isAlarmNotificationLaunch(intent)) {
      return
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
      val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      keyguard?.requestDismissKeyguard(this, null)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
          WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      )
    }
  }

  private fun isAlarmNotificationLaunch(intent: Intent?): Boolean {
    if (intent == null) {
      return false
    }
    val extras = intent.extras ?: return false
    if (extras.getBoolean("rippleAlarmFullScreen", false)) {
      return true
    }
    if (extras.containsKey("notificationResponse") || extras.containsKey("textInputNotificationResponse")) {
      return true
    }
    if (extras.containsKey("notification")) {
      return true
    }
    return intent.action == "expo.modules.notifications.NOTIFICATION_EVENT"
  }

`;
      if (contents.includes(delegateNeedle)) {
        contents = contents.replace(delegateNeedle, `${onNewIntentBlock}${delegateNeedle}`);
      }
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withAndroidAlarmActivity;
