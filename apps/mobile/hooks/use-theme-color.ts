/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  // 2026-05-15 — RN 0.85 forward-compat: `useColorScheme()` now returns
  // `ColorSchemeName` (`'light' | 'dark' | null | undefined`). After
  // `?? 'light'` the value is logically `'light' | 'dark'`, but TS no
  // longer narrows the union for indexing, so we widen via a concrete
  // alias.
  const theme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
