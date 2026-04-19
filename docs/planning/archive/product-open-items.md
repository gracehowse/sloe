# Open items

Ongoing list of user-owned actions, queued workstreams, and known follow-ups. Anything an agent can action lives in the session — items here require Grace, an accountant, an operator, or a product decision not yet made.

Last updated: 2026-04-19 (end of landing-parity sweep, rounds 1–6).

---

## Pre-ship checklist (before next deploy)

Rounds 1–6 of the landing-parity sweep are ship-approved by release-gate conditional on these steps. Working tree has ~90 uncommitted files across this sweep + parallel session work.

- [ ] **Commit working tree in 8 chunks** (order per release-gate) — do not squash into one commit.
  1. `chore(docs): landing maintenance SSOT + hub refresh`
  2. `refactor(landing): extract SSOT content + nutrition sources`
  3. `feat(legal): renewal disclosure, refund anchor, downgrade FAQ, TDEE copy`
  4. `feat(db): free save cap + publish-tier + stripe_customer_id migrations`
  5. `feat(billing): stripe_customer_id webhook write + customer portal route + BillingUnavailableFallback`
  6. `feat(billing): stripe tax flag + VAT-inclusive disclosure (gated) + mobile parity tests + VAT posture decision doc`
  7. `feat(api): voice-log pro-gate (100/day)`
  8. `feat(mobile): nutrition-sources SSOT, upgrade banner tier branching, paywall refund line, openUpgradePromo signature`

- [ ] **Apply 3 Supabase migrations to prod** (order-agnostic; none depend on each other):
  - `supabase/migrations/20260419110000_profiles_stripe_customer_id.sql`
  - `supabase/migrations/20260426100000_saves_free_tier_cap.sql`
  - `supabase/migrations/20260426100100_recipes_publish_tier_gate.sql`

- [ ] **Stripe dashboard — activate Stripe Tax** on the account.

- [ ] **Stripe dashboard — set `tax_behavior: inclusive`** on all 4 Price objects:
  - `STRIPE_PRICE_BASE_MONTHLY`
  - `STRIPE_PRICE_BASE_ANNUAL`
  - `STRIPE_PRICE_PRO_MONTHLY`
  - `STRIPE_PRICE_PRO_ANNUAL`
  - Note: existing subscribers are not retroactively re-charged; change takes effect at next renewal.

- [ ] **Deploy rounds 1–6** (with `STRIPE_TAX_ENABLED=false` in prod env — safe default).

---

## At flip time (flip `STRIPE_TAX_ENABLED=true`)

Only after the Stripe dashboard steps above are confirmed live.

- [ ] Set `STRIPE_TAX_ENABLED=true` in production env (Vercel / whatever host).
- [ ] Manual smoke test: run one live UK checkout end-to-end. Confirm:
  - Displayed price matches charged price (tax-inclusive).
  - `paywall_viewed` event fires with expected `{ from, tier, surface, platform }` payload.
  - Webhook writes `stripe_customer_id` to `profiles`.
- [ ] Monitor Stripe `checkout.session.completed` for tax line presence within 24h. Rollback path = set flag back to `false` (copy + API both revert cleanly; verified by tests).
- [ ] TestFlight smoke: confirm mobile paywall copy is unchanged (mobile is flag-independent — Apple IAP handles VAT natively on UK/EU storefronts).
- [ ] Update `docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md` with flip date + NETP/OSS registration numbers once known.

---

## Accountant workstream (parallel, before paid traffic in UK/EU)

Not a deploy blocker for rounds 1–6, but required before first sale to a consumer in these jurisdictions. Stripe Tax calculates VAT either way; registration is about remitting collected VAT to the tax authority.

- [ ] **UK VAT registration** — Non-Established Taxable Person (NETP) with HMRC. £1 threshold applies to non-established digital-service suppliers.
- [ ] **EU non-Union OSS registration** — digital services to EU consumers. €1 threshold.
- [ ] **US state sales tax** — revisit when approaching economic-nexus thresholds (~$100k or 200 txns per state). Not urgent.
- [ ] Add UK + EU registrations to Stripe Tax dashboard once live so Stripe reports the VAT component to the correct authorities.

---

## Within 7 days of ship (analytics)

- [ ] **PostHog dashboards** — update F2 (`paywall_viewed`) funnel to include the 5 new `from` enum values:
  - `recipes_library`
  - `shopping_list`
  - `profile`
  - `recipe_create`
  - `recipe_import`
  - Any dashboard filtering on the old enum list will silently drop events until updated.

---

## Post-launch A/B tests (growth-strategist queue)

- [ ] **Web default billing period** — monthly vs annual. Product-lead's 2026-04-19 decision kept them divergent (web=monthly cold-comparison surface, mobile=annual trial-led). Test whether web annual-default lifts paid conversion without tanking trial-start. See `docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md`.

---

## Future workstreams (not ship-blocking for rounds 1–6)

- [ ] **Region-aware pricing** — hardcoded GBP pricing is a bug vs intent. Multi-specialist project: product-lead (rollout + regions), monetisation-architect (Stripe Price matrix), legal-reviewer (per-region disclosure), integration-manager (Stripe multi-currency). Memory: `project_region_aware_pricing.md`.
- [ ] **`/login?redirect=` not wired** — login UI drops the `?redirect=` hint on auth completion (pre-existing). Affects `/account/billing` + `app/pricing/CheckoutButton.tsx` post-auth flow.
- [ ] **Full legal review of `app/terms/page.tsx`** — refund section landed inside a doc that was flagged "needs-legal-full-review before launch" by an earlier session. Refund anchor is legal-approved in isolation; the broader terms content still needs counsel.
- [ ] **`/account/billing` UI polish** — current page is a redirect-only server component. A minimal billing overview (current plan, next charge, upgrade/cancel CTAs) could reduce the number of users bouncing straight into Stripe's portal.
- [ ] **Mobile Base-tier IAP offering** — mobile paywall is Pro-only. A user who wants Base (e.g. for multi-day meal plans) has to use web. Intentional today per RevenueCat simplification, but worth revisiting.

---

## Pre-existing known issues (not from this sweep)

- [ ] **Mobile test flakiness** — `weightChartRangeFilter.test.ts`, `mealPlanAlgo.test.ts`, `progressSkeletonFirstPaint.test.tsx`, `todayActivityBonusCardMaintenanceTile.test.tsx` (rolling7 enum), `weeklyRecapPushRoute.test.ts` (weekKey field). Owner: whoever's driving those parallel sessions; pre-existing `tsc --noEmit` error in the rolling7 case.
- [ ] **Duplicate local clone** — per memory, delete `/Users/graceturner/suppr/` after mirroring its `.env.local` to this repo.
- [ ] **Rebrand external-system audit** — GitHub, Vercel, PostHog/Sentry, Stripe, email "from" addresses still need platemate→suppr sweep per `project_rebrand_checklist.md`.
- [ ] **Supabase migration/RLS audit** (next session priority per memory) — thorough review separate from the three migrations shipping in this sweep.

---

## Completed today (for cross-reference)

Full record in `docs/decisions/2026-04-19-*.md` — nine decision files logged:

- Shopping-list tier gating (transitive via plan gate)
- Renewal disclosure rewrite (ARL/CRD compliant, flag-gated)
- Voice logging Pro-only server-enforced (100/day)
- Consumer VAT posture — UK and EU (Cayman ≠ exempt)
- Pricing default billing period divergence (intentional)
- Plus: full-sweep-ship-verdict, pricing-v1, billing-architecture-pattern-a, revenuecat-offerings-empty (pre-existing)

---

**Convention:** when an item is done, tick it in place. When all items in a section are done, consider whether the section itself still belongs (e.g. "Pre-ship checklist" will archive after the first successful deploy of this sweep). Add new items at the top of the relevant section with a date tag.
