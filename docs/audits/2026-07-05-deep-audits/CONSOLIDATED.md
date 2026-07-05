# CONSOLIDATED — 2026-07-05 deep audits (4 stages)

Sources: `audit1-live-db-security/findings.json` (20 findings), `audit2-production-readiness/findings.json` (32), `audit3-nutrition-trust/findings.json` (55 incl. reviewer re-files), `audit4-money-path/findings.json` (24). Deduped to **67 actionable items, 18 release blockers**. For Grace's approval — nothing filed to Linear, nothing implemented.

## 1. Stage verdicts

1. **Live-DB security — FAIL.** findings.md verdict line: "**NO** — the live RLS posture is not safe for adversarial traffic this week" — two client-writable poisoning holes into shared nutrition corpora, plus a merged-but-never-applied migration breaking a shipped feature in prod.
2. **Production readiness — FAIL.** findings.md verdict line: "10k-users-tomorrow verdict: **FALLS OVER**" — both core vendors on free tiers that hard-stop, both telemetry rails (mobile Sentry, web PostHog) dark, backups never rehearsed, the one wired security alarm silently failing daily.
3. **Nutrition trust — FAIL** *(derived — no findings.md verdict file in the stage folder)*: four release-blocking findings in the never-defer trust-label cluster, headlined by unverified estimator totals persisted into `recipes.calories` and rendered everywhere with verified-grade authority.
4. **Money path — FAIL, on configuration not code** *(derived — no findings.md)*: MP-11 verifies the webhook/entitlement/disclosure engineering as genuinely solid, but Stripe env + Stripe Tax are dark in prod, Apple SBP is unenrolled, webhook failure alerting is unwired, and every purchase-surface screenshot in evidence is a 404/fallback/wrong-account — four blockers.

## 2. Cross-stage dedupe (same root cause, two stages → one item)

- **Web Stripe billing go-live bundle** — IM-02 (stage 2) + MP-01 + LEGAL-001 + the STRIPE_TAX_ENABLED slice of PRA-007 (stage 2) → one item (#5 below). Zero Stripe vars in Vercel prod (checkout 503s today) AND Stripe Tax must be inclusive-mode at flip. One decision, one config sitting.
- **Billing webhook failure alerting** — MP-03 + LEGAL-004 (stage 4) + IM-08's alerting half + PRA-005's Stripe-alarm slice (stage 2) → one item (#13).
- **Entitlement reconciliation + false "self-heals" doc claim** — MP-04 + LEGAL-005 (stage 4) + IM-08's reconciliation half (stage 2) → one item.
- Within-stage reporter pairs merged throughout (SEC↔DI, PRA↔IM, mechanical↔reviewer re-files in audit3, MP↔LEGAL in audit4) — strongest framing kept.
- **Related but NOT merged** (different root causes): signup account-farming (SEC-01/DI-04) vs AI budget cap sizing (PRA-010/IM-10) — the budget breaker is the backstop for the farming vector; noted as a pairing. Supabase Pro upgrade (PRA-004) unblocks PITR (PRA-003) — dependency, not a dupe.
- **Do not re-flag:** MP-11's verified-solid money-path foundations (signature verification, idempotency, tier lockdown, honest cancel/refund copy) and ntr-3's 696/696 green nutrition baseline are informational.

## 3. Top 15 (ranked by severity, then blocksRelease, then userImpact)

| # | Stage | Sev | Title | Effort | Recommendation |
|---|---|---|---|---|---|
| 1 | live-DB security | 5 · blocker | `user_foods` can be INSERTed born-"verified" — poisons the shared verified-food corpus every user reads (DI-01) | S | BEFORE INSERT trigger forcing `pending` + nulling verified/vote columns (mirror ENG-1035's profiles fix); migration via `db push` + hardening test |
| 2 | prod readiness | 5 · blocker | Mobile crash reporting dead — 0 Sentry events in 90 days on the primary surface (PRA-001/IM-03) | S | Bake `sentryDsn` into app.json extra, wire source-map upload, new TestFlight build, force a test crash, named-recipient alert |
| 3 | prod readiness | 5 · blocker | Supabase Free + Vercel Hobby into a viral push — hard-stop outage no alarm would catch (PRA-004/IM-04) | S | Upgrade both to Pro before any launch traffic; enable vendor usage/error alerts the same afternoon |
| 4 | prod readiness | 5 · blocker | 24h RPO, restore never rehearsed, recipe-images unmirrored; ENG-510 falsely Done (PRA-003/IM-07) | M | Enable PITR after the Pro upgrade, run one timed restore rehearsal, nightly storage mirror, reopen/successor ticket |
| 5 | money path (+stage 2) | 5 · blocker | Web Stripe billing entirely dark in prod + Stripe Tax off — dead checkout today; first UK/EU sale VAT-exclusive the day it opens (MP-01/LEGAL-001/IM-02) | S | Grace decides launch-vs-defer: full config bundle (4 Stripe vars, live webhook, Tax inclusive, `STRIPE_TAX_ENABLED` + verify-production-env check, UK smoke test) or an honest iOS-only upgrade CTA |
| 6 | nutrition trust | 5 · blocker | RecipeUpload persists raw unfiltered estimator totals, racing a silent background verify (rt-F1/fill-F1) | M | Apply MIN_ACCEPT_CONFIDENCE floor to the client fallback, persist a recipe-level quality signal, gate Save/Publish on verify or explicit confirm |
| 7 | prod readiness | 5 · blocker | Web PostHog dead — `NEXT_PUBLIC_POSTHOG_KEY` absent from Vercel prod; flags read OFF, replay dark (IM-01) | S | Set the var (+ verify /ingest proxy host), redeploy, confirm one event; ship the app_heartbeat absence alarm |
| 8 | prod readiness | 5 · blocker | The one wired security alarm (advisor cron) has failed silently every day since 07-02 — SUPABASE_PAT unset (PRA-002/IM-05) | S | `vercel env add SUPABASE_PAT production` + redeploy; add `if: failure()` notification to scheduled-crons.yml |
| 9 | money path | 5 · blocker | Apple SBP not enrolled — first paid subscriber locks 30%/12mo (MP-02/LEGAL-002) | S | Grace enrols in App Store Connect now; paid SKU stays off-sale until the effective date is confirmed |
| 10 | live-DB security | 4 · blocker | `recipe_collections` migration merged but never applied — shipped ENG-1126 Library feature errors in prod for all users (SEC-04/DI-03) | S | `supabase db push --linked` today + CI/release-gate check for merged-but-unapplied migrations |
| 11 | nutrition trust | 4 · blocker | Recipe kcal renders with zero trust qualifier on cards/discover/planner/cook AND the north-star suggestion (rt-F3/fill-F3 + cx-1 + tl-F6) | M | Qualifier on decision-driving surfaces first (planner totals, cook mode, calorie sort, north-star card; `~` prefix on cards); thread isVerified into NorthStarRecipe; wire the dead Verified filter |
| 12 | nutrition trust | 4 · blocker | Mobile Today rows fake a verified-green dot on every non-thumbnail meal (tl-F2/label-F2) | S | Wire the already-imported SourceDot to match web; delete dead label plumbing; fresh sim before/after |
| 13 | money path (+stage 2) | 4 · blocker | Billing webhook failures reach no human on either rail — a broken first transaction would be silent (MP-03/LEGAL-004/IM-08) | S | Wire Stripe + RC delivery-failure notifications + Sentry issue alert (all dashboard actions), then one sandbox purchase end-to-end per rail |
| 14 | prod readiness | 4 · blocker | Founder safety net unpopulated — no recovery vault, no trusted contact; every vendor account a single point of failure (PRA-006) | S | Grace (~2h, non-delegable): 1Password vault for all 11 systems, printed Emergency Kit, brief trusted contact with 48h emergency access |
| 15 | prod readiness | 4 · blocker | Minimum alarm set unwired + Sentry prod signal is 100% dev noise (PRA-005/PRA-008/IM-09) | M | One afternoon: authored Sentry rules + spend notifications, PostHog heartbeat, environment tagging from VERCEL_ENV, resolve stale dev issues |

Just below the cut (sev 4 blockers, userImpact 3): rt-F2/fill-F2 "Verified value" banner copy lie (S), PRA-007 privacy page asserts unsigned DPAs + missing sub-processors (M), MP-05/LEGAL-003 purchase surfaces visually unverified — re-capture pass (S).

## 4. Full deduped list, by stage

### Stage 1 — live-DB security (15 items, 2 blockers)

1. **DI-01** · sev 5 · **blocker** · S · cross-platform — Born-"verified" `user_foods` INSERT poisons `verified_food_canonical` for every user. Fix: BEFORE INSERT guard trigger (mirror `profiles_tier_column_insert_lockdown`), migration + test.
2. **SEC-04/DI-03** · sev 4 · **blocker** · S · cross-platform — `20260703140000_eng1126_recipe_collections.sql` merged (PR #754) but never pushed to the live DB; shipped web+mobile collections code hits "relation does not exist". Fix: `db push --linked` + merged-but-unapplied CI check.
3. **SEC-01/DI-04** · sev 4 · M · cross-platform — Confirmations-off client-direct signup + per-userId AI quotas = account-farming resets every free quota; no aggregate spend ceiling. Fix: tighten GoTrue signup limits (Grace, dashboard), consider captcha/proxy, add IP-scoped ceiling on the costliest AI endpoints + spend anomaly alert. Pairs with PRA-010/IM-10.
4. **SEC-02** · sev 3 · S — `recipe_ingredients`/`recipe_steps` SELECT `USING (true)` leaks unpublished draft content to anon. Fix: EXISTS policy mirroring the parent recipes policy.
5. **SEC-03/DI-02** · sev 3 · S — `barcode_mappings` directly client-writable (unmetered, unmoderated, `is_verified`/`source` unguarded) → shared barcode poisoning. Fix: revoke client writes, force through the service-role `/api/barcode-mapping` route (or trigger forcing `is_verified=false`/`source='Community'`).
6. **SEC-06** · sev 2 · S — Leaked-password protection OFF in GoTrue. Fix: dashboard toggle + minimum password policy.
7. **SEC-08** · sev 2 · S — Broad anon/authenticated grants remain on deny-all billing tables (`revenuecat_events`, `stripe_webhook_events`, +2). Fix: REVOKE for defense-in-depth.
8. **SEC-09** · sev 2 · M — SECURITY DEFINER RPCs callable directly, bypassing route rate limits; `household_join_by_invite_code` has no DB-layer throttle. Fix: internal attempt-throttle mirroring `promo_redeem_throttle`.
9. **SEC-10** · sev 2 · S — `user_food_votes` fully readable by any authenticated user (voter_id exposure). Fix: narrow SELECT to own rows; serve tallies from aggregates.
10. **SEC-11/DI-07** · sev 2 · M — Hard-coded prod Supabase fallback means misconfigured envs silently write to LIVE prod. Fix: fail closed in non-local envs unless an explicit dev flag is set.
11. **SEC-05/DI-05** · sev 2 · S · mobile — `EXPO_PUBLIC_E2E_PASSWORD` seam would bake a plaintext credential into a shipped bundle if ever set at build. Fix: gate on `__DEV__`/non-public vars + EAS preflight assertion.
12. **SEC-07** · sev 2 · S · web — `/api/stripe/subscription-status` makes an unthrottled outbound Stripe call per request. Fix: modest per-user rate limit + short cache.
13. **DI-06** · sev 2 · S · web — anon has no SELECT grant on `public.recipes`; logged-out PostgREST reads of shared recipe links may fail. Fix: trace the public share path; grant or document as intentional.
14. **SEC-12** · sev 1 · S · web — `/api/household` invite rotation has no rate limit (self-DoS only). Fix: parity limit with `/join`.
15. **DI-08** · sev 1 · S — Undeployed edge-function stub with CORS `*`. Fix: delete `supabase/functions/server/`.

### Stage 2 — production readiness (17 items, 8 blockers)

1. **PRA-001/IM-03** · sev 5 · **blocker** · S · mobile — Mobile Sentry dead: DSN never reaches EAS builds; source maps off. Fix: `sentryDsn` in app.json extra, `SENTRY_AUTH_TOKEN` secret, remove `SENTRY_DISABLE_AUTO_UPLOAD`, new build, test crash + fatal-level alert.
2. **PRA-002/IM-05** · sev 5 · **blocker** · S — Daily advisor security cron 503s (`SUPABASE_PAT` unset) since 07-02; failure itself invisible. Fix: set PAT + redeploy + failure-notification step so no cron can rot silently again.
3. **PRA-003/IM-07** · sev 5 · **blocker** · M — Data plane: Free-plan 24h RPO, restore never rehearsed, PITR decision blank 5 weeks, 117 storage objects unmirrored, ENG-510 closed with unchecked items. Fix: PITR (post-upgrade), timed rehearsal to scratch project, nightly rclone/R2 image mirror, successor ticket.
4. **PRA-004/IM-04** · sev 5 · **blocker** · S — Supabase Free hard-stops (500MB → read-only; ~5GB egress; MAU gate); Vercel Hobby can pause the deployment; no plan-limit alarms possible at these tiers. Fix: both to Pro + vendor usage alerts (~$45–50/mo).
5. **IM-01** · sev 5 · **blocker** · S · web — Web prod PostHog dead (`NEXT_PUBLIC_POSTHOG_KEY` absent — code reads a name that isn't set): no web analytics, no replay, all flags read OFF on web prod. Fix: set var, redeploy, confirm ingest; ship Alarm 7 heartbeat.
6. **PRA-005 + PRA-008 + IM-09** · sev 4 · **blocker** · M — Only 3 of 12 alarms wired; Sentry rules are unauthored defaults; 100% of "production" Sentry volume is local dev noise; `SENTRY_DSN` unset server-side. Fix: authored rules to a named recipient, spend notifications, heartbeat, `environment` from VERCEL_ENV, resolve stale issues. (Stripe-webhook alarm slice lives in money item #3.)
7. **PRA-006** · sev 4 · **blocker** · S — Recovery vault + trusted contact never actioned (3 weeks past own deadline). Founder-gated, ~2 hours.
8. **PRA-007** · sev 4 · **blocker** · M · web — Privacy page claims signed DPAs that don't exist; sub-processor table omits fal.ai/Anthropic/Supadata/Upstash/Vercel. Fix: click-through DPAs + table update in one change. (Its `STRIPE_TAX_ENABLED` slice → money item #1.)
9. **IM-06** · sev 4 · S — No `/api/healthz` and no external uptime monitor — the cheapest 3am answer doesn't exist. Fix: healthz route + free UptimeRobot/BetterStack check to Grace's phone.
10. **PRA-013/IM-12** · sev 3 · S · mobile — No auth-outage runbook; SIWA is the only mobile auth path. Fix: write DR scenario S8 (~1 page).
11. **PRA-014/IM-15** · sev 3 · M — Last full CI run red (6 timeout failures incl. the Stripe checkout gate) AND Vercel deploys aren't gated on CI. Fix: triage the 4 files in isolation; couple deploys to required checks.
12. **PRA-009/IM-13** · sev 3 · S — Session replay defaults to 100% sampling; documented 0.1 dashboard flip unverified. Fix: set flag payload to 0.1 now, verify, note in the decision doc.
13. **PRA-010/IM-10** · sev 3 · S — AI/image budget caps sized for 1k DAU (£50/£10 per day); enforcement flag value unconfirmed; falBudget lacks the Redis fail-policy. Fix: eyeball `AI_BUDGET_ENFORCEMENT_ENABLED=true`, pre-decide launch-day caps in a decision doc, wrap falBudget Redis calls.
14. **PRA-011/IM-11** · sev 3 · M — Food-vendor quota cliffs (Edamam 1k/day decorative; FatSecret 10k/day zero headroom; USDA unverified) degrade match quality silently. Fix: buy Edamam paid tier or drop it, re-verify USDA limit, PostHog alert on vendor-degraded events.
15. **PRA-012/IM-14** · sev 3 · M — Two hot-path scale bugs: unbounded `saves` fetch on every boot (web+mobile) and unindexed leading-wildcard `ilike` per ingredient in verifyIngredients. Fix: pg_trgm GIN index migration + `.limit()`/cursor contract on the four hydrate sites.
16. **PRA-015/IM-16** · sev 2 · S · mobile — TestFlight 90-day expiry guarded only by a calendar reminder. Fix: weekly ASC API poll in scheduled-crons failing loudly <21 days out.
17. **PRA-016** · sev 2 · S — 14 web + 23 mobile moderate advisories; posthog-js pins a vulnerable OpenTelemetry range. Fix: `npm audit fix` + bump posthog-js + Dependabot toggle.

### Stage 3 — nutrition trust (22 items, 4 blockers)

1. **rt-F1/fill-F1** · sev 5 · **blocker** · M · web — RecipeUpload persists raw `estimateLineMacros()` sums into `recipes.*` when verify hasn't completed/failed; save-before-verify is a routine race. Fix: accept-floor the client fallback, persist a quality signal, gate Save/Publish. Root of the cluster — land 1–3 as one bundle.
2. **rt-F2/fill-F2** · sev 4 · **blocker** · S · web — Discrepancy banner prints "Verified value calculated from ingredient data" without checking `isVerified`, and divides by zero (Infinity%). Fix: condition copy + guard `calories > 0`.
3. **rt-F3/fill-F3 + cx-1 + tl-F6** · sev 4 · **blocker** · M · both — kcal with zero trust qualifier across cards/discover/library-sort/planner/cook AND the north-star "what to eat next" block (no isVerified on `NorthStarRecipe`); Discover's Verified filter is dead plumbing. Fix: qualifier on decision-driving surfaces first, `~` prefix on cards, thread isVerified into north-star, wire the filter. Depends on #1's persisted signal.
4. **tl-F2/label-F2** · sev 4 · **blocker** · S · mobile — Today rows hardcode a success-green dot for every meal; SourceDot imported but dead. Fix: wire SourceDot to match web; delete dead plumbing; sim captures.
5. **tl-F1/label-F1 + tl-F3/label-F3** · sev 4 · S · both — `classifySource` forked web vs mobile (FatSecret green vs grey; "USDA adjusted" over-trusts on mobile); tests cover web only. Fix: single shared classifier in `src/lib/nutrition/` + table-driven parity test.
6. **mp-F1/plaus-F1** · sev 4 · M · both — Manual custom-food creation has zero plausibility gate (server or client). Fix: server-side gate matching the user-foods 422 precedent, with an acknowledged-override path that carries a flag.
7. **mp-F2/plaus-F2** · sev 4 · M · both — `/api/nutrition/photo-log` is the only ungated AI path — no Atwater/ceiling check. Fix: apply the scan-label soft-flag pattern per item.
8. **ne-A1** · sev 4 · S · both — Plan Import tier computed from accepted-rows-only average: more junk lines → higher displayed confidence on an incomplete total. Fix: cap tier when `belowAcceptFloorCount > 0`; surface excluded-line count.
9. **mp-F3/plaus-F3 + mp-F4/plaus-F4** · sev 3 · S · both — USDA/Edamam/FatSecret search routes return implausible rows (only OFF filters); four dead plausibility imports in mobile `verifyRecipe.ts`. Fix: gate at the server routes mirroring OFF; delete the dead imports in the same change.
10. **conf-1** · sev 3 · S — Three independent hardcoded 0.75/0.50 display-tier pairs beside the canonical policy file. Fix: extract shared constants into `verifyConfidencePolicy.ts`.
11. **conf-2** · sev 3 · S — Untrusted-source ingredient rows get the green no-CTA "verified" tier at bare 0.75. Fix (product call): cap untrusted-source fallback at "partial" so the Verify CTA stays visible.
12. **count-to-weight-1 + count-to-weight-2** · sev 3 · S · both — FatSecret evaluates only `results[0]`; Edamam iterates unranked. Fix: normalise both to the USDA/OFF ranked-candidates pattern, one PR.
13. **ne-A2** · sev 3 · S · both — FatSecret silently assumes 100g serving when no metric weight resolves — multi-x macro error at unchanged high confidence, invisible to the self-consistent cross-check. Fix: skip or hard-demote below the accept floor; fold into #12's block rework.
14. **ntr-1/nutrition-test-1** · sev 3 · S — Multi-candidate fallback (USDA top-2 + serial tail) has zero integration coverage. Fix: two fixtures; extend to FatSecret/Edamam after #12.
15. **mp-F5/plaus-F5** · sev 3 · M — No meta-test inventories plausibility-gate coverage — the structural reason 6/7 shipped unnoticed. Fix: inventory meta-test (sibling of `nutritionEntriesGuardInventory`) + consolidate to one canonical plausibility entry point.
16. **tl-F5/label-F5** · sev 3 · M · both — Verified/Estimated confidence chip is mobile-only on AI log review; web dialogs never got it. Fix: port behind the same flag or record an explicit divergence decision.
17. **rt-F4/fill-F4** · sev 3 · S · mobile — create-recipe defaults missing source strings to "Verified" (trust-inverted fallback; currently dead branches). Fix: flip both defaults to "Estimated"/"Pending".
18. **cx-2 + conf-4** · sev 3 · M · both — Trust-vocabulary sprawl: 10+ user-facing trust words ("Structured" is engineer-speak) and five unrelated "confidence" systems with no glossary, incl. source-string collisions (barcode/manual trusted in one system, estimated in another). Fix: Grace picks a canonical 3–4-word vocabulary; write the five-system index + source-trust matrix in `verifyConfidencePolicy.ts`.
19. **count-to-weight-3** · sev 2 · M — 5g/15g per-piece buckets spanning 2.5–7x real ranges all earn "high" conversion confidence. Fix: split worst buckets + add a medium tier so coarseness is visible.
20. **conf-3** · sev 2 · S · docs — Flag-not-reject for AI logging is correct but undocumented; stale comment cites a non-existent classifier. Fix: fix comment + add the carve-out to CLAUDE.md nutrition rules.
21. **tl-F4/label-F4** · sev 2 · S · web — Same tier: "Partial match" in the inline grid, "Estimated" in the verify modal, same dot colour. Fix: one exported TIER_LABEL record.
22. **ntr-2/nutrition-test-2** · sev 2 · S · docs — "Ask for clarification" rule wording vs shipped flag-and-review contract. Fix: amend the CLAUDE.md rule to name the shipped contract.

*Informational: ntr-3 — scoped nutrition suite 696/696 green on both platforms; do not read as trust-machinery health (the gaps above sit exactly in uncovered paths).*

### Stage 4 — money path (13 items, 4 blockers)

1. **MP-01/LEGAL-001 + IM-02 + PRA-007-tax** *(also stage 2)* · sev 5 · **blocker** · S · web — Web Stripe billing entirely dark (zero Stripe vars in Vercel prod → checkout 503s behind a live Buy button) AND Stripe Tax off (first UK/EU sale would be VAT-exclusive, accruing retroactive liability). Fix: Grace decides Option A (full go-live bundle: 4 vars + webhook endpoint + Tax inclusive on all 4 Prices + `STRIPE_TAX_ENABLED` + verify-production-env check + live UK smoke test) or Option B (honest "iOS-only for now" CTA + documented deferral). A 503 behind a Buy button is not a valid deferral.
2. **MP-02/LEGAL-002** · sev 5 · **blocker** · S · mobile — Apple SBP unenrolled, 5 days past its own deadline, with ~6-week effective-date lag. Founder-gated; paid SKU stays off-sale until effective.
3. **MP-03/LEGAL-004 + IM-08a** *(also stage 2)* · sev 4 · **blocker** · S — No human is alerted if either payment webhook fails; first-transaction config errors are the most likely failure. Fix: Stripe + RC delivery-failure notifications + Sentry issue alert, then one sandbox purchase per rail confirming `user_tier` flips.
4. **MP-05/LEGAL-003** · sev 4 · **blocker** · S — Purchase surfaces visually unverified: paywall captured in the disclosure-absent fallback state, billing captures are 404s (wrong route), no Pro-account cancel-path pixels. Fix: full re-capture pass (sandbox paywall, `/account/billing` Free+Pro, Pro cancel path, /pricing light+dark) → legal re-review. Also explain why offerings resolved empty.
5. **MP-04/LEGAL-005 + IM-08b** *(also stage 2)* · sev 4 · M — No reconciliation for a permanently missed webhook, and founder-safety-net.md's "self-heals on next launch" claim is false (client write is 42501-blocked by design). Fix: correct the doc today; ship a scheduled RC+Stripe → `profiles.user_tier` reconciliation cron via `updateProfileTierServiceRole`.
6. **MP-06/LEGAL-006** · sev 3 · S · mobile (+web parity) — Full auto-renew disclosure below the fold while the sticky trial CTA shows from frame one. Fix: condensed one-liner in the sticky bar (copy via legal-reviewer), full paragraph stays in-body; mirror on web.
7. **LEGAL-013** · sev 3 · S · web — Unverified whether Stripe Checkout collects the EU/UK 14-day-withdrawal express consent the Terms claim. Fix: trace `consent_collection`/`custom_text`; add if absent; fold into the UK smoke test.
8. **MP-08/LEGAL-007** · sev 3 · M — No ordering/replay guard on tier writes; stale events can re-grant or wrongly revoke entitlement (bulk-replay runbook triggers it). Fix: persist last-entitlement-event timestamp; no-op older events; document the Stripe/RC dedup asymmetry.
9. **MP-09/LEGAL-008** · sev 3 · M · web — Landing `/` and the in-app upgrade dialog have zero region/VAT wiring and won't self-correct when the tax flag flips; every consumer price is a GBP literal (conversion drag on the US-heavy MFP-refugee cohort). Fix: thread regionCurrency + VAT note into both; sequence USD display first.
10. **MP-10/LEGAL-009** · sev 3 · M · web — Latent shown-£/charged-€ mismatch activates the day EUR Price env vars are set. Fix: per-currency display fields in the SSOT + env assertion refusing EUR SKUs while the display layer can't render EUR.
11. **MP-07/LEGAL-010** · sev 3 · S — Meal-plan day-count Pro gate is client-only; `save_meal_plan` accepts a 7-day plan from Free. Fix: tier predicate in the RPC (third instance of a twice-fixed class — mirror those migrations).
12. **LEGAL-011** · sev 2 · S · mobile — Weight-projection card on the paywall purchase surface (well-hedged, but a body-weight outcome beside a CTA). Fix: diversity-inclusion review + verify calm_mode/no-goal suppression + never on logged-out surfaces.
13. **LEGAL-012** · sev 2 · S · web — "Unlimited imports" marketed as a Pro perk when import is free-by-design; the true differential is unlimited saves. Fix: rename the card; check the shared comparison component.

*Informational: MP-11 — verified-solid money-path foundations (signatures, idempotency, tier lockdown, honest cancel/refund, provider-authoritative prices). Do not re-flag.*

---

```json
{"total": 67, "blockers": 18, "topItem": "DI-01 — user_foods can be INSERTed born-'verified', letting a hostile account poison the shared verified-food corpus every user's calorie tracking reads (sev 5, blocker, S effort: BEFORE INSERT guard trigger migration)"}
```