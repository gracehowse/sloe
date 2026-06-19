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
| heavy | `"800"` | Reserved — see "Hero numerals are serif" below; big standalone numbers are NOT sans 800 anymore |

**Do not use `fontWeight: "900"`.** Maximum weight in product UI is 800.

### Hero numerals are serif (SLOE Phase 0, 2026-06-08)

Big **standalone numeric hero values** read in the **Newsreader serif** display
face, not sans. Sloe is an editorial app — big numbers are a serif moment. The
serif face carries its own weight, so a sans `fontWeight` (700/800) is **dropped**
when converting (leaving it forces a synthetic bold over the serif).

**Applies to** big standalone numbers: calorie totals, kcal/day targets, kg
weights, big stat-grid numbers, the prominent number on a card, the onboarding
ruler/stepper/pace/reveal hero readouts.

**How:**
- **Mobile:** spread a serif `Type.*` token (`Type.display` 32 / `Type.title` 24 /
  `Type.ringValue` 48 / `Type.heroValue` 20) matching the existing size, OR set
  `fontFamily: FontFamily.serifRegular` (or `serifMedium`) for a kept custom size,
  and **remove** the sans `fontWeight`. Keep `color`, `fontVariant: ["tabular-nums"]`,
  `letterSpacing`. `Type.heroValue` is the dedicated serif sibling of the sans
  `Type.macroValue` (same 20/24 box) for big-numeral surfaces.
- **Web:** apply the serif display var — `font-[family-name:var(--font-headline)]`
  or `font-[family-name:var(--font-display)]` (both Newsreader) with `font-medium`
  / `font-normal`, replacing `font-bold` / `font-extrabold`. Keep `tabular-nums`.

**Stays sans (do NOT convert):** labels / eyebrows / ALL-CAPS section headers /
anything ≤ 14px; **unit suffixes** (kcal, kg, g, ml, %) — split these into a
nested sans `Text`/`<span>` so only the number goes serif; numbers inline inside
a sentence/paragraph; glyphs, arrows (↑↓), emoji, icon characters; button labels;
+/− stepper glyphs; the small inline macro callouts in the saved-meal portion +
ingredient sheets (`Type.macroValue` stays sans there for tight tabular
alignment); cook-mode countdown timer (deliberate Menlo monospace); join/invite
codes (serif hurts character distinction).

Regression guard: `tests/unit/heroNumeralSerif.test.ts` (web + mobile parity) and
`tests/unit/targetsHeroKcal.test.ts`. The calorie ring + Today macro tiles +
burn-detail were converted earlier (ENG-997); this pass covered the remaining
Progress / onboarding / meal + weight / digest / weekly-recap numerals.

### Spacing scale

Mobile tokens (`Spacing.*`):

| Token | px | Common use |
|-------|-----|-----------|
| `xs` | 4 | Tight gaps within a row, icon-to-text |
| `sm` | 8 | Standard inner gap, between related elements |
| `md` | 16 | Card inner padding, between sections |
| `lg` | 20 | Card padding, primary rhythm unit |
| `xl` | 24 | Between major sections on a screen |
| `xxl` | 32 | Page gutters (`px-pm-5`), Today scroll section gap |
| `xxxl` | 40 | Hero spacing, page top/bottom insets |

_2026-05-19: scale bumped for premium airy rhythm (Noom/Lifesum). xs/sm unchanged._

### Branding row (Today)

Reserved **44px min-height** row at the top of Today: `SupprPlateWordmark` (Tare-style empty plate + working name **Suppr**). Use `SupprPlateMark` / `SupprPlateWordmark` — not the legacy `S` tile — until rebrand. Web hides on `lg+` when the desktop sidebar carries the mark.

**Rules:**
- Never use raw pixel values (`paddingVertical: 14`). Use the nearest token.
- If no token fits, add one to the scale rather than hardcoding.
- The 4px base grid means all spacing should be divisible by 4.

### Radius scale

| Token | px | Usage |
|-------|-----|-------|
| `sm` | 8 | Chips, badges, small buttons, inner elements |
| `md` | 12 | Inputs, standard buttons, toggles |
| `lg` | 16 | Modals, inner elements |
| `xl` | 20 | Bottom sheets |
| `full` | 9999 | Pills, circular elements, avatar frames |

**Card corners are owned by the `<SupprCard>` shell, not the `Radius` ladder.**
Resting cards round to **20** (`CARD_RADIUS`, exported from `SupprCard`); the 2×2
macro **tiles** and card-on-card **inset** sub-panels round to **16**
(`TILE_RADIUS`). The `Radius` token ladder tops out at `xl: 12` (tuned for
Linear/Stripe density), so the Sloe card corner lives in the shell instead — do
**not** hand-roll `borderRadius: 20` / `borderRadius: Radius.lg` on a card; render
`<SupprCard>` and let it own the corner. (Card consolidation, 2026-06-04.)

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
| Card (soft lift) | `0 6px 18px rgba(34,27,38,0.16)` (`Elevation.cardSoft` / `--elev-card-soft`) | `none` — tonal lift via `cardElevated` + hairline | Standard resting cards (the Sloe default) |
| Elevated | `0 4px 12px rgba(0,0,0,0.08)` | `0 4px 12px rgba(0,0,0,0.25)` | Modals, FABs, popovers |

The card soft lift is **16% opacity** (`0 6px 18px rgba(34,27,38,0.16)`). It moved
in two same-day bumps: 0.07 → 0.10 ("push it to 10%"), then 0.10 → 0.16 (Grace
"cards still blend on-device"). The second bump is grounded in **edge-pixel
sampling of the sim**: the shadow WAS rendering but was too weak — the `#F6F5F2`
fill sits only ~10 luminance levels below the `#FFFFFF` page, so the shadow alone
must carry the separation, and a 10%/14px halo read lighter than the card at its
edge. At 0.16/18px/y+6 the penumbra below a card drops to ~lum 227 (≈28 under the
white page) — a confident but still-soft plum lift, not a hard Material drop
shadow (the wide 18px radius keeps it ambient). The card fill stays `#F6F5F2`
(matches Figma — the problem was separation, not the fill); no border is
re-introduced. Both levers move in lockstep on **both** platforms so web ==
mobile. Resting cards default to a FLAT warm slab (Figma `654:2`) via the
`<SupprCard>` shell / `useCardElevation()` — the fill on the page is the
separation. The elevated recipe-card surfaces (Discover, Library, recipe detail)
opt into the soft lift with mobile `lift="soft"` / web `elevation="card"` (see
"Resting-card elevation" below). Dark mode cards rely on the `cardElevated` tonal
lift + `cardBorder` for definition, not a shadow.

## Component patterns

### Card — ONE component (`<SupprCard>`)

**There is exactly one card component. Every resting card surface renders its
chrome through `<SupprCard>` — never hand-roll a card `View`.** (Grace 2026-06-04:
"the cards are being handled separately for some reason — each card looks slightly
different, they should all be the same component updated at once." Card chrome had
been copy-pasted across ~12 surfaces and drifted on radius (8 / 12 / 20), fill,
border width, and the iOS clip fix. The shell ends the drift: a fix lands once and
every card moves together.)

```
// Mobile: apps/mobile/components/ui/SupprCard.tsx
<SupprCard>                 {/* fill #F6F5F2 · radius 20 · soft lift · hairline */}
  …card contents…
</SupprCard>

// Web mirror: src/app/components/ui/suppr-card.tsx (same props/variants)
```

The shell encapsulates, in ONE place:
- fill `colors.card` (#F6F5F2 light), corner radius (20 card / 16 tile+inset),
- the **soft lift on an OUTER wrapper + the corner-clip on an INNER view** — so
  the iOS `overflow: 'hidden'` shadow-clip bug (see below) can never recur
  per-card,
- the dark-mode tonal lift + hairline,
- the hairline border drawn as `StyleSheet.hairlineWidth` (never a 1pt box).

**`<SupprCard>` API (mobile):**

| Prop | Values | Notes |
|------|--------|-------|
| `tone` | `neutral` (default) / `primary` / `success` / `warning` / `magenta` | tinted fill + border |
| `size` | `card` (default, radius 20) / `tile` (radius 16 — the 2×2 macro tiles) / `inset` (radius 16, hairline, **no drop shadow** — a sub-panel ON a card) | |
| `gradient` | bool | north-star tinted surface when `tone='primary'` |
| `border` | bool (default true) | the light resting `card` drops it (lift = separation); `inset` always draws it |
| `padding` | `none` / `sm` / `md` / `lg` (default) / `xl` | symmetric; use `innerStyle` for asymmetric |
| `radius` | `sm`/`md`/`lg`/`xl` | overrides the size default |
| `style` | `ViewStyle` | merged onto the OUTER node (margins, width, flex-basis) |
| `innerStyle` | `ViewStyle` | merged onto the INNER clip node (flow layout: `flexDirection`, `gap`, asymmetric padding) |
| `testID` | string | on the OUTER node (where Maestro/captures expect it) |

For an interactive card (a tappable tile / row), wrap the `<SupprCard>` in a thin
`Pressable` that owns the tap + press feedback; the `SupprCard` owns the chrome
(see `TodayDashboardMacroTiles`, the burn-breakdown card).

**Intentional exceptions** (NOT silent — documented):
- `DiscoverHeroCard` — a full-bleed editorial IMAGE hero with its own dark fill +
  scrim, so it can't use the neutral `#F6F5F2` shell. It DOES share `CARD_RADIUS`
  (20) + the same `useCardElevation().shadowStyle` lift, imported from the shell.
- The Recipes-tab (`library.tsx`) recipe-grid cells + import rows are **not yet**
  migrated (tracked in `docs/decisions/2026-06-04-card-component-consolidation.md`
  → "Recipes tab not migrated this pass"; a Linear follow-up is pending). Until
  then they keep their hand-rolled chrome.

**Hairline rule (still applies to dividers).** Structural dividers INSIDE a card
(`borderTopWidth` / `borderBottomWidth` / `height: 1` / `width: 1` rules, and
`divide-x` / `divide-y` rules between stat tiles + stacked rows) MUST use
`StyleSheet.hairlineWidth`, never a literal `1` — on @3x a `1` is 3 physical px,
far heavier than the prototype's 1-device-px line. Interactive controls (toggle
pills, quick-add chips, picker buttons) and floating modal dialogs are NOT resting
cards and keep their `borderWidth: 1` affordance.

Pinned by `apps/mobile/tests/unit/sloeCardHairlineBorders.test.tsx` +
`supprCardShell.test.tsx` (the shell's render contract) — *source-level* sweeps,
because `StyleSheet.hairlineWidth` and the heavy `1` are numerically equal under
the vitest RN mock, so a rendered-value assertion can't tell them apart.

### Resting-card elevation (the soft lift)

`useCardElevation()` is the single source of the resting-card treatment that the
`<SupprCard>` shell consumes, and as of 2026-06-04 the **soft lift is the
unconditional default** on mobile (no longer flag-gated — the Sloe redesign is the
product, and flag-FORCE is dead in a bundled app per ENG-840, so the old
`design_system_elevation` gate could never be exercised on the sim anyway). The
hook returns:

- **Light** → a soft drop shadow (`Elevation.cardSoft`) and **no border**. The
  shadow carries the separation between the `#F6F5F2` card and the `#FFFFFF`
  page, so the hairline is dropped (one edge, no double line). A heavier border
  is explicitly *not* the answer — the lift is the shadow.
- **Dark** → no shadow (RN renders shadows poorly on dark surfaces); a tonal
  lift (`cardElevated` background via `liftBg`) plus a hairline instead.

`Elevation.cardSoft` mirrors the web `--elev-card-soft` token EXACTLY
(`0 6px 18px rgba(34,27,38,0.16)` — the aubergine Sloe ink `#221B26` at **0.16**,
radius 18, y+6): a calm, plum-tinted ambient lift, not a harsh Material shadow.

**Web == mobile (no flag, no divergence):** both platforms default to the FLAT
slab and expose the SAME soft opt-in. When opted in (web `elevation="card"` /
mobile `lift="soft"`) the web `<SupprCard>` is **un-gated** — the `card` tier
renders the `.card-slab` class (→ `box-shadow: var(--elev-card-soft)`) +
`data-soft-elevation="true"` with no `design_system_elevation` read. Both
platforms render the identical 16% lift, and the token is pinned
character-for-character across `theme.css` ↔ `theme.ts` by
`cardElevationVariants.test.tsx`.

**iOS gotcha — shadow on an OUTER wrapper when the card clips its children.**
RN clips a view's own shadow under `overflow: 'hidden'`. The `<SupprCard>` shell
handles this once: the shadow rides the OUTER wrapper, the clip + border sit on an
INNER `View`. This is why you must never hand-roll a card — the bug is solved in
the shell. Pinned by `apps/mobile/tests/unit/cardElevationVariants.test.tsx`
+ `supprCardShell.test.tsx`.

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
> **Superseded — Sloe wordmark (2026-06-04, casing fixed 2026-06-08).**
> The blue-square "S" mark + "Suppr" label lockup described below is
> retired. The brand is now the **"Sloe" wordmark** (capital S, Newsreader
> semibold, plum `--foreground-brand`) — no glyph, no plate ring, no lockup.
> Casing + weight match the canonical Figma `654:2` Today frame. Components
> keep the historical `Suppr*` export names for call-site stability
> (`src/app/components/ui/suppr-mark.tsx`, `apps/mobile/components/SupprMark.tsx`,
> `apps/mobile/components/SloeHeaderWordmark.tsx`). See
> `docs/decisions/2026-06-08-today-654-conformance-wordmark-weekstrip-tdee.md`.

- ~~Background is always brand `--primary` blue. Letter is always white.~~
  ~~The dark-mode lift to the brighter blue happens automatically via~~
  ~~the `--primary` token — never override the colours per surface.~~
- ~~Wordmark composes Mark + the "Suppr" label with proportional spacing~~
  ~~(`gap-2.5` web, `gap: 10` mobile).~~ The wordmark is now the single
  "Sloe" word; pass the same `size` prop to both surfaces to match in
  side-by-side comparisons.
- Use the **wordmark** for sign-in headers, paywall heroes, Today's brand
  bar, the sidebar, and marketing. (The standalone-glyph "mark alone"
  context is moot — there is no glyph; favicon/nav use the wordmark or an
  app icon, not a letter-mark.)

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
8. **Hairline resting-card borders + dividers (mobile).** Use `StyleSheet.hairlineWidth` (≈1 physical px), never a literal `1` (= 1pt = 3px on @3x), on resting cards, structural dividers, and `divide-x`/`divide-y` rules. See the **Card** pattern above. Web uses CSS `border` (1px) — already correct, no equivalent bug. Controls + modals keep `borderWidth: 1`. (2026-06-04)

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

  _Off-token literals migrated onto semantic tokens (ENG-716, 2026-06-19, token + a11y sweep): `NutritionSourceBadge` (web green/yellow/slate → `success/warning/muted` tokens; mobile cool-slate `#94a3b8` manual → `sourceManual` warm-grey token); web `streak-pip` milestone tone (`amber-*` literals → `warning-soft`/`warning-solid`, matching mobile's `Accent.warning`); both 404 pages (`app/not-found.tsx` + `app/recipe/[id]/not-found.tsx` — slate/violet/indigo literals + 🍽️ emoji → semantic tokens + lucide `FileQuestion`/`UtensilsCrossed`, unified onto one card shell). Source-check guards: `tests/unit/nutritionSourceBadge.test.ts`, `tests/unit/streakPip.test.tsx`, `tests/unit/notFoundTokenParity.test.ts`, `apps/mobile/tests/unit/paywallPriceA11y.test.tsx`. These surfaces should NOT be re-flagged in colour censuses._
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
