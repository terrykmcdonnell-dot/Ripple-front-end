export const alarmTheme = {
  bg: '#121212',
  surface: '#1a1a1a',
  surface2: '#242424',
  surface3: '#303030',
  accent: '#06b6d4',
  accentBright: '#67e8f9',
  accentDim: 'rgba(6,182,212,0.18)',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.12)',
  amber: '#fbbf24',
  amberDim: 'rgba(251,191,36,0.12)',
  red: '#f87171',
  text: '#f5f7ff',
  muted: '#a8b1cf',
  border: '#363636',
} as const;

export type AlarmTone = 'purple' | 'green' | 'amber' | 'off';
