# Decision — EMAIL-01 vendor selection (deferred)

**Date:** 2026-04-28
**Area:** Engineering / Ops
**Status:** Open (deferred to vendor-selection round)

> **Update 2026-07-01 (ENG-1289):** the six auth templates + config.toml
> subjects were rebranded Suppr → Sloe (plum wordmark `#3B2A4D` mirroring
> `--foreground-brand`; the blue→magenta gradient described below is
> retired). Guarded by `tests/unit/brandDriftSloe.test.ts`. Applying to
> the live mailer requires `supabase config push --project-ref
> fnfgxsignmuepshbebrl` post-merge. Link hosts stay `suppr-club.com`
> until the domain cutover. Step 3's "inherit the auth-template
> aesthetic (gradient wordmark)" should now read the Sloe plum treatment.

## What's done

EMAIL-01 partial closure shipped 2026-04-28 (commits `5d72203`,
`dfc7b39`). Six branded HTML templates for the **Supabase Auth**
mailer pipeline live at `supabase/templates/*.html` (canonical) +
`docs/emails/supabase-auth/*.html` (human reference), wired into
`supabase/config.toml` `[auth.email.template.*]` blocks, pushed to
the linked Supabase project (`fnfgxsignmuepshbebrl`):

- Confirm signup (`Confirm your Suppr account`)
- Reset password (`Reset your Suppr password`)
- Magic link (`Your Suppr login link`)
- Change email (`Confirm your new email address`)
- Invite (`You're invited to join Suppr`)
- Reauthentication (`Confirm a sensitive change to your Suppr account`)

These cover every email Supabase Auth emits today. The "default
Supabase emails are scammy on first signup" finding from the Phase 6
audit is closed for the auth flow.

## What's still open

The custom transactional emails the audit listed are NOT shipped
because they need a vendor before code can ship:

- **Trial ending** — fires N days before the Pro annual trial
  converts to a paid renewal. Stripe webhook → app-side dispatch.
- **Subscription confirmation / changed / cancelled** — Stripe
  webhook → app-side dispatch.
- **Weekly digest** — scheduled cron → app-side dispatch.
- **Plan-build failed** — onboarding-completion failure path that
  currently writes a query string `?plan_build=failed` and surfaces
  a toast on Today; should also email the user with retry guidance.
- **Account deletion confirmed** — receipt the user has typed
  `delete` in the prompt and the deletion ran.

## Why deferred

Selecting a vendor is a strategic call that touches:
- **Cost** — per-email pricing, free-tier ceiling, monthly
  commitment. Resend / Postmark / SendGrid / SES all price
  differently across volume bands.
- **Reliability** — deliverability score, bounce handling, IP
  reputation, region hosting (UK GDPR posture matters for PII
  in welcome emails).
- **Operational footprint** — DKIM/SPF/DMARC setup, custom domain
  (`mail.suppr-club.com` vs `noreply@suppr-club.com`), template
  build pipeline (React Email / MJML / hand-rolled HTML).
- **Legal** — unsubscribe handling for the digest stream (transactional
  emails like Confirm / Reset don't need it; the digest does), GDPR
  art. 13 footer, sender identification.

Per memory `feedback_specialist_agents.md`, vendor selection routes
to `monetisation-architect` (cost / billing surface) +
`integration-manager` (vendor reliability and SDK fit) +
`brand-manager` (template voice) + `legal-reviewer` (unsubscribe
copy + GDPR posture). Main thread doesn't ship a vendor.

Per memory `feedback_no_quick_temp_fixes.md`, no temp vendor — the
right answer ships once and survives. Temporarily wiring the digest
to Supabase's default SMTP relay (which caps at ~30/hr) and then
ripping it out for a real vendor is exactly the temp-fix this rule
forbids.

## Trigger conditions for the next round

Pick this up when **any** of these hits:

1. First Pro trial fires (currently 0 — solo tester pre-launch).
   The trial-ending email is the highest-stakes piece because the
   user is about to be charged.
2. First subscription event lands in Stripe production (today: 0).
3. Beta-tester wave > 1 user. Solo tester (Grace) doesn't need a
   weekly digest yet; multi-user TestFlight does.
4. Marketing-launch readiness review — the digest is part of the
   activation loop and should not ship to a launched product.

## Concrete next-step (when triggered)

1. Run `monetisation-architect` agent: vendor cost analysis at
   100 / 1k / 10k emails/month bands. Output: ranked recommendation.
2. Run `integration-manager` agent: vendor SDK fit for Next.js
   (server actions / app router) + Supabase webhook plumbing
   pattern. Output: integration plan.
3. Run `brand-manager` + `legal-reviewer` in parallel: template
   voice + footer. Inherit the auth-template aesthetic
   (`docs/emails/supabase-auth/*.html`) — gradient wordmark,
   600px column, single CTA, plaintext fallback, footer with
   privacy link + privacy@suppr-club.com.
4. Executor builds:
   - `src/lib/email/<vendor>Client.ts` — typed wrapper around the
     vendor SDK.
   - `src/lib/email/templates/*.tsx` (or `.mjml`) — one per email
     kind.
   - `app/api/email/<event>/route.ts` — server endpoints called by
     Stripe webhooks / cron / app-side dispatch.
   - `tests/integration/email/<event>.test.ts` — assert the right
     template fires with the right context for each event.

## Operational follow-up Grace owns

Independent of vendor choice:

- Configure custom SMTP in Supabase Dashboard so production volume
  isn't capped at the free-relay's ~30/hr. Currently the auth
  templates above route through Supabase's default SMTP — fine
  for solo-tester volume, not fine for any beta wave.
- DKIM + SPF + DMARC for `suppr-club.com` (independent of vendor —
  needed regardless to keep the auth templates out of spam).
- Add the chosen vendor to the Notion **Vendors & subscriptions**
  database with category, plan, monthly cost, renewal, critical
  flag, URL.

## Notion mirror

- Roadmap row: "EMAIL-01 follow-up — Custom transactional emails
  (vendor selection)" — state Open, target "Pre-launch" (already
  exists, mirrored 2026-04-28).
- Decisions log row for this file (already mirrored 2026-04-28).
