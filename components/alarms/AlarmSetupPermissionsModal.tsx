import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import type { AndroidAlarmPermissionWarning } from '@/lib/android-alarm-permissions-status';

type AlarmSetupPermissionsModalProps = {
  visible: boolean;
  warnings: AndroidAlarmPermissionWarning[];
  onComplete: () => void;
};

/**
 * Shown when the user saves their first alarm and Android lock-screen settings are still off.
 */
export function AlarmSetupPermissionsModal({
  visible,
  warnings,
  onComplete,
}: AlarmSetupPermissionsModalProps) {
  const primary = warnings[0];
  if (!primary) {
    return null;
  }

  const bodyLines = warnings.map((w) => `• ${w.title}: ${w.body}`).join('\n\n');

  return (
    <AppConfirmModal
      visible={visible}
      title="Enable lock-screen alarms"
      body={
        'Ripple needs a couple of Android permissions so alarms can ring on your lock screen.\n\n' +
        `${bodyLines}\n\n` +
        'Tap Open Settings, find Ripple in the list, and turn it ON.'
      }
      onRequestClose={onComplete}
      actions={[
        {
          label: 'Later',
          variant: 'secondary',
          onPress: onComplete,
        },
        {
          label: 'Open Settings',
          variant: 'primary',
          onPress: () => {
            void primary.openSettings();
            onComplete();
          },
        },
      ]}
    />
  );
}
