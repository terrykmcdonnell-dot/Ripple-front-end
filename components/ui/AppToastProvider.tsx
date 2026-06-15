import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTabBarReservedHeight } from '@/components/alarms/BottomNavbar';
import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { setAuthToastHandler, type AuthToastVariant } from '@/lib/auth-notify';

type ToastContextValue = {
  showToast: (message: string, variant?: AuthToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useAppToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useAppToast must be used within AppToastProvider');
  }
  return ctx;
}

export function AppToastProvider({ children }: { children: ReactNode }) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createToastStyles(alarmTheme), [alarmTheme]);

  const [toast, setToast] = useState<{ message: string; variant: AuthToastVariant } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const sessionRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runDismissAnimation = useCallback(
    (session: number) => {
      opacity.stopAnimation();
      translateY.stopAnimation();
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 12,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && sessionRef.current === session) {
          setToast(null);
        }
      });
    },
    [opacity, translateY],
  );

  const showToast = useCallback(
    (msg: string, variant: AuthToastVariant = 'info') => {
      opacity.stopAnimation();
      translateY.stopAnimation();

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      const session = ++sessionRef.current;
      setToast({ message: msg, variant });
      opacity.setValue(0);
      translateY.setValue(12);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        if (session !== sessionRef.current) {
          return;
        }
        runDismissAnimation(session);
      }, msg.length > 120 ? 5200 : 3800);
    },
    [opacity, runDismissAnimation, translateY],
  );

  const dismissNow = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!toast) {
      return;
    }
    runDismissAnimation(sessionRef.current);
  }, [toast, runDismissAnimation]);

  useEffect(() => {
    setAuthToastHandler(showToast);
    return () => {
      setAuthToastHandler(null);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [showToast]);

  const ctxValue = useMemo(() => ({ showToast }), [showToast]);

  const bottomPad = useTabBarReservedHeight();

  const bubbleStyle = useMemo(() => {
    if (!toast) {
      return styles.bubbleInfo;
    }
    if (toast.variant === 'warning') {
      return styles.bubbleWarning;
    }
    if (toast.variant === 'error') {
      return styles.bubbleError;
    }
    return styles.bubbleInfo;
  }, [toast, styles]);

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.overlay]}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastWrap,
              {
                paddingBottom: bottomPad,
                opacity,
                transform: [{ translateY }],
              },
            ]}>
            <Pressable
              accessibilityRole="alert"
              onPress={() => dismissNow()}
              style={({ pressed }) => [styles.bubbleBase, bubbleStyle, pressed && styles.bubblePressed]}>
              <Text style={styles.text}>{toast.message}</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

function createToastStyles(theme: AlarmThemePalette) {
  return StyleSheet.create({
    overlay: {
      zIndex: 99999,
      elevation: 99999,
      justifyContent: 'flex-end',
    },
    toastWrap: {
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    bubbleBase: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.surface2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 3,
      paddingVertical: 16,
      paddingHorizontal: 20,
      elevation: 12,
    },
    bubbleInfo: {
      borderLeftColor: theme.accent,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
    },
    bubbleWarning: {
      borderLeftColor: theme.amber,
      shadowColor: theme.amber,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 14,
    },
    bubbleError: {
      borderLeftColor: theme.red,
      shadowColor: theme.red,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
    },
    bubblePressed: {
      opacity: 0.92,
    },
    text: {
      color: theme.text,
      fontSize: alarmTypography.body,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: alarmTypography.body + 6,
    },
  });
}
