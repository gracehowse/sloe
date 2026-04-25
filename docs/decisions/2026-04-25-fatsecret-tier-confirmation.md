# Decision log: FatSecret tier confirmation + caching compliance (2026-04-25)

**Date:** 2026-04-25
**Status:** **OPEN — Grace action required**
**Owner:** `integration-manager` (audit), Grace (tier confirmation), `executor` (downstream)

Supersedes the unchecked action items in [2026-04-19 FatSecret caching](./2026-04-19-fatsecret-caching.md). Closes T19 from the [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md) once Grace confirms.

---

## TL;DR

The FatSecret client requests `scope: "basic"` on the OAuth2 token exchange (`src/lib/fatsecret/client.ts:74`). On Basic tier the FatSecret Platform API ToS **prohibits** caching macro values. We currently cache them in `recipe_ingredients`, `recipes`, `nutrition_entries`, and `user_favorite_foods`. The licence page at `/licences` claims a "FatSecret Platform terms (commercial licence)" — that claim is **not supported by the API credentials in use**. Either credentials are Premier and the scope request is wrong, or the licence claim is aspirational.

**Grace must log into [platform.fatsecret.com](https://platform.fatsecret.com) and confirm the account tier. Everything else follows from that single data point.**

---

## Schema audit — where FatSecret-derived macros live

| Table | Columns storing FatSecret macros | Nature | Action |
|---|---|---|---|
| `recipe_ingredients` | `calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg` + `fatsecret_food_id` | **Direct cache** — written verbatim from FatSecret response in `RecipeUpload.tsx:1064`. No user-edit step. | Path A or B target. |
| `recipes` | `calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg` + `verified_source = 'FatSecret'` | Derived cache (aggregated from `recipe_ingredients`). | Path B mirror. |
| `nutrition_entries` | `calories, protein, carbs, fat` + `source` label | One step removed — logged from a recipe whose ingredients were FatSecret-matched. | Owned user data once logged. **Not retroactively zeroed under Path B.** |
| `user_favorite_foods` | `calories, protein, carbs, fat` + `source` label | Same — converted to user data when starred. | Same. |
| `food_sources` | `source = 'FatSecret'` allowed by check constraint | **No live writer.** API blocks FatSecret at validation layer. | Schema-present, behaviourally clean. |
| `user_custom_foods` | None | User-entered only. | Clean. |

The legal exposure is the `recipe_ingredients` layer. The other tables only become exposure if the source column is treated as a cache attribution rather than user provenance.

---

## Path A — confirm Premier, document it, fix scope mismatch

If `platform.fatsecret.com` shows the account on **Premier** (or any commercial tier that permits caching):

1. Screenshot the dashboard tier/plan page.
2. Change `scope: "basic"` → `scope: "premier"` in `src/lib/fatsecret/client.ts:74`. This both uses the correct scope and produces a token that proves Premier in any future compliance check.
3. Add to this decision doc: tier confirmed, dashboard screenshot reference, date of confirmation, the specific FatSecret ToS section (currently §3.2 of the Platform API terms) that permits caching. Sign off.
4. Verify the `/licences` page claim is accurate; update if needed.

**~30 minutes of work. No write-path code changes.**

---

## Path B — Basic tier, strip cached macros, re-fetch on demand

If the account is **Basic**:

### Migration shape

Add a migration that, on every row where `source = 'FatSecret'` and `fatsecret_food_id IS NOT NULL`, sets:

```sql
calories = 0, protein = 0, carbs = 0, fat = 0,
fiber_g = 0, sugar_g = 0, sodium_mg = 0,
is_verified = false, source = 'Unverified'
```

**Keep the `fatsecret_food_id` column.** The ID is a permitted reference pointer — only the co-stored macros are the violation. Same nullification on `recipes` rows where `verified_source = 'FatSecret'`.

### Runtime re-fetch

On recipe detail load, if any ingredient row has `fatsecret_food_id IS NOT NULL` and `is_verified = false`, fire a server-side call to `/api/nutrition/verify-recipe` before rendering. ~300–600ms FatSecret round-trip; invisible at solo-tester scale. At scale this compounds with the free-tier rate limit (~5,000 calls/day → 500 detail-views/day with a 10-ingredient recipe). Not today's problem.

### Matching coverage delta

USDA covers most generic ingredients. OpenFoodFacts covers barcoded products. The ingredients that fall through to FatSecret are primarily branded/restaurant items USDA + OFF miss. After Path B, those surface as `Unverified` until the user opens the recipe and the re-fetch fires. **Honest failure beats cached stale data.**

### Out of scope under Path B

`nutrition_entries` and `user_favorite_foods` rows are owned user data once logged or starred — they are the user's record of what they ate. Do **not** retroactively zero them.

---

## Recommendation

**Path A if Grace confirms Premier within 48 hours; otherwise Path B.** The app cannot submit to the App Store with unresolved ToS non-compliance on a dependency whose terms explicitly prohibit caching.

---

## App Store 5.2 risk framing

App Store Rule 5.2 covers intellectual property. Apple's enforcement pattern is: they don't typically catch third-party API ToS violations at review — they catch them when the third party complains. Practical risk is **post-approval removal** triggered by a FatSecret enforcement action, not review rejection.

FatSecret has historically been lenient with small developers, but their ToS exists specifically to protect their data business. If Suppr grows and FatSecret notices macro data served without a Premier licence, expected sequence: cease-and-desist to Suppr's registered contact → complaint to Apple if unresolved → Apple removal. Apple removal at that point is far more disruptive than fixing it now.

**Fix-before-submit gate.** Not a disclose-to-Apple item — Apple wants compliance, not disclosure.

---

## Pending Grace actions

1. Open [platform.fatsecret.com](https://platform.fatsecret.com).
2. Find the account tier on the dashboard plan/billing page.
3. Reply with the tier (`Basic` / `Premier` / commercial-name).
4. **If Premier**: take the screenshot, fix the scope string, sign off this doc.
5. **If Basic**: green-light Path B; executor lands the migration + runtime re-fetch.

---

## Related

- [2026-04-19 FatSecret caching](./2026-04-19-fatsecret-caching.md) — original flag, action items still unchecked
- [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md) §B6 — App Store submission gate
- `src/lib/fatsecret/client.ts:74` — scope discrepancy
- `/app/licences/page.tsx:39` — disputed licence claim
- `src/app/components/RecipeUpload.tsx:1064` — primary write site
