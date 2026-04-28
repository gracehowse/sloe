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

### Brand mark — `SupprMark` / `SupprWordmark`

The rounded-square "S" logo, exposed as a React component on both
surfaces so brand placements (sign-in, paywall, marketing pages) stay
visually identical without copying SVG markup around.

| Surface | File |
|---------|------|
| Web | `src/app/components/ui/suppr-mark.tsx` |
| Mobile | `apps/mobile/components/SupprMark.tsx` |

**Rules:**
- Background is always brand `--primary` blue. Letter is always white.
  The dark-mode lift to the brighter blue happens automatically via
  the `--primary` token — never override the colours per surface.
- Wordmark composes Mark + the "Suppr" label with proportional spacing
  (`gap-2.5` web, `gap: 10` mobile). Pass the same `size` prop to both
  surfaces if you need them to match in side-by-side comparisons.
- Use the **mark alone** for tab bar / nav / favicon contexts. Use the
  **wordmark** for sign-in headers, paywall heroes, and marketing.

### Selection card — `OptionCard`

Tappable card for picking one (or many) from a small list. Standard
shape used by every onboarding step that asks the user to choose
between a handful of named options (Goal, Sex, Activity, Diet).

| Surface | File |
|---------|------|
| Web | `src/app/components/ui/option-card.tsx` |
| Mobile | `apps/mobile/components/OptionCard.tsx` |

**Anatomy:** optional left icon (auto-tinted to `--primary` when
selected) → title → optional subtitle → trailing slot (default is a
check/uncheck radio circle).

**Rules:**
- Renders a real `<button>` (web) / `<Pressable accessibilityRole="radio">`
  (mobile) so keyboard + screen reader work without extra ARIA wiring
  on the consumer.
- Selected state is announced via `aria-pressed` (web) and
  `accessibilityState.selected` (mobile).
- Use `compact` for dense lists (Activity step). Use the default
  spacing for the Goal-style picker.
- For multi-select chip patterns (Diet preferences) pass `trailing={null}`
  to suppress the radio circle. The selected border + tint still
  communicate state.

### Ruler slider — `RulerSlider`

iOS-style horizontal ruler picker for height + weight. Used by
onboarding steps 06 + 07. The big number readout is tappable to switch
into typed-input mode.

| Surface | File |
|---------|------|
| Web | `src/app/components/suppr/ruler-slider.tsx` |
| Mobile | `apps/mobile/components/RulerSlider.tsx` |

**Inputs:**
- drag horizontally — snapped to `step`
- mouse wheel / trackpad (web only)
- keyboard (web): arrows ±step, Page Up/Down ±major, Home/End to clamp
- tap the big number → typed editor; Enter / return to commit, Esc /
  blur to cancel

**Custom formatting:**
- `format(value)` — render override for the big number (e.g.
  `5′ 10″` for imperial height)
- `parseInput(text)` — parse override for typed-input mode

Two named helpers ship for imperial height: `formatImperialHeightInches`
and `parseImperialHeightInches`. Both surfaces export the same names
with byte-identical behaviour — they are the parity contract for any
imperial-vs-metric flow.

**Perf note (mobile):** ticks within the visible window are re-rendered
on each pan event via React state. If perf becomes an issue once
wired into onboarding on lower-end devices, swap the SVG layer to a
Reanimated worklet (sharedValue → useDerivedValue → SVG transform)
and only sync to React state on gesture end.

## Implementation rules

1. **No hardcoded hex values in component files.** Import from `theme.ts` or use `useThemeColors()`.
2. **No raw `fontWeight` numbers.** Use the semantic weight names documented above.
3. **No raw `borderRadius` numbers on cards.** Use `Radius.lg`.
4. **No raw spacing pixels.** Use `Spacing.*` tokens.
5. **Every screen must support dark mode** via `useThemeColors()`. No static `StyleSheet.create` with light-only colours.
6. **`tabular-nums`** on every changing number: `fontVariant: ["tabular-nums"]`.
7. **Lucide on both platforms** (`lucide-react` web, `lucide-react-native` mobile). Decided 2026-04-28 (`docs/ux/teardown-2026-04-28-daily-loop.md` Top-5 #4). **Outline variants** for icons in cards and navigation; **filled** only for active tab bar state. Existing `@expo/vector-icons` Ionicons usages migrate opportunistically; new code uses Lucide.

## Lint enforcement (Next-10 #6, 2026-04-28)

The implementation rules above are partially enforced at lint time — a preventive measure so future agent sweeps can't silently re-introduce drift. The rule set lives in:

- **Mobile:** `apps/mobile/eslint.config.js`
- **Web:** `eslint.config.mjs`

### What's enforced today

**Mobile, scoped to the Today component tree** (`app/(tabs)/index.tsx`, `components/today/**`, `components/charts/CalorieRing.tsx`) — `no-restricted-syntax` flags raw numeric/string literals on:

| Style property | Token to use | Why |
|---|---|---|
| `fontSize` | `Type.headline / Type.body / Type.label / ...` from `@/constants/theme` | Typography scale defined in `theme.ts:209-226`. |
| `fontWeight` | `FontWeight.regular / medium / semibold / bold / heavy` | Five semantic weights — never raw `"700"` literals. |
| `padding*` | `Spacing.xs / sm / md / lg / xl / xxl / xxxl` | 4px grid; never raw pixel values. |
| `margin*` | Same as padding. | Same. |
| `borderRadius` | `Radius.sm / md / lg / xl / full` | Cards always `Radius.lg`. |
| `gap` | `Spacing.*` | Gap is a spacing concern. |

Severity: **`warn`**. The today/ tree carries a baseline of legacy literals (~456 as of 2026-04-28) — those migrate opportunistically as files are touched. New code lights up the lint output. Expanding the scope to `components/**` and `app/**` is a follow-up once the today/ tree is clean.

**Mobile, all files** — `no-restricted-imports` flags `@expo/vector-icons` Ionicons imports as **`warn`**. Lucide is canonical (Top-5 #4 decision); ~64 legacy Ionicons usages migrate opportunistically.

**Web, all files** — `no-restricted-imports` flags `lucide-react-native` imports as **`error`** (zero existing violations; the React Native variant has no business being in web source).

### What's NOT enforced

- Hardcoded hex colors in component files. Rule #1 in the implementation list above is convention-only — there's no AST selector that catches hex literals reliably without false positives. The token system + `useThemeColors()` covers the common path; visual review catches the rest.
- `tabular-nums` on numerical Text. Rule-by-convention.
- Tailwind arbitrary values (`p-[14px]`, `text-[15px]`) on web. Possible future addition; the today/ web tree is too clean to make this urgent.

### Baseline (2026-04-28)

| Surface | Errors | Warnings | Notes |
|---|---|---|---|
| Web (`npm run lint`) | 0 | 89 | Below `--max-warnings 500` cap. |
| Mobile (`npm run mobile:lint`) | 0 | 693 | `expo lint` has no `--max-warnings`; warnings inform, don't block. |

If your sweep PUSHES THE MOBILE COUNT UP, you've added a new violation — review before merging. If your sweep brings the count DOWN, you've migrated legacy literals — celebrate quietly.

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
- [ ] `npm run lint` (web) and `npm run mobile:lint` warning counts not increased
