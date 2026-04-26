export const alarmTheme = {
  bg: '#080810',
  surface: '#0f0f1a',
  surface2: '#161625',
  surface3: '#1e1e30',
  accent: '#7c6af0',
  accentBright: '#a594ff',
  accentDim: 'rgba(124,106,240,0.15)',
  green: '#34d399',
  greenDim: 'rgba(52,211,153,0.12)',
  amber: '#fbbf24',
  amberDim: 'rgba(251,191,36,0.12)',
  red: '#f87171',
  text: '#eeeef8',
  muted: '#5a5a78',
  border: '#1e1e35',
} as const;

export type AlarmTone = 'purple' | 'green' | 'amber' | 'off';
