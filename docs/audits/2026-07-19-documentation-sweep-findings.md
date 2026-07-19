# Documentation completeness sweep — findings & open questions (2026-07-19)

**What this is:** a full ground-truth audit of every feature area across web + mobile,
run to bring `docs/journeys/`, `docs/product/`, `docs/user/` up to complete,
loop-first, "why + what's next" documentation (Grace's request). Auditing every
screen against the real code surfaced ~85 open questions and concrete defects
beyond pure documentation gaps. The 10 clearest, most concrete ones are already
filed as Linear issues (below). Everything else is a genuine open product
question that needs Grace's judgment before it can become a well-scoped ticket
— listed here, grouped by area, so nothing gets silently lost.

**Full documentation output:** [`docs/journeys/README.md`](../journeys/README.md)
(15 product loops, loop-first index) and [`docs/product/overview.md`](../product/overview.md).

---

## Filed as Linear issues (concrete, evidence-backed, no product judgment needed to act)

| Issue | Severity | What |
|---|---|---|
| [ENG-1599](https://linear.app/suppr/issue/ENG-1599) | **P1 — legal, launch-blocker** | `fetchSocialPostMeta()` bypasses the blocked IG/TT server-fetch decision on the founder's headline Instagram-import loop |
| [ENG-1600](https://linear.app/suppr/issue/ENG-1600) | Bug | Batch-cook "scale to shopping" writes to a legacy JSON blob the Shopping screen doesn't read |
| [ENG-1601](https://linear.app/suppr/issue/ENG-1601) | Bug | Mobile plan-import auto-rebalances against a hardcoded 2000kcal + fabricated macros |
| [ENG-1602](https://linear.app/suppr/issue/ENG-1602) | Bug (needs verification) | Household `share_targets` may not actually reach other members — possible RLS gap |
| [ENG-1603](https://linear.app/suppr/issue/ENG-1603) | Bug, parity | Mobile `/coach` drops carbs/fat, producing wrong "what to eat next" ranking vs web |
| [ENG-1604](https://linear.app/suppr/issue/ENG-1604) | Cleanup | Dead Eat-again code still shipped + tested since ENG-984 retired the feature |
| [ENG-1605](https://linear.app/suppr/issue/ENG-1605) | Cleanup | Two source comments cite decision docs that don't exist on disk |
| [ENG-1606](https://linear.app/suppr/issue/ENG-1606) | Bug, accessibility | VoiceOver announces "Starting a fast" on a no-op (already fasting) |
| [ENG-1597](https://linear.app/suppr/issue/ENG-1597) | Future feature | Scope in-app help/contextual guidance UI (Grace's explicit ask, tracked separately from this sweep) |
| [ENG-1598](https://linear.app/suppr/issue/ENG-1598) | Documentation | Literal button-by-button component inventory (Grace's explicit ask, tracked separately from this sweep) |

---

## Needs Grace's call — grouped by area

Each item below is written into its source journey doc's "Open questions" section too (not duplicated content, just indexed here for scanning). File a ticket for any of these directly if you want one — none were auto-filed because each requires a product/design decision before it's a well-scoped piece of work, not just a fix.

### Onboarding & Auth ([journey doc](../journeys/onboarding-to-first-log.md))
- Mobile's auth-wall-first default (`mobile_preauth_reveal_v1` OFF) vs web's reveal-first — permanent split or should mobile ramp to match? Largest live onboarding parity gap.
- Web onboarding has no Apple Sign-In option; mobile onboarding has *only* Apple. Intended permanent split?
- `docs/user/getting-started.md` is badly stale (wrong tab IA, pre-Sloe branding, describes a removed onboarding step) — needs an owner to rewrite or retire.
- `apps/mobile/CLAUDE.md` claims "no email/password QA form" but `login.tsx` ships a full email/password + magic-link + reset form — rules-file contradiction.

### Recipe Capture & Import ([journey doc](../journeys/import-recipe.md), [cookbook doc](../journeys/import-cookbook.md))
- Cookbook PDF batch import is mobile-only; is web parity intended or permanent?
- Caption-preview trust card is gated behind `import_caption_preview_v1` on web but always-on on mobile — intended divergence or unramped drift?
- On `verifyIngredients` failure mid-import, a 0-kcal recipe can still be saved. Is the write-side guard sufficient, or should save be blocked outright?
- Plan Import (paste/PDF/screenshot from the Plan tab) isn't referenced from `meal-planning.md` at all — the only spec lives in `docs/planning/plan-import-linear-program.md`.

### Recipe Library, Discovery & Cooking ([journey doc](../journeys/discover-and-library.md))
- "Add to my regulars" (Cook Mode) is mobile-only with no documented carve-out — unflagged drift?
- Cook-mode "handsfree" voice toggle is a dark shell (no audio capture) citing a decision doc that doesn't exist (ENG-1605 covers the citation; whether to keep shipping the shell is a separate call).
- Two Discover sections ("Popular collections," "Recipes in action" Reels rail) are coded as deferred — still planned or cut?
- No de-seed trigger exists for the curated seed recipes once real community content grows — will they sit above real content indefinitely?

### Nutrition & Macro Calculation ([journey doc](../journeys/food-tracking.md), [user doc](../user/how-your-calorie-target-works.md))
- `energy_numbers_v1` (the ENG-1506 maintenance-number consistency fix) is still default-OFF — production still shows the divergent numbers the fix was built to kill. Ramp plan?
- `GET/POST /api/nutrition/adaptive-tdee` has no client anywhere and fabricates body stats — delete it or bring it under the resolver?

### Meal Planning ([journey doc](../journeys/meal-planning.md))
- Should web get a per-meal "Remove from plan" affordance to match mobile? The shared engine already supports it.
- Inactive named plan slots are local-storage-only on both platforms — accept losing them on device switch, or move server-side?

### Food Tracking / Diary ([journey doc](../journeys/food-tracking.md), [log sheet](../journeys/log-sheet.md))
- Two mobile barcode-scanner implementations duplicate UI/correction code (standalone route vs the one inside LogSheet) — consolidate?
- Web has no offline write-ahead queue for logging (mobile does, ENG-1447) — is online-first acceptable for web long-term?
- Web weekly-recap screen is deferred (ENG-1001) — launch priority or stays deferred?

### Progress & Insights ([journey doc](../journeys/progress.md))
- **Is the ENG-1525 hierarchy redesign meant to be live yet?** Code landed 2026-07-17 but the flag is default-OFF and the PostHog row/ramp haven't been created — today everyone, including Grace, sees the legacy stack. Needs explicit ramp-intent confirmation so nobody mistakenly treats it as shipped.
- `StreakFreezeCard` conflict: the ENG-1525 decision doc says it renders cross-platform; mobile's own code comment says it was demoted per a different (Sloe Figma 492:2) decision. Two decisions disagree — which is canonical?
- Mobile Body Composition hardcodes `latestBodyFatPct: null` (comment: "deferred: see ENG-1525") — closing this a launch requirement or acceptable post-ramp?
- Could not confirm the hierarchy redesign was pixel-validated (light/dark × 4 states) before code-landing, per its own decision doc's stated requirement.

### Shopping List ([journey doc](../journeys/shopping-list.md))
- `shopping_list_generated` analytics event fires web-only — mobile's plan-generate emits nothing, blinding the tier-gating decision's own revisit trigger on iOS (the primary surface).
- No "add custom item" input on either platform, despite shoppers routinely adding non-recipe items — permanently out of scope?

### AI Coach ([journey doc](../journeys/what-to-eat-next.md))
- `docs/ux/redesign/ai-coach.md` (2026-06-02) still says "no AI chat, no LLM-backed coach" — directly contradicted by the shipped `/coach` screen (ENG-1240, default-ON). Needs a superseded banner or reconciliation.
- Is a separate `/coach` destination (vs. expanding the inline Today block) validated with the solo tester, given it ships default-ON?
- No dedicated Maestro/Playwright coverage exists for `/coach` despite being default-ON.

### Creator Platform ([journey doc](../journeys/creator-platform.md))
- **Headline open risk:** should the creator platform ship to real users at all today? It's populated by 5 fabricated "verified" personas with zero real recipes and no way for a genuine creator to join.
- Is showing `is_verified = true` on invented personas, with no "sample" disclosure, a trust/legal problem?
- DMCA designated-agent registration (ENG-859) is incorporation-dependent and Grace-owned — confirm current status before any external claim describes the DMCA channel as effective.

### Settings, Household, Profile & Notifications ([journey doc](../journeys/settings-and-control.md), [household doc](../journeys/household-sharing.md))
- **Delete-account flow doesn't warn that deletion doesn't cancel the subscription** — verified not shipped on either platform. This is a live chargeback/support-ticket risk, not hypothetical.
- Reminder time is only settable during onboarding on both platforms — ship an editor, or rule onboarding-only intentional?
- `measurement_system` (units) is web-editable only; mobile is metric-forced everywhere, silently mis-storing non-metric mobile users' input today.
- Household web entry point is only reachable via a legacy `/home?view=household-settings` alias, not a first-class route.

### Monetisation & Billing ([journey doc](../journeys/monetisation-and-paywall.md))
- **Is the 7-day free-trial actually configured on the App Store Connect annual SKU?** The mobile paywall asserts the trial from a client-side constant and never checks the store's real intro-offer config — if the SKU lacks it, Apple charges on day 0 while the copy says otherwise.
- Should the entitlement-reconcile cron cover the RevenueCat rail before public launch? Only Stripe self-heals from a dropped webhook today (ENG-1463 deferred).
- Region-aware pricing is half-built: EUR SKUs exist but fall back to a "GBP" banner when unconfigured; USD has no price resolver at all.

### Widgets, Shortcuts & Marketing ([journey doc](../journeys/shortcuts-and-widgets.md), [marketing doc](../journeys/marketing-to-signup.md))
- Is the native WidgetKit extension actually planned, or indefinitely deferred? If deferred, `docs/user/shortcuts-and-widgets.md`'s "coming next" framing overstates imminence and the unused `widget_snapshot_updated` event should be gated off.
- **Mobile-first referral invitees never get their code redeemed** — only web's onboarding flow calls the redemption function; a user who installs from the `/g/<code>` page and completes onboarding on mobile gets nothing.
- `/licences` lists Edamam as an active nutrition data source — it doesn't appear anywhere in the current integration footprint. Stale legal attribution, or an undocumented live integration?

---

## Documentation housekeeping (low severity, already flagged inline)

- `docs/journeys/README.md` gaps list: no dedicated journey doc yet for **Health Sync** (mechanics) — only its Settings entry point is documented.
- `import-cookbook.md` has no Maestro/Playwright/Vitest coverage found — confirm none exists and document why, or add coverage.
- `docs/product/subscriptions-stripe-and-iap.md`'s mobile section is thin — doesn't name the RevenueCat webhook, reconcile cron, or the client-asserted-trial risk (ENG-1599 sibling). Follow-up doc pass recommended.
