# Recipe wizard step 4 — lock Calories field, restore actuals to full text colour

- Date: 2026-05-02
- Area: Recipe creation (mobile wizard)
- Status: Resolved
- Surface: `apps/mobile/components/recipe/CreateRecipeWizard.tsx`, step 4 ("Macros look right?")

## Problem

Two issues reported by Grace on TestFlight on 2026-05-02:

1. **Values look like placeholder hints, not actuals.** The auto-computed per-serving figures (e.g. `40kcal`, `1.6g`, `0g`, `2.3g`, `0.2g`) rendered in `colors.textTertiary` because they sat in the input's `placeholder` slot, not the controlled `value` slot. Quote: *"the light grey text makes the values look like placeholders but they are actuals"*.
2. **Calories was a user-editable field.** Calories per serving is derived from `sum(ingredient.calories) / servings`. Letting the user type an arbitrary kcal that diverges from the underlying USDA / OFF / Edamam data invents nutrition — explicitly forbidden by CLAUDE.md (*"If nutrition / ingredient matching is uncertain, do not guess"*). Quote: *"shouldn't be able to edit the cals they are calculated from the ingredients selected"*.

## Decision

### Fix 1 — value text colour

`MacroOverrideRow` now renders the resolved per-serving figure via the `TextInput`'s controlled `value` prop, not via the placeholder slot:

```tsx
const displayedNumber = override ?? value;
const displayedString = readOnly ? `${displayedNumber}${suffix}` : String(displayedNumber);
// ...
<TextInput
  style={[
    styles.macroFieldInput,
    { color: colors.text, fontWeight: "600" },
    // ...
  ]}
  value={displayedString}
  onChangeText={onChange}
  placeholder="auto"
  placeholderTextColor={colors.textTertiary}
  // ...
/>
```

The `placeholder` slot is now reserved for the literal string `"auto"` and only ever surfaces if the input is blank AND the auto value is non-finite — practically never (per-serving math always produces a finite number). The cue lives instead in the helper caption under read-only rows.

### Fix 2 — Calories read-only

`MacroOverrideRow` accepts a `readOnly?: boolean` flag and a `helperText?: string` caption. The Calories row is the only consumer:

```tsx
<MacroOverrideRow
  label="Calories"
  color={MacroColors.calories}
  suffix="kcal"
  value={perServing.calories}
  override={undefined}
  onChange={() => {}}
  styles={styles}
  colors={colors}
  readOnly
  helperText={`Calculated from your ingredients · ${perServing.calories} kcal`}
/>
```

Read-only treatment:
- Both `editable={false}` (RN-native lock) and `readOnly` (react-native-web mirror) are set.
- Input dims to `opacity: 0.6` and drops its border so it doesn't read as tappable.
- A small lucide `Calculator` glyph sits next to the "Calories" label.
- A helper caption — `Calculated from your ingredients · {N} kcal` — renders under the row.
- `override={undefined}` is forced so any stale `macroOverrides.calories` value from an older code path can never display.

Calories is **not** recomputed via Atwater (`P*4 + C*4 + F*9`) when the user overrides Protein / Carbs / Fat. Atwater is an approximation; the recipe carries actual ingredient kcal data and that's what we surface. If a user overrides macros, calories stay at the ingredient sum / servings — the helper text remains accurate to its own claim.

### Copy update

Step 4 subtitle was *"…Override any field if the auto-compute looks wrong."* It is now *"…Override any macro if the auto-compute looks wrong — calories stay calculated."* This frames the Calories lock for the user before they reach the row.

## Tests

`apps/mobile/tests/unit/createRecipeWizard.test.ts` — added structural pins under "structural pins for the wizard component":

- `displayedNumber = override ?? value` and feeds the input's `value` prop (full-strength text colour).
- The override style is `{ color: colors.text, fontWeight: "600" }`.
- `readOnly` propagates to both `editable={false}` AND `readOnly`, with `opacity: 0.6` for the disabled treatment.
- The Calories row renders `readOnly`, ships a `helperText` caption, and pulls in the lucide `Calculator` icon.
- The Calories row passes `override={undefined}` and never wires `setOverride("calories", …)`.
- Step-4 subtitle includes "calories stay calculated".

vitest can't render the wizard end-to-end (Expo Router screen + RN-only imports — same constraint as the other pins in this file), so the assertions read the component file as text and grep for the load-bearing wiring. The shared step-machine in `src/lib/recipes/createRecipeWizard.ts` is unchanged; existing math + override tests still apply.

## Web parity

The web equivalent (`src/app/components/RecipeUpload.tsx`, `mode="create"`) is a single-screen form, not a 5-step wizard. There is no editable Calories input on web — per-serving kcal renders as a derived figure inside the verified-totals card. Both bugs are mobile-only by surface; this fix is mobile-only by design. The shared step-machine in `src/lib/recipes/createRecipeWizard.ts` is untouched (the `calories` slot in `WizardMacroOverrides` remains for type-shape compatibility but is no longer reachable from the wizard UI).

`sync-enforcer` carve-out logged — visible-UI surface area for "edit Calories on a wizard step" exists only on mobile, so there is nothing to sync.
