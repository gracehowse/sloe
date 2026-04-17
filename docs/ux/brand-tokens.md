# Brand colour tokens (web + mobile)

Single reference for **accent roles** so colours do not drift between the Next.js web app and Expo mobile app.

> **Note:** The palette shifted from violet (#7c3aed) to blue (#4c6ce0) during the 2026 design overhaul. Any remaining violet references in web components are legacy and should be migrated to the current blue primary.

## Accent palette

| Role | Hex (canonical) | Mobile token | Web CSS variable | Usage |
|------|-----------------|-------------|-----------------|--------|
| **Primary** | `#4c6ce0` | `Accent.primary` | `--primary` | Buttons, selected states, links, brand wordmark, protein macro |
| **Primary light** | `#6c8cff` | `Accent.primaryLight` | `--primary` (dark) | Dark mode tint, active tab (dark), sugar macro |
| **Success** | `#22a860` | `Accent.success` | `--success` | Confirmations, calorie/fiber macro, positive states |
| **Success light** | `#4cd080` | `Accent.successLight` | `--success` (dark) | Dark mode success tint |
| **Warning** | `#e8a020` | `Accent.warning` | `--warning` | Over-budget indicator, carbs macro, activity bonus |
| **Warning light** | `#ffc04c` | `Accent.warningLight` | `--warning` (dark) | Dark mode warning tint |
| **Destructive** | `#e04848` | `Accent.destructive` | `--destructive` | Errors, dangerous actions only — never for over-budget |
| **Destructive light** | `#ff6c6c` | `Accent.destructiveLight` | `--destructive` (dark) | Dark mode destructive tint |
| **Magenta** | `#e04888` | `Accent.magenta` | `--macro-fat` | Fat macro, gradient accent — not for standalone body UI |
| **Cyan** | `#06b6d4` | `Accent.cyan` | `--macro-water` | Water tracking, exercise/activity |
| **Orange** | `#f97316` | `Accent.orange` | n/a | Sodium macro |
| **Info** | `#0ea5e9` | `Accent.info` | n/a | Informational accents |

## Macro colours

Fixed across all screens. Never hardcode — always reference `MacroColors` (mobile) or `--macro-*` (web).

| Macro | Colour | Hex |
|-------|--------|-----|
| Calories | Success (green) | `#22a860` |
| Protein | Primary (blue) | `#4c6ce0` |
| Carbs | Warning (amber) | `#e8a020` |
| Fat | Magenta (pink) | `#e04888` |
| Fiber | Success (green) | `#22a860` |
| Sugar | Primary light (blue) | `#6c8cff` |
| Sodium | Orange | `#f97316` |
| Water | Cyan | `#06b6d4` |

## Surface colours

| Role | Light | Dark | Mobile token |
|------|-------|------|-------------|
| Background | `#ffffff` | `#0a0a0f` | `Colors.*.background` |
| Background secondary | `#f8fafc` | `#111118` | `Colors.*.backgroundSecondary` |
| Card | `#ffffff` | `#16161e` | `Colors.*.card` |
| Card border | `#e2e8f0` | `#2a2a3a` | `Colors.*.cardBorder` |
| Border | `#e2e8f0` | `#1e1e2a` | `Colors.*.border` |
| Input background | `#f1f5f9` | `#1e1e2a` | `Colors.*.inputBg` |
| Overlay | `#00000088` | `#000000aa` | `Colors.*.overlay` |

## Text colours

| Role | Light | Dark |
|------|-------|------|
| Primary text | `#0f172a` | `#f8fafc` |
| Secondary text | `#475569` | `#94a3b8` |
| Tertiary text | `#94a3b8` | `#64748b` |

## Where it lives in code

- **Mobile:** `apps/mobile/constants/theme.ts` — `Accent`, `MacroColors`, `Brand`, `Colors.light` / `Colors.dark`, `Spacing`, `Radius`.
- **Web:** `src/styles/theme.css` — CSS custom properties. When adding a new surface, use existing tokens. Do not introduce new hex values without updating this doc.

## Spacing tokens

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 12px |
| `lg` | 16px |
| `xl` | 20px |
| `xxl` | 24px |
| `xxxl` | 32px |

## Radius tokens

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Chips, badges, small buttons |
| `md` | 12px | Inputs, standard buttons |
| `lg` | 16px | Cards (canonical card radius) |
| `xl` | 20px | Large cards, modals |
| `full` | 9999px | Pills, circular badges |

## Rules

1. **No hardcoded hex values in components.** All colours must come from theme tokens or `useThemeColors()`.
2. **One primary per screen region.** Do not mix `primary` and `primaryLight` as competing accents.
3. **Magenta is not a standalone accent** — only for fat macro and gradient endpoints.
4. **Over-budget = warning (amber), never destructive (red).** Red implies failure.
5. **Macro colours are immutable.** They must not change per-screen or per-context.
6. **Surface tints use `color + "08"` consistently.** Do not mix "08", "12", "18", "20" for the same role.

## Visual QA checklist

When changing accents, spot-check: Discover header, tab bar (light + dark), tracker macro chips, paywall header, calorie ring, burn detail, and one settings row. Verify both light and dark mode.
