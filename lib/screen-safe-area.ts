import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Minimum bottom inset when edge-to-edge reports 0 but system nav still overlaps. */
export const ANDROID_MIN_BOTTOM_INSET = 32;
export const IOS_MIN_BOTTOM_INSET = 8;

export function resolveBottomSafeInset(insets: { bottom: number }): number {
  const minBottom = Platform.OS === 'android' ? ANDROID_MIN_BOTTOM_INSET : IOS_MIN_BOTTOM_INSET;
  return Math.max(insets.bottom, minBottom);
}

/** Scroll padding for full screens without a tab bar (edit alarm, auth, paywall, etc.). */
export function useBottomSafePadding(extra = 16): number {
  const insets = useSafeAreaInsets();
  return extra + resolveBottomSafeInset(insets);
}

/** Bottom padding for slide-up sheets and modals anchored to the screen bottom. */
export function useBottomSheetPadding(base = 16): number {
  const insets = useSafeAreaInsets();
  return base + resolveBottomSafeInset(insets);
}
