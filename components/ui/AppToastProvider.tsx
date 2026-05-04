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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

/** Matches typical scroll `paddingBottom` above `BottomNavbar`. */
const TOAST_ABOVE_TAB_BAR = 88;

type ToastContextValue = {
  showToast: (message: string) => void;
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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createToastStyles(alarmTheme), [alarmTheme]);

  const [message, setMessage] = useState<string | null>(null);
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
          setMessage(null);
        }
      });
    },
    [opacity, translateY],
  );

  const showToast = useCallback(
    (msg: string) => {
      opacity.stopAnimation();
      translateY.stopAnimation();

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      const session = ++sessionRef.current;
      setMessage(msg);
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
      }, 2600);
    },
    [opacity, runDismissAnimation, translateY],
  );

  const dismissNow = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!message) {
      return;
    }
    runDismissAnimation(sessionRef.current);
  }, [message, runDismissAnimation]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const ctxValue = useMemo(() => ({ showToast }), [showToast]);

  const bottomPad = TOAST_ABOVE_TAB_BAR + Math.max(insets.bottom, 8);

  return (
    <ToastContext.Provider value={ctxValue}>
      {children}
      {message ? (
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
              style={({ pressed }) => [styles.bubble, pressed && styles.bubblePressed]}>
              <Text style={styles.text}>{message}</Text>
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
    bubble: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.surface2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 3,
      borderLeftColor: theme.accent,
      paddingVertical: 14,
      paddingHorizontal: 18,
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 12,
    },
    bubblePressed: {
      opacity: 0.92,
    },
    text: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
