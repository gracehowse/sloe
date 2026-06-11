# Launch-monetisation sequencing — first-100-free → paid GA

**Date:** 2026-06-11
**Lenses applied:** monetisation-architect + legal-reviewer (this doc is written to the bar those specialists would sign off).
**Status:** RESEARCH / RECOMMENDATION — **FOR GRACE'S CALL. Nothing in here is applied.** No code, no schema, no Linear writes.
**Branch:** `claude/skia-ring-2026-06-10`
**Scope question:** Given the founder's model — *"beta testers / first 100 users free, but not fully free"* → a free founding cohort, then a paid **Free + Pro** tier for general availability, launching into the 2026-07-01 TikTok/IG push — **what gates the first free cohort vs what gates the first PAID transaction**, and therefore which of the 6 "billing" launch-blocker issues actually block onboarding the first 100, vs block charging the 101st user, vs are post-launch.

**Bottom line up front:** the 2026-07-01 free-cohort launch is **NOT gated by billing**. None of the 6 billing issues block onboarding a free founding cohort. The free-cohort gate is three non-billing things: working auth, the two confirmed launch-readiness P0s (entitlement-escalation **ENG-1035** and the recipe-import legal bundle), and a verified comp path (`redeem_promo_code` reconciled with the lockdown trigger — **P1-8**). Billing wiring (RevenueCat/StoreKit, Stripe Tax, EUR SKU, SBP) becomes a **distinct, later gate** that blocks the *first paid transaction*, not the launch. Treating them as launch-blockers has been forcing the launch to wait on the wrong dependency.

---

## 0. What's already true in the repo (don't re-derive)

These are load-bearing and were verified in the codebase for this doc:

- **Strategy is Free + Pro only.** Base tier was removed 2026-04-27 (`docs/decisions/2026-04-27-strategic-direction.md`, mirrored in `project_strategic_direction_2026-04-27`). Pro = £7.99/mo or £59.99/yr. So ENG-123's "base tier migration path" is now *Base→Free collapse + the grandfather question*, not a live third tier.
- **Entitlement source of truth is `profiles.user_tier` in Supabase.** Server gating reads it (`src/lib/supabase/serverAnonClient.ts:81`). Both billing rails reconcile *into* it: Stripe webhook writes it on web; mobile **merges** RevenueCat entitlements with redeemed promo tiers before syncing (`apps/mobile/lib/purchases.ts:222-223` — "Merges RevenueCat entitlements with redeemed promo tiers so promos are not wiped by a later RC sync"). This is the kept carve-out "Stripe (web) vs IAP (mobile) billing rails — entitlements reconcile in `profiles.user_tier`" (`docs/decisions/2026-05-25-sweep-parity-ia-pricing-resolutions.md`).
- **A comp/redemption path already exists.** `public.redeem_promo_code(p_code)` (SECURITY DEFINER) reads a `promo_codes` row carrying `tier`, `max_uses`, `expires_at`, `active`, and writes `profiles.user_tier` server-side (`supabase/migrations/20260407220000_redeem_promo_idempotent.sql`). A `max_uses=100` code with `tier='pro'` is *already* a founding-cohort mechanism — no RevenueCat offering and no Apple offer code needed to grant it.
- **`profiles.user_tier` is locked down client-side.** The `profiles_tier_column_lockdown` trigger is the same object at the centre of three findings: ENG-1035 / audit P0-1 (escalation bypass, `BEFORE UPDATE` only), and audit P1-8 (the `redeem_promo_code` `ON CONFLICT DO UPDATE` may itself be rejected by that trigger for existing profiles).
- **Launch-readiness audit never lists billing as launch-blocking.** `docs/ux/reviews/2026-06-11-launch-readiness-audit.md` gates launch on exactly two P0s — DB entitlement-escalation and the recipe-import copyright bundle — plus a focused P1 pass (SSRF, RLS view, vendor cache, parity). **Verified + endorsed:** that omission is correct *for a free cohort*. It is an unstated assumption (free-first) that this doc makes explicit and confirms.

---

## 1. The recommended "first 100 free → paid GA" model (concrete)

> **Recommendation (confidence 8/10):** a **server-authoritative comp via the existing `redeem_promo_code` path**, granting a durable `lifetime_pro` entitlement, distributed by a single capped founding code. Do **not** route the founding cohort through RevenueCat offerings or Apple offer codes — those are the *paid-GA* rails and provisioning them is not on the free-cohort critical path.

**Mechanism**
- Add a tier value `lifetime_pro` (or reuse `pro` + a `lifetime` boolean — see "the one decision below") that resolves to full Pro everywhere `user_tier` is gated. Because all gating already reads `profiles.user_tier`, the cohort gets Pro on web *and* mobile with zero new client code and no store dependency.
- Seed one `promo_codes` row: `code='FOUNDING100'`, `tier='lifetime_pro'`, `max_uses=100`, `active=true`, `expires_at` = a hard cut (e.g. 2026-09-01) so the window can't drift open forever.
- Users redeem in-app (the `usePromoCode` hook + RPC already exist). The grant is written to `user_tier` by the SECURITY DEFINER function — never client-writable, so it survives the lockdown trigger *once P1-8 is fixed* (see gate below).

**Duration / "not fully free"**
- The founder's phrase "free, but not fully free" reads as **founding members get the full product permanently as a thank-you, but the cohort is capped and closed** — i.e. it's a *scarce comp*, not an *open free tier*. That's exactly the lifetime-comp shape, and it's the least-regret option for a solo founder (see §1a). The "not fully free" guard rails are: (a) cap at 100, (b) hard `expires_at` on the *code*, (c) the comp is a deliberate, revocable server flag — not an Apple/Stripe contract you can't unwind.
- The general public who arrive *after* the cohort closes land on **Free** (the genuine free tier) and convert to **Pro** through the normal paid rails. Free is genuinely free and is VAT-neutral (§3).

**What the 100 get:** full Pro (unlimited imports, macro-fitting, AI coach, cloud sync — the paywall's four cards), permanently, as `lifetime_pro`. No card required, no store transaction, no trial clock.

**How they're grandfathered:** they already *are* — the entitlement lives in `profiles.user_tier=lifetime_pro`, which is the canonical gate. When paid GA turns on, nothing has to migrate them: a `lifetime_pro` row is simply never downgraded by any webhook (the merge logic in `purchases.ts` must treat `lifetime_pro` as a floor, same way it already protects redeemed promo tiers from being wiped by an RC sync). This is the answer to **ENG-49** (provisioning method) and the grandfather half of **ENG-123**.

### 1a. Why this beats the alternatives (no strawmen)

| Mechanism | Verdict | Why |
|---|---|---|
| **Server-side `lifetime_pro` via `redeem_promo_code`** ✅ **recommended** | Cleanest, least-regret | Cross-platform by construction (one `user_tier` source); no store dependency on the free-cohort critical path; revocable (it's a flag, not a contract); the path *already exists*. Resolves ENG-49 + ENG-123 with the infrastructure in the repo. |
| **RevenueCat "Granted/Promotional Entitlements" (lifetime duration, via REST API)** | Strong, but second choice | RC granted entitlements genuinely support a `lifetime` duration, are grantable via API, never charge the user, never touch the App Store/Stripe, and are shared across all platforms in the project ([RevenueCat — Granted Entitlements](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-history/promotionals)). **But** Suppr's source of truth is `user_tier`, not RC — so an RC-only grant would need the mobile merge to propagate it to `user_tier` and would *not* cover web. It also makes RC a hard dependency for the *free* cohort, which the `redeem_promo_code` path avoids entirely. Keep RC granted-entitlements as the tool for **creator lifetime comps** post-incorporation (the other half of ENG-49), not the founding-100 path. |
| **Apple promo codes** | ❌ Dead | **Apple retired promo codes for in-app purchases on 2026-03-26** ([Appbot — Apple Offer Codes](https://appbot.co/blog/apple-offer-code/)). Not an option. |
| **Apple Offer Codes (free-for-N-months subscription offer)** | ❌ Wrong tool here | Offer codes require the subscription product (and thus RevenueCat offerings + StoreKit) to be fully provisioned first — i.e. they *depend on* the paid-GA gate. They also grant a *time-boxed* free subscription that then auto-converts/charges, which is the opposite of a permanent founding comp and introduces a churn-trap clock. Right tool for *acquisition discounts at GA*, wrong tool for *founding lifetime comp*. |
| **Time-boxed free (e.g. 6 months) for everyone** | ❌ Rejected | Creates a cliff where the whole cohort hits a paywall at once with no SBP/Stripe-Tax cover guaranteed by then, and bakes in a support spike. Also not what the founder asked for (a capped cohort, not a universal free window). |
| **"TestFlight-only free" period** | ⚠️ Partial / complementary | TestFlight *is* genuinely free (no real payments, so no SBP/VAT exposure at all) and is the right home for the cohort *if launch slips* or while Gate-0 P0s are still open. But TestFlight caps at 10,000 external testers and isn't a public-launch surface — it's a pre-launch holding pen, not the GA mechanism. Use it as the safety valve, not the model. |

**The one decision below (for Grace):** a dedicated `lifetime_pro` tier value vs. `pro` + a `lifetime` flag. Recommend a **dedicated `lifetime_pro` tier value** — it's self-documenting in the DB, trivially queryable for the "who are my founders" cohort, and makes the "never downgrade" rule a single explicit branch in the merge logic. Cost: one enum/string value threaded through the tier resolver on both platforms + one new test that `lifetime_pro` gates identically to `pro` and is never overwritten by a webhook.

---

## 2. Phase-gated checklist + placement of all 8 issues

Three gates. The whole argument is that **most "billing" work moves from Gate A to Gate B.**

### GATE A — Before onboarding the FIRST FREE user (the 2026-07-01 launch gate)

What must be true to safely put a real human on a comped account. **No billing rail is required here.**

1. **Working auth + the comp path verified end-to-end.** `redeem_promo_code` must actually grant `lifetime_pro` and survive the lockdown trigger.
   - **→ P1-8 (audit) lands here.** The audit flags (conf 5) that `redeem_promo_code`'s `INSERT … ON CONFLICT DO UPDATE SET user_tier` runs an UPDATE for any *existing* profile, firing the `BEFORE UPDATE` lockdown trigger, and `auth.role()` is JWT-derived (not `service_role` just because the function is SECURITY DEFINER). If correct, **every comp redemption against an existing profile fails with 42501** — which would break the founding-cohort grant itself. This must be live-verified and, if confirmed, fixed (service-role-scoped write or a GUC the trigger detects) *before* the cohort, because it gates the comp mechanism, not the paywall. **Receipt:** audit §11 P1-8.
2. **ENG-1035 / audit P0-1 — close the entitlement-escalation hole.** `BEFORE INSERT` guard rejecting non-`service_role` INSERTs that set `user_tier != 'free'` or a non-null `stripe_customer_id`.
   - **Why this is a free-cohort gate, not a paid gate:** see §4 (the ENG-1035 interaction). A free cohort that can self-upgrade turns a "skip the paywall" bug into "forge the founding-comp economy." **Receipt:** audit §10 P0-1, ENG-1035.
3. **Recipe-import legal bundle — close before pointing TikTok at the import wedge.** This is a *content/copyright* gate, not billing, but it blocks the same launch:
   - **P0-2 / ENG-857** — null the verbatim creator `description` on the web/blog import path.
   - **P1-7 / ENG-858** — the required source-card disclaimer.
   - **ENG-859 — DMCA designated agent** registration. **This one has a billing-adjacent dependency: it ties to incorporation** (it registers against the legal entity + needs a real postal address, byte-matching `app/dmca/page.tsx`). See §4 incorporation chain. **Receipt:** audit §10 P0-2, §11 P1-7; ENG-859 description ("§512(c) safe harbour is not effective until filed — and the web/blog import path is already live").
4. *(non-billing, from the audit's Gate-0)* SSRF fix (P1-2) + the public SECURITY DEFINER recipe view (P1-1) — listed for completeness; they gate "real users," not "paid users."

**Billing issues in Gate A: NONE.** A comped user never hits Stripe, never hits StoreKit, is never charged, is never in the UK/EU VAT base (no consideration → no taxable supply, §3). The free cohort is monetisation-inert.

### GATE B — Before the FIRST PAID transaction (the paid-GA gate — a *distinct* gate, can land after launch)

What must be true the moment user #101 (or any cohort member converting voluntarily) is *charged*. This is where the 6 billing issues actually live.

1. **Apple SBP enrolled and effective — BEFORE the first paid iOS sub.** Not before "launch day" — before the first *charge*. **This is the highest-cost timing trap on the board** (§4).
   - **Receipt (precise, supersedes the memory's "1–3 business days"):** the 15% rate "takes effect on the 15th day of Apple's next fiscal period. It does not apply to earlier transactions" ([Adapty — App Store Small Business Program](https://adapty.io/docs/app-store-small-business-program)); confirmed by [RevenueCat](https://www.revenuecat.com/blog/engineering/small-business-program/) (effective date is a fiscal-period boundary, no backdating). Any sub that starts at 30% is locked at 30% for that subscriber's whole first year — Apple does not re-rate it when you later enrol.
   - **→ This is not one of the 6 issues, but it's the gate they all sit behind. Flag it as a Gate-B blocker in its own right.**
2. **ENG-101 — RevenueCat + StoreKit IAP wired (iOS).** Paywall currently renders "Subscriptions unavailable." Blocks the first *iOS paid* sub. **→ Gate B (paid-GA-blocker).** Today: `Blocked`, Urgent, launch-blocker.
3. **ENG-198 — RevenueCat offerings provisioned.** Empty offerings until configured (Grace-only, RC dashboard). Blocks the first *iOS paid* sub. **→ Gate B.** Today: `Todo`, Urgent, launch-blocker.
4. **ENG-33 — jurisdiction-aware Stripe Tax (UK/EU inclusive, US automatic).** Blocks the first *web UK/EU paid* sub being legal. Also fixes the `BillingDisclosure` bug (renders "Prices include VAT" unconditionally regardless of the env flag). **→ Gate B (UK/EU-paid-blocker).** Today: `Blocked`, High, launch-blocker.
5. **ENG-667 — VAT not inclusive on UK/EU checkout + no EUR SKU.** Two things: (a) VAT-inclusive display (legal, overlaps ENG-33), (b) add a EUR price in Stripe + RevenueCat. Blocks the first *EU/UK web paid* sub being compliant. **→ Gate B (UK/EU-paid-blocker).** Today: `Backlog`, Urgent, launch-blocker + risk/legal + risk/billing.
6. **ENG-49 — Suppr Pro-for-life provisioning method.** **Split it:** the *founding-cohort* half is resolved by §1 (the `lifetime_pro` comp) and moves to Gate A as already-designed; the *featured-creator lifetime comp* half (post-incorporation creator outreach) is Gate B/C — recommend RevenueCat granted entitlements for creators since they don't need a `user_tier` cohort query and can be granted by API. Today: `Todo`, Urgent, launch-blocker.
7. **ENG-123 — base tier migration path / grandfather.** **Split it:** the *grandfather* half is resolved by §1 (`lifetime_pro` is never downgraded — Gate A design, no action needed at GA). The *Base→Free collapse* half (any user who somehow holds a `base` tier must resolve to a defined state) is a Gate-B data-hygiene task before charging, but is low-risk at N≈1 with no real Base subs sold. Today: `Todo`, Urgent, launch-blocker.

### GATE C — Post-launch hardening (during the beta, not blocking either gate)

- **Region-aware pricing** beyond the EUR SKU (`project_region_aware_pricing`) — currency/disclosure matrix across more regions. The single EUR SKU (ENG-667) is the minimum for a UK+EU launch; the full matrix is a workstream, not a gate.
- **First-price-rise gate** (500 paying subs + ≥4.3 rating) — already deferred in pricing-v1; pure post-launch.
- **The "category-leading" growth tranche** (ENG-927→979) — the audit re-classifies these as beta-window, not launch-blockers. Out of scope for monetisation but reinforces the same "re-classify launch-blocker" theme.

---

## 3. Legal/tax timing — exactly when each obligation bites (with receipts)

- **A genuinely zero-price founding cohort triggers no UK/EU VAT collection obligation.** VAT attaches to a *supply for consideration*; with no payment there is no taxable supply for a SaaS subscription. The "deemed supply" free-of-charge rules in the EU VAT Directive are about *input-VAT recovery* (a business that reclaimed VAT on costs can owe output VAT on a free give-away) — Suppr reclaims no input VAT on a Cayman footing, so they don't bite here. **Receipt:** EU principle that liability requires consideration, and deemed-supply turns on prior input-VAT deduction ([Grant Thornton — VAT on free-of-charge supplies](https://www.grantthornton.nl/en/insights-en/topics/tax/vat/ecj-explains-how-vat-applies-on-free-of-charge-supplies/)). **Confidence 7/10** — the *direction* (free = no collection obligation) is solid; a one-line confirmation from the VAT adviser already in the workstream removes the residual.
- **UK/EU VAT obligation bites at the FIRST PAID UK/EU transaction — and prices must be VAT-inclusive *and* the registration must be live by then.** As an NETP, Suppr registers from the first £1 (UK) / €1 (EU non-Union OSS) — there is no threshold. **Receipt:** `docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md` (HMRC NETP rules; non-Union OSS from the first euro; UK Price Marking Order requires VAT-inclusive display). **Sequencing consequence:** ENG-33 + ENG-667 are *Gate B*, not Gate A — but they must be **fully done before the first paid UK/EU sub, not "soon after."** A non-inclusive or unregistered first sale is both a consumer-law and a tax exposure.
- **A free cohort creates no consumer-law price-display obligation** (the Price Marking Order governs *prices shown to buyers* — there's no price). The normal ToS/privacy obligations still apply, but those exist already.
- **Incorporation timing relative to (a) first paid sub and (b) DMCA safe harbour:**
  - **(a) Stripe billing is hard-blocked on incorporation.** "Stripe does not support Cayman Islands as a merchant jurisdiction… an incorporation in a supported country is a hard prerequisite for billing" (`docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`). So the *web* paid rail (ENG-33/667 + Stripe onboarding) cannot exist until the entity exists. **Incorporation is therefore a Gate-B prerequisite, not a Gate-A one** — it does not block the free cohort.
  - **(b) DMCA safe harbour (ENG-859) is incorporation-dependent too** — it registers against the legal entity + a real postal address. So **incorporation gates *both* the paid web rail *and* the DMCA shield.** This is the one place a Gate-A item (the import legal bundle) reaches into the incorporation chain: ENG-859 can't fully close until the entity exists. **Sequencing consequence:** if incorporation slips past 2026-07-01, the launch can still proceed *on the social-import path* (documented compliant) with the web/blog import path's verbatim-prose nulled (ENG-857) — the DMCA shield is most needed for the third-party-import surface, so leaning the launch on the compliant social path (the audit's headline recommendation) also de-risks the ENG-859 timing.

---

## 4. Risk callouts

1. **The SBP 30%-lock trap (highest-cost timing risk).** Enrol *and* reach the effective date (15th of Apple's next fiscal period — could be up to ~6 weeks out depending on where in the fiscal month you enrol) **before the first paid iOS sub.** No backdating, no re-rating: every sub that starts at 30% stays at 30% for that subscriber's entire first year. At Suppr's net margins this is ~14% of mobile revenue per affected sub (`docs/finance/income-projection.md` sensitivity). **Mitigation:** enrol SBP the day the entity exists (it's free and Grace-only), and *do not flip iOS App Store availability to "for sale" until the SBP effective date has passed.* The free cohort can be live the whole time — they're not paying, so the clock doesn't matter for them. **Receipts:** [Adapty](https://adapty.io/docs/app-store-small-business-program), [RevenueCat](https://www.revenuecat.com/blog/engineering/small-business-program/), `project_apple_sbp_status`.
2. **VAT-inclusive-before-first-paid-sub.** ENG-33/667 must be *fully* done (inclusive display + registration live + EUR SKU) before the first UK/EU charge, not after. The current `BillingDisclosure` renders "Prices include VAT" unconditionally regardless of `STRIPE_TAX_ENABLED` (ENG-33 finding) — shipping that while Stripe is *not* computing VAT is itself the misleading-price problem. Free cohort = no exposure; paid GA = full exposure on day one of charging.
3. **Incorporation dependency chain (billing + DMCA both wait on it).** Stripe (web paid rail) and ENG-859 (DMCA shield) both require the legal entity. Incorporation is itself gated on the Cayman-immigration + US-CPA checks (`docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`) that are Grace+advisor, not engineering. **This is the single most likely thing to slip the *paid* gate — and it's fine, because it does not slip the *free* gate.** Plan the free launch to not depend on it.
4. **ENG-1035 interaction — a free cohort raises the self-upgrade exploit's value.** Today the DELETE-then-INSERT escalation lets any authed user grant themselves `user_tier='pro'` for free (audit P0-1). With a *founding-comp economy* layered on top, the same hole means **anyone can forge `lifetime_pro`** — not just dodge £7.99/mo, but mint the scarce founder benefit the cohort is built to make special, and re-open the `stripe_customer_id` hijack vector. The free-first model *increases* the blast radius of ENG-1035, which is exactly why ENG-1035 sits in **Gate A** (free-cohort gate) and not Gate B. Fixing it is a precondition for the comp mechanism meaning anything.

---

## 5. Explicit re-classification recommendation — FOR GRACE'S CALL (not applied)

Recommend a distinct label so the two gates are legible in Linear. Today all 6 + ENG-859 carry `launch-blocker`, which conflates "blocks the free launch" with "blocks charging." Proposal: **keep `launch-blocker` to mean "blocks onboarding the first free user," and add a new `paid-ga-blocker` label** for "blocks the first paid transaction." (Alternatively, keep one label but drop priority on the paid-GA set from Urgent → High so the free-gate set stands out.)

| Issue | Today | Recommended | Reasoning |
|---|---|---|---|
| **ENG-1035** (tier-lockdown bypass) | launch-blocker, Triage/Urgent | **KEEP `launch-blocker`** | Blocks the *free* cohort: a comped cohort is meaningless if anyone can self-grant `lifetime_pro`. Gate A. The single highest-severity item. |
| **ENG-859** (DMCA agent) | launch-blocker, Backlog/Urgent | **KEEP `launch-blocker`** (note incorporation dependency) | Pairs with the import legal P0s; gates the import wedge the viral push lands on. Gate A — but its *close* is incorporation-dependent, so lean launch on the social path if incorporation slips. |
| **ENG-49** (Pro-for-life provisioning) | launch-blocker, Todo/Urgent | **SPLIT.** Founding-cohort half → **resolved by this doc** (Gate A, `lifetime_pro` comp — close as designed). Creator-comp half → **`paid-ga-blocker`** | The mechanism the founding cohort needs is the `redeem_promo_code` path, already built. Creator lifetime comps (RC granted entitlements) are post-incorporation outreach, not a launch gate. |
| **ENG-123** (base tier migration / grandfather) | launch-blocker, Todo/Urgent | **SPLIT.** Grandfather half → **resolved by this doc** (Gate A — `lifetime_pro` never downgraded). Base→Free collapse half → **`paid-ga-blocker`** (low-risk at N≈1) | No live Base subs exist; the grandfather rule is a one-branch "never downgrade `lifetime_pro`." |
| **ENG-101** (RevenueCat + StoreKit IAP) | launch-blocker, Blocked/Urgent | **→ `paid-ga-blocker`** | Blocks the first *iOS paid* sub only. A comped/free user never hits it. |
| **ENG-198** (RC offerings provisioned) | launch-blocker, Todo/Urgent | **→ `paid-ga-blocker`** | Same — empty offerings only matter when someone tries to *buy*. |
| **ENG-33** (jurisdiction-aware Stripe Tax) | launch-blocker, Blocked/High | **→ `paid-ga-blocker`** (legal-critical within Gate B) | Blocks the first *web UK/EU paid* sub being lawful. No paid sub → no VAT surface. Must be 100% before first UK/EU charge. |
| **ENG-667** (VAT inclusive + EUR SKU) | launch-blocker, Backlog/Urgent | **→ `paid-ga-blocker`** (legal-critical within Gate B) | Same gate as ENG-33 plus the EUR SKU. Minimum EUR provisioning for a UK+EU paid launch; full region matrix is Gate C. |

**Net effect of the re-classification:** the *free-cohort launch* gate shrinks to **ENG-1035 + the import legal bundle (ENG-857/858/859) + verifying the comp path (P1-8)** — none of which are "billing" in the Stripe/StoreKit sense. All six nominal "billing" issues collapse into a *paid-GA* gate that can be worked in parallel with, and land after, the free launch.

---

## 6. Bottom line

**Given the first-100-free → paid-GA model, the 2026-07-01 free-cohort launch is NOT gated by billing.** A comped founding cohort never touches Stripe or StoreKit, is never charged, and — because a zero-price supply carries no consideration — sits entirely outside the UK/EU VAT base, so none of ENG-101/198/33/667/49/123 block it; they collapse into a separate paid-GA gate that can land after launch. The minimum that must be true to onboard the first 100 safely is narrow and non-billing: **(1)** working auth; **(2)** the entitlement-escalation hole closed (**ENG-1035**) so a comped `lifetime_pro` actually means something and can't be forged; **(3)** the comp path itself verified — `redeem_promo_code` granting `lifetime_pro` without being rejected by the lockdown trigger (**P1-8**); and **(4)** the recipe-import legal bundle closed (**ENG-857/858/859**) before the TikTok push points traffic at the import wedge, with ENG-859 leaning on the compliant social-import path if incorporation slips. Billing, SBP, and VAT-inclusive pricing are real and non-negotiable — but they gate the **101st (paying) user**, not the **1st (free) one**. Sequence the launch accordingly: ship the free cohort behind Gate A, enrol SBP and finish the Stripe/IAP/VAT rails behind Gate B *before the first charge*, and do not let the incorporation chain — which legitimately blocks paid — hold the free cohort hostage.

---

### Receipts index
- Apple promo codes for IAP retired 2026-03-26; Offer Codes are the successor — [Appbot](https://appbot.co/blog/apple-offer-code/).
- Add IAP to an already-shipped free app later (new binary + IAP submitted together for review) — [Apple Developer Forums](https://developer.apple.com/forums/thread/718682), [App Store Connect Help](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/).
- SBP 15% effective on the 15th of Apple's next fiscal period, no backdating, no re-rating — [Adapty](https://adapty.io/docs/app-store-small-business-program), [RevenueCat](https://www.revenuecat.com/blog/engineering/small-business-program/).
- RevenueCat granted/promotional entitlements: lifetime duration, API-grantable, never charges, store-independent, cross-platform — [RevenueCat — Granted Entitlements](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-history/promotionals).
- VAT requires consideration; free-of-charge deemed-supply turns on input-VAT deduction — [Grant Thornton](https://www.grantthornton.nl/en/insights-en/topics/tax/vat/ecj-explains-how-vat-applies-on-free-of-charge-supplies/).
- Internal: `docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md`, `docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`, `docs/decisions/2026-04-27-strategic-direction.md`, `docs/decisions/2026-05-25-sweep-parity-ia-pricing-resolutions.md`, `docs/ux/reviews/2026-06-11-launch-readiness-audit.md`, `supabase/migrations/20260407220000_redeem_promo_idempotent.sql`, `apps/mobile/lib/purchases.ts`, `project_apple_sbp_status`, `project_region_aware_pricing`, `project_strategic_direction_2026-04-27`.
