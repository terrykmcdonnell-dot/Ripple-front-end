import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  DEFAULT_APP_THEME,
  loadAppThemePreference,
  type AppThemePreference,
  getAppThemeGeneration,
  subscribeAppThemeGeneration,
} from '@/lib/settings-preferences';

/** Stripe / chip coloring on alarm rows */
export type AlarmTone = 'purple' | 'green' | 'amber' | 'off';

export type AlarmThemePalette = {
  bg: string;
  text: string;
  muted: string;
  border: string;
  surface: string;
  surface2: string;
  surface3: string;
  accent: string;
  accentBright: string;
  accentDim: string;
  accentBannerBorder: string;
  navBarBg: string;
  green: string;
  greenDim: string;
  amber: string;
  amberDim: string;
  blueDim: string;
  red: string;
  redDim: string;
};

const dark: AlarmThemePalette = {
  bg: '#070b10',
  text: '#f1f5f9',
  muted: '#94a3b8',
  border: '#273549',
  surface: '#0f141c',
  surface2: '#151d28',
  surface3: '#1f2937',
  accent: '#06b6d4',
  accentBright: '#22d3ee',
  accentDim: 'rgba(6, 182, 212, 0.14)',
  accentBannerBorder: 'rgba(6, 182, 212, 0.35)',
  navBarBg: '#0a1018',
  green: '#34d399',
  greenDim: 'rgba(52, 211, 153, 0.18)',
  amber: '#fbbf24',
  amberDim: 'rgba(251, 191, 36, 0.18)',
  blueDim: 'rgba(96, 165, 250, 0.18)',
  red: '#f87171',
  redDim: 'rgba(248, 113, 113, 0.18)',
};

/** Light theme: high-contrast type, cool neutrals, slightly stronger separators (modern “paper on tint” look). */
const light: AlarmThemePalette = {
  bg: '#eef1f6',
  text: '#0b1220',
  muted: '#4a5568',
  border: '#c8d1dd',
  surface: '#ffffff',
  surface2: '#f5f7fb',
  surface3: '#e4eaf2',
  accent: '#0d7c8a',
  accentBright: '#0891b2',
  accentDim: 'rgba(13, 124, 138, 0.12)',
  accentBannerBorder: 'rgba(13, 124, 138, 0.24)',
  navBarBg: '#f8f9fc',
  green: '#047857',
  greenDim: 'rgba(4, 120, 87, 0.12)',
  amber: '#b45309',
  amberDim: 'rgba(180, 83, 9, 0.12)',
  blueDim: 'rgba(29, 78, 216, 0.10)',
  red: '#b91c1c',
  redDim: 'rgba(185, 28, 28, 0.12)',
};

/** Resolved palettes — use `useAlarmTheme()` in screens. */
export const alarmThemes = {
  dark,
  light,
} as const;

/** Default dark tokens for rare legacy/static paths that cannot use hooks. */
export const alarmTheme = alarmThemes.dark;

export function resolveAlarmThemePalette(
  preference: AppThemePreference,
  systemColorScheme: 'light' | 'dark' | null | undefined,
): AlarmThemePalette {
  if (preference === 'Light') {
    return alarmThemes.light;
  }
  if (preference === 'Dark') {
    return alarmThemes.dark;
  }
  const scheme = systemColorScheme === 'dark' ? 'dark' : 'light';
  return scheme === 'dark' ? alarmThemes.dark : alarmThemes.light;
}

export function isAlarmPaletteDark(palette: AlarmThemePalette): boolean {
  return palette.bg === alarmThemes.dark.bg;
}

/** Typography scale (dp) — biased toward comfortable reading (not ultra-compact). */
export const alarmTypography = {
  /** Fine print, tab labels */
  micro: 12,
  /** Secondary lines, nav hints */
  caption: 14,
  /** Primary body / list rows */
  body: 16,
  /** Emphasized body, sheet titles */
  bodyLarge: 18,
  /** Card titles, settings row titles */
  titleSm: 22,
  /** Primary time on alarm cards / list rows */
  timeRow: 28,
  /** Screen titles */
  title: 28,
  /** Large headers */
  titleLg: 34,
  /** Hero clock */
  displayTime: 60,
} as const;

type AlarmThemeContextValue = {
  palette: AlarmThemePalette;
  preference: AppThemePreference;
};

const AlarmThemeContext = createContext<AlarmThemeContextValue | null>(null);

export function AlarmThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const gen = useSyncExternalStore(subscribeAppThemeGeneration, getAppThemeGeneration, () => 0);
  const [preference, setPreference] = useState<AppThemePreference>(DEFAULT_APP_THEME);

  useEffect(() => {
    void loadAppThemePreference().then(setPreference);
  }, [gen]);

  const palette = useMemo(
    () => resolveAlarmThemePalette(preference, systemScheme),
    [preference, systemScheme],
  );

  const value = useMemo(() => ({ palette, preference }), [palette, preference]);

  return createElement(AlarmThemeContext.Provider, { value }, children);
}

export function useAlarmTheme(): AlarmThemePalette {
  const ctx = useContext(AlarmThemeContext);
  if (!ctx) {
    throw new Error('useAlarmTheme must be used within AlarmThemeProvider');
  }
  return ctx.palette;
}

export function useAlarmThemePreference(): AppThemePreference {
  const ctx = useContext(AlarmThemeContext);
  if (!ctx) {
    throw new Error('useAlarmThemePreference must be used within AlarmThemeProvider');
  }
  return ctx.preference;
}
