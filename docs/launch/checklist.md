# Suppr launch checklist

**Owner:** Grace
**Status:** living document — track completion in line
**Last updated:** 2026-04-25 (P1-16 of [Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md))

This is the operational sequence for going from "code-complete" to "TestFlight cohort live" to "App Store / web public launch". Each row links to the underlying decision doc, runbook, or audit artefact.

The companion docs are:
- [Legal finalization runbook](../operations/legal-finalization-runbook.md) — entity, DMCA, GDPR reps, vendor DPAs.
- [RevenueCat webhook ops runbook](../operations/revenuecat-webhook-runbook.md) — RC dashboard + Vercel env wiring.
- [App Store listing](./app-store-listing.md) — subtitle, description, keywords, screenshots, privacy labels.
- [Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md) — origin of the P0/P1/P2 batch.

## Phase 1 — Pre-cohort (gate: small TestFlight beyond Grace)

Soft TestFlight expansion to 5–20 internal/external testers. Critical correctness fixes shipped; ops queue cleared.

| # | Item | Status | Owner | Reference |
|---|------|--------|-------|-----------|
| 1 | All P0 items resolved (audit + 2 ops migrations applied) | ✅ Shipped 2026-04-25 | Grace + Claude | [P0 punch list](../audits/2026-04-25-opus47-codebase-review.md#7-prioritized-punch-list) |
| 2 | RevenueCat webhook ops setup (RC dashboard + Vercel env) | Pending Grace | Grace | [Runbook](../operations/revenuecat-webhook-runbook.md) |
| 3 | `npm run smoke:revenuecat` returns 200/200 with `skipped_duplicate` | Pending #2 | Grace | [P1-14](../decisions/2026-04-25-revenuecat-replay-smoke.md) |
| 4 | `npm run ci` green locally + on the latest push | — | Grace before each cohort add | CLAUDE.md "CI hygiene" |
| 5 | TestFlight build distributed; `apps/mobile/CHANGELOG.md` updated | — | Grace | EAS dashboard |
| 6 | Sentry production project receiving events from web + mobile | Verify | Grace | [observability.md](../observability.md) |
| 7 | PostHog production project receiving events; key funnels populating | Verify | Grace | [observability.md](../observability.md) |
| 8 | Smoke test the cohort journey end-to-end on a fresh device | — | Grace | (manual) |

**Cohort expansion gate:** all rows green. The audit's 7 P0 items + 11 P1 items being closed in code is the floor; #2–#8 are operational confirmation.

## Phase 2 — Pre-public launch (gate: App Store submission)

App Store + web public availability for UK + EU. Legal floor met; assets shipped; monitoring in place.

| # | Item | Status | Owner | Reference |
|---|------|--------|-------|-----------|
| 9 | Cayman immigration counsel call complete | Pending Grace | Grace | [Incorporation pending](../decisions/2026-04-20-incorporation-jurisdiction-pending.md) |
| 10 | Trademark direction (TM-1) resolved | Pending Grace | Grace | [IP follow-ups](../planning/ip-followups-2026-04-19.md) |
| 11 | US cross-border CPA consult complete | Pending #9 | Grace | [Incorporation pending](../decisions/2026-04-20-incorporation-jurisdiction-pending.md) |
| 12 | Delaware LLC formed via Stripe Atlas (or alternate per advisor) | Pending #11 | Grace | [Legal runbook §4](../operations/legal-finalization-runbook.md) |
| 13 | Stripe Live onboarded against the new entity | Pending #12 | Grace | [Legal runbook §5](../operations/legal-finalization-runbook.md) |
| 14 | All five `[PLACEHOLDER ...]` strings in legal pages replaced | Pending #12 | Grace + Claude | `npm run prelaunch:checklist` reports 0 |
| 15 | DMCA designated agent registered (USD 6 at copyright.gov) | Pending #12 | Grace | [Legal runbook §7](../operations/legal-finalization-runbook.md) |
| 16 | UK + EU GDPR Article 27 representatives appointed | Pending #12 | Grace | [Legal runbook §8](../operations/legal-finalization-runbook.md) |
| 17 | Vendor DPAs signed (Supabase, Stripe, RevenueCat, Expo, PostHog, Sentry, OpenAI, Edamam) | Pending #12 | Grace | [Legal runbook §9](../operations/legal-finalization-runbook.md) |
| 18 | Stripe Tax dashboard activated; `STRIPE_TAX_ENABLED=true` in Vercel | Pending #13 | Grace | [VAT posture](../decisions/2026-04-19-consumer-vat-posture-uk-eu.md) |
| 19 | App Store listing assets shipped (subtitle, description, keywords, 6 screenshots, privacy nutrition label) | Pending Grace | Grace | [App Store listing](./app-store-listing.md) |
| 20 | App Store privacy nutrition label submitted | Pending #19 | Grace | App Store Connect → App Privacy |
| 21 | Production smoke (`npm run smoke:production`) green against the live URL | Pending all | Grace | `docs/observability.md` |
| 22 | Sentry alert rules active (5xx spike, new issues on production routes) | — | Grace | Sentry project Alerts |
| 23 | PostHog dashboards built per `docs/observability.md` § Suggested dashboards | — | Grace | [observability.md](../observability.md) |
| 24 | All P1 items resolved | ✅ Tracked in Notion | Grace + Claude | Audit + Notion mirror |
| 25 | Final re-sweep by security-reviewer + nutrition-engine + legal-reviewer + qa-lead | — | Claude | "Phase 3" gate of [2026-04-24 verdict](../decisions/2026-04-24-full-sweep-ship-verdict.md) |

**Public launch gate:** all rows green + App Store reviewer accepts the build. Some rows are sequenced (#11 depends on #9; #18 on #13; etc.); the legal runbook captures the order.

## Phase 3 — Post-launch (first 4 weeks)

Listening, fixing, and iterating against real-user signal.

| # | Item | Cadence | Owner |
|---|------|---------|-------|
| 26 | Daily Sentry triage (15 min/day) | Daily | Grace |
| 27 | Weekly funnel review in PostHog (signup → onboarding_completed → food_logged → 7-day retention) | Weekly | Grace |
| 28 | Weekly App Store review monitoring + reply triage | Weekly | Grace |
| 29 | TestFlight feedback fetch (`npm run testflight:feedback`) + triage | Weekly | Grace |
| 30 | RC webhook health (look for 4xx/5xx spikes in `revenuecat_events.received_at` density) | Weekly | Grace |
| 31 | P2 backlog (audit items 19–29 + the new P2-28 / P2-29) | Sprint planning | Grace |

## Pre-deployment checklist (every release)

Run this from the repo root before pushing to `main`:

```bash
npm run ci                       # full type/lint/test/build chain
npm run prelaunch:checklist       # placeholder inventory + RC smoke + drift
gh run watch                      # confirm latest GH Actions run is green
```

Per CLAUDE.md "CI hygiene" non-negotiable: a red `main` blocks all collaborators.

## Deployment flow (web)

1. `git push origin <branch>` (or `main`).
2. Vercel auto-deploys from `main` to production.
3. `npm run smoke:production` against the live URL.
4. Spot-check `/`, `/login`, `/pricing`, `/privacy` in a private window.
5. Confirm Sentry shows the new release tag (`SENTRY_RELEASE` env in `next.config.ts`).

## Deployment flow (mobile, EAS)

1. `eas build --profile production --platform ios` (or both).
2. Submit via `eas submit -p ios --latest` (App Store) / `eas submit -p android --latest` (Play Store).
3. App Store Connect → TestFlight tab → distribute to internal/external testers.
4. Update `apps/mobile/CHANGELOG.md` with build notes.
5. Confirm Sentry mobile project shows the new release.

## Post-deployment confirmation

Within 30 minutes of a production deploy:

- [ ] Sentry: no new error class spike vs prior 30-min window.
- [ ] PostHog: `food_logged` and `meal_plan_generated` events still firing.
- [ ] Vercel function logs: no 5xx on `/api/revenuecat/webhook`, `/api/stripe/webhook`, `/api/account/delete`, `/api/household/join`.
- [ ] RC webhook: latest event in `revenuecat_events` has `received_at` within the last hour (proves dashboard wiring still alive).

## Rollback flow

Web (Vercel): rollback through dashboard → Deployments → previous green → Promote to production. Takes <60 seconds.

Mobile (App Store): can't rollback an existing submission; submit a hotfix build. For TestFlight, expire the bad build and distribute the previous one.

Supabase migrations: forward-only by default. If a migration breaks production, the response is a forward-fix migration, not a rollback. Per CLAUDE.md, all migrations are idempotent so re-runs are safe.

## When to re-open this doc

- Any P1 item flips back to non-green.
- A new vendor or subprocessor is added → update vendor DPAs row + Notion.
- Phase 2 completes → archive Phase 1 + Phase 2 sections, keep Phase 3 + repeat-runs sections live.
- An incident requires a new pre-launch gate → add the row.
