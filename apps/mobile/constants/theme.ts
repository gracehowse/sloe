import { Platform } from 'react-native';

export const Brand = {
  violet: '#7c3aed',
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
};

export const Colors = {
  light: {
    text: '#0f172a',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    background: '#ffffff',
    backgroundSecondary: '#f8fafc',
    card: '#ffffff',
    border: '#e2e8f0',
    tint: Brand.violet,
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: Brand.violet,
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    background: '#020617',
    backgroundSecondary: '#0f172a',
    card: '#0f172a',
    border: '#1e293b',
    tint: '#a78bfa',
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: '#a78bfa',
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
