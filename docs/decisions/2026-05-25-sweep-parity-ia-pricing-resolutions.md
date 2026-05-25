# Decision — 2026-05-25 full-sweep parity, IA & pricing resolutions

- **Date:** 2026-05-25
- **Area:** Product / Pricing / Brand
- **Status:** Resolved
- **Owner:** Grace, from the 2026-05-25 full-product audit sweep
- **Tracking:** Linear initiative "Full-product audit sweep — 2026-05-25"; decisions log issue ENG-718; this doc closes ENG-708.

Records the sweep resolutions that needed decision-doc form. Each links to its action issue. Companion: the gamification line lives in its own doc (`2026-05-25-noom-delight-vs-gamification-line.md`).

## North-star block → empty-day-only (ENG-690) — supersedes D-2026-04-27-04

D-2026-04-27-04 made "what to eat next" a **permanent block on Today**. Live behaviour diverged (north-star now renders empty-day-only, `index.tsx:4770`, Grace's 2026-05-23 call) with no recorded rationale. **Resolution:** the empty-day-only placement is intentional and canonical; D-2026-04-27-04's "permanent block" is **superseded**. Residual concern recorded on ENG-690: a brand-new user's Today no longer shows the differentiator (it lives in the Log sheet) — revisit if activation data shows the north-star moment isn't being discovered. Web + mobile parity required.

## Pricing default divergence RETIRED → unify to monthly (ENG-698) — supersedes 2026-04-19 doc

`2026-04-19-pricing-default-billing-period-divergence.md` defended web-monthly / mobile-annual defaults as intentional. The sweep retired that carve-out: **both platforms default to monthly.** Rationale: a single predictable default is clearer than two opposite ones, and monthly is the honest low-friction anchor on both surfaces. **Verify before shipping:** the 7-day trial SKU (Apple IAP) is attached to the annual product — confirm the trial still surfaces correctly when mobile defaults monthly (or attach a monthly trial). The 2026-04-19 doc is marked Superseded.

## Fourth tab canonical = "Progress" (ENG-694)

The mobile fourth tab renders `title: 'Progress'` consistently (2026-05-19 IA; `(tabs)/_layout.tsx:195-200`, Settings/Profile collapsed in). Only the `testID` (`tab-you`, kept for Maestro stability), a stale code comment, and `_project-context.md` ("More") disagreed. **Canonical user-facing name is "Progress."** This is doc/comment hygiene, not a code change — docs fixed to match the code.

## Carve-outs RETIRED (now converging to parity)

These were "documented intentional divergences"; the sweep converts each to a parity task:
- **Paywall default** → unify monthly, both platforms (ENG-698, above).
- **Move-meal** → add to web `/planner` (ENG-699). Was mobile-only (`MoveMealSheet.tsx`).
- **Recipe "Go Public"** → add to mobile (ENG-700). Was web-only (`GoPublicDialog`).
- **Onboarding Welcome copy** → fresh brand+copy pass, both platforms (ENG-697). Was web "Join the Suppr Club" vs mobile prototype copy.
- **Discover IA** → converge mobile to the web cuisine-carousel layout (ENG-695). Was "may diverge visually."

## Carve-outs KEPT (still intentional — do NOT flag as drift)

- **Onboarding step count** — web N/13 vs mobile N/12 (mobile refresh-plan step difference). Intentional; documented.
- **iOS-only build target** — Android config is vestigial; not a parity gap.
- **Calorie-ring colour map** — empty=gradient, under=success green, over=destructive red (overrides prototype's "never destructive over-budget"); other over-budget signals stay amber.
- **Stripe (web) vs IAP (mobile) billing rails** — entitlements reconcile in `profiles.user_tier`.
- **Apple Health / Apple Sign-In** — mobile-first/native; web has manual equivalents.
- **Today dark surface tone** — mobile `#0a0a0f` vs web `#101014` (platform-native depth).

## Where this is recorded
- Parity scope: `docs/product/web-mobile-parity-scope.md` (2026-05-25 section).
- Agent context: `.claude/agents/_project-context.md` (divergence list updated).
- Notion Decisions log: mirror rows for this doc + the retired divergences (per ENG-708 completion).
