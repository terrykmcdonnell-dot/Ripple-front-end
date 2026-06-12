import { Platform } from 'react-native';

export type IosAlarmInterruptionLevel = 'timeSensitive' | 'critical';

/**
 * Critical Alerts are the closest iOS equivalent to Android alarm delivery:
 * they can bypass Focus and the hardware mute switch, but Apple must grant the
 * entitlement and the provisioning profile must include it.
 */
export function areIosCriticalAlertsConfigured(): boolean {
  return (
    Platform.OS === 'ios' &&
    process.env.EXPO_PUBLIC_IOS_CRITICAL_ALERTS_ENABLED === 'true'
  );
}

export function getIosAlarmInterruptionLevel(): IosAlarmInterruptionLevel {
  return areIosCriticalAlertsConfigured() ? 'critical' : 'timeSensitive';
}
