# F-156 — Add-Custom-Food Parity Spec

**Status:** Draft, ready for executor pickup
**Source feedback:** `docs/testflight-feedback/tracker.md` F-156 — "Add-custom-food too thin vs MFP / Lose It"
**Constraints:** post-launch (do not gate launch), schema-additive only, web parity planned in same wave.

---

## 1. The gap (what we have today)

Mobile sheet — `apps/mobile/components/CreateCustomFoodSheet.tsx` (804 lines). Web mirror — `src/app/components/suppr/create-custom-food-dialog.tsx` (584 lines). The two are intentionally a faithful pair, both wired through the shared pure helpers in `src/lib/nutrition/customFoods.ts` (state shape identical, payload identical). What exists today:

**Above-the-fold (always visible):**
- Name (required, `CUSTOM_FOOD_NAME_MAX = 120`) — sheet line 357-367.
- Brand (optional, max 80) — sheet line 379-388.
- Natural serving — label + grams pair, both-or-neither validation — sheet line 408-427.
- Servings per container (optional numeric) — sheet line 436-448.
- Macros basis row: `baseGrams` text input, default "100" — sheet line 481-489.
- Macro 2x2 grid: Calories / Protein / Carbs / Fat — sheet line 503-566.
- Fibre (g, optional, single full-width input) — sheet line 567-578.
- Per-serving live preview tile — sheet line 582-613.
- "Macros not set" soft notice when all four are zero — sheet line 615-626.

**Behind disclosure ("Add detailed nutrition", default collapsed):**
- Sugar (g) / Sat fat (g) / Sodium (mg) — three-column row, sheet line 661-710.
- Barcode text input (8/12/13/14 digit validation, no scanner) — sheet line 721-742.

**Footer:** Cancel / Save (Save copy: "Save food" or "Save changes"; disabled until valid) — sheet line 747-798.

**Schema today** — `supabase/migrations/20260414180000_create_user_foods_table.sql` + `20260430100000_user_foods_micros.sql`: `name, brand?, base_grams, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, saturated_fat_g, servings (jsonb), servings_per_container, barcode, source, submitted_by`. Schema is **already ahead of the form** — no migration needed for the must-haves below.

**What's missing vs MFP / Lose It (the user complaint):**
- No way to enter macros **per serving** instead of per 100 g (forces mental arithmetic from a packaged label).
- Only **one** named serving (no "1 slice / 1 cup / 1 piece" multi-serving array, even though `servings` is a JSONB array on disk).
- No barcode **scanner** entry — text-only.
- No "copy from existing food" / duplicate-and-edit.
- No photo of the package label.
- No micros beyond sugar / sat fat / sodium (no cholesterol, potassium, vitamins).
- Fibre sits oddly between core and detailed; not in a tidy row with the other three macros.

---

## 2. Competitor reality (MFP, Lose It — 2026)

**Core (universal):**
- Name, brand (both, MFP requires brand on packaged; Lose It optional).
- Serving size — **dropdown of named units + amount** (MFP) OR **per-serving entry with grams** (Lose It).
- Calories + the 4 macros (P / C / F + sometimes shown as kcal-only on entry).
- **Per-serving vs per-100g basis toggle** — MFP defaults per-serving (US label convention), Lose It defaults per-serving. Both let you switch.

**Extended (both apps surface these, behind a "more nutrients" disclosure):**
- Fiber, Sugar, Saturated fat, Sodium, Cholesterol, Potassium.
- MFP additionally: Vitamin A, Vitamin C, Calcium, Iron, Trans fat, Polyunsaturated/Monounsaturated fat, Added sugars.
- Lose It Premium: full micro grid behind paywall.

**Convenience:**
- **Multiple named servings** — MFP lets you define multiple ("1 slice = 30g", "1 loaf = 500g"). Lose It surfaces 2 (serving + grams).
- **Barcode prefill** — both. MFP scans, prefills the form from OFF/USDA, user edits. Lose It same.
- **Photo of label** — MFP has it (display-only; not OCR'd into fields). Lose It does not.
- **Copy from existing food** — MFP has "Create food from copy" deep in the menu. Lose It does not.
- **Public / private** — MFP defaults public, prompts for confirmation. Lose It private-only.
- **Per-serving vs per-100g toggle** — see above.

The honest read: MFP's form is wider but heavier. Lose It is closer to ours and ships well. Suppr's gap is narrower than the user's complaint suggests — but a few specific items (per-serving entry, scan-to-prefill, multi-serving) are doing real work for those competitors and we're missing them.

---

## 3. Cross-product carve-out — why we're not chasing full parity

Suppr's barcode flow (`apps/mobile/app/(tabs)/barcode.tsx` + verified-food path) **is the primary path**. Custom-food is the fallback when:
- the package isn't in OFF/USDA,
- OR the user is logging homemade / restaurant food,
- OR the user is correcting a wrong scan.

The bar isn't "match MFP field-for-field." The bar is: **the user does not bounce to MFP because Suppr's fallback was missing the one thing they needed.**

Ranked by what would actually cause a bounce:
1. They're holding a packaged label that says "per serving" and we force them to do per-100g math. (High bounce risk, common case.)
2. They scanned a barcode, got nothing, and have to re-type all the data instead of "scan, then edit." (High bounce risk, addressable by a one-tap from the unmatched-scan state into the create form pre-filled with the barcode.)
3. They want one custom food with two named servings ("1 slice" + "1 loaf"). (Low-medium; nice to have but most homemade items have one natural unit.)

Everything else (photo of label, full micro grid, copy-from-existing) is below the bounce bar. It's MFP-thicker but it doesn't move retention for our segment.

---

## 4. Recommended scope

### Must-have (this PR wave)

**M1. Per-serving vs per-100g basis toggle.**
A two-pill segmented control above the macro grid: `Per serving` / `Per 100 g`. Default = `Per serving` if a natural serving is set, else `Per 100 g`. The macro inputs always store as per-100g internally (no schema change), but the user enters in whichever basis matches their label. Switching the toggle re-renders the values converted; switching with values entered triggers a one-line "values converted" notice for trust. Reuses `customFoodToMacrosPer100g` in reverse for the conversion.

**M2. Scan-to-prefill from barcode failure path.**
When `barcode.tsx` returns "no match," surface a single CTA: `+ Add as custom food` that opens the sheet with the barcode pre-filled and the disclosure auto-opened. No scanner inside the sheet itself — the camera lives where it already lives.

**M3. Multi-serving array (unlimited, MFP parity).**
The schema already stores `servings: CustomFoodServing[]`. Today the form writes only one entry. Allow the user to add as many serving rows as they need via "+ Add another serving" inline. **No cap** (Grace 2026-05-10 override). To keep the form from blowing up the sheet height, rows beyond the first are rendered in a compact list (`[label] [grams] ×` per row) inside a `ScrollView`. First row stays pinned as the canonical natural serving used by the preview. Both-or-neither validation per row.

**M4. Move Fibre into the macro grid.**
Make it a 2x3 grid: Calories / Protein / Carbs / Fat / Fibre / (empty). Right now Fibre's full-width row breaks the visual rhythm. Cosmetic but high-leverage for "feels finished."

### Nice-to-have (next wave, only if telemetry justifies)

**N1. Cholesterol + Potassium fields** in the disclosure (schema add: `cholesterol_mg`, `potassium_mg`). Add only if search analytics show >5% of custom-food creations have a barcode that came from a packaged item (i.e. label data is available).

**N2. Copy from existing food.**
Long-press on any custom food row → "Duplicate." Pre-fills the create sheet with everything except the name (which gets " (copy)" appended). One day's work; defer until we know how often users want it.

### Out-of-scope (rejected — see section 7)

Photo of label, public/private sharing (until F-138 Phase 4 cleanly defines public custom foods), trans fat, individual fatty acid breakdowns, vitamins A/C/Calcium/Iron grid.

---

## 5. UI brief

```
┌─────────────────────────────────────────────────┐
│  Create custom food                          ×  │
│  For homemade items or foods not in our DB.    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Name *                                         │
│  [ Homemade granola                          ]  │
│                                                 │
│  Brand (optional)                               │
│  [ My recipe                                 ]  │
│                                                 │
│  Serving size (optional)                        │
│  [ 1 slice          ] [ 30 ] grams              │
│  [ + Add another serving ]    ← up to 3 total   │
│                                                 │
│  [ 4 ] servings per container (optional)        │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Macros entered as:                     │   │
│  │  ( • Per serving )  ( Per 100 g )       │   │  ← M1 toggle
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────┬──────────────┐                │
│  │ Calories     │ Protein (g)  │                │
│  │ [ 220     ]  │ [ 8       ]  │                │
│  ├──────────────┼──────────────┤                │
│  │ Carbs (g)    │ Fat (g)      │                │
│  │ [ 28      ]  │ [ 9       ]  │                │
│  ├──────────────┼──────────────┤                │
│  │ Fibre (g)    │              │                │  ← M4 grid
│  │ [ 3       ]  │              │                │
│  └──────────────┴──────────────┘                │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ PER-SERVING PREVIEW                     │   │
│  │ 1 slice (30g) ≈ 220 kcal · P 8 · C 28…  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [ + Add detailed nutrition          ⌄  ]      │  ← collapsed
│  ┌─────────────────────────────────────────┐   │
│  │ (when expanded:)                        │   │
│  │ Sugar (g) / Sat fat (g) / Sodium (mg)   │   │
│  │ Barcode (optional, 8/12/13/14 digits)   │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
├─────────────────────────────────────────────────┤
│  [ Cancel ]                  [ Save food ]      │
└─────────────────────────────────────────────────┘
```

**Default toggle states:**
- `Per serving` toggle: ON if natural serving has both label + grams, else `Per 100 g`. Persist user's last choice in AsyncStorage / localStorage so a power user doesn't re-toggle every time.
- "Add detailed nutrition" disclosure: collapsed (unchanged from today).
- Save copy: `Save food` (create) / `Save changes` (edit) — unchanged.
- Save position: pinned bottom-right of footer — unchanged.

**Behaviour notes for executor:**
- Toggle state lives in component state; on flip, run conversion and update the four macro text fields. Show the one-line notice for 3s then fade.
- "Add another serving" rows are rendered from a `servings: ServingRow[]` state array, capped at 3. Validation: each must be both-or-neither. Empty trailing rows are stripped on save.
- The barcode-failure → custom-food entry point is in `barcode.tsx`, not in the sheet. Pass `initialBarcode` prop (mirror existing `initialName` prop, sheet line 79-83 in mobile, dialog line 78-79 in web).

---

## 6. Estimated effort

**Two PRs.**

- **PR 1 — M1 + M4 (mobile + web in same PR):** ~1.5 days. Toggle is the entirety of the work; M4 is a 30-minute grid reflow. Both surfaces touch the same shared `customFoods.ts` for the conversion helper. Adds one new pure helper `convertMacrosBetweenBases()` with full test coverage.

- **PR 2 — M2 + M3 (mobile-first, web parity in same PR):** ~2.5 days (was 2; +0.5 day for unlimited-row UX with the compact ScrollView list). M2 is a small wiring change in `barcode.tsx` plus the prop pipe. M3 is state-array refactor + "add row" UX + compact list rendering + tests for the both-or-neither validation extended to N rows.

Total: **~4 days**, two PRs, sequenced to land within one sprint. No migrations on PR-1 / PR-2.

**PR 3 (read surface for cholesterol + potassium)** + **PR 4 (write fields + schema)** are deferred to a later wave and not part of this initial F-156 work.

If we want to ship M1 alone first and let it sit before adding M2/M3, that's a perfectly defensible call — M1 is the single highest-leverage item.

---

## 7. What stays out (and why)

| Considered | Why it's out |
| --- | --- |
| **Camera scanner inside the sheet** | The scanner already exists at `barcode.tsx`. Duplicating it inside the sheet adds permission prompts, two camera surfaces, and breaks the mental model "scanning lives in Scan." M2 does the cross-product wiring instead. |
| **Photo of the label** | Storage cost + moderation surface area + zero impact on logging accuracy (we don't OCR). Cosmetic-only feature. |
| **Public / private sharing** | F-138 Phase 4 owns the question of public custom foods. Re-opening it here forks two specs. Hold. |
| **Cholesterol, Potassium, Vit A/C, Calcium, Iron, Trans fat** | We don't surface micros yet beyond sodium / sugar / sat fat. Adding entry fields with no read surface is collecting data the user can't see — bad trust posture. Add when the read surface exists. |
| **Copy from existing food (long-press → duplicate)** | Real value but unproven demand. Listed as N2; revisit if telemetry shows >10% of custom-food creations are near-duplicates of existing ones. |
| **Importing nutrition from a URL** | Cal-AI-adjacent. Opens scraping + IP + accuracy cans of worms. Hard no until we have a deliberate "import" track. |
| **Recipe-style multi-ingredient builder** | That's a recipe, not a custom food. Recipes are a separate surface and a separate spec. |
| **Per-quantity entry ("I had 2.5 servings")** | Already handled at the **log** step, not the create step. Conflating them would force users to re-create the food every time they ate a different amount. |

---

## Severity & next action

- **Severity:** P2 — real product gap, not a bounce-driver today, but the right shape for a post-launch sprint.
- **Next action:** route to `planner` to schedule PR 1 (M1 + M4) within the next wave. PR 2 (M2 + M3) follows immediately.
- **Web parity:** both PRs ship web + mobile in the same commit, per project rule.
- **Tests:** new pure helper `convertMacrosBetweenBases()` gets 100% unit coverage in `tests/unit/customFoods.test.ts`; existing form parity test (`apps/mobile/tests/unit/createCustomFoodFormParity.test.ts`) extended for the toggle + multi-serving cases.
- **Docs to update on ship:** `docs/journeys/food-tracking.md`, `docs/technical/components.md`, `apps/mobile/CHANGELOG.md`, and the F-156 row in `docs/testflight-feedback/tracker.md`.

---

## Open questions for Grace — RESOLVED 2026-05-10

1. **Default basis toggle on first open** — ✅ `Per serving` when a natural serving exists, else `Per 100 g`. Persist user's last choice across sessions.
2. **Multi-serving cap** — ✅ **Unlimited (MFP parity)**, overriding the spec's recommended cap of 3. Implementation note: the form needs visual discipline at scale — render added rows in a compact list (no extra labels, just `[label] [grams] ×`), keep first row pinned as the canonical natural serving used by the preview, and lazy-render rows beyond ~3 inside a `ScrollView` so the form doesn't blow up the sheet height. Both-or-neither validation per row stays.
3. **N1 (Cholesterol + Potassium)** — ✅ **Build the read surface first, then the write fields.** No new entry fields in PR-1 or PR-2. Defer to a separate **PR 3 (read)** + **PR 4 (write + schema add)** sequence after the read surface lands. Trust posture: don't collect data the user can't see.

### Updated PR sequence after these calls

- **PR 1 (~1.5 days):** M1 per-serving toggle (with the "default Per serving when natural serving set" rule + last-choice persistence) + M4 Fibre into the macro grid.
- **PR 2 (~2.5 days, +0.5d for unlimited rows):** M2 scan-to-prefill from barcode failure + M3 multi-serving as **unlimited list** with pinned first row, compact row UI, and ScrollView lazy-render.
- **PR 3 (TBD, after telemetry confirms surface need):** Cholesterol + Potassium read surface on food-detail + meal-nutrition.
- **PR 4 (after PR 3):** Cholesterol + Potassium write fields in disclosure + schema add (`cholesterol_mg`, `potassium_mg` columns on `user_foods`).

---

## Files referenced (absolute paths)

- `apps/mobile/components/CreateCustomFoodSheet.tsx`
- `src/app/components/suppr/create-custom-food-dialog.tsx`
- `src/lib/nutrition/customFoods.ts`
- `supabase/migrations/20260414180000_create_user_foods_table.sql`
- `supabase/migrations/20260430100000_user_foods_micros.sql`
- `apps/mobile/app/(tabs)/barcode.tsx`
- `docs/testflight-feedback/tracker.md` (F-156 row)
