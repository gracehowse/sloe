# Gluten depth (B3.2 — Phase 5)

**Status:** Phase 5 / B3.2 — implementation shipped 2026-04-27.
Legal-reviewer copy review RESOLVED 2026-05-27 (ENG-748): descriptive
chip copy + Sparkles glyph + persistent disclaimer caption; the
regulated term "Gluten-free" never renders as a label.
**Authority:** D-2026-04-27-13 (one allergen done brilliantly = gluten).
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` §1.6 +
Surface H §Ingredients.

## What it is

Coeliac-grade gluten-free / contamination-risk classification across
recipe surfaces, surfaced via a `<TrustChip>` chip variant pair
(`gluten-high-conf` / `gluten-uncertain`) and inline ingredient
flagging.

> "Pick one allergen and do it brilliantly."
> — D-2026-04-27-13

## What ships in Phase 5

### Classifier (shared)

`src/lib/nutrition/glutenClassifier.ts`:

- `classifyIngredientGluten(text)` — pure function returning
  `{ status: 'free' | 'contains' | 'risk', confidence: 'high' |
  'medium' | 'low', matched: string | null }`.
- Detects:
  - **15 explicit gluten-bearing grains** (wheat, barley, rye, malt,
    semolina, durum, spelt, kamut, triticale, bulgur, couscous,
    farina, einkorn, freekeh, seitan).
  - **8 implicit gluten dishes** (pasta, bread, pappardelle,
    spaghetti, linguine, fettuccine, macaroni, tortilla) — cleared
    by qualifiers like "gluten-free", "rice", "buckwheat", "soba",
    "corn".
  - **4 risk markers** (oats, oat, soy sauce, miso) — cleared by
    qualifiers like "certified gluten-free", "tamari".
  - **2 implicit risk** (noodles, soba) — cleared by "rice",
    "buckwheat", "gluten-free".
  - **15 known gluten-free flours/grains** (rice flour, almond
    flour, coconut flour, buckwheat, gram flour, chickpea flour,
    quinoa, millet, sorghum, amaranth, teff, tapioca, cornstarch,
    polenta, cornmeal).
  - **~70 naturally gluten-free whole foods** (meats, produce,
    dairy, eggs, legumes, oils, plain rice, common seasonings) —
    so a "chicken + quinoa + olive oil" recipe earns the chip
    without every line needing an explicit "gluten-free" qualifier.

Word-boundary regex guards against canonical false positives
("buckwheat" must not trip the "wheat" rule).

### Aggregator (shared)

`src/lib/nutrition/recipeTrust.ts` extends with `classifyRecipeGluten`:

| Input shape | Output `variant` | Output `message` |
|---|---|---|
| Empty list | `null` | `""` |
| Any `contains + high` | `null` | `""` (gluten-containing by intent — no chip) |
| Any `risk + medium` | `gluten-uncertain` | `"Contains potential gluten · review"` |
| All `free + high` | `gluten-high-conf` | `"No gluten-containing ingredients"` |
| Mix of high + low | `null` | `""` (insufficient surface to claim high confidence) |

The `null` variant is intentional silence — the recipe surface
renders normally without a misleading chip.

### Chip rendering surfaces

- **Web Recipe detail hero** (`src/app/components/RecipeDetail.tsx`):
  - Gluten chip appended to the existing TrustChip row.
  - Variant chosen by `classifyRecipeGluten(ingredients.map(name))`.
- **Mobile Recipe detail hero** (`apps/mobile/app/recipe/[id].tsx`):
  - Same render — gluten chip alongside source TrustChip.

#### Coeliac-safety treatment (ENG-748, legal-reviewer signed off 2026-05-27)

A green ✓ on a coeliac surface reads as a verified safety guarantee.
Two changes close that risk on both heroes:

1. **Glyph swap** — `gluten-high-conf` uses the `sparkles` ("estimated")
   glyph, not `check` ("verified"). It now matches `gluten-uncertain`'s
   glyph so neither variant reads as a verified mark.
   (`src/app/components/ui/trust-chip.tsx`,
   `apps/mobile/components/ui/TrustChip.tsx`.)
2. **Persistent disclaimer caption** — rendered directly beneath the
   chip (not a tooltip / tap-to-reveal / global ToS) whenever EITHER
   gluten chip surfaces, on both heroes. Muted ~11pt, same column as the
   chip, marginTop 4. testID `recipe-detail-gluten-disclaimer`. Exact
   string:

   > Estimated from ingredient names — not a guarantee. Always check
   > labels and packaging if you avoid gluten for medical reasons.

The regulated term **"Gluten-free" is never rendered as a label**
(EU/UK Reg 828/2014 reserves it for verified ≤20 ppm products; an
ingredient-name estimate cannot make that claim).

### Filter chip on Recipes

Per spec, the Library + Discover surfaces add a "Gluten-free" filter
pill that filters by classification. **Implementation deferred to a
Phase 5 follow-up** (the existing filter chip rail pattern accepts
new entries cleanly; the addition is mechanical once the filter copy
is legal-reviewed).

### Ingredient row inline flag

The mobile ingredient row already surfaces a confidence dot. The
inline gluten-icon flag (small `Wheat` 12pt warning-coloured icon
before name on `contains` or `risk` rows) is **deferred** — the row
classification logic is available via `glutenResult.perIngredient[]`,
but the inline glyph wiring is staged behind the legal-reviewer copy
sign-off so we don't ship "this contains gluten" claim copy without
review.

## Tests shipped

- `tests/unit/glutenClassifierPhase5.test.ts` — 43 tests covering:
  - Each canonical gluten-bearing token classifies as `contains + high`.
  - Word-boundary edge case ("buckwheat" doesn't match "wheat").
  - Implicit-dish names (pasta, bread, tortilla) clear via qualifiers.
  - Risk markers (oats, soy sauce, miso) clear via certifications.
  - Recipe-level aggregation rules (matrix above).
- `apps/mobile/tests/unit/glutenChipParityPhase5.test.ts` — 4 tests
  pinning that the mobile re-export is the same function (no fork).

## Cross-platform

- Same shared `glutenClassifier.ts` + `recipeTrust.ts:classifyRecipeGluten`
  on both surfaces.
- Web and mobile both render the chip via the same
  `<TrustChip variant="gluten-high-conf">` / `<TrustChip variant="gluten-uncertain">`
  primitive (web + mobile mirrors).

## Open follow-ups

1. **Legal-reviewer copy review** — RESOLVED 2026-05-27 (ENG-748). The
   shipped chip copy is "No gluten-containing ingredients" /
   "Contains potential gluten · review" — descriptive, not regulated.
   The earlier draft strings ("Gluten-free · high confidence" /
   "Gluten contamination risk · review") were rejected: "Gluten-free"
   is a regulated term (EU/UK Reg 828/2014) and cannot be claimed from
   an ingredient-name estimate. Signed off with the Sparkles-glyph swap
   + persistent disclaimer caption above (per coeliac-claim guidance,
   UK FSA + EU 1169/2011 §22).
2. **Library + Discover filter chip** — "Gluten-free" filter pill
   still deferred. The filter label must use the same non-regulated
   wording as the chip (no bare "Gluten-free" claim).
3. **Inline `Wheat` glyph on flagged ingredient rows** — staged.
4. **Multi-allergen extension** — D-2026-04-27-13 says "one
   allergen done brilliantly" today. If retention research shows
   coeliac depth is a meaningful wedge, the classifier shape
   generalises to a per-allergen lookup (but the spec is firm:
   one for now, not 14).
