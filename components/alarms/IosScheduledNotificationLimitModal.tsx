import { AppConfirmModal } from '@/components/ui/AppConfirmModal';

type IosScheduledNotificationLimitModalProps = {
  visible: boolean;
  scheduledCount: number;
  onDismiss: () => void;
};

/** One-time warning when iOS scheduled notification count nears the ~64 limit. */
export function IosScheduledNotificationLimitModal({
  visible,
  scheduledCount,
  onDismiss,
}: IosScheduledNotificationLimitModalProps) {
  return (
    <AppConfirmModal
      visible={visible}
      title="Many alarms scheduled"
      body={
        `iOS limits each app to about 64 scheduled notifications. Ripple currently has ${scheduledCount} scheduled.\n\n` +
        'If you have many alarms turned on, some may not ring reliably. Try turning off alarms you do not need.'
      }
      onRequestClose={onDismiss}
      actions={[
        {
          label: 'OK',
          variant: 'primary',
          onPress: onDismiss,
        },
      ]}
    />
  );
}
