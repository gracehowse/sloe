# Alerting — ops runbook

**Owner:** Grace
**Status:** required before TestFlight cohort expansion (Phase 1 row 6/7) and before public launch (Phase 2 rows 22/23)
**Last updated:** 2026-05-14 (Blocker 1 of the 2026-05-14 production-readiness audit)
**Supersedes:** the one-line aspirational mentions in [`docs/launch/checklist.md`](../launch/checklist.md) row 22 and [`docs/observability.md`](../observability.md) § Sentry → "Add alert rules".

The 2026-05-14 audit found **zero alarms wired anywhere**. PostHog ingestion silently died between 2026-04-21 and 2026-05-11 because nothing alarmed on its absence — three weeks of blind product analytics. This runbook closes that gap: it lists the **minimum 6 alarms** every production-bound deploy must have configured + tested, plus 4 nice-to-haves.

This is a dashboard runbook, not a code runbook. Suppr's vendors all do alarming server-side; no code changes are required to enable any alarm below. Where a vendor needs a one-off cron-poll to surface a signal (e.g. Supabase `get_advisors`) the workstream is flagged but not in scope for this PR.

---

## Routing rules

**Primary route:** `gracehowse@outlook.com` (Grace, single human responder while cohort = N=1).

**Secondary route:** none today. **Flagged:** once a second human joins the team (designer, contractor, or co-founder), pager-style fanout should land at the second human as well. Mailhook into a shared inbox is fine; Slack/Discord webhook is the upgrade target. Tracked separately — do not block the primary wiring on it.

**Quiet hours:** none. Suppr is N=1 and pre-launch; every alarm fires immediately. Once cohort > 50, revisit and add a "noise" tier (digest-only) for non-critical alarms.

---

## The 6 minimum alarms

Every row below must be `Wired` before App Store submission. `Pending Grace` is acceptable for TestFlight expansion only. `Not yet wired` blocks Phase 2 row 22.

### Alarm 1 — Sentry: new issue / event spike

- **Vendor:** Sentry
- **Trigger condition:** New issue created in the production project **OR** existing issue event count > **50 events / 1 hour**.
- **Route:** Email to `gracehowse@outlook.com`.
- **Test procedure:**
  1. Sentry dashboard → Suppr web project → **Alerts** → confirm the rule exists with the two conditions joined by OR.
  2. Trigger a deliberate error: add a temporary `throw new Error("alerting-canary " + Date.now())` to a dev-only API route, push to a preview deploy, hit the route once. Confirm the email lands within ~2 minutes.
  3. Remove the throw before merging. Mark the canary issue as resolved in Sentry so the recurring-error escalation rule doesn't false-positive in future.
- **What to do when it fires:**
  - New issue → triage to severity. P0 (auth, payments, food logging) gets immediate response; lower priorities get logged in Linear with the Sentry issue link.
  - Spike on existing issue → existing class of bug got louder. Likely cause: regression in latest deploy, or external dependency degradation (Supabase / Stripe / RC). Cross-reference deploys timeline.
- **Status:** Not yet wired.

### Alarm 2 — Sentry: quota at 70% of monthly cap

- **Vendor:** Sentry
- **Trigger condition:** Monthly event quota usage reaches **70%** of the plan cap (Sentry's built-in **Spend Notifications**, threshold = 70).
- **Route:** Email to `gracehowse@outlook.com`.
- **Test procedure:**
  1. Sentry dashboard → **Settings → Subscription → Spend Notifications**.
  2. Confirm a notification rule exists for the 70% threshold on the current plan.
  3. To validate the route works (without burning real quota): temporarily lower the threshold to 1% and trigger a single event from Alarm 1's test procedure. Restore to 70% after the email lands.
- **What to do when it fires:** Sentry will drop events once the cap is hit. Either bump the plan tier (preferred when traffic is real) or apply an inbound filter (when the cap is being burned by a noise source — bot crawlers, dev-tool extension noise). Never just let it run silent.
- **Status:** Not yet wired.

### Alarm 3 — PostHog: event-cap at 70% of monthly cap

- **Vendor:** PostHog
- **Trigger condition:** Monthly ingested event volume reaches **70%** of plan cap. PostHog calls this **billing usage alerts**.
- **Route:** Email to `gracehowse@outlook.com`.
- **Test procedure:**
  1. PostHog → **Organization settings → Billing → Usage alerts**.
  2. Confirm a usage alert for 70% of the monthly cap exists for both **events** and **session recordings**.
  3. Validate by temporarily lowering threshold to 1% on a single product, wait for the daily polling, confirm email lands. Restore to 70%.
- **What to do when it fires:** Either bump plan or apply event-level filters in PostHog (drop high-volume noise events). The 70% threshold is deliberate — session replay is the priority data and gets cut first when you hit the hard cap, so 70% gives a working week of headroom.
- **Status:** Not yet wired.

### Alarm 4 — Stripe: webhook delivery failure

- **Vendor:** Stripe
- **Trigger condition:** Any webhook delivery returns 5xx **OR** the same endpoint hits 3 consecutive delivery failures (Stripe's built-in **endpoint failure** alert).
- **Route:** Email to `gracehowse@outlook.com`.
- **Test procedure:**
  1. Stripe dashboard → **Developers → Webhooks → [the Suppr production endpoint] → Notifications**.
  2. Confirm "Notify me when webhook events fail" is enabled and routed to gracehowse@outlook.com.
  3. Validate by temporarily rotating `STRIPE_WEBHOOK_SECRET` in Vercel **without** updating Stripe's stored secret (so signature verification fails). Trigger one event via Stripe CLI: `stripe trigger checkout.session.completed`. Confirm email lands within ~15 minutes (Stripe batches webhook failure notifications).
  4. **Critical:** restore the secret immediately after testing. Live entitlement writes depend on this webhook.
- **What to do when it fires:** Entitlement leak risk. Open Stripe → Webhooks → endpoint → Recent events; look at the latest 5xx body. Either the handler is broken (rollback if mid-deploy), or Vercel function is timing out (check Vercel function logs), or the signing secret rotated out-of-band. Manually replay missed events from Stripe dashboard after fix.
- **Status:** Not yet wired.

### Alarm 5 — Vercel: function error-rate spike

- **Vendor:** Vercel
- **Trigger condition:** Function error rate > **2%** over a **5-minute** window across all serverless functions in the production project. Vercel exposes this as **Observability → Metrics → Function Errors** with alerting available on Pro plan.
- **Route:** Email to `gracehowse@outlook.com`.
- **Test procedure:**
  1. Vercel dashboard → Suppr project → **Settings → Notifications** (or Observability → Alerts depending on plan UI).
  2. Confirm a metric alert is configured: "Function Errors > 2% over 5 minutes" routed to gracehowse@outlook.com.
  3. Validate by deploying a preview build with the deliberate `throw` from Alarm 1's test, hitting the route 100x in a loop (`for i in {1..100}; do curl -s -o /dev/null https://<preview>.vercel.app/api/<route>; done`). Confirm email lands within ~10 minutes.
- **What to do when it fires:** Either a route is throwing (cross-reference Sentry — Alarm 1 should also fire), or function-level infra issue (cold start storm, dependency degradation). Vercel dashboard → Functions → latest deployment → Logs. Rollback to last green deploy if mid-deploy.
- **Status:** Not yet wired.

### Alarm 6 — Supabase advisor: critical findings

- **Vendor:** Supabase (currently no native alarm)
- **Trigger condition:** `mcp__claude_ai_Supabase__get_advisors` returns at least one **critical** severity finding (RLS bypass, exposed function, missing-FK, lossy-cast).
- **Route:** Manual today — Grace polls via Claude MCP weekly. **Flag:** this should be a cron-polled alarm. Currently there is no native Supabase Slack/Email integration for advisors. **Cron-poll candidate:** a Vercel cron route (`/api/cron/supabase-advisors`) that calls Supabase Management API's advisors endpoint and emails on critical findings. Out of scope for this PR; opened as Linear follow-up.
- **Test procedure:**
  1. Today: `mcp__claude_ai_Supabase__get_advisors { type: "security" }` and `{ type: "performance" }`. Eyeball severity field.
  2. Once cron-polled: deliberately create a public-readable table in a staging project, run the cron, confirm email.
- **What to do when it fires:** Most critical-severity findings are RLS gaps (table without RLS, RLS without a deny-default policy, or function-with-elevated-privs callable by `anon`). Drop a fix migration the same day — these are entitlement-leak risks.
- **Status:** Pending Grace (manual weekly poll); cron-poll: Not yet wired.

---

## Nice-to-haves (post-launch)

### Alarm 7 — PostHog health-check absence

- **Vendor:** PostHog (synthetic, via a Vercel cron)
- **Trigger condition:** No `app_heartbeat` event received in the production project for **30 minutes**.
- **Why:** This is the exact alarm that would have caught the 2026-04-21 → 2026-05-11 silent outage. Three weeks of zero PostHog ingestion would have alarmed within 30 min instead of 3 weeks.
- **Implementation sketch:** Add a low-cost client-side `app_heartbeat` event fired once per session-load. PostHog → Insights → Trends → `app_heartbeat` count over last 30 min. Set Insight Alert when count = 0. Email to gracehowse@outlook.com.
- **Status:** Not yet wired.

### Alarm 8 — AI provider 429-rate spike

- **Vendor:** Sentry (custom event tag) + the provider's own dashboard
- **Trigger condition:** Rate of 429 responses from OpenAI/Anthropic > **5 / minute** over a 10-minute window (rate limit being burned by an attack or a runaway client).
- **Why:** Cost ceiling. Suppr's voice-logging + recipe-import call AI providers; uncontrolled 429-burn is either an abuse vector (rapid-fire requests from one user) or a SDK retry loop.
- **Status:** Not yet wired.

### Alarm 8.5 — AI budget — 70% global daily cap (Blocker 3, 2026-05-14)

- **Vendor:** Sentry (automatic) + log line in Vercel function logs
- **Trigger condition:** The Suppr-side daily AI spend counter (Layer B in [`docs/decisions/2026-05-14-ai-cost-circuit-breaker.md`](../decisions/2026-05-14-ai-cost-circuit-breaker.md)) crosses **70%** of its cap. Default cap = £50/day. Threshold = £35.
- **Why:** Last warning before the circuit-breaker trips. At 100% the AI helper starts returning 503 `ai_capacity_reached` to every user — better to widen the cap or investigate the cause first.
- **What to do when it fires:**
  1. Open Vercel function logs, grep `[ai-budget] ALARM 70%`. Look at the scope: `global_spend` (everyone burning) vs `user:<id>` (one user runaway).
  2. If runaway user: check Sentry for traces of that user's session; if abuse, kill their session token. The per-user cap (50 calls / day default) will hold them at the next reset.
  3. If global-wide burn: legitimate spike (viral moment, cohort expansion) → widen `AI_BUDGET_GLOBAL_DAILY_GBP` in Vercel env vars (90-second deploy via "Save and redeploy" toggle on the env var, no code change). Tighten the next morning.
  4. If nothing looks wrong but burn is real: re-examine `max_tokens` ceilings in the route handlers (`app/api/nutrition/photo-log/route.ts` uses 2500 — that's the heaviest).
- **Status:** Wired in code (alarm fires automatically from `src/lib/server/aiBudget.ts` once 70% is crossed; logs to Vercel + captures Sentry warning). **Test:** locally set `AI_BUDGET_GLOBAL_DAILY_GBP=1` and run two photo-log requests through `npm run dev`; grep the logs for the alarm line.

### Alarm 9 — Stripe Tax mode mismatch

- **Vendor:** Stripe (manual config audit, not a runtime alarm)
- **Trigger condition:** Stripe Tax mode != **inclusive** on any UK/EU price.
- **Why:** UK/EU consumer VAT applies from £1/€1 (per [`docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md`](../decisions/2026-04-19-consumer-vat-posture-uk-eu.md)). Inclusive mode is the legal floor today. Inadvertent flip to exclusive on a single SKU = under-collection liability.
- **Implementation sketch:** Vercel cron route hitting Stripe API `prices.list` and filtering for `tax_behavior != "inclusive"`. Email on any finding.
- **Status:** Not yet wired.

### Alarm 10 — TestFlight build expiry

- **Vendor:** App Store Connect (no native email)
- **Trigger condition:** A TestFlight build's expiry date is **7 days** away with no successor build uploaded.
- **Why:** Solo tester. If the only TestFlight build expires while Grace is heads-down on code, the cohort lapses for hours/days. Mid-Phase-1 this is annoying. Mid-Phase-3 (after public launch) it's still a coverage gap for the beta channel.
- **Implementation sketch:** Vercel cron route hitting App Store Connect API for build list, filter `expirationDate < now + 7d`, email when one is hit and no newer build exists.
- **Status:** Not yet wired.

---

## How to test all 6 alarms in one afternoon

This is the **dry run script** for Grace's dashboard session. Order chosen so the cheapest tests come first (no live entitlement risk) and the most disruptive last.

**Setup:** open a tab per vendor. Have the test email account (`gracehowse@outlook.com`) inbox visible.

### Step 1 — Sentry (Alarms 1 + 2)

1. Open Sentry → Suppr web project.
2. **Alerts → Create Alert**.
   - Type: **Issue Alert**.
   - Conditions:
     - "A new issue is created"
     - OR "The issue is seen more than `50` times in `1 hour`"
   - Action: **Send a notification to a member** → `gracehowse@outlook.com`.
   - Save.
3. **Settings → Subscription → Spend Notifications**.
   - Add 70% threshold notification → `gracehowse@outlook.com`.
4. **Validate Alarm 1:** add `throw new Error("alerting-canary-1");` to `app/api/_health/route.ts`, deploy to a preview branch, hit the URL once. Email should arrive within 2 minutes.
5. **Validate Alarm 2:** temporarily set spend threshold to 1%, trigger one event with the same throw. Email lands. Restore to 70%.
6. Remove the temporary throw, redeploy, mark canary issue as resolved in Sentry.

### Step 2 — PostHog (Alarm 3)

1. PostHog → **Organization settings → Billing**.
2. **Usage Alerts → Add Alert**.
   - Product: **Product analytics events**, threshold 70%, route `gracehowse@outlook.com`.
   - Product: **Session replays**, threshold 70%, route `gracehowse@outlook.com`.
3. **Validate:** set events threshold to 1% temporarily; PostHog re-evaluates usage on a daily roll-up — to force-fire, contact PostHog support or wait for next eval. Cheaper test: confirm the email-route end-to-end by triggering a different PostHog email (e.g. team-invite to yourself); if that delivers, the project's email route works.
4. Restore to 70%.

### Step 3 — Stripe (Alarm 4)

1. Stripe dashboard → **Developers → Webhooks → [production endpoint]**.
2. **Notifications** tab → enable "Notify me when webhook events fail" → confirm route is gracehowse@outlook.com (Stripe uses the account-level notification email; confirm under **Settings → Notifications**).
3. **Validate (CAREFUL):**
   - In Vercel, temporarily set `STRIPE_WEBHOOK_SECRET` to a deliberately wrong value (e.g. append `-BAD`). **Redeploy.**
   - In a terminal: `stripe trigger checkout.session.completed` (uses Stripe CLI — install if missing).
   - The handler will 401 the signature check → Stripe records a delivery failure.
   - Repeat 3 times to hit the consecutive-failure threshold.
   - **Restore the real secret immediately**, redeploy.
   - Manually replay any missed live events from Stripe dashboard.
4. Email lands within ~15 min.

### Step 4 — Vercel (Alarm 5)

1. Vercel dashboard → Suppr project → **Settings → Notifications** (Pro plan exposes function-error alerts under Observability).
2. **Add alert:** Function errors > 2% over 5 minutes → gracehowse@outlook.com.
3. **Validate:** deploy a preview branch with a deliberately-throwing API route (re-use Alarm 1's canary), then loop 100x:
   ```sh
   for i in {1..100}; do curl -s -o /dev/null "https://<preview>.vercel.app/api/_health"; done
   ```
4. Email lands within ~10 min.
5. Remove canary route, redeploy.

### Step 5 — Supabase advisor (Alarm 6)

1. Today this is a **manual weekly poll**:
   ```
   mcp__claude_ai_Supabase__get_advisors { type: "security" }
   mcp__claude_ai_Supabase__get_advisors { type: "performance" }
   ```
2. Add a recurring calendar reminder: **every Monday 09:00**, run the two queries. Send email-to-self if any critical findings.
3. **Cron-poll candidate** logged as follow-up: `app/api/cron/supabase-advisors/route.ts` hitting Management API, scheduled via `vercel.json` `crons`. Out of scope for the current PR.

### Step 6 — End-to-end sanity sweep

After all 5 alarms have been deliberately fired at least once:

- Confirm 5 emails landed in `gracehowse@outlook.com` (one per alarm).
- Confirm no canary code remains in production (`grep -r "alerting-canary" .` returns nothing).
- Confirm `STRIPE_WEBHOOK_SECRET` matches Stripe's stored secret.
- Confirm temporary thresholds restored.
- Mark Phase 1 row 6 + Phase 2 row 22 of [`docs/launch/checklist.md`](../launch/checklist.md) as `Verified <date>`.

**Time budget:** 90 minutes if everything works first try; allow 3 hours for vendor-UI hunting on first pass.

---

## Failure modes & runbook

| Symptom | Cause | Fix |
|---|---|---|
| Sentry alarm rule exists but emails never arrive | The Sentry "Issue Owners" or "Team" route hasn't been mapped to gracehowse@outlook.com | Sentry → Settings → Account → Notifications → confirm email is verified and "Alerts" toggle is on |
| Stripe webhook failure email doesn't arrive after deliberate failure | Account-level notifications disabled, or test-mode endpoint instead of live | Confirm the failure was on the **live** endpoint (test-mode endpoint failures don't email by default). Settings → Notifications → toggle "Failed webhook deliveries" |
| Vercel function-error alert never fires | Vercel plan tier doesn't include function alerting | Upgrade to Pro, or add a synthetic Sentry-based alarm: tag every `/api/*` 5xx with a Sentry breadcrumb and rely on Alarm 1 |
| PostHog 70% alert seems delayed | PostHog usage alerts evaluate on a daily roll-up, not real-time | Expected. The 70% threshold gives a working week of headroom, so a 24h evaluation delay is acceptable |
| Supabase advisor returns no findings but RLS is provably broken | Advisor lints aren't exhaustive — they catch a known class of issues, not all | Cross-reference with `docs/supabase-rls-checklist.md` for manual review |

---

## Related

- [Launch checklist](../launch/checklist.md) — Phase 1 row 6/7, Phase 2 row 22/23
- [Observability](../observability.md) — Sentry/PostHog wiring overview
- [RevenueCat webhook runbook](./revenuecat-webhook-runbook.md) — sister webhook runbook (RC has its own delivery-failure alert in the dashboard; mirror the Stripe procedure under Alarm 4)
- [Decisions log — 2026-05-13 tooling stack](../decisions/2026-05-13-tooling-stack-linear-sentry-qodo.md) — context on Sentry being already wired
- Production-readiness audit (2026-05-14) — Blocker 1 origin
