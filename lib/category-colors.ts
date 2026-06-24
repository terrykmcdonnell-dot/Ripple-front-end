import type { AlarmThemePalette, AlarmTone } from '@/components/alarms/theme';
import type { AlarmCategoryColorKey } from '@/lib/alarm-categories';

export type CategoryColorTokens = {
  main: string;
  dim: string;
};

/** Theme tokens for one category accent color. */
export function categoryColorTokens(palette: AlarmThemePalette, colorKey: AlarmCategoryColorKey): CategoryColorTokens {
  switch (colorKey) {
    case 'green':
      return { main: palette.green, dim: palette.greenDim };
    case 'amber':
      return { main: palette.amber, dim: palette.amberDim };
    case 'blue':
      return { main: palette.blue, dim: palette.blueDim };
    case 'red':
      return { main: palette.red, dim: palette.redDim };
    case 'purple':
    default:
      return { main: palette.accentBright, dim: palette.accentDim };
  }
}

export function categoryColorKeyToTone(colorKey: AlarmCategoryColorKey | string | undefined): AlarmTone {
  switch (colorKey) {
    case 'green':
      return 'green';
    case 'amber':
      return 'amber';
    case 'blue':
      return 'blue';
    case 'red':
      return 'red';
    case 'purple':
    default:
      return 'purple';
  }
}

export function categoryColorToggleOnColor(
  palette: AlarmThemePalette,
  colorKey: AlarmCategoryColorKey | string | undefined,
): string | undefined {
  switch (colorKey) {
    case 'green':
      return palette.green;
    case 'amber':
      return palette.amber;
    case 'blue':
      return palette.blue;
    case 'red':
      return palette.red;
    case 'purple':
    default:
      return palette.accent;
  }
}

/** Active chip styling for category pickers (create/edit alarm, settings). */
export function categoryChipActiveStyle(palette: AlarmThemePalette, colorKey: AlarmCategoryColorKey) {
  const { main, dim } = categoryColorTokens(palette, colorKey);
  return {
    backgroundColor: dim,
    borderColor: main,
    textColor: main,
  };
}

export const CATEGORY_COLOR_OPTIONS: Array<{ key: AlarmCategoryColorKey; label: string; sample: string }> = [
  { key: 'purple', label: 'Teal', sample: '#22d3ee' },
  { key: 'green', label: 'Green', sample: '#34d399' },
  { key: 'amber', label: 'Amber', sample: '#fbbf24' },
  { key: 'blue', label: 'Blue', sample: '#60a5fa' },
  { key: 'red', label: 'Red', sample: '#f87171' },
];
