import {
  AndroidAudioContentType,
  AndroidAudioUsage,
  AndroidImportance,
  AndroidNotificationVisibility,
} from 'expo-notifications/build/NotificationChannelManager.types';
import setNotificationChannelAsync from 'expo-notifications/build/setNotificationChannelAsync';

/**
 * Android: alarm-style channel so fire/snooze sounds use **USAGE_ALARM** (follows alarm volume,
 * still audible when notification stream is muted), **enforceAudibility**, and **bypassDnd** where allowed.
 */
export async function setAndroidAlarmStyleNotificationChannelAsync(
  channelId: string,
  options: {
    name: string;
    sound: string;
    enableVibrate: boolean;
    vibrationPattern?: readonly number[];
  },
): Promise<void> {
  await setNotificationChannelAsync(channelId, {
    name: options.name,
    importance: AndroidImportance.MAX,
    bypassDnd: true,
    audioAttributes: {
      usage: AndroidAudioUsage.ALARM,
      contentType: AndroidAudioContentType.SONIFICATION,
      flags: {
        enforceAudibility: true,
        requestHardwareAudioVideoSynchronization: false,
      },
    },
    enableVibrate: options.enableVibrate,
    ...(options.enableVibrate && options.vibrationPattern != null
      ? { vibrationPattern: [...options.vibrationPattern] }
      : {}),
    sound: options.sound,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
  });
}
