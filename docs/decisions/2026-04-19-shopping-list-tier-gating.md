# Decision: Shopping list tier gating — Base claim satisfied transitively

**Date:** 2026-04-19

**Decision**
The "Shopping list from plan" feature is listed as a Base-tier benefit in `src/lib/landing/content.ts` and intentionally has no dedicated gate on any shopping-list write path; the existing multi-day plan gate acts as the real paywall.

**Rationale**
Free users are blocked from building plans longer than one day by gates in `src/app/components/MealPlanner.tsx:878` (web) and `apps/mobile/app/(tabs)/planner.tsx:1044` (mobile). A one-day plan produces a trivial shopping list (a single day's ingredients), which is not a meaningful product in itself. The differentiated value — one week of meals collapsed into a single shopping trip — lives exclusively above the multi-day gate, which is already enforced. Adding a second, explicit gate on shopping-list writes would block a legitimate Free use case (generate a grocery list for today's cook) and creates a confusing UX where a user can see and interact with a plan but is then blocked on the secondary action derived from it.

**Alternatives considered**
- Add a `userTier === "base" || userTier === "pro"` check to every shopping-list write path — rejected because it double-gates something the multi-day plan gate already covers, and it blocks the 1-day Free use case that we do not want to paywall.
- Move "Shopping list from plan" to Pro-only in the landing SSOT — rejected because the feature is genuinely available to Base users for multi-day plans; demoting it would be a false claim.
- Add a per-week or per-list quota for Free users instead of a hard gate — rejected because the multi-day gate already delivers the right quota shape without any additional machinery.

**Platforms affected**
Both (web MealPlanner gate, mobile planner gate).

**Agents involved**
product-lead (decision), product-memory (capture).

**Status**
Active.

**Revisit on**
PostHog shows >15% of Free WAU generating 1-day shopping lists more than 3×/week without converting to Base. That would indicate the 1-day list has standalone retention value not captured by the multi-day gate. Event to watch: `shopping_list_generated` segmented by `user_tier`.

**Related**
- `src/lib/landing/content.ts` — SSOT for tier claims; "Shopping list from plan" lives in the Base features list.
- `src/app/components/MealPlanner.tsx:878` — web multi-day plan gate.
- `apps/mobile/app/(tabs)/planner.tsx:1044` — mobile multi-day plan gate.
- `docs/product/landing-maintenance.md` — how to change tier claims and run parity tests.
- `docs/decisions/2026-04-19-renewal-disclosure-rewrite.md` — companion decision from same sweep.
- `docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md` — companion decision from same sweep.
