import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { AppModal } from '@/components/ui/AppModal';

const MAX_REVIEW_LENGTH = 500;

export type InAppReviewModalProps = {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (stars: number, message: string) => void | Promise<void>;
};

export function InAppReviewModal({ visible, onDismiss, onSubmit }: InAppReviewModalProps) {
  const palette = useAlarmTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [stars, setStars] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = stars >= 1 && !submitting;

  const resetForm = () => {
    setStars(0);
    setMessage('');
    setSubmitting(false);
  };

  const handleDismiss = () => {
    if (submitting) {
      return;
    }
    Keyboard.dismiss();
    resetForm();
    onDismiss();
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await onSubmit(stars, message);
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      transparent
      animationType="fade"
      visible={visible}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      onRequestClose={handleDismiss}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enjoying Ripple?</Text>
            <Text style={styles.modalBody}>Tap a star rating and optionally share what you think.</Text>

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((value) => {
                const filled = value <= stars;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${value} out of 5 stars`}
                    hitSlop={8}
                    style={styles.starButton}
                    onPress={() => setStars(value)}>
                    <MaterialIcons
                      name={filled ? 'star' : 'star-border'}
                      size={36}
                      color={filled ? palette.accentBright : palette.muted}
                    />
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Write a review (optional)"
              placeholderTextColor={palette.muted}
              style={styles.reviewInput}
              multiline
              textAlignVertical="top"
              maxLength={MAX_REVIEW_LENGTH}
              editable={!submitting}
            />
            <Text style={styles.charCount}>
              {message.length}/{MAX_REVIEW_LENGTH}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                disabled={submitting}
                onPress={handleDismiss}>
                <Text style={styles.modalBtnSecondaryText}>Not now</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  !canSubmit ? styles.modalBtnDisabled : null,
                ]}
                disabled={!canSubmit}
                onPress={() => void handleSubmit()}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppModal>
  );
}

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    modalCard: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: alarmTheme.surface,
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    modalTitle: {
      color: alarmTheme.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 10,
    },
    modalBody: {
      color: alarmTheme.muted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    starRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 4,
      marginBottom: 16,
    },
    starButton: {
      padding: 2,
    },
    reviewInput: {
      minHeight: 96,
      maxHeight: 140,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: alarmTheme.text,
      fontSize: 14,
      lineHeight: 20,
      backgroundColor: alarmTheme.surface2,
    },
    charCount: {
      alignSelf: 'flex-end',
      color: alarmTheme.muted,
      fontSize: 12,
      marginTop: 6,
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'flex-end',
    },
    modalBtn: {
      minWidth: 96,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
    },
    modalBtnSecondary: {
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    modalBtnSecondaryText: {
      color: alarmTheme.text,
      fontSize: 14,
      fontWeight: '600',
    },
    modalBtnPrimary: {
      backgroundColor: alarmTheme.accent,
    },
    modalBtnPrimaryText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    modalBtnDisabled: {
      opacity: 0.45,
    },
  });
}
