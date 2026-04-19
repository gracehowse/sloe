# Open Food Facts (ODbL) — architectural decision pending

**Status:** Open / awaiting engineering + legal sign-off.
**Raised:** 2026-04-19, by IP-counsel pre-launch clearance memo.
**Owners:** Engineering (data layer), Product (food-DB architecture), Legal.

## Problem

Open Food Facts ([OFF](https://world.openfoodfacts.org)) publishes its product / nutrition data under the [Open Database License 1.0 (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). ODbL carries three obligations that apply to anyone who uses the data publicly:

- **Attribution (§ 4.3)** — any public use must credit Open Food Facts and link to the licence.
- **Share-alike (§ 4.4)** — any *Derivative Database* that is made publicly available must itself be licensed under ODbL.
- **Licence notice (§ 4.6)** — a notice identifying the ODbL must accompany any public use.

Suppr currently:

- Queries OFF live for barcode and product lookups (`src/lib/openFoodFacts/fetchProductByBarcode.ts`, `src/lib/openFoodFacts/searchProducts.ts`).
- Persists OFF-derived rows into `foods` / `user_foods` / `recipe_ingredients` in Supabase (see migrations `20260414200001_user_foods_verification.sql`, `20260408170000_food_db_unification.sql`).
- Commingles OFF rows with Edamam, FatSecret, and USDA FDC rows in a single `foods` table — which is a problem because Edamam and FatSecret terms *prohibit* redistribution, creating a direct tension with ODbL's share-alike clause.

The risk is that the accumulated OFF-derived rows reach a "substantial part" of OFF (§ 4.4 is intentionally vague on what counts; a systematic cache of every scanned barcode is likely to qualify within months), which would oblige Suppr to publish that derived subset under ODbL. Because the subset is commingled with proprietary Edamam / FatSecret data, we cannot publish it as-is.

## Options

### A. Cache-only, no persistence (preferred)
Treat OFF as a pass-through. Cache responses at the edge (Upstash Redis) with a short TTL (24h / 7d). Do *not* write OFF-derived rows into `foods` or `user_foods`. When a user logs a product, snapshot the macros into the `meal` / `journal` row (which is private to that user) and store the OFF barcode + product id as a reference for re-fetch.

**Pros:** removes the "substantial part" trigger — nothing public accumulates. Attribution at point-of-use is enough. Survives an ODbL audit with no share-alike obligation.
**Cons:** loses offline-first lookups for barcodes already seen by other users. Engineering work to rework the `foods` table ingestion.

### B. Segregate OFF data into its own table, publish under ODbL
Keep persistence but move OFF rows into `off_foods` (a separate, OFF-only table). Expose a downloadable ODbL-licensed dump (e.g. `/data/off-subset.csv`) updated nightly, with an `/licences/odbl` page carrying the required notice.

**Pros:** keeps the offline-first UX. Cleanly compliant with attribution + share-alike + notice.
**Cons:** more engineering. Requires a public data endpoint with enough bandwidth and refresh cadence. Adds a governance surface (which OFF rows to include, how to strip PII if any).

### C. Drop OFF entirely
Use only Edamam + FatSecret + USDA for food matching. Accept the UK/EU coverage gap.

**Pros:** no ODbL risk at all.
**Cons:** materially worse product for UK/EU users (OFF has the strongest coverage there) and loses barcode coverage for packaged foods.

## Recommendation

**Option A** is the right first move. The product's primary food-DB pillar is USDA + Edamam + FatSecret — OFF adds barcode coverage and UK/EU long-tail, which a short-TTL cache handles well. Option B only makes sense once barcode-scanning volume is material enough that offline-first is a user requirement, at which point we can invest in publishing the ODbL subset.

Separately, regardless of which option is chosen, render the ODbL attribution notice on every surface where an OFF match is shown (food-search row, barcode result detail, nutrition panel), and on `/help`, `/privacy`, and the mobile nutrition-sources screen. That work is already done (2026-04-19).

## Action items (pre-launch)

- [ ] Engineering: scope Option A. Identify every write path that persists OFF rows (`foods`, `user_foods`, `recipe_ingredients`). Move to cache-only.
- [ ] Product: confirm that cache-only lookup meets the UX bar on barcode scan.
- [ ] Legal: review the final architecture once chosen and sign off the ODbL posture in writing.
- [x] Attribution rendered at point-of-use (nutrition-sources screen, `/help`, `/privacy`). Completed 2026-04-19.

## Related

- IP-counsel clearance memo, 2026-04-19.
- `src/lib/openFoodFacts/` — the existing client.
- `supabase/migrations/20260408170000_food_db_unification.sql` — the commingled table that currently creates the problem.
