# T11 — Onboarding v2 ramp runbook

**Date:** 2026-04-27
**Owner:** Grace (executes), Engineering on-call (monitors)
**Status:** Ready to execute post App Store live
**Trigger:** App Store submission accepted + first install lands.

---

## TL;DR

Onboarding v2 is the canonical sign-up entry today (legacy form is tombstoned, middleware revert shipped). Every new install / signup currently uses v2 by default *because the PostHog `onboarding_v2` flag defaults to true*. This runbook documents the controlled-ramp posture we'll fall back to if the v2 flow surfaces a regression in the wild.

The default-true posture matters: if a regression appears, we don't ramp UP, we ramp DOWN. The flag exists as a kill-switch.

---

## Pre-ramp checklist (do BEFORE App Store goes live)

1. **Verify PostHog flag exists + defaults true:** PostHog → Feature Flags → `onboarding_v2` should be enabled, with rollout 100% to all users. If somehow still set to a partial rollout, push to 100% before launch.
2. **Verify mobile flag wiring:** `apps/mobile/lib/analytics.ts` exports `isOnboardingV2Enabled()` + `subscribeToFlags()`. The reading code is in `apps/mobile/app/onboarding.tsx`. Grep verified 2026-04-27: callers exist on the consume side; web has the equivalent legacy-form-tombstone path.
3. **Sentry alert for `onboarding_v2_step_failed`:** confirm an alert is set up to fire when `count(onboarding_v2_step_failed)` over 1h > 5. PostHog → Alerts.
4. **PostHog dashboard "Onboarding v2 funnel"** confirms steps 01 → 09 → completion with conversion at each step. Bookmark URL.

---

## The flag's truth table

| Flag value | Behaviour |
|---|---|
| `true` (default) | New signup hits `/onboarding/v2` directly — what we ship pre-launch. |
| `false` | New signup STILL hits `/onboarding/v2` because that's the only public route now (legacy was deleted 2026-04-27). The flag controls a few branched components inside the v2 flow that fall back to "simpler" copy. **This is no longer a true kill-switch — the legacy form is gone.** |

**Implication:** the flag's main remaining job is *analytics segmentation* + *internal-only branching*, not a full rollback path. If we need a real rollback we need to redeploy the legacy form.

This is intentional per the 2026-04-27 pre-submission readiness doc — the legacy form had bit-rotted enough that keeping it as a parallel path was a higher launch risk than going single-track on v2.

---

## Ramp sequence (use only if v2 surfaces a regression in the wild)

> The default posture is 100% on v2. The "0 → 10 → 50 → 100" ramp below applies if we detect a problem and need to dial v2-branched features back, then dial them up again as we patch.

### Stage 0 — incident detected
- **Trigger to start the ramp:** any of:
  - Sentry alert: `onboarding_v2_step_failed` > 5 in 1h.
  - PostHog: signup → completion conversion drops below 60% (baseline ~75%).
  - Crash rate on `apps/mobile/app/onboarding.tsx` > 0.5%.
  - Direct user report (TestFlight / App Store review) of a blocking bug.

### Stage 1 — flag to 0%
- PostHog → `onboarding_v2` → set rollout to 0%.
- All new signups (mobile + web) now hit the simpler-fallback branches inside v2.
- Wait 30 min. Confirm error rate drops + signups still complete.
- If error stays high → escalate; the regression is in code paths the flag doesn't gate. Hot-fix needed.

### Stage 2 — flag to 10%
- After hot-fix is deployed AND validated locally, set flag rollout to 10%.
- Watch for 24h. PostHog "Onboarding v2 funnel" should not show > 5% drop in completion vs the 90% on the fallback branch.
- If green → proceed to Stage 3.

### Stage 3 — flag to 50%
- Set rollout to 50%.
- Watch for 24h. Same metric: completion within 2-3% of fallback branch.
- If green → proceed to Stage 4.

### Stage 4 — flag back to 100%
- Set rollout to 100%.
- Watch for 24h. Confirm baseline holds.
- File a decision doc capturing root cause + rollout date.

---

## Monitoring queries

PostHog SQL (paste into PostHog → SQL):

```sql
-- Stage funnel: signup → onboarding step 01 → step 02 (signUp call) → completion
SELECT
  toDate(timestamp) AS day,
  countIf(event = 'signup_started') AS signups,
  countIf(event = 'onboarding_v2_step_started' AND properties.step = '01') AS step_01,
  countIf(event = 'onboarding_v2_step_started' AND properties.step = '02') AS step_02,
  countIf(event = 'onboarding_completed') AS completions,
  round(countIf(event = 'onboarding_completed') * 100.0 / nullif(countIf(event = 'signup_started'), 0), 1) AS conversion_pct
FROM events
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day DESC;
```

```sql
-- Step-failure rate per step
SELECT
  properties.step AS step,
  count() AS failures,
  round(count() / countIf(event = 'onboarding_v2_step_started') * 100, 2) AS pct
FROM events
WHERE event = 'onboarding_v2_step_failed' AND timestamp >= now() - INTERVAL 24 HOUR
GROUP BY properties.step
ORDER BY failures DESC;
```

Sentry — saved search:
- `event.type:error AND tag:onboarding_v2:true` — onboarding-specific errors.
- Drilldown: `transaction:onboarding-v2-*` shows per-step crash distribution.

---

## Rollback (ultimate last resort)

If even the flag-off fallback branches in v2 are broken and signups are zero:

1. Revert the commit that tombstoned `app/onboarding/legacy-form.tsx` (it's still in git history at `2026-04-27`).
2. Revert `app/onboarding/page.tsx` to read `?legacy=1` and import the form.
3. Re-add `/onboarding/v2` to `DEV_PREVIEW_PREFIXES` in `middleware.ts` (so the flag-off path falls back to `/onboarding?legacy=1`).
4. Deploy. New signups now route through the legacy form.
5. Open a P0 ticket to repair v2.

This rollback adds ~30 min to a 1-line revert because of the cross-platform sync work. We assume we won't need it; this is documented for completeness.

---

## What this runbook deliberately does NOT cover

- **Signal selection.** Which 4 metrics to rely on for the green-light decision is a product call (Grace + eng lead). The queries above are the menu.
- **Communication.** Whether to email TestFlight users about an in-flight regression, post to support, etc. — Grace's call.
- **Mobile-only ramp scoping.** The flag is shared web ↔ mobile today. If we ever need to dial mobile down without affecting web, we'd add a `platform` filter inside `isOnboardingV2Enabled()` — that's a separate ticket.

---

## Notes for execution

- All flag changes are reversible within a few seconds via PostHog dashboard.
- The mobile flag SDK polls every 30s by default — expect up to that delay for changes to propagate to running apps.
- Web flag is read on each signup page load — instant on next page nav.
- This runbook supersedes the original "0 → 10 → 50 → 100" ramp captured in the pre-submission readiness doc, which was written before the legacy form was tombstoned.
