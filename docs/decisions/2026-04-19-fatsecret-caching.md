# FatSecret — caching audit pending

**Status:** Open / needs engineering + policy decision.
**Raised:** 2026-04-19, by IP-counsel pre-launch clearance memo.
**Owners:** Engineering (food-DB layer), Product, Legal.

## Problem

FatSecret Platform API's terms (free and Basic tiers) restrict caching of the nutrition macros returned by the API. Storing only the `fatsecret_food_id` as a reference — with a re-fetch on display — is permitted. Storing calories / protein / carbs / fat alongside that id is caching, which the terms do not permit on the free / Basic tier.

Suppr persists `fatsecret_food_id` in `recipe_ingredients` (seen in `src/context/AppDataContext.tsx:871` and downstream). What needs to be confirmed: whether per-row macros are persisted *alongside* the id, and if so on which tier.

## What needs to happen

1. **Confirm the current FatSecret tier** — free / Basic / Premier. Premier (commercial tier) typically relaxes caching.
2. **Audit the schema** — identify every `recipe_ingredients`, `meal`, or `foods` column that stores FatSecret-derived macros.
3. **Decide**:
   - **Option A**: upgrade to the FatSecret commercial tier that permits caching. Low-friction if cost is acceptable.
   - **Option B**: rework the write path so that only `fatsecret_food_id` is persisted, and a re-fetch populates macros on display. Adds latency on read.
4. **Document the decision** in this file once settled, and keep FatSecret's attribution text current on the `/licences` page.

## Action items

- [ ] Engineering: audit schema.
- [ ] Product + Finance: decide tier.
- [ ] Engineering: implement Option A or B.
- [ ] Legal: review and sign off.

## Related

- IP-counsel clearance memo, 2026-04-19.
- `src/lib/fatsecret/client.ts`.
