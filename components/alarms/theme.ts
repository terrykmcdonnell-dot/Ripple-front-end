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

/** Reference-stable for `alarmTheme === alarmThemes.dark` checks (dark-only app). */
export const alarmThemes = {
  dark,
} as const;

/** Dark tokens for static `StyleSheet.create` outside hooks. */
export const alarmTheme = alarmThemes.dark;

export function useAlarmTheme(): AlarmThemePalette {
  return alarmThemes.dark;
}
