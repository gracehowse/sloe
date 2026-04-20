# UX/UI Patterns

**Audience:** Design / Product

## Design System

### Colours (Mobile)

```typescript
Neon = {
  purple: "#7c3aed",  // Primary brand
  pink: "#ec4899",    // Accents, saved state
  green: "#22c55e",   // Success, verified, within target
  red: "#ef4444",     // Error, over target, destructive
  yellow: "#f59e0b",  // Warning, under target, needs review
  blue: "#3b82f6",    // Carbs macro
  cyan: "#06b6d4",    // Remaining, water
  orange: "#f97316",  // Sodium
}

MacroColors = {
  calories: purple,
  protein: red,
  carbs: blue,
  fat: yellow,
  fiber: green,
  sugar: purple,
  sodium: orange,
  water: cyan,
}
```

### Spacing / Radius
- `Spacing: xs(4) sm(8) md(12) lg(16) xl(20) xxl(24) xxxl(32)`
- `Radius: sm(8) md(12) lg(16) xl(20) full(9999)`

### Stimulant tracker colours (Batch 2.5 / audit M9 2026-04-18)
- `--stimulant-caffeine` (web) / `StimulantColors.caffeine` (mobile) — `#8b5cf6` violet — hydration card caffeine row, chips, progress fill.
- `--stimulant-alcohol` (web) / `Accent.warning` (mobile) — `#f59e0b` amber (web) / `#e8a020` amber (mobile — shared warning token) — hydration card alcohol row.
- Full role table in `docs/ux/brand-tokens.md`. No hex values anywhere in the Hydration & Stimulants card source on either platform.

## Interaction Patterns

### Onboarding redesign primitives (Phase 1, 2026-04-19)

Three new primitives ship in Phase 1 of the onboarding redesign and are
the canonical building blocks for the new flow + any future picker
surface. Full rules + per-platform paths live in `docs/ux/design-system.md`
under "Component patterns":

- **`SupprMark` / `SupprWordmark`** — brand mark as a React component.
  Replaces ad-hoc inline SVG copies of the logo.
- **`OptionCard`** — radio-card primitive used by Goal / Sex / Activity /
  Diet steps. Pass `trailing={null}` for multi-select chip shape.
- **`RulerSlider`** — iOS-style horizontal ruler picker for height +
  weight (with imperial/metric helpers).

Decision history: `docs/decisions/2026-04-19-onboarding-redesign-scope.md`.

### Long-press Actions
Used throughout for destructive/secondary actions:
- **Tracker**: long-press logged meal → delete with confirmation
- **Planner**: long-press planned meal → swap from library
- **Shopping**: long-press item → remove with confirmation

### Meal Slot Picker
Horizontal row of togglable chips (Breakfast / Lunch / Dinner / Snack):
- Used in: tracker quick-log, import review, create-recipe, planner config
- Active state: purple background, white text, checkmark icon
- Inactive: border only, secondary text

### Calorie/Macro Display
Two patterns:
1. **Hero number** — large central number for the primary metric (calories remaining)
2. **Progress bars** — horizontal bars with label/value for each macro

Over-budget indicator: number turns red, shows "+" prefix, label changes to "kcal over"

### Recipe Cards (Discover)
```
┌──────────────────┐
│  [Recipe Image]  │
│        254 kcal  │  ← top-right badge
├──────────────────┤
│  Recipe Title    │
│  P 25g C 7g F 13│  ← macro chips (coloured borders)
│  Source   [🔖]   │  ← creator name + bookmark toggle
└──────────────────┘
```

### Save/Bookmark
Consistent across all screens: Ionicons `bookmark` (filled) / `bookmark-outline` (empty), pink when saved.

### Food Search Modal
Full-screen modal with:
- Search input with auto-search on 400ms debounce
- Results list with per-100g macros (kcal, P, C, F)
- Tap result → preview card with:
  - Food name
  - Original recipe context in italic ("Recipe calls for: 1 lb chicken breast")
  - Portion pills (g, oz, lb, tbsp, tsp, cup, ml + USDA portions)
  - Quantity input with ± buttons
  - Live-updating nutrition display
  - "Use this" / "Back to results" buttons

### Weekly Bar Chart
Vertical bars for Mon-Sun:
- Height proportional to calories (scaled to max of target or highest day)
- Purple bars for normal, red for over-target
- Small calorie number above each bar
- Today's label in bold purple
- Tap any bar to drill into Day view

## Badges

A badge is a short uppercase tag rendered inline with a title or row label — used to communicate row-level state ("this was added by you", "this is AI-estimated", "this is a leftover") at a glance.

There is exactly **one** badge primitive per platform:
- Web: `src/app/components/suppr/badge.tsx` → `<Badge variant=… />`
- Mobile: `apps/mobile/components/Badge.tsx` → `<Badge variant=… />`

Every badge in the product should use it. If you find yourself writing an inline `<span className="… px-1.5 py-0.5 text-[9px]…">` or `<View style={{ paddingHorizontal: 6, paddingVertical: 2 …}}><Text>`, stop — use `<Badge>`.

### Shape
- One size, one padding (`px-2 py-0.5` web / `8/2` RN), one radius (`rounded-full`), one font size (`10px`), one weight (`font-semibold/700`), one tracking (`uppercase`).
- Variants swap colour **only**. If a new badge needs a different shape, it belongs in a different primitive — don't re-roll.

### Variants

| Variant | Where | Colour anchor (web / mobile) |
|---|---|---|
| `neutral` | Catch-all | `muted` / `#94a3b8` |
| `info` | Informational metadata | `--macro-water` / `Accent.info` |
| `warn` | Warning metadata | `--warning` / `Accent.warning` |
| `pro` | Pro-gated feature labels (future use) | `--primary` / `Accent.primary` |
| `ai` | AI-estimated entries (voice/photo-log, Recent tab) | `--chart-5` (violet) / `#8b5cf6` |
| `added` | Ingredient row added by user after import | `--success` / `Accent.success` |
| `override` | Manual macro override pinned on row | `--warning` / `Accent.warning` |
| `leftover` | Planner tile — leftover of a parent meal | `--warning` / `Accent.warning` |
| `custom` | User-defined custom food in search results | `--primary` / `Accent.primary` |
| `freeze` | Streak freeze available / used | `--macro-water` / `Accent.cyan` |

### Accessibility
The primitive ships a default `aria-label` / `accessibilityLabel` for every variant that carries semantics (pro / override / leftover / freeze / ai / added / custom). Override with the `ariaLabel` / `accessibilityLabel` prop when the label needs to include runtime context (e.g. "Leftover of Chicken Tikka Masala" or "2 streak freezes available").

### Extending
To introduce a new badge use-case:
1. Add a new variant key to the `BadgeVariant` union in both platform primitives.
2. Add a colour entry to the variant map in both.
3. Add a default aria-label if the new variant carries semantics.
4. Use `<Badge variant="new-one">…</Badge>` at the call site. Do not fork a new pill component.

## One-time factual acknowledgements

A few moments in the product are one-time "you did it" surfaces (e.g. earning a streak freeze). The rule of thumb:

- **Never a modal takeover.** A compact inline row under the relevant card is enough. Today already has the user's attention.
- **Factual copy, no shame, no celebration ad-libs.** "You earned a freeze — N available" is the ceiling. "Amazing!" / "Streak saved!" / "You're on fire" is not the bar we hold.
- **One-time per earned event.** Gate on a local timestamp (`localStorage` / `AsyncStorage`) — no new DB migration needed when the underlying ledger already records the moment.
- **Additive, never required.** A user who has never earned one must see nothing extra.
- **Dismiss primitive = a small "Got it" button.** On dismiss, write the earned ISO to storage and fire a `*_seen { at }` analytics event so product can measure whether the surface is actually seen, not just fired.

Reference implementation: the "You earned a freeze" row on the Today streak insight card (web `NutritionTracker.tsx`, mobile `app/(tabs)/index.tsx`). Storage key `suppr-last-seen-freeze-earned-at`; event `streak_freeze_earned_seen`. Paired with the ❄ glyph on `DayStrip` tiles for days where a freeze was consumed (factual "Freeze used (Tue)" signal; `aria-label` / `accessibilityLabel` = `Freeze used on {dateKey}`).

## Empty States

There is exactly **one** empty-state primitive per platform (audit M5, 2026-04-18):
- Web: `src/app/components/suppr/empty-state.tsx` → `<EmptyState icon title description action />`
- Mobile: `apps/mobile/components/EmptyState.tsx` — same prop contract (`style` instead of `className`)

Every empty-state card in the product should use it. If you find yourself writing a one-off `<p className="px-3.5 py-6 text-xs text-muted-foreground text-center">` or `<Text style={{ textAlign: "center", paddingTop: 40 }}>`, stop and use `<EmptyState />`.

### Shape
- Optional icon slot (`~24px`, muted).
- `title` — semibold, foreground colour. Typically a short sentence; accepts rich React content so callers can preserve existing inline emphasis (e.g. a bolded CTA label) without forking the primitive.
- Optional `description` — muted, smaller. Used when the empty-state naturally splits into two factual sentences.
- Optional `action` — typically a primary button.

### Copy rules
- **Factual, no shame, no hype.** "No favourites yet" / "Nothing to re-log yet." is the ceiling. "Let's get started!" / "You haven't done anything!" is not the bar we hold.
- **Do not gate the copy on login state.** Tell the user what will appear and how.
- **Same strings on both platforms.** Never rewrite copy for mobile when the web string is already fine.

### Reference sites
- `suppr/quick-add-panel` + mobile `QuickAddPanel` — Favourites / Frequent / Recent empty tabs.
- `suppr/saved-meals-tab` + mobile `QuickAddPanel` "My meals" branch — signed-out + no-combos states.

### Legacy copy (bespoke screens not yet migrated)
- **No recipes**: plate emoji + "No recipes yet" + pull-to-refresh hint
- **No search results**: magnifying glass + "No results for X" + try different term
- **No meals logged**: "No meals logged yet today" + ADD FOOD button
- **No shopping list**: cart emoji + "No shopping list yet" + link to planner

## Card radius

One card radius token, everywhere (audit M6, 2026-04-18):
- Web: `rounded-card` (`var(--radius-card) = 1rem / 16px`, defined in `src/styles/theme.css`).
- Mobile: `Radius.lg` (`16`, defined in `apps/mobile/constants/theme.ts`).

The two map to the same visual radius so web and mobile cannot drift.

### When `rounded-card` / `Radius.lg` applies
A **card-shell** is any container that presents a discrete content surface with `bg-card + border border-border` (web) / `backgroundColor: colors.card + borderWidth: 1` (mobile). Examples:
- Today dashboard cards (Steps, Week view, Activity Bonus, Macro tiles, Remaining macros bar).
- Streak insight card, Hydration & stimulants card.
- Weekly recap card and the inline stat tiles inside it.
- Recipe notes card, and its signed-out prompt card.
- List-row cards inside a scroll view (Quick add rows, Move-meal destinations).

### When it does **not** apply
Buttons, pills, badges, chips, inputs, textareas, dropdown menu cells, modal handles, camera frames, tab-toggle backgrounds, and any other non-card element have their own radius spec and should **not** be changed. Pill-style quick-log chips (Search / Voice / Snap / Scan on Today) are buttons, not cards — leave them on `rounded-xl`.

### Adding a new card
- Use `rounded-card` (web) or `Radius.lg` (mobile) on the outer shell.
- Do not introduce new radius tokens. If the design truly needs one, raise it with `product-lead` first.

## Progressive disclosure defaults (audit M4, 2026-04-18)

The **Today screen** is the product's most-used surface. When every card shows
on first run, the screen is hostile to brand-new users and the primary action
("log food") drowns in secondary cards. M4 lands a single rule for when a
Today card is visible on first run vs on return, and **every rule lives in one
shared helper** so web and mobile cannot drift:

```
src/lib/nutrition/todayProgressiveDisclosure.ts
  └── isHydrationCardVisible()
  └── isStepsCardVisible()
  └── isAdaptiveTdeeHintVisible()
  └── QUICK_ADD_COLLAPSED_STORAGE_KEY / parse/serialize helpers
```

### Rules

1. **Always visible (day view).** Day strip, calorie hero ring, remaining
   macros bar, dashboard macro tiles, Meals section. Never gate these.

2. **State-gated cards.** Only render when the user has the state that makes
   the card useful:
   - Hydration card: non-zero `target_water_ml` OR any water / caffeine /
     alcohol logged (including meals carrying `waterMl`).
   - Steps card: `steps_by_day` or `activity_burn_by_day` non-empty (i.e.
     Health / Fit has synced at least once).
   - Adaptive TDEE hint: `adaptive_tdee_confidence` medium/high OR ≥ 14
     logged days. Matches the `getEffectiveTDEE` threshold.

3. **User-collapsible surfaces.** When the card is an entry point to a
   larger picker (Quick Add), collapse it behind a single compact CTA by
   default on first run. Persist the user's open/closed choice per device
   via the documented storage key. The full overlay / alternative path
   (mobile FAB → Previous) stays available to power users.

4. **First-run fallbacks are never destructive.** When a card is hidden,
   render a small text link that reveals the card on tap ("Track hydration?",
   "Connect health"). No state is written until the user performs the
   underlying action — the link just opens the card.

### Sticky gates

Every gate is **additive + sticky**: once `true`, a returning user will keep
seeing the card because the underlying state persists (a target set in
Settings, a Health sync completed, a water log from yesterday). We don't
hide cards from returning users just because they happened to delete today's
entries. The state gate checks the full persisted map, not just today.

### When to extend

- Add a rule to `todayProgressiveDisclosure.ts` — do **not** inline a new
  visibility check on Today.
- Add a test in `tests/unit/todayProgressiveDisclosure.test.ts`.
- Update `docs/product/overview.md` → "Today progressive disclosure" table.
- Update both platform call sites (web `NutritionTracker.tsx`, mobile
  `apps/mobile/app/(tabs)/index.tsx`).

### Anti-patterns

- Adding a new Today card that is always on, even when empty.
- Hiding a card based on `is_first_run` instead of its own state — leads to
  a returning user being punished when the card would have helped them.
- Writing default state (e.g. setting a water target of 2000 ml) just to
  flip a gate to `true`. Gates must reflect real user intent.

## Destructive confirmations (audit M7, 2026-04-18)

Any action that deletes a user's content or that can't be undone must be confirmed through a themed dialog. Never use `window.confirm` — it is unthemed, synchronous, breaks in dark mode, and does not integrate with the app's accessibility tree.

There is exactly **one** destructive-confirm primitive per platform:
- Web: `src/app/components/suppr/destructive-confirm-dialog.tsx` → `<DestructiveConfirmDialog title description confirmLabel onConfirm />` (shadcn `AlertDialog` + destructive-variant button).
- Mobile: `Alert.alert(title, description, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress }])`. `Alert.alert` is the native iOS pattern and integrates correctly with VoiceOver; mobile does not need a wrapper.

### Shape
- Short, factual title framed as a question: `Delete "{name}"?`, `Remove "{recipeTitle}"?`, `Replace this week's plan with "{name}"?`.
- Optional description explaining the consequence: `"This can't be undone."`, `"Downstream leftovers of this meal will be cleared."`, `"The current week will be overwritten with the template."`.
- Two buttons: **Cancel** (neutral, auto-focused so a stray keystroke does nothing) and the destructive action (red, labelled with the verb — `Delete`, `Remove`, `Apply`, `Continue`).
- Never confirm non-destructive actions through this primitive — use `toast.success` for save/apply/log feedback instead.

### Copy rules
- **No shame, no drama.** `"Delete local data & sign out?"` is the ceiling; `"Are you ABSOLUTELY sure?!"` is not the bar we hold.
- **Describe the consequence, not the feeling.** `"This can't be undone."` / `"The current week will be overwritten."` — not `"You'll lose everything!"`.
- **Reiterate the target.** Include the item name in quotes so the user knows exactly what will be deleted.
- **Double-confirm only when the blast radius is the whole account.** `Settings` → "Delete my account permanently" surfaces two sequential `DestructiveConfirmDialog`s; every other destructive flow is single-confirm.

### Call sites (web)
- `suppr/quick-add-panel` — saved-meal delete.
- `suppr/today-meals-section` — meal-row Delete overflow item.
- `suppr/plan-templates-dialog` — template delete action.
- `FoodSearch` — custom-food delete.
- `Settings` — clear local data + sign out, two-stage account deletion.
- `MealPlanner` — delete named plan slot, apply template (overwrites week), leftover-clearing swap.

## Inline rename (audit M7, 2026-04-18)

Short-lived "rename this thing" prompts must run through a themed dialog — never `window.prompt`. On web, Radix `Dialog` gives focus trap, labelled title, `Enter`-to-submit, and `Escape`-to-cancel for free.

Two primitives per platform today:
- **Saved-meal combo rename** — web `suppr/rename-saved-meal-dialog.tsx` → `<RenameSavedMealDialog currentName onConfirm />`. Runs input through the shared `normaliseSavedMealName(raw)` helper in `src/lib/nutrition/savedMeals.ts` (trim + `SAVED_MEAL_NAME_MAX_LENGTH = 80` clip). Empty or unchanged input is a no-op. Mobile uses `Alert.prompt` with the same rule.
- **Generic named-slot rename / create** — web `suppr/text-prompt-dialog.tsx` → `<TextPromptDialog title inputLabel currentValue onConfirm />`. Trims input, disables Save on empty. Used by `MealPlanner` for New plan / Rename plan. Mobile uses `Alert.prompt` with the matching validation.

### Shape
- Short title framed as an action: `Rename meal`, `New plan`, `Rename plan`.
- Single labelled `<Input>` pre-filled with the current value (for rename) or empty (for create).
- Two buttons: **Cancel** (ghost) and the primary action (`Save` / `Create`).
- `Enter` submits; `Escape` cancels; focus moves to the input on open (shadcn `autoFocus`).

### Copy rules
- **Factual label.** `"Name"` / `"Plan name"` on the input — never `"What would you like to call it?"`.
- **Same cap on create and rename.** If the create dialog enforces `maxLength=80`, the rename dialog must too. Centralise the cap in a shared helper (`SAVED_MEAL_NAME_MAX_LENGTH`, `normaliseSavedMealName`) so the two sites cannot drift.
- **No-op gracefully.** If the user types nothing, clears the field, or submits the same value, treat it as Cancel — do not surface a toast.

## Paywall surfaces — convention (Ship M2, 2026-04-18)

There are exactly **two** paywall surfaces in the product, and they are not interchangeable:

### 1. In-flow gate — bottom sheet / dialog
- Web: `src/app/components/suppr/ai-paywall-dialog.tsx` (`<AiPaywallDialog feature={...} />`)
- Mobile: `apps/mobile/components/AiPaywallSheet.tsx` (`<AiPaywallSheet visible feature onClose onSeePlans />`)

Shown when a free / Base user taps a Pro-gated entry point **inside** a primary flow — today that means the Voice and Snap (AI photo) chips on Today. The user is not browsing for a plan; they were trying to log a meal and hit a gate. The surface must stay light-touch and keep the user in context.

- Shape: title + factual body + PRO badge + secondary "Not now" + primary "See Pro plans".
- Primary CTA navigates to the full-route `/paywall?from={feature}` surface (the second surface below).
- Feature-specific copy comes from `FEATURE_COPY` (defined in the web dialog; mirrored verbatim in the mobile sheet). **If you edit the strings, change both files.**
- Analytics fire on both platforms with identical payload shapes:
  - `ai_paywall_sheet_viewed { feature }` on mount.
  - `ai_paywall_sheet_dismissed { feature, reason: "backdrop" | "close_button" | "not_now" }` on every dismiss path. Web distinguishes `"not_now"` (explicit button) from `"backdrop"` (overlay click / Escape); `"close_button"` is mobile-only (the dedicated X in the top-right of the sheet). A Radix `onOpenChange(false)` triggered immediately after the "Not now" button is de-duped inside the web dialog so the funnel never double-counts.
  - `ai_paywall_sheet_cta_tapped { feature, action: "see_plans" }` on primary CTA tap.

### 2. Full-route commercial surface — `/paywall` (mobile) / `/pricing` (web)
- Mobile: `apps/mobile/app/paywall.tsx`
- Web: `/pricing` page

A standalone screen where the user is browsing for a plan: trial timeline, features matrix, plan chooser, checkout. This is **commercial-intent** — it competes with landing pages, not with meal-logging flows.

### Non-negotiables

- **The in-flow gate NEVER replaces the full-route surface.** If the user wants to see plans, they must still be able to reach `/paywall` / `/pricing`. The sheet's primary CTA is the bridge.
- **The full-route surface is NEVER invoked directly from an in-flow Pro-gated action.** Free / Base users tapping Voice or Snap see the sheet / dialog — not a full-screen route navigation. This was the exact mistake M2 fixed on mobile: the Today screen used to `router.push("/paywall?from=voice_log")`, yanking the user out of context.
- **Copy taxonomy is shared.** Web and mobile render the same `FEATURE_COPY` keys. Do not rewrite the body on one platform to sound better — change both.
- **Analytics are identical.** Same event names, same payload keys, same values. A new reason string means a new union member in `ai_paywall_sheet_dismissed` that must ship on both platforms at once.
- **No shame copy anywhere.** Factual, no countdowns, no "only X seats left", no "you're missing out". This applies to both surfaces.

### Anti-patterns

- Adding a second in-flow paywall shape next to `AiPaywallDialog` / `AiPaywallSheet`. Consolidate.
- Gating a new in-flow action (e.g. a future AI barcode narrator) by pushing to `/paywall` directly. Add a new `AiPaywallFeature` key to the shared union instead and route through the existing sheet / dialog.
- Changing the primary CTA label on one platform without the other ("See plans" vs "See Pro plans" was the regression that M2 closed).
- Firing the sheet analytics at the caller instead of inside the component. The component is the source of truth for `_viewed` / `_dismissed` / `_cta_tapped`; the caller only fires the feature-specific funnel-entry event (`voice_log_paywalled` / `ai_photo_log_paywalled`).

## Copy vs Duplicate (Ship M1, 2026-04-18)

The product has two distinct row-copy actions. Their names are pinned so they read as different affordances, never interchangeable.

- **Copy to another day…** — per-meal action in the row overflow (web) / long-press action sheet (mobile). Copies **one logged meal** from the current day into another target day / date range. Source row is never mutated. Available when the row is a single journal entry.
- **Duplicate day…** — day-header action in the Meals section chrome. Copies **every meal in the current day** into another target day / date range. Same "single target" / "quick range" / "date-range" picker UX as Copy, but the unit of work is the whole day.
- Keep the distinction at the verb level. "Copy" is always about a single meal. "Duplicate" is always about a whole day. Do not let either action's copy refer to the other.

## Usual meals canonical re-log (Ship M1, 2026-04-18)

Saved meals are the canonical one-tap re-log surface. "Combo" is retired from user-facing copy — internal types and helper names may keep `savedMeal` / `SavedMeal`; UI strings always say **"usual meal"**.

- **Slot-header pill (primary re-log entry point).** On each meal-slot header (`Breakfast / Lunch / Dinner / Snacks`) in `today-meals-section.tsx` (web) + `TodayMealsSection.tsx` (mobile), when the user has ≥1 saved meal with matching `defaultMealSlot`, a `[↻ Log usual: {name}]` pill renders on the right. 2+ matches open a small picker sheet with the top 3 by `last_logged_at`.
- **Full-width "Save {Slot} as a meal" row (primary save entry point).** Below the last food item in a slot, a full-width primary-colour row renders when the slot has ≥2 items AND no saved meal yet for this slot. Same visual weight as other primary row actions — not a 10px metadata pill.
- **First-run hint.** A one-off dismissible inline card inside the slot, gated by the shared `shouldShowUsualMealHint` helper (same-day ≥2 items OR cross-day ≥2 matches in 7d). Dismiss is per-slot, persisted under `suppr-usual-meal-hint-dismissed-v1` (localStorage / AsyncStorage). Fires `usual_meal_hint_shown` / `usual_meal_hint_accepted` / `usual_meal_hint_dismissed`.
- **Quick Add tab order.** **Usual meals → Recent → Frequent → Favourites**. Default tab is `"saved"` when the user has ≥1 saved meal, else `"recent"` — resolved by the shared `resolveQuickAddDefaultTab` helper. Both platforms consume the helper so they cannot drift.
- **Dialog copy.** `SaveMealDialog` (web) / `SaveMealSheet` (mobile) title is `"Save as a usual meal"`; description `"One tap re-logs all of these items next time."`; placeholder defaults to `My usual {slot}` (slot-contextual) or `My usual breakfast` (fallback). Empty-state copy in SavedMealsTab aligns with the button: `Save {Slot} as a meal`.

## Related Documents
- [Component Reference](../technical/components.md)
- [Product Overview](../product/overview.md)
