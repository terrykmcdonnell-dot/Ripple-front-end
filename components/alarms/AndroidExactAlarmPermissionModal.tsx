import { AppConfirmModal } from '@/components/ui/AppConfirmModal';
import { openAndroidExactAlarmPermissionSettings } from '@/lib/open-android-exact-alarm-settings';

type AndroidExactAlarmPermissionModalProps = {
  visible: boolean;
  onComplete: () => void;
};

/**
 * Explains why exact-alarm permission is required, then opens the system settings page
 * when the user taps Allow (Android 12+).
 */
export function AndroidExactAlarmPermissionModal({
  visible,
  onComplete,
}: AndroidExactAlarmPermissionModalProps) {
  return (
    <AppConfirmModal
      visible={visible}
      title="Allow exact alarms"
      body={
        'Ripple needs permission to schedule exact alarms so your reminders ring on time.\n\n' +
        'Without it, Android may delay alarms by up to 15 minutes.\n\n' +
        'Tap Allow to open Alarms & reminders settings, then turn Ripple ON.'
      }
      onRequestClose={onComplete}
      actions={[
        {
          label: 'Later',
          variant: 'secondary',
          onPress: onComplete,
        },
        {
          label: 'Allow',
          variant: 'primary',
          onPress: () => {
            void openAndroidExactAlarmPermissionSettings();
            onComplete();
          },
        },
      ]}
    />
  );
}
