import { Modal, type ModalProps } from 'react-native';

/**
 * On iOS, a mounted `<Modal visible={false} />` can still intercept touches.
 * Only mount the native modal while it should be shown.
 */
export function AppModal({ visible, children, ...rest }: ModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <Modal visible animationType="fade" {...rest}>
      {children}
    </Modal>
  );
}
