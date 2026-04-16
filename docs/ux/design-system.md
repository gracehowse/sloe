# Suppr Design System

Technical reference for the token system, component patterns, and implementation rules that enforce the brand guidelines. See `brand-guidelines.md` for the "why" and `brand-tokens.md` for the colour palette.

## Token architecture

### Source of truth

| Platform | File | Tokens |
|----------|------|--------|
| Mobile | `apps/mobile/constants/theme.ts` | `Accent`, `MacroColors`, `Brand`, `Colors`, `Spacing`, `Radius` |
| Web | `src/styles/theme.css` | CSS custom properties (`--primary`, `--macro-*`, etc.) |

These two files must stay in sync. When updating a colour, update both. The brand-tokens doc (`docs/ux/brand-tokens.md`) is the human-readable reference.

### Font weight scale

Use semantic names, not raw numbers. Add this to components as needed:

| Name | Weight | Usage |
|------|--------|-------|
| regular | `"400"` | Body text, descriptions, helper text |
| medium | `"500"` | Subtle emphasis (rarely used) |
| semibold | `"600"` | Labels, section titles within cards, row labels |
| bold | `"700"` | Screen titles, headings, CTAs, card titles |
| heavy | `"800"` | Hero numbers only (calorie totals, stat grid, fasting timer) |

**Do not use `fontWeight: "900"`.** Maximum weight in product UI is 800.

### Spacing scale

Mobile tokens (`Spacing.*`):

| Token | px | Common use |
|-------|-----|-----------|
| `xs` | 4 | Tight gaps within a row, icon-to-text |
| `sm` | 8 | Standard inner gap, between related elements |
| `md` | 12 | Card inner padding (compact), between sections |
| `lg` | 16 | Card padding, section gaps, primary rhythm unit |
| `xl` | 20 | Between major sections |
| `xxl` | 24 | Page-level padding |
| `xxxl` | 32 | Hero spacing, page top/bottom insets |

**Rules:**
- Never use raw pixel values (`paddingVertical: 14`). Use the nearest token.
- If no token fits, add one to the scale rather than hardcoding.
- The 4px base grid means all spacing should be divisible by 4.

### Radius scale

| Token | px | Usage |
|-------|-----|-------|
| `sm` | 8 | Chips, badges, small buttons, inner elements |
| `md` | 12 | Inputs, standard buttons, toggles |
| `lg` | 16 | Cards (canonical card radius), modals |
| `xl` | 20 | Large cards, bottom sheets |
| `full` | 9999 | Pills, circular elements, avatar frames |

**Rule:** Cards always use `Radius.lg` (16). Never `borderRadius: 14`.

### Surface hierarchy

| Level | Light | Dark | When to use |
|-------|-------|------|-------------|
| 0 — Page | `#ffffff` | `#0a0a0f` | Full-screen background |
| 0.5 — Grouped | `#f8fafc` | `#111118` | Background behind card groups |
| 1 — Card | `#ffffff` | `#16161e` | Standard card surface |
| 2 — Elevated | `#ffffff` | `#202028` | Modals, popovers, bottom sheets |
| Overlay | `#00000088` | `#000000aa` | Behind modals |

### Surface tints

When tinting a surface with an accent colour (e.g., a subtle primary background for a card), use **one consistent opacity**:

| Role | Opacity suffix | Example |
|------|---------------|---------|
| Subtle tint | `"08"` | `Accent.primary + "08"` — card backgrounds, section highlights |
| Medium tint | `"18"` | `Accent.primary + "18"` — icon box backgrounds, badge fills |
| Strong tint | `"30"` | `Accent.primary + "30"` — progress bar tracks |

**Do not mix** `"08"`, `"10"`, `"12"`, `"15"`, `"20"` for the same role. Pick from the three tiers above.

### Shadow tokens

| Level | Light mode | Dark mode | Usage |
|-------|-----------|-----------|-------|
| None | `none` | `none` | Flat elements, items within cards |
| Card | `0 1px 3px rgba(0,0,0,0.04)` | `none` (rely on border) | Standard cards |
| Elevated | `0 4px 12px rgba(0,0,0,0.08)` | `0 4px 12px rgba(0,0,0,0.25)` | Modals, FABs, popovers |

Dark mode cards should rely on `cardBorder` for definition, not shadow.

## Component patterns

### Card

```
<View style={{
  backgroundColor: colors.card,
  borderRadius: Radius.lg,        // always 16
  borderWidth: 1,
  borderColor: colors.cardBorder,
  padding: Spacing.lg,            // always 16
}}>
```

### Empty state

Every empty state should follow this pattern:

```
<View style={{ alignItems: "center", paddingVertical: 40 }}>
  <IconBox color={...} size={28}>
    <Ionicons name="..." size={14} color={...} />
  </IconBox>
  <Text style={{ fontSize: 15, fontWeight: "600" }}>Title here</Text>
  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
    Description of what will appear and how to populate it.
  </Text>
</View>
```

Never use emoji as illustration. Never use bare text without an icon.

### Over-budget state

When calories or macros exceed the target:
- 0–100% of goal: success colour (green)
- 100–120%: warning colour (amber)
- 120%+: warning colour (deeper amber via `warningLight` in dark mode)
- **Never use destructive (red).** Red implies failure.

### Pressed states

Use `opacity: 0.92` for press feedback on cards and list rows. For buttons, use a darkened background (not opacity change).

## Implementation rules

1. **No hardcoded hex values in component files.** Import from `theme.ts` or use `useThemeColors()`.
2. **No raw `fontWeight` numbers.** Use the semantic weight names documented above.
3. **No raw `borderRadius` numbers on cards.** Use `Radius.lg`.
4. **No raw spacing pixels.** Use `Spacing.*` tokens.
5. **Every screen must support dark mode** via `useThemeColors()`. No static `StyleSheet.create` with light-only colours.
6. **`tabular-nums`** on every changing number: `fontVariant: ["tabular-nums"]`.
7. **Ionicons outline** for icons in cards and navigation. **Filled** only for active tab bar state.

## Audit checklist

Before shipping a new screen or significant UI change:

- [ ] All colours from theme tokens (no hardcoded hex)
- [ ] Dark mode renders correctly
- [ ] Cards use `Radius.lg` (16)
- [ ] Spacing uses `Spacing.*` tokens
- [ ] Font weights follow semantic scale
- [ ] Numbers use `tabular-nums`
- [ ] Empty states use the shared pattern (icon + heading + description)
- [ ] Over-budget states use amber, not red
- [ ] No motivational/guilt language in copy
