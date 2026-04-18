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

/**
 * Stimulant tracker colours (Batch 2.5 hydration & stimulants).
 * Caffeine is its own violet tone (not a macro role). Alcohol uses the
 * same amber hue as the warning accent — the semantic is "approaching
 * weekly limit", not error. Mirrors web `--stimulant-caffeine` /
 * `--stimulant-alcohol` in `src/styles/theme.css`. See
 * `docs/ux/brand-tokens.md` for the full role table.
 */
export const StimulantColors = {
  caffeine: '#8b5cf6',
  alcohol: '#f59e0b',
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

/**
 * Dark-first color system.
 *
 * Cross-platform alignment (2026-04-18):
 *   - Foreground / border / input-bg hexes mirror `src/styles/theme.css`
 *     so a side-by-side comparison of mobile and web doesn't betray
 *     two different hue families (slate vs neutral-zinc).
 *   - **Background** stays divergent on purpose — mobile keeps pure
 *     white in light mode and `#0a0a0f` (OLED-friendly black) in dark
 *     mode, while web uses `#f4f5f7` / `#101014` (slightly off-white +
 *     slightly raised black) for desktop eye-comfort. Documented in
 *     `PARITY_AUDIT.md` "Token alignment".
 *   - Card colour follows the same logic — mobile cards sit on the
 *     OLED-black background, web cards on the raised dark background.
 */
export const Colors = {
  light: {
    text: '#111118',                // ↔ web --foreground
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    background: '#ffffff',          // intentional divergence (see header)
    backgroundSecondary: '#f8fafc',
    card: '#ffffff',
    cardBorder: '#e4e4ec',          // ↔ web --border
    border: '#e4e4ec',              // ↔ web --border
    tint: Accent.primary,
    icon: '#6b6b78',                // ↔ web --fg-muted
    tabIconDefault: '#94a3b8',
    tabIconSelected: Accent.primary,
    inputBg: '#ededf2',             // ↔ web --input-background
    overlay: '#00000088',
  },
  dark: {
    text: '#e4e4e8',                // ↔ web --foreground (dark)
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    background: '#0a0a0f',          // intentional divergence — OLED-friendly
    backgroundSecondary: '#111118',
    card: '#16161e',                // intentional — sits on OLED-black bg
    cardBorder: '#282830',          // ↔ web --border (dark)
    border: '#282830',              // ↔ web --border (dark)
    tint: Accent.primaryLight,
    icon: '#7a7a88',                // ↔ web --fg-muted (dark)
    tabIconDefault: '#4a4a5a',
    tabIconSelected: Accent.primaryLight,
    inputBg: '#202028',             // ↔ web --input-background (dark)
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
