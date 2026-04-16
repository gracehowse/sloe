import { Platform } from 'react-native';

/**
 * Suppr brand accents (mobile). Aligned with the web design-overhaul palette.
 * Primary: `Accent.primary` (#4c6ce0 blue). Use `Brand.gradient` for hero highlights only.
 * Canonical roles: `docs/ux/brand-tokens.md`.
 */
/** Accent palette — aligned with web CSS custom properties in theme.css */
export const Accent = {
  primary: '#4c6ce0',
  primaryLight: '#6c8cff',
  success: '#22a860',
  successLight: '#4cd080',
  warning: '#e8a020',
  warningLight: '#ffc04c',
  destructive: '#e04848',
  destructiveLight: '#ff6c6c',
  cyan: '#06b6d4',
  orange: '#f97316',
  magenta: '#e04888',
  /** Info / carbs-style accent (aligned with web macro-carbs tone where needed) */
  info: '#0ea5e9',
};

/** Legacy alias — use Accent instead for new code */
export const Neon = {
  pink: Accent.magenta,
  purple: Accent.primaryLight,
  violet: Accent.primary,
  blue: Accent.primary,
  cyan: Accent.cyan,
  green: Accent.success,
  yellow: Accent.warning,
  orange: Accent.orange,
  red: Accent.destructive,
  magenta: Accent.magenta,
};

/** Macro-specific colors — aligned with web --macro-* CSS custom properties */
export const MacroColors = {
  calories: Accent.success,       // web: --macro-calories (#22a860)
  protein: Accent.primary,        // web: --macro-protein  (#4c6ce0)
  carbs: Accent.warning,          // web: --macro-carbs    (#e8a020)
  fat: Accent.magenta,            // web: --macro-fat      (#e04888)
  fiber: Accent.success,
  sugar: Accent.primaryLight,
  sodium: Accent.orange,
  water: Accent.cyan,
};

/** Brand */
export const Brand = {
  primary: Accent.primary,
  accent: Accent.magenta,
  gradient: [Accent.primary, Accent.magenta] as const,
  /** @deprecated — use Brand.primary */
  violet: Accent.primary,
  /** @deprecated — use Brand.accent */
  pink: Accent.magenta,
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
    tint: Accent.primary,
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: Accent.primary,
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
    tint: Accent.primaryLight,
    icon: '#94a3b8',
    tabIconDefault: '#4a4a5a',
    tabIconSelected: Accent.primaryLight,
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

/** Semantic font weight scale — use these instead of raw weight strings */
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
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
