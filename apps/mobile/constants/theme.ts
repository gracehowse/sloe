import { Platform } from 'react-native';

/** Neon accent colors */
export const Neon = {
  pink: '#ff2d78',
  purple: '#a855f7',
  violet: '#7c3aed',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
  magenta: '#e839f6',
};

/** Macro-specific colors */
export const MacroColors = {
  calories: Neon.purple,
  protein: Neon.red,
  carbs: Neon.blue,
  fat: Neon.yellow,
  fiber: Neon.green,
  sugar: Neon.purple,
  sodium: Neon.orange,
  water: Neon.cyan,
};

/** Brand */
export const Brand = {
  violet: Neon.violet,
  pink: Neon.pink,
  gradient: [Neon.violet, Neon.pink] as const,
};

/** Dark-first color system */
export const Colors = {
  light: {
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    background: '#0a0a0f',
    backgroundSecondary: '#111118',
    card: '#16161e',
    cardBorder: Neon.pink + '40',
    border: '#1e1e2a',
    tint: Neon.violet,
    icon: '#94a3b8',
    tabIconDefault: '#4a4a5a',
    tabIconSelected: Neon.pink,
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    background: '#0a0a0f',
    backgroundSecondary: '#111118',
    card: '#16161e',
    cardBorder: Neon.pink + '40',
    border: '#1e1e2a',
    tint: Neon.violet,
    icon: '#94a3b8',
    tabIconDefault: '#4a4a5a',
    tabIconSelected: Neon.pink,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    mono: 'Menlo',
  },
  default: {
    sans: 'System',
    mono: 'monospace',
  },
});
