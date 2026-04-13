import { Platform } from 'react-native';

/**
 * Platemate brand accents (mobile). Primary actions: `Neon.violet` / `Neon.purple` (aligned with web Tailwind
 * violet–indigo accents in the Next app). Use `Brand.gradient` for hero / marketing-style highlights only.
 * Canonical roles: `docs/ux/brand-tokens.md`.
 */
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
    text: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    background: '#ffffff',
    backgroundSecondary: '#f8fafc',
    card: '#ffffff',
    cardBorder: '#e2e8f0',
    border: '#e2e8f0',
    tint: Neon.violet,
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: Neon.violet,
    inputBg: '#f1f5f9',
    overlay: '#00000088',
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    background: '#0a0a0f',
    backgroundSecondary: '#111118',
    card: '#16161e',
    cardBorder: '#2a2a3a',
    border: '#1e1e2a',
    tint: Neon.violet,
    icon: '#94a3b8',
    tabIconDefault: '#4a4a5a',
    tabIconSelected: Neon.purple,
    inputBg: '#1e1e2a',
    overlay: '#000000aa',
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
