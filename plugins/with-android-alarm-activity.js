const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

const MAIN_ACTIVITY_ALARM_MARKER = 'applyAlarmLaunchWindowFlags';

/**
 * Ensures MainActivity can show over the lock screen when opened from a full-screen alarm intent.
 * Without this, prebuild-generated manifests omit showWhenLocked / turnScreenOn.
 *
 * requestDismissKeyguard is intentionally NOT used — on devices with a PIN or
 * biometric lock it triggers the PIN entry screen and hides the alarm ring UI.
 * setShowWhenLocked / setTurnScreenOn display the activity *over* the keyguard
 * without attempting to dismiss it, which is the correct behaviour for alarms.
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

    // Inject only the imports we actually need (Intent, WindowManager).
    // Try multiple anchor patterns to handle SDK version differences.
    if (!contents.includes('import android.content.Intent')) {
      const intentAnchors = [
        'import android.os.Bundle\n',
        'import android.os.Build\n',
        'import expo.modules.splashscreen.SplashScreenManager\n',
      ];
      let injected = false;
      for (const anchor of intentAnchors) {
        if (contents.includes(anchor)) {
          contents = contents.replace(
            anchor,
            `${anchor}import android.content.Intent\n`,
          );
          injected = true;
          break;
        }
      }
      if (!injected) {
        console.warn('[with-android-alarm-activity] Could not inject Intent import.');
      }
    }

    if (!contents.includes('import android.view.WindowManager')) {
      const wmAnchors = [
        'import android.content.Intent\n',
        'import android.os.Bundle\n',
        'import android.os.Build\n',
      ];
      let injected = false;
      for (const anchor of wmAnchors) {
        if (contents.includes(anchor)) {
          contents = contents.replace(
            anchor,
            `${anchor}import android.view.WindowManager\n`,
          );
          injected = true;
          break;
        }
      }
      if (!injected) {
        console.warn('[with-android-alarm-activity] Could not inject WindowManager import.');
      }
    }

    // Hook into onCreate to apply window flags when launched from an alarm FSI.
    const onCreateNeedle = '    super.onCreate(null)';
    const onCreateNeedle2 = '    super.onCreate(savedInstanceState)';
    if (contents.includes(onCreateNeedle)) {
      contents = contents.replace(
        onCreateNeedle,
        `${onCreateNeedle}\n    applyAlarmLaunchWindowFlags(intent)`,
      );
    } else if (contents.includes(onCreateNeedle2)) {
      contents = contents.replace(
        onCreateNeedle2,
        `${onCreateNeedle2}\n    applyAlarmLaunchWindowFlags(intent)`,
      );
    }

    // Inject onNewIntent + helper methods before getMainComponentName.
    if (!contents.includes('override fun onNewIntent')) {
      const delegateNeedle = '  override fun getMainComponentName()';
      const helperBlock = `
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyAlarmLaunchWindowFlags(intent)
  }

  private fun applyAlarmLaunchWindowFlags(intent: Intent?) {
    if (!isAlarmNotificationLaunch(intent)) {
      return
    }
    // Tell AlarmSoundService to stop — the ring screen's expo-av takes over audio.
    try {
      val stopSvc = android.content.Intent().apply {
        setClassName(packageName, packageName + ".AlarmSoundService")
        action = packageName + ".STOP_ALARM_SOUND"
      }
      startService(stopSvc)
    } catch (_: Exception) {}
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      // Show the activity over the lock screen without dismissing it.
      // requestDismissKeyguard is intentionally omitted — it triggers the
      // PIN entry screen on locked devices and hides the alarm ring UI.
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun isAlarmNotificationLaunch(intent: Intent?): Boolean {
    if (intent == null) return false
    val extras = intent.extras ?: return false
    if (extras.getBoolean("rippleAlarmFullScreen", false)) return true
    if (extras.containsKey("notificationResponse") || extras.containsKey("textInputNotificationResponse")) return true
    if (extras.containsKey("notification")) return true
    return intent.action == "expo.modules.notifications.NOTIFICATION_EVENT"
  }

`;
      if (contents.includes(delegateNeedle)) {
        contents = contents.replace(delegateNeedle, `${helperBlock}${delegateNeedle}`);
      }
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withAndroidAlarmActivity;
