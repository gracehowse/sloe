# Recipe Import — Best-in-Class Redesign Spec

**Surface:** Recipe import (link / Reel / TikTok / YouTube / Pinterest / website / photo / paste)
**Platforms:** iOS-primary, web parity
**Spec status:** Design brief — not yet implemented
**Last updated:** 2026-06-02
**Sources:** Functional inventory (audited source, June 2026), Mobbin benchmark (June 2026), Suppr design direction (locked)

---

## 1. Surface Overview

### Purpose

Recipe import is Suppr's viral wedge and the primary acquisition loop: a user sees a recipe on TikTok or Instagram, taps Share, and within 90 seconds that recipe is in their plan with per-serving macros, a confidence-graded ingredient list, and a card that says "this dinner still leaves you 540 kcal and 32g protein for the day." That combination — attributed Reel-import plus goal-awareness — is uncopyable by pure recipe apps (no goals layer) and pure diet apps (no content layer).

### Role in the product

- **Acquisition:** the share-sheet flow is the primary TikTok/IG → Suppr pipeline. Every attributed import is a potential re-share.
- **Retention:** imported recipes populate the library and the meal plan, driving return visits.
- **Positioning proof point:** the "fits your day" card is the product's core proposition made visible — "cook what you love, fit it to your goals."
- **Pro upgrade trigger:** image OCR is Pro-gated. Every photo-import attempt by a free user is a paywall moment.

### Navigation entry points

**Mobile:**
- Recipes tab → "+" → `CreateRecipeActionSheet`
- Share-sheet cold launch → `/import-shared?url=`
- Warm resume clipboard detection → `/import-shared`
- `suppr://import` deep link
- Clipboard quick-action on the action sheet ("Paste from {host}")

**Web:**
- `/import` route → `RecipeUpload` in import mode
- Recipes section "Import" button → same

---

## 2. Current Design Audit (Weaknesses Only)

### Action sheet (`CreateRecipeActionSheet`)

- Row list is visually undifferentiated. The link/Reel path — Suppr's viral hook — has identical visual weight to manual entry.
- No clipboard pre-detect affordance is visible until after the sheet opens, and even then it appears as a secondary line with no visual distinction.
- No Pro lock shown on the photo tile; free users tap it and receive a 403 at the API boundary (gap #1).
- Icons are not yet aligned to lucide-react-native exact set.

### Import screen idle state (`import-shared.tsx`)

- The "IMPORT FROM" source grid (TikTok / Instagram / YouTube / Website, four equal tiles) maps all four actions to `onPasteFromClipboard` — it looks like a four-way router but is a single handler (audit gap #6). This is a discoverability and honesty problem.
- Platform inline hints ("use share sheet for best results") are useful but styled as flat body text; they disappear visually.
- Recent imports list exists but source badges are small and inconsistent with the design direction.
- Signed-out state correctly preserves the pasted URL through login but the UI is generic.

### Loading state

- Three-step phased loader (ingredients → nutrition → macros) is functionally correct and more informative than any comparable. The visual treatment is not yet aligned to the direction: serif step labels, line-art glyph, no sparkles.
- 8s "taking longer than usual" nudge and cancel are unique Suppr advantages — kept.

### Caption preview state

- Trust copy ("We never fetch the post itself — this is the caption text you shared") is best-in-class — better than any Mobbin comparable. Keep verbatim.
- No escape hatch into the photo path if the caption is thin or wrong.
- This state exists only on mobile; web URL import of an IG/TT link hits the og-tag scrape directly without the trust framing (gap #2).

### Review state (pre-save)

- Long-press to override an ingredient is discoverable only by accident. None of the Mobbin comparables hide this behind a long-press; Cherrypick (https://mobbin.com/screens/5e4ba8b5-6fd0-4fb9-8a4d-04e1671b0edd) uses a visible "Swap" label.
- The header ("some ingredients need review") is accurate but clinical. MFP's "Do these matches look right?" (https://mobbin.com/screens/f209cb21-f50e-456d-88bf-4af21abd8564) is warmer and more actionable.
- Matched food name is not visually distinguished from the original parsed line in the current row layout, making wrong matches harder to spot.
- "HOW THIS FITS YOUR DAY" macro card is mobile-only; web shows a raw MacroWheel with no target comparison (gap #4).

### Verify screen (`verify.tsx`)

- Confidence bar (≥0.9 green / ≥0.5 amber / <0.5 red) is a genuine Suppr advantage — no comparable has graded confidence. Keep.
- Density-aware "= N g" / "needs density — tap to switch to g" is a genuine data-quality feature. Keep.
- Caption-claim banner (creator says X kcal, we calculated Y) is a unique honesty signal. Keep.
- "needs density" hint competes visually with the confidence bar; hierarchy needs clarifying.
- No comparable verify screen on web — the bare RecipeUpload with MacroWheel and USDA picker offers a fraction of the review capability (gap #3).

### Web `RecipeUpload`

- The MacroWheel (recharts pie) shows macro composition but not comparison to daily target — it cannot answer the product's north-star question ("does this fit my day?"). This is the single most important web gap.
- No confidence bars on matched ingredients.
- No density-aware portion hints.
- No caption/trust path for IG/TT links.
- No "fits your day" target card.
- No recent imports list.
- No separate pre-save review state; everything is in one form.

### Photo import

- Pro gate is enforced server-side (correct) but mobile shows the Scan photo tile to all users and fails at request time rather than showing a lock on the tile (gap #1).
- No pre-capture coaching (Cal AI model: https://mobbin.com/screens/4cf16779-f393-4fac-92b6-ba105c91342e) — a real accuracy upgrade.
- No edge guidance for full-page captures.
- `imageUsed = false` honesty banner (image silently dropped, fell back to caption) is a Suppr advantage — keep.

### Servings editor

- Inline −/+ stepper is functional. No quick-multiplier chips (1x/2x/4x) for batch cooks (Alma: https://mobbin.com/screens/613b19b6-99a7-457d-838b-85daa967fd26).

### Success state

- "SAVED → In your library → View / Review ingredients" two-action success is better than every comparable's silent drop-to-detail. Keep; restyle in direction.

---

## 3. Redesign — Per-Component Specification

---

### 3.1 CreateRecipeActionSheet — "Add a recipe" entry

**Current purpose:** canonical fork into link / photo / cookbook / manual.

**Current weaknesses:** undifferentiated row weight; photo tile has no Pro lock; clipboard quick-action is visually buried; icons not exact.

**Benchmark:**
- Julienne 2×2 serif-tile sheet: https://mobbin.com/screens/46f642d4-85ac-4f0e-9d6b-a6c37ea7bdae
- Recime "Write from scratch" separator: https://mobbin.com/screens/8374ed18-353d-4ead-94a1-63b770d70c43

**Proposed redesign:**

Layout: bottom sheet, white `#FFFFFF` background, 24px corner radius top, drag indicator (#ECEAE4, 4×36px). Sheet content max-height 70vh, scrollable if content overflows.

**Clipboard quick-action (conditional — shown only when clipboard holds a recognised URL):**
Full-width card at the very top of the sheet, above the grid. Background `#F6F5F2`, 12px radius, 16px padding. Left: terracotta `link` icon (lucide-react-native `Link`, 20px, `#C2683E`). Centre: Fraunces Regular 15px `#1B1814` "{Recipe title or host} — tap to import". Right: chevron-right `#ECEAE4`. Subtle terracotta left-border (3px). This is a Suppr advantage; no comparable has it — defend it.

**2×2 tile grid:**
Four equal-height tiles (168×120px), 12px gap, 16px outer padding. Each tile: white card, `#ECEAE4` hairline border (0.5px), 14px radius.

| Tile | Icon (lucide-react-native) | Label | Treatment |
|---|---|---|---|
| Paste a link / Reel | `Link2` | "Paste a link" | **Primary tile.** Terracotta icon (`#C2683E`), Fraunces Medium 15px label. Subtle terracotta background tint `#FDF5F0` on the tile. This is the viral-wedge path — make it legible as the main action. |
| Photo of a recipe | `Camera` | "Scan a photo" | **Pro-locked.** Icon: `Camera` with a small `Lock` overlay badge (12px, `#C9892C` amber, top-right corner). Label adds "(Pro)" in Inter 12px `#C9892C` beneath. Tile press → paywall for Free users, camera picker for Pro. **Fix for gap #1.** |
| Import cookbook | `BookOpen` | "From a PDF" | `#7C8466` sage icon. Label Fraunces Regular 15px. Flag-gated; when `cookbook_import_enabled = false` the tile is visible but shows a "Coming soon" badge (Inter 11px, #ECEAE4 bg, #7C8466 text) and is non-interactive. |
| Manual entry | `PenLine` | "Create manually" | `#7C8466` sage icon. Fraunces Regular 15px. |

Below the grid: 12px hairline divider `#ECEAE4`. Then a single 44px row: Inter Regular 14px `#7C8466` "Or write from scratch" with a right-aligned `ChevronRight` — maps to manual entry route. (Recime pattern — demotes without hiding.)

**Motion:** standard iOS sheet spring (stiffness 400, damping 30). Tiles scale to 0.96 on press with 100ms spring. Clipboard quick-action entrance: slide-in from top, 200ms ease-out, only after clipboard detection resolves (no layout shift during detection).

**Accessibility:** each tile: `accessibilityRole="button"`, `accessibilityLabel` describes the full action ("Import a recipe from a link or social post"), `accessibilityHint` names the engine. Pro-locked tile: `accessibilityLabel` includes "Pro feature — upgrade required". Minimum touch target 44×44px.

**User benefit:** the viral path is immediately legible as primary; Pro lock prevents the frustrating fail-after-tap; clipboard pre-detect saves the most common action (copy URL from browser, open app) to one tap.

---

### 3.2 Import screen — idle state

**Current purpose:** paste a URL or trigger share-sheet import; show supported platforms; show recent imports.

**Current weaknesses:** source grid is decorative (four tiles → one handler); platform hints are flat text; signed-out state is generic.

**Benchmark:**
- Cherrypick unified paste field + icon row: https://mobbin.com/screens/cdaf9320-8443-4938-8c92-948717cf560b
- CREME creator attribution card: https://mobbin.com/screens/b1667741-5d21-46c8-a386-dab77c75cdc3
- Recime per-platform import guides: https://mobbin.com/screens/8374ed18-353d-4ead-94a1-63b770d70c43

**Proposed redesign — signed-in:**

Header: Fraunces Medium 22px `#1B1814` "Import a recipe". Inter Regular 14px `#7C8466` "From any link, social post or website." 24px below header.

**Paste field:**
Full-width, 56px height, `#F6F5F2` background, `#ECEAE4` border (0.5px), 12px radius. Left: `Link2` icon 20px `#7C8466`. Placeholder: Inter Regular 15px `#ECEAE4` "Paste a link…". Right: "Import" button (terracotta pill, Fraunces Medium 15px white, 44px height, 16px horizontal padding). Below field, when text is present: Inter 12px `#7C8466` platform-specific inline hint — "Tip: for TikTok and Instagram, use the app's share sheet for best results." (existing logic, restyled).

**Source-trust chip row (below the paste field, not a nav grid):**
Single horizontal row, 8px gap between chips. Each chip: `#F6F5F2` background, `#ECEAE4` border, 8px radius, 32×24px. Contains only the platform monogram/icon (TikTok, Instagram, YouTube, globe). No tap action on the chips themselves. Right of the row: Inter 12px `#7C8466` "Works with". **This resolves audit gap #6 honestly** — the icons become trust-affordance signals (Cherrypick model), not fake route buttons. Platform-specific guidance instead surfaces as the inline hint below the field.

**CREME-style attribution preview (conditional):**
When the pasted URL resolves to a creator handle (IG, TT, YT), show a card above the Import button: `#F6F5F2` background, 12px radius, 12px padding. Left: platform icon 20px. Centre: Inter Regular 14px `#1B1814` "@{handle} · {detected title if available}". Right: `X` to dismiss. This is Suppr's attributed-Reel differentiator made visible before the import runs. If the handle is unknown, card is omitted.

**"Use clipboard" secondary CTA:**
Single 44px touchable row below the import button. `Link` icon 16px `#7C8466`, Inter Regular 14px `#7C8466` "Use clipboard". No border. Visible only when clipboard has content other than what's already in the field.

**"RECENT IMPORTS" section:**
Section header: Inter SemiBold 12px `#7C8466` uppercase tracking-wider "RECENT IMPORTS". Three recipe rows, each 64px height: `#F6F5F2` card, 10px radius, 12px horizontal padding. Left: source badge chip (TT / IG / YT / W, Inter Mono 10px, `#F6F5F2` bg, `#1B1814` text, `#ECEAE4` border, 6px radius). Centre: Fraunces Regular 15px `#1B1814` recipe title (1 line, truncated), Inter Regular 12px `#7C8466` relative time ("2 days ago"). Right: `ChevronRight` 16px `#ECEAE4`. If no recent imports: omit section entirely (don't show an empty state here; the paste field is the primary CTA).

**Signed-out state:**
Replace recent imports and source row with a single card: `#F6F5F2`, 14px radius, 20px padding. Fraunces Medium 17px `#1B1814` "Sign in to import recipes". Inter Regular 14px `#7C8466` "Your pasted link will be saved." If a URL has been pasted, the field value persists through auth. Sign in CTA: terracotta pill, full-width-minus-40px, Fraunces Medium 15px white.

**User benefit:** honest source grid (no fake routing); attributed creator card makes the viral differentiator visible before the first byte is fetched; signed-out flow preserves intent.

---

### 3.3 Loading / processing state

**Current purpose:** phased loader while AI parses; cancel + slow nudge.

**Current weaknesses:** visual treatment not yet aligned to direction (no serif step labels, no line-art glyph, no calm voice).

**Benchmark:**
- Bevel calm plate glyph + single sentence: https://mobbin.com/screens/47101bbd-1a04-45c6-a25b-2e16351ed01a
- Cal AI pre-scan checklist: https://mobbin.com/screens/4cf16779-f393-4fac-92b6-ba105c91342e (applied to photo path — see §3.7)
- MFP named current step: https://mobbin.com/screens/3957c43d-2ece-4940-9683-c7b62aee6b26

**Proposed redesign:**

Full-screen takeover (replaces the idle state in-place, no navigation push). White background.

Centre-aligned stack:

1. **Line-art glyph:** a single 80×80px `UtensilsCrossed` or `ChefHat` lucide icon, stroke 1.5px, `#1B1814`. No animation on the glyph itself.
2. **Fraunces Regular 20px `#1B1814`** — current step label from the existing three steps, animated crossfade between steps (200ms ease). Steps rendered as:
   - "Finding ingredients…"
   - "Estimating nutrition…"
   - "Checking your macros…"
3. **Progress track:** 240px wide, 2px height, `#F6F5F2` background, terracotta `#C2683E` fill, animated left-to-right over the timed steps (400/1200/2000ms — existing timing preserved). Radius 1px (capsule).
4. **8s nudge (existing):** at 8s, beneath the track: Inter Regular 13px `#7C8466` "Taking a bit longer than usual — almost there." Fade in 300ms.
5. **Cancel:** Inter Regular 14px `#C2683E` "Cancel" link, 24px below nudge (or below track before nudge appears). 44px touch target.

No spinner. No sparkles. No "Powered by AI" copy. Calm is the goal.

**Photo import sub-variant (checking state):**
Before the parse begins, insert a pre-capture coaching interstitial (Cal AI model): white card, 14px radius, centred. Fraunces Medium 17px "For best results". Bulleted checklist (Inter Regular 14px `#1B1814`, `Check` icons in `#5E7C5A` success-green):
- "Lay the recipe flat so all text is visible"
- "Include the ingredients and quantities"
- "Good lighting — no glare on the page"

"Looks good" primary CTA (terracotta pill) triggers the pick. "Skip" secondary in `#7C8466` proceeds without coaching. This is a genuine accuracy upgrade, not decoration.

**User benefit:** calm aesthetic matches the voice; named steps make the wait feel purposeful; pre-capture checklist reduces OCR failures before they cost a round-trip.

---

### 3.4 Caption preview state

**Current purpose:** review the shared caption text before AI parse; deliver privacy trust framing.

**Current weaknesses:** no escape hatch into photo path if caption is thin; this state is mobile-only (gap #2 — web must gain it).

**Benchmark:**
- Bevel "Import photo instead" fallback: https://mobbin.com/screens/1e30b3e8-856f-419d-996a-cfbb14c5a9e6
- CREME source provenance chip: https://mobbin.com/screens/b1667741-5d21-46c8-a386-dab77c75cdc3

**Proposed redesign:**

Header row: platform logo (32px) + Fraunces Medium 18px `#1B1814` "Import from {Instagram | TikTok | YouTube}".

**Trust banner:** `#F6F5F2` card, 12px radius, 14px padding. `ShieldCheck` icon 18px `#5E7C5A`. Inter Regular 14px `#1B1814`: **"We never fetch the post itself — this is the caption text you shared."** Keep verbatim. This copy is best-in-class; no comparable states a privacy posture.

**Attribution chip (if handle detected):** small pill beneath trust banner: `#F6F5F2` bg, `#ECEAE4` border, 8px radius, Inter Regular 12px `#7C8466` "@{handle}". Source domain on right: Inter Mono 11px `#7C8466`.

**Caption preview area:** scrollable, `#F6F5F2` background, 14px radius, 16px padding, max 240px height (truncated with fade at bottom and "Show more" if longer). Inter Regular 14px `#1B1814` for the caption body. Edit toggle: Inter Regular 13px `#C2683E` "Edit" top-right of the card — expands to a TextInput over the caption text.

**Primary CTA:** terracotta pill, full-width-minus-32px, Fraunces Medium 15px white "Looks right — import it". 52px height.

**Escape hatch row (below CTA):** two 44px touchable options side by side (or stacked on small screens):
- `Camera` icon `#7C8466` + Inter Regular 14px `#7C8466` "Import from a photo instead"
- `Link2` icon `#7C8466` + Inter Regular 14px `#7C8466` "Paste the link instead"

These are the escape hatches Bevel surfaces; they're absent from Suppr today.

**Web parity (closes gap #2):** when `RecipeUpload` in import mode receives an IG or TT URL, the trust banner and caption preview card must render before the import runs. Same copy, same visual treatment. This is not currently implemented on web.

**User benefit:** explicit trust framing reduces abandonment at the consent-anxiety moment; escape hatches recover thin-caption cases without an error round-trip.

---

### 3.5 Review state — the editable ingredient list

**Current purpose:** pre-save editable preview with confidence, servings rescale, "fits your day" macro card.

**Current weaknesses:** long-press-to-override is not discoverable; header copy is clinical; matched name not visually distinguished from original line; web has no equivalent state (gap #3); "fits your day" card is mobile-only (gap #4).

**Benchmark:**
- MFP matched-bold / original-line-in-quotes / running total: https://mobbin.com/screens/f209cb21-f50e-456d-88bf-4af21abd8564
- Cherrypick visible "Swap" label: https://mobbin.com/screens/5e4ba8b5-6fd0-4fb9-8a4d-04e1671b0edd
- Alma per-row P/C/F mini-pills: https://mobbin.com/screens/7d4fe1f7-3171-41b3-8baf-c8caa9f7d027
- Lifesum verified-tick: https://mobbin.com/screens/ee7f1862-099b-4782-947a-21a4c00ced87
- MacroFactor thin labelled bars: https://mobbin.com/screens/8d1b33b3-e5b3-46ef-a84f-58ad83b06f50
- MFP per-item % of daily goals: https://mobbin.com/screens/f27a36dd-ce06-4f3a-bdf2-d880ce881822

**Proposed redesign:**

**Header:**
Fraunces Medium 22px `#1B1814` "{Recipe title}". Below: Inter Regular 14px `#7C8466` "Do these matches look right?" (MFP voice — warmer and more actionable than "some ingredients need review"). If confidence is generally high: "Looks good — review before saving."

**Servings editor (inline, below header):**
`#F6F5F2` pill row: `Minus` 20px `#7C8466` | Fraunces Regular 15px `#1B1814` "{N} servings" | `Plus` 20px `#7C8466`. Live macro rescale on every tap (existing `nutritionRescale` behaviour preserved). To the right of the stepper: quick-multiplier chips "1×" "2×" "4×" as small `#F6F5F2` pills with `#ECEAE4` border (Alma model) — tapping sets servings to 1/2/4× the detected yield. Chips are supplementary; the stepper handles the 1–99 clamp.

**Confidence banner (conditional, existing logic preserved):**
`#FDF5F0` background (very light terracotta tint), `#C2683E` left-border 3px, 12px radius. Inter Regular 13px `#1B1814`. Shown when estimates-only or image-dropped. "Image couldn't be analysed — macros are estimated from the caption" or "These macros are estimated — review each ingredient." (`imageUsed = false` banner preserved verbatim.)

**"HOW THIS FITS YOUR DAY" card (mobile + web parity — closes gap #4):**

This is the product's core positioning card. It must land on web in the same design pass.

Card: `#F6F5F2`, 14px radius, 16px padding.

Header row: Fraunces Medium 14px `#1B1814` uppercase tracking-wider "HOW THIS FITS YOUR DAY".

**Plain-language verdict line (Lifesum model):** Inter Regular 15px `#1B1814`. Computed from `resolveTargets` vs recipe per-serving macros. Variants:
- "This fits — you'd still have {remaining kcal} kcal and {remaining protein}g protein after dinner." (`#5E7C5A` success-green `CheckCircle` 14px left of text)
- "A little over on calories — {overage} kcal above today's target." (`#C9892C` amber `AlertCircle` 14px)
- "This takes you over budget — review the portions." (amber — note: the calorie ring uses destructive red for over-budget, but the import card is a **soft nudge**, not a hard gate; amber is correct here per the direction's "over-budget = amber" rule except for the calorie ring)

**Per-macro bars (MacroFactor model + MFP % pattern):**
Four rows: Calories / Protein / Carbs / Fat. Each row:
- Inter SemiBold 12px `#7C8466` macro label, left-aligned
- Hairline track (full width minus labels, 4px height, `#ECEAE4` background, `#1B1814` radius-capsule)
- Terracotta `#C2683E` fill = (consumed-today + this-recipe) / target, clamped at track width. If combined exceeds target: amber `#C9892C` fill for the over-target segment.
- Right-aligned: Inter Regular 12px `#7C8466` "{this-recipe amount} of {target} {unit}"

This is the analytically complete answer (MFP's % approach styled as MacroFactor's thin bars). It preserves all numerals, shows the target, shows the running total after this meal — nothing is hidden. The pure MacroWheel (current web) is retired from this surface because it answers composition but not the goal question.

**Ingredient list:**
Section header: Inter SemiBold 12px `#7C8466` uppercase "INGREDIENTS". Below: {N} of {total} matched · {N} need review (amber count only if >0).

**Per-ingredient row (collapsed, 64px height):**
`#FFFFFF` background, `#ECEAE4` hairline bottom border (0.5px). 16px horizontal padding.

Left column (60% width):
- Fraunces Regular 15px `#1B1814` **matched food name** (bold/prominent — MFP model)
- Inter Regular 12px `#7C8466` italic "{original parsed line}" in quote marks beneath — makes wrong matches immediately obvious (MFP's single best contribution to this pattern)
- Confidence bar: 48px wide, 3px height, radius 2px. Green `#5E7C5A` if ≥0.9; amber `#C9892C` if ≥0.5; red `#C25B5B` (destructive-muted) if <0.5. This is a Suppr advantage — no comparable has graded confidence. Preserve exactly.
- If `isVerified`: tiny `CheckCircle` 10px `#5E7C5A` after the confidence bar (Lifesum tick model).

Right column (40% width), right-aligned:
- Inter Regular 13px `#1B1814` "{calories} kcal"
- Inter Regular 12px `#7C8466` "{protein}g P · {carbs}g C · {fat}g F"
- **"Swap" button** (replaces long-press — closes gap): 36×28px terracotta-outlined pill, Inter SemiBold 12px `#C2683E` "Swap". Tap → `FoodSearchModal` (existing). Right of "Swap": `ChevronDown` 14px `#ECEAE4` to expand the row.

**Per-ingredient row (expanded, existing Nutrition Facts grid preserved):**
- Nutrition Facts grid (kcal / P / C / F / fibre / sodium / sugar) — all existing columns, no removals.
- Serving-size portion picker (existing) — amount input + unit selector.
- Density-aware "= {N} g" hint (existing). "Needs density — tap to switch to g" hint (existing). These are Suppr advantages; keep exactly.
- Action row: `Search` icon + "Search alternative" | `Barcode` icon + "Scan barcode" | `Pencil` icon + "Edit nutrition" | `Trash2` icon + "Remove" — all existing handlers, restyled to 36px height Inter Regular 13px `#C2683E` for destructive, `#7C8466` for others.

**Needs-review rows:**
`#FDF5F0` tinted background (very light terracotta) + amber left-border 3px. No red. The amber is correct: this is not an error, it's a low-confidence estimate.

**Running totals bar (sticky footer):**
`#FFFFFF` background, `#ECEAE4` top border 0.5px, 16px padding, 64px height. Left: Fraunces Regular 15px `#1B1814` "{N} kcal per serving · {N} servings". Right: two CTAs: "Save to Library" (terracotta pill, Fraunces Medium 15px white) and "Cancel" (Inter Regular 14px `#7C8466`).

**MealTypePicker:** existing component, triggered by a `#F6F5F2` pill row between the macro card and the ingredient list: `UtensilsCrossed` 16px `#7C8466` + Inter Regular 14px `#7C8466` "Add to {meal type}" + `ChevronDown` 14px.

**Web parity (closes gap #3 and #4):** `RecipeUpload` in import mode must gain:
- A dedicated pre-save review state (not just the live form)
- The per-ingredient confidence bars (web currently has none)
- The "fits your day" macro card with thin labelled bars (replacing the bare MacroWheel for this surface — the MacroWheel may remain on the create/manual path)
- The "Do these matches look right?" header
- Matched-bold / original-line-in-quotes row layout

**User benefit:** "Swap" replaces the invisible long-press, recovering a large class of abandoned imports where the wrong match slipped through; MFP-style row layout makes wrong matches obvious at a glance; "fits your day" card delivers the product's core value on both platforms.

---

### 3.6 Verify screen (`verify.tsx`) — post-save ingredient review

**Current purpose:** post-save per-ingredient review and correction with full confidence and data detail.

**Current weaknesses:** visual hierarchy between confidence bar, density hint, and caption-claim banner is unclear; some over-budget colour uses inconsistent tokens.

**Benchmark:**
- All Mobbin comparables are weaker than Suppr's verify screen in data depth. The task here is aesthetic alignment, not feature borrowing.

**Proposed redesign:** reskin to direction; no feature removals.

Header: Fraunces Medium 20px `#1B1814` "{Recipe name}". Sub: Inter Regular 14px `#7C8466` "Review your ingredients — tap any row to adjust."

**Caption-claim banner (existing logic, restyled):**
`#FDF5F0` background, `#C2683E` left-border 3px, 12px radius, 14px padding. `Info` icon 16px `#C2683E`. Inter Regular 13px `#1B1814`: "Creator says {claim} kcal/serving — we estimated {calculated} kcal." Second line: Inter Regular 12px `#7C8466` "Over-match: we may have captured an extra ingredient." or "Under-match: the creator may have included ingredients we couldn't find." Keep existing `nutritionDelta`/`materiallyDiverges` logic exactly.

**Live totals card:** `#F6F5F2`, 12px radius, 14px padding. Per-serving P/C/F, fibre if >0. Fraunces Regular 16px `#1B1814` for the numbers, Inter Regular 12px `#7C8466` for the labels. Updates live as rows are confirmed.

**Ingredient rows:** same visual treatment as §3.5 (matched-bold / original-line / confidence bar / "Swap" / expand). Expanded state: full Nutrition Facts grid + portion picker + density hint + action row. All existing handlers preserved.

**Override/Added badges:** Inter SemiBold 10px pill. Override: `#FDF5F0` bg, `#C2683E` text. Added: `#F0F4F0` bg, `#5E7C5A` text. Both get `#ECEAE4` border.

**+ Add ingredient CTA:** dashed border `#ECEAE4`, `#F6F5F2` bg, 14px radius, 48px height. `Plus` 16px `#7C8466` + Inter Regular 14px `#7C8466` "Add an ingredient".

**Footer:** Fraunces Regular 15px `#1B1814` "{N} kcal per serving · {M} servings". "Confirm All" terracotta pill + "Save Changes" sage secondary (Inter SemiBold 14px `#7C8466`).

**User benefit:** visual alignment to direction; no capability loss; caption-claim banner more legible.

---

### 3.7 Photo import (Pro-gated) — pre-capture coaching

**Current purpose:** AI vision OCR of a recipe photo or printed page.

**Current weaknesses:** Pro lock not surfaced on the action-sheet tile (gap #1 — fixed in §3.1); no pre-capture coaching; no edge guidance; `imageUsed` banner kept.

**Benchmark:**
- Cal AI capture coaching: https://mobbin.com/screens/4cf16779-f393-4fac-92b6-ba105c91342e
- Speechify document-scanner edge guidance: https://mobbin.com/screens/33a5da73-1dc2-40c2-8146-566f64ec23df

**Pre-capture interstitial (new, shown before ImagePicker fires):**

`#FFFFFF` full-screen. Centred stack:
- `Camera` icon 64px `#1B1814` stroke 1.5px
- Fraunces Medium 20px `#1B1814` "Scan a recipe"
- Inter Regular 14px `#7C8466` "For best results:"
- Checklist (3 items, `Check` 14px `#5E7C5A` left):
  - "Lay the page flat — all text visible"
  - "Include the ingredients and quantities"
  - "Even lighting, no shadows or glare"
- "Take a photo" terracotta pill + "Choose from library" sage pill (side by side, 8px gap)
- Inter Regular 13px `#7C8466` "6 MB max · HEIC, JPG, PNG supported"

This coaching fires every time on the Pro path (not a one-time interstitial — it's a genuine accuracy nudge, not onboarding).

**imageUsed fallback banner (existing, restyled):**
`#FDF5F0` background, `#C2683E` left-border, `AlertCircle` 16px `#C2683E`, Inter Regular 13px `#1B1814` "Image couldn't be analysed — macros are estimated from the caption." This is a Suppr integrity advantage; keep verbatim.

**User benefit:** pre-capture coaching reduces bad OCR attempts before they cost a round-trip to the AI; Pro lock on tile reduces frustration for free users.

---

### 3.8 Paste-list / manual text entry

**Current purpose:** paste or type a raw ingredient list; bulk match.

**Current weaknesses:** visual treatment is a plain modal; no "paste from anywhere or dictate" framing.

**Benchmark:**
- Julienne "Paste text from any cookbook, photo, or website. Or, use the keyboard microphone to transcribe.": https://mobbin.com/screens/f2aacab6-b8b9-4105-975e-9d35e4ed2611
- MFP bulk-import toggle: https://mobbin.com/screens/71939954-f022-43e0-b701-5205a7751605
- Cherrypick "This looks correct" confirm: https://mobbin.com/screens/ee6224a5-71ec-492a-9cd9-aa7df38f82d8

**Proposed redesign:**

Sheet (mobile) / inline panel (web). White background, 24px radius top.

Header: Fraunces Medium 18px `#1B1814` "Add ingredients". Sub: Inter Regular 13px `#7C8466` "Paste from any cookbook, website, or photo — or dictate using your keyboard microphone." (Julienne framing — on-direction, generous in scope.)

Large TextInput: `#F6F5F2` background, 12px radius, min-height 160px, Inter Regular 15px `#1B1814`, 16px padding. Placeholder: "e.g. 200g chicken breast, 1 tbsp olive oil, 2 cloves garlic…"

MFP-style bulk toggle: `#F6F5F2` pill with toggle: "Line by line" | "Free text". Line-by-line mode parses each newline as a separate ingredient. Free text passes the whole block for AI extraction.

"Parse ingredients" terracotta pill CTA. On result: show matched ingredient rows above the input (Cherrypick model). Per row: matched name (Fraunces Regular 14px) + original line in Inter Regular 12px italic + `Check` icon if confidence ≥ 0.9. "This looks correct" confirm row at the bottom (Cherrypick). "Edit" link per row if needed.

Publish/import honesty framing: if in import mode (not create), show below the CTA: Inter Regular 12px `#7C8466` "Imported recipes can't be published as your own creation." Existing modal `Alert` on mobile and `RecipeUpload.tsx:922` enforcement on web — keep both; surface the copy non-modally here so it's visible before, not after, the save.

**User benefit:** Julienne's framing makes the paste-list feel capable and warm, not utilitarian; honesty copy is now visible before the save rather than as a blocking alert.

---

### 3.9 Success state

**Current purpose:** confirm save; route to view / review.

**Current weaknesses:** none functional; "SAVED" all-caps serif + checkmark is on-direction, just needs token alignment.

**Benchmark:** Suppr's explicit SAVED→View/Review is better than every comparable's silent drop-to-detail. Defend it.

**Proposed redesign (token alignment only):**

Full-screen white. Centre-aligned:
- `CheckCircle` 56px `#5E7C5A` success-green.
- Fraunces Medium 24px `#1B1814` "Saved."
- Inter Regular 15px `#7C8466` "{Recipe title}"
- `#F6F5F2` chip: Inter Regular 13px `#7C8466` "In your library"

Two CTAs:
- Terracotta pill full-width-minus-32px: Fraunces Medium 15px white "View recipe"
- Inter Regular 14px `#C2683E` "Review ingredients" (link-style, below pill)

No modal. No checkmark animation (keep it calm — a subtle scale-in on the CheckCircle, 200ms spring, is sufficient).

**User benefit:** explicit success state prevents the "did it save?" anxiety; Review ingredients route gives the confidence-check path to users who want it.

---

### 3.10 Error states

**Current purpose:** surface import failures; provide retry with Retry-After countdown; prevent vendor/Postgres string leaks.

**Current weaknesses:** none — the existing `IMPORT_ERROR_COPY` / `userFacingImportError` sanitisation is correct. Visual treatment needs direction alignment.

**Proposed redesign (token alignment only):**

**General error:**
`AlertCircle` 40px `#C9892C` amber (not destructive red — import errors are recoverable, not data loss). Fraunces Medium 18px `#1B1814` "Something went wrong". Inter Regular 14px `#7C8466` from `IMPORT_ERROR_COPY` map. URL TextInput pre-filled with the failed URL. Terracotta pill "Try again". Below: Inter Regular 13px `#7C8466` "Or paste a different link".

**Rate-limit (429) with Retry-After countdown (existing, restyled):**
`Clock` 40px `#C9892C`. Fraunces Medium 18px `#1B1814` "Too many requests". Inter Regular 14px `#7C8466` "Try again in {countdown}s." Countdown ticks visually in Inter Mono 16px `#1B1814`. Keep existing countdown logic.

**AI capacity (503 ai_capacity_reached):**
`Cloud` 40px `#7C8466`. Fraunces Medium 18px "High demand right now". Inter Regular 14px `#7C8466` "Our recipe engine is busy. Try again in {Retry-After}s or paste the link again later."

**Signed-out mid-import:**
Preserve existing: URL held in state through auth, restored on return.

**User benefit:** amber over red for recoverable states matches the direction; Retry-After countdown gives users a concrete wait signal rather than a vague "try again."

---

## 4. Visual Token Reference

All tokens from the locked design direction.

| Token | Value | Usage in this surface |
|---|---|---|
| `--background` | `#FFFFFF` | All screen backgrounds |
| `--card` | `#F6F5F2` | All cards, fields, chips |
| `--border` | `#ECEAE4` | All hairlines (0.5px on mobile, 1px on web) |
| `--foreground` | `#1B1814` | All primary text |
| `--muted-foreground` | `#7C8466` | All secondary / label text |
| `--primary` | `#C2683E` | CTAs, active icons, confidence-bar fill for over-budget |
| `--secondary` | `#7C8466` | Secondary actions, sage icons |
| `--amber` | `#C9892C` | Needs-review rows, rate-limit errors, over-budget macro bars |
| `--success` | `#5E7C5A` | High-confidence confidence bars, verified ticks, success state |
| `--destructive-muted` | `#C25B5B` | Low-confidence confidence bars (<0.5) — note: NOT full destructive red; low confidence is a data signal, not an error |

**Type roles:**

| Role | Font | Weight | Size | Colour |
|---|---|---|---|---|
| Screen title | Fraunces | Medium | 22px | `#1B1814` |
| Card/section header | Fraunces | Medium | 17–18px | `#1B1814` |
| Ingredient name (primary) | Fraunces | Regular | 15px | `#1B1814` |
| Data numerals | Fraunces | Regular | 15–16px | `#1B1814` |
| Body / labels | Inter | Regular | 14px | `#7C8466` |
| Dense data rows | Inter | Regular | 13px | `#7C8466` |
| Badges / chips / mono ids | Inter Mono | Regular | 10–12px | varies |
| Section headers (caps) | Inter | SemiBold | 12px | `#7C8466` |
| CTAs primary | Fraunces | Medium | 15px | white on `#C2683E` |
| CTAs secondary | Inter | SemiBold | 14px | `#7C8466` |
| Destructive link | Inter | Regular | 14px | `#C2683E` |

**Radius:** 14px for large cards, 12px for action sheets and medium cards, 10px for recipe rows, 8px for chips/badges, 6px for source tags.

**Spacing:** 8px base grid. Card padding 16px. Section gap 24px. Row height 64px standard, 44px for secondary rows. Minimum touch target 44×44px everywhere.

**Imagery:** recipe cover images on recent imports and success state use the meal/dish rule — hyperrealistic editorial food photography (natural/moody light, ceramic, linen, shallow depth of field). Ingredient-level images (where used in ingredient rows) use the single-subject stylised-photoreal style. Never stock.

**Motion:**
- Sheet entry: iOS standard spring (stiffness 400, damping 30). 
- Step label crossfade: 200ms ease.
- Confidence bar fill: 300ms ease-out on first render.
- Macro bar fill: 400ms ease-out on review state entry.
- Success CheckCircle: scale 0.8→1.0, 200ms spring.
- Tile press: scale 0.96, 100ms spring.
- No sparkles. No bounce. Calm is the standard.

---

## 5. Parity Gaps Closed by This Redesign

| Gap | Description | This spec's resolution |
|---|---|---|
| Gap #1 | Photo import Pro lock not surfaced on tile | Lock glyph + amber "(Pro)" label on tile in §3.1 |
| Gap #2 | Caption/trust path mobile-only | Caption preview card + trust banner specified for web `RecipeUpload` in §3.4 |
| Gap #3 | Web has no review/confidence model | Dedicated review state + confidence bars + matched-bold/original-line layout specified for web in §3.5 |
| Gap #4 | "Fits your day" card mobile-only | MacroFactor-style thin labelled bars card specified for web in §3.5 |
| Gap #6 | Source grid tiles all call one handler | Demoted to trust-affordance chips (no tap action) in §3.2; honest fix |

Gap #5 (recent imports list mobile-only) and Gap #7 (manual entry split) are noted but **intentional** — no change required for this redesign pass. Recent imports list on web would duplicate the library; web RecipeUpload's mode-toggle pattern is acceptable. Both flagged for future parity review.

---

## 6. Cookbook-import — premium-parity pass notes (2026-06-09)

The DS-compliance pass on `apps/mobile/app/cookbook-import.tsx` fixed the following gaps identified by the premium-bar sweep:

**Fixed (code shipped):**
- Typography: `cardTitle` and review-row recipe names routed through `Type.headline` (serifMedium / Newsreader). All raw `fontWeight:'700'/'600'` strings replaced with `FontFamily.*` tokens (DS §2.3 rule 2).
- Spacing: off-scale values removed — `padding:14` → `Spacing.md(16)`, `marginBottom:6` → `Spacing.xs(4)`, `borderRadius:16/14` → `Radius.xl(12)/Radius.lg(8)`, `Radius.xl*2=24` → `Radius.xl(12)`.
- Alerts: non-destructive feedback (file-too-large, parse errors, paywall, save limit) replaced by inline `InlineBanner` component behind `recipe-import-redesign` flag (DS §10.8). Alert retained in flag-off (legacy) path.
- Photography: `CookbookReviewRow` adds `UtensilsCrossed` warm fallback thumbnail (DS §11.4). `CookbookParsingView` replaces `ActivityIndicator` with `ChefHat` line-art glyph + thin terracotta progress track (import.md §3.3).
- Row state: `CookbookReviewRow` uses DS §6.2 selected-card pattern (2pt terracotta border + 6% tint for included) and DS §10.1 visible `CheckCircle` checkbox trailing control for include/exclude state (replaces opacity+strikethrough only).
- Pagination: `recipe-import-redesign` flag path replaces pager with single `FlatList` + sticky running-totals footer (import.md §3.5). Legacy pager preserved in flag-off path.
- Success state: `CookbookSuccessView` component (flag-on only) — `CheckCircle` 56px success-green, Fraunces "Saved.", "In your library" chip, View/Plan CTAs. No Alert (DS §3.9 / import.md §3.9).
- Button: CTA routes through `FontFamily.sansSemibold` (Inter 600) + `accent.primaryForeground` token. `Radius.xl(12)`. Min-height 48pt.
- Components extracted to `apps/mobile/components/cookbook/`: `CookbookParsingView`, `CookbookSuccessView`, `CookbookReviewRow`. Reduces screen complexity (toward ENG-621 target).

**Deferred (not fixed in this pass):**
- **Web cookbook-import surface** (sev 5 parity gap): no web UI exists for the batch-cookbook-import journey (multi-recipe parse, per-recipe exclude, author-vs-match, partial-save). The API routes exist but no web page/component. Building a correct web surface is >80 lines and blocked on the `recipe-import-redesign` import-screen parity work (gaps #3/#4 from §5 above must land first). Tracking as ENG-NNN — see gapsDeferred. // deferred: see ENG-NNN (to be filed)
- **Sweep harness hard-fail for flag-gated routes** (sev 5 functionality): the sweep that produced the false positive `cookbook-import.png` (byte-identical to plan.png) captured the Plan fallback because `cookbook_import_enabled` was off. The harness should detect `router.back()` on mount and fail the sweep. This is a test-infra fix, not a cookbook-import code fix. // deferred: see ENG-NNN (to be filed)

---

## 6. FUNCTIONALITY PRESERVED Checklist

Every audited feature, data point, interaction, and gating from the functional inventory is checked against this spec. Nothing may be dropped, hidden, simplified, or weakened. Where a feature is upgraded, "IMPROVED" is noted.

### Import engines

- [x] URL importer (schema.org JSON-LD, og-tag + AI, Pinterest SSRF-guarded resolution) — untouched by redesign
- [x] Caption-text importer flag-gated OFF (`IG_TT_IMPORT_ENABLED`) — flag gate preserved; spec does not change flag state
- [x] Image/photo OCR importer (Pro-gated, 6MB max, HEIC→JPEG normalisation, Claude vision temp 0.2) — untouched; pre-capture coaching IMPROVED
- [x] Paste-a-list path (no AI, nutrition DB matching only) — preserved in §3.8
- [x] `kill_recipe_import` PostHog kill-switch (503 on all three routes) — untouched

### Screens and entry points

- [x] `CreateRecipeActionSheet` (4 options + clipboard quick-action) — preserved; primary emphasis on link tile is additive, IMPROVED discoverability
- [x] `import-shared.tsx` all states (idle / checking / importing / captionPreview / review / saving / success / error) — all states specified in §3.2–§3.3–§3.4–§3.5–§3.9–§3.10
- [x] `create-recipe.tsx` — not changed by this spec; auto-photo path preserved
- [x] `recipe/verify.tsx` — preserved in §3.6; no data removals
- [x] `cookbook-import.tsx` — flag-gated OFF; shown as "Coming soon" tile in §3.1
- [x] Deep-link / share-sheet / clipboard entry points (`ForwardSocialSharesToImport`, `ForwardShareIntentToImport`, `ResumeClipboardToImport`, clipboard polled 450ms/600ms) — untouched
- [x] Web `RecipeUpload` (`mode="import"` and `mode="create"`) — extended with parity features; existing mode logic preserved
- [x] `/import` page.tsx routing — untouched

### Data points and business rules

- [x] Per-serving macros = recipe total ÷ servings via `nutritionRescale` — preserved
- [x] Servings clamp 1–99 — preserved; quick-multiplier chips are additive (IMPROVED)
- [x] `recomputeRecipeTotals` honours per-row overrides; sugar/sodium from snapshot columns — untouched
- [x] `scaleMacrosByGrams(per100g, grams)` — untouched
- [x] Per-serving-only FatSecret foods (no per-100g): `macrosPerServing × quantity`, fibre=0 — untouched
- [x] `RECIPE_INGREDIENT_REVIEW_CONFIDENCE` threshold + `ingredientVerifyNeedsReview(avg, min)` — untouched
- [x] Confidence bar colours: ≥0.9 green / ≥0.5 amber / <0.5 red — preserved exactly in §3.5 with direction-aligned tokens
- [x] `classifyConfidence` buckets for analytics (never raw floats) — untouched
- [x] `primarySource` field ("Site" / verifier source / "Unverified" / "Estimated") — untouched
- [x] Caption-vs-calculated divergence: `nutritionDelta` → `materiallyDiverges` → claim banner — preserved in §3.6
- [x] `imageUsed = false` → "image silently dropped" banner — preserved verbatim in §3.4 and §3.7
- [x] Free save limit = 10 recipes (`saveImportedRecipe.ts:282`) — untouched; no UI change to this gate
- [x] `STANDARD_UNITS` gram weights (oz 28.35, tbsp 14.79, tsp 4.93, cup 236.59, g/ml 1) — untouched
- [x] Profile targets from `resolveTargets` for "fits your day" — preserved; card is now on both platforms (IMPROVED)
- [x] Rate limits (URL 20/min, image 15/min, caption 20/min) — untouched; Retry-After display preserved in §3.10
- [x] No vendor/Postgres string leak in errors (`IMPORT_ERROR_COPY` / `userFacingImportError`) — preserved in §3.10

### Gating

- [x] URL import: Free + Pro — preserved (no tier check in route.ts, unchanged)
- [x] Caption import: flag-gated OFF both tiers — preserved
- [x] Photo/image OCR: Pro-only (server 403 `pro_required`) — preserved; additionally surfaced on tile in §3.1 (IMPROVED)
- [x] Paste-list: Free + Pro — preserved
- [x] Save count: 10 max Free / unlimited Pro — untouched
- [x] Publish to community: Pro only — honesty copy now visible pre-save in §3.8 (IMPROVED); both `RecipeUpload.tsx:378` and mobile attestation Alert preserved
- [x] Voice/photo-log as ingredient in verify: photo-log Pro-gated — untouched

### AI / insight capabilities

- [x] AI caption parse (Claude primary, OpenAI fallback via `aiProvider`) — untouched
- [x] AI image vision OCR (`callAiVision`) — untouched; pre-capture coaching is a UX layer only, no API change
- [x] Tiered URL extraction (og-tags + AI, Instagram comments augmentation, Whisper REMOVED per IP counsel) — untouched and the Whisper removal is preserved (no re-addition)
- [x] Pinterest SSRF-guarded outbound URL resolution — untouched
- [x] Auto meal-type classification (`classifyMealType`) — preserved; `MealTypePicker` in §3.5
- [x] Caption nutrition extraction (`extractCaptionNutrition`) → creator-claim banner — preserved in §3.6
- [x] Title sanitisation (`sanitiseImportedTitle`) — untouched
- [x] 503 `ai_capacity_reached` with Retry-After — preserved in §3.10

### Suppr advantages defended (no comparable matches these)

- [x] Graded confidence bar (≥0.9 / ≥0.5 / <0.5) — preserved and restyled with exact tokens
- [x] Density-aware "= N g" / "needs density — tap to switch to g" — preserved in §3.5 expanded row
- [x] "We never fetch the post itself — this is the caption text you shared" trust copy — preserved verbatim in §3.4
- [x] `imageUsed = false` fallback banner — preserved verbatim in §3.4 and §3.7
- [x] Recent imports list with source badges — preserved and restyled in §3.2
- [x] Phased 3-step loader + 8s "taking longer than usual" nudge + cancel — preserved and restyled in §3.3
- [x] Explicit SAVED → View / Review success state — preserved in §3.9
- [x] Publish-attestation honesty framing — preserved and IMPROVED (visible pre-save, not only as a blocking alert)
- [x] Clipboard quick-action ("Paste from {host}") with dedup logic — preserved in §3.1 and §3.2

### New capabilities added (all are improvements, none replace existing)

- [x] Pre-capture coaching interstitial for photo import (§3.7) — genuine OCR accuracy improvement, Cal AI model
- [x] Visible "Swap" affordance on ingredient rows (§3.5) — replaces hidden long-press; existing handler unchanged
- [x] CREME-style creator attribution card on idle state when handle detected (§3.2)
- [x] Escape hatches from captionPreview into photo/link path (§3.4)
- [x] Quick-multiplier chips (1×/2×/4×) alongside servings stepper (§3.5)
- [x] MacroFactor-style thin labelled macro bars replacing bare MacroWheel for the "fits your day" card (§3.5) — web + mobile
- [x] Lifesum plain-language verdict line on "fits your day" card (§3.5)
- [x] Parity: caption/trust state on web (§3.4)
- [x] Parity: confidence bars + matched-bold/original-line row layout on web (§3.5)
- [x] Parity: "fits your day" card on web (§3.5)

---

## 7. Implementation Notes for Executor

### Flag requirements

All visual changes in this spec ship behind `isFeatureEnabled("recipe-import-redesign")` (mobile) and the same flag name on web. The old paths stay alive in the `else` branches until the flag has held 100% for two weeks with no regression.

### File size warning

`import-shared.tsx` is 2053 lines and `RecipeUpload.tsx` is 2193 lines — both are well above the 400-line screen limit (ENG-621). The redesign must not make these files larger. Extract:
- `useImportScreen()` hook from `import-shared.tsx` for all state + handlers
- `<ImportIdleView />`, `<ImportReviewView />`, `<ImportSuccessView />` as separate component files
- `<FitsYourDayCard />` as a standalone component usable on both platforms
- `<IngredientReviewRow />` (collapsed + expanded) as a standalone component
- `<ImportLoadingView />` as a standalone component

### Web parity work order

1. `<FitsYourDayCard />` shared component (logic from `resolveTargets`, chart from thin bars spec)
2. Confidence bar component (shared, same thresholds as mobile)
3. Pre-save review state in `RecipeUpload` (gate behind `recipe-import-redesign` flag)
4. Caption preview card for IG/TT links in `RecipeUpload`

### Analytics events

No new event names required. Existing events:
- `recipe_imported` — preserved; no new properties
- `recipe_import_failed` — preserved
- `recipe_ingredient_swapped` — update the trigger to fire on the new visible "Swap" tap (not long-press); event name unchanged
- `recipe_import_preview_dismissed` — add for the new escape-hatch taps from captionPreview

`confidence_bucket` property on all ingredient-match events: preserved (never raw float).

---

*End of spec. Implementation requires: executor (code), qa-lead (test plan update for new Swap affordance + pre-capture interstitial + web parity states), sync-enforcer (sign-off on gap #5 and gap #7 intentional-divergence carve-outs), release-gate (final ship verification).*
