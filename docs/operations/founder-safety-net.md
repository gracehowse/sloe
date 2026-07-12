# Solo-founder safety net

**Owner:** Grace
**Status:** Blocker 6 of the [2026-05-14 production-readiness audit](../decisions/2026-05-14-production-readiness-audit-verdict.md) — deadline **2026-06-15**
**Last updated:** 2026-06-02
**Linear:** ENG-514

Suppr is a one-person operation. Every vendor portal (Apple, Stripe, Supabase, Vercel, GitHub, RevenueCat, PostHog, Sentry, Cloudflare) is a single point of failure: if Grace loses her laptop, her phone, or 7 days, there is currently no documented way for anyone — including future-Grace — to recover access or keep the lights on. This doc closes that gap.

It deliberately contains **no secrets**. Secrets live in the vault (§1). This file documents *where things are* and *what to do*, so it can safely live in the repo.

---

## 1. Recovery vault inventory

Pick one vault and put **everything** in it. Recommended: **1Password** (has a printable Emergency Kit + secure document storage + an Emergency-Access "trusted contact" feature). Bitwarden Emergency Access is the free-tier alternative.

For each system below, the vault must hold: the login, the TOTP/2FA seed (or backup codes), and any account-recovery codes. **The vault recovery key itself must be printed and stored physically** (a fireproved box / a sealed envelope with the trusted contact) — a password manager you can't get back into is not a safety net.

| System | What's catastrophic to lose | Must be in vault |
|---|---|---|
| **Apple / App Store Connect** | The app itself; can't ship builds | Apple ID + 2FA recovery key + App-Store-Connect API key (`.p8` + key id + issuer id) |
| **Stripe** | Billing; customer money | Login + 2FA backup codes + restricted API keys |
| **Supabase** | The database | Login + 2FA + DB password + service-role key + project ref |
| **Vercel** | Web hosting | Login + 2FA + deploy token |
| **GitHub** | All source code | Login + 2FA recovery codes + a PAT scoped for emergency push |
| **RevenueCat** | Mobile entitlements | Login + 2FA + secret API key + webhook signing secret |
| **PostHog** | Analytics + flags + session replay + **the DR kill-switch flag** | Login + personal API key + project id |
| **Sentry** | Error monitoring | Login + 2FA + auth token |
| **Cloudflare** (DNS) | The domain resolves | Login + 2FA + API token |
| **Domain registrar** | The domain itself | Login + 2FA + registrar auth/EPP code |
| **Upstash (Redis)** | Rate limiter (fails closed without it — [ENG-668]) | Login + REST URL + REST token |

> **Cross-check:** the live secret values for the *app* (not the portals) are in Vercel env + `apps/mobile` EAS secrets + `.env.local`. The vault stores the *portal* credentials needed to regenerate them. Both layers matter.

**Action (Grace):** populate the vault, print the Emergency Kit + vault recovery key, store the physical copy securely. Tick the Linear box when done.

---

## 2. Trusted contact

A single trusted person who can (a) reach the physical recovery key and (b) is briefed on what to do if Grace is unreachable for >7 days.

- **Who:** _[Grace to name]_
- **What they hold:** sealed physical copy of the vault recovery key (or 1Password Emergency Access / Bitwarden Emergency Access configured with a 48h wait).
- **Briefed on:** how to open the vault, who to contact (this doc), and the "Grace offline" playbook in §4.
- **Not expected to operate the product** — only to preserve access and, if needed, post the holding comms in §4.

**Action (Grace):** identify + brief the contact, configure conditional vault access. Tick the Linear box.

---

## 3. TestFlight build-expiry monitor

TestFlight builds **auto-expire after 90 days** ([DR runbook S6](../runbooks/disaster-recovery.md)). If the only green build expires with no replacement, there is no install path and (for a wider cohort) no rollback target.

- **Policy:** always keep a build no older than ~75 days promoted. Ship or re-archive before the cliff.
- **Reminder:** recurring calendar event "Suppr TestFlight build-expiry check" set 2026-06-02 (every 60 days) — re-up the build well inside the 90-day window.
- **Better (later):** automate via the App Store Connect API (`GET /v1/builds` → `expirationDate`) in a weekly cron that pings if the newest build expires within 21 days. Tracked as a follow-up, not blocking.

---

## 4. "Grace offline 7 days" playbook

The bet: the product **degrades gracefully on its own** for the four most likely incidents, so 7 days offline is survivable without manual ops. This section states what's automatic vs what the trusted contact may need to do. Full procedures live in the linked runbooks.

### 4a. Stripe webhook fails
- **Symptom:** subscriptions not activating/cancelling on web; `stripe_webhook_events` stops growing; Sentry/alerting fires ([alerting runbook](alerting.md)).
- **Automatic:** two layers. (1) Stripe **retries failed webhooks for up to 3 days** with backoff — a transient outage self-heals. (2) For a webhook missed *beyond* that window, the **entitlement-reconciliation cron** (`/api/cron/entitlement-reconcile`, every 6h — ENG-1463/1437) compares Stripe's canonical subscription state against `profiles.user_tier` and auto-corrects the safe direction (granting a tier a customer has paid for). It fires a Sentry alert on every correction, since a correction means a webhook was missed. Stripe is the canonical source of truth — no data is lost, only our denormalised mirror lags, and now it self-repairs.
- **Manual (only if the cron also can't resolve it — e.g. a *downgrade* it flagged but did not auto-apply):** the cron surfaces downgrade candidates to Sentry rather than auto-applying them (a canceled-Stripe user may be a legitimate App Store subscriber). Confirm the user has no active entitlement on either rail, then correct in Supabase, or replay from the Stripe dashboard per the [Stripe webhook replay runbook](stripe-webhook-replay-runbook.md) (idempotent, safe to do late).
- **Trusted-contact action:** none. This can wait for Grace.

### 4b. RevenueCat webhook fails
- **Symptom:** mobile entitlements (`profiles.user_tier`) not updating after purchase; `revenuecat_events` stalls.
- **Automatic:** RevenueCat **retries webhooks** with backoff. That is the only automatic recovery.
- **History (2026-07-06):** this section previously claimed the app "re-syncs entitlement state from RC on launch, so a missed webhook self-corrects on the user's next open." That was **not true** — `syncTierToSupabase` (`apps/mobile/lib/purchases.ts`) attempts exactly that client-side write, but `profiles.user_tier` is client-write-locked since the tier-lockdown migration (ENG-1035-era hardening); the write is rejected with `42501` and the code's own comment says so ("Tier sync arrives via RevenueCat webhook (T6)"). Caught while evaluating ENG-1433 (launch-sequencing decision, 2026-07-06).
- **Reconciliation (2026-07-10, ENG-1463/1437):** the **entitlement-reconciliation cron** (`/api/cron/entitlement-reconcile`, every 6h) is now built. Its **Stripe** half is complete and reconciles Stripe drift server-side. Its **RevenueCat** half is **not yet built** — it needs an outbound RC REST secret key that is not yet provisioned (tracked in ENG-1463). So for the RC/App Store rail specifically, there is still no automated reconciliation today; RC's own webhook retries are the only automatic recovery until the RC half ships. This is not launch-blocking: TestFlight purchases clear through Apple's sandbox (no real money on the RC rail yet), so the paying-customer-stranded risk currently lives entirely on the Stripe rail, which *is* reconciled. See `docs/decisions/2026-07-10-entitlement-reconciliation-cron.md`.
- **Manual (until the RC half ships):** replay per the [RevenueCat webhook runbook](revenuecat-webhook-runbook.md), or manually correct the affected user's tier in Supabase once identified.
- **Trusted-contact action:** none (this one needs Grace or an engineer, not just the contact).

### 4c. AI quota burns (LLM spend spike)
- **Symptom:** recipe-import / photo-log / voice-log start failing with quota errors; LLM cost dashboard spikes.
- **Automatic:** these features fail **closed and gracefully** — the user sees an error and can fall back to manual entry; no data corruption, no runaway billing of the *user*. The rate limiter ([Upstash, ENG-668](../../)) caps abuse.
- **Manual:** if a provider key is exhausted, the feature stays down until Grace tops up / rotates the key — an acceptable 7-day degradation (core logging/tracking is unaffected; only the AI conveniences pause).
- **Trusted-contact action:** none (don't hand an LLM billing key to the contact).

### 4d. Supabase down / database incident
- **Symptom:** the whole product is unavailable; Supabase status page shows an incident, or a data incident is suspected.
- **Automatic:** nothing — this is the one scenario with no auto-recovery (single-region, free plan, see [PITR posture](../decisions/2026-06-01-pitr-posture.md)).
- **The one button the trusted contact CAN press:** flip the **`dr-full-outage-banner`** PostHog flag ON to tell users "we're temporarily down" (the kill-switch banner is built and live on web + mobile — [DR runbook row 7](../runbooks/disaster-recovery.md)). Copy is editable from the flag payload. This buys goodwill without touching the database.
- **Manual recovery (Grace, or a technical contact):** the full restore procedure is [DR runbook S2/S7](../runbooks/disaster-recovery.md). Do **not** attempt a blind restore — follow the runbook.

> **Bottom line for a 7-day absence:** 4a/4b/4c self-heal or degrade safely; only 4d (full DB loss) genuinely needs Grace — and even then the trusted contact can raise the outage banner to hold the line. (Caveat: 4b's *automated* self-heal covers the Stripe rail via the reconciliation cron; the RevenueCat rail still relies on RC's own webhook retries until the cron's RC half ships — ENG-1463. Not a 7-day-absence risk while the RC rail can't take real money.)

---

## 5. Status checklist (mirror of ENG-514 done-criteria)

- [x] `docs/operations/founder-safety-net.md` written (this file) — 2026-06-02
- [ ] Recovery codes stored in a documented vault (Grace — §1)
- [ ] Trusted contact identified, briefed, conditional access (Grace — §2)
- [x] TestFlight build-expiry calendar reminder set — 2026-06-02 (§3)
- [x] One-page "Grace offline 7 days" playbook (§4)

When the two Grace-only boxes are ticked, Blocker 6 can flip to **Closed** in the [audit verdict](../decisions/2026-05-14-production-readiness-audit-verdict.md).

---

## Related

- [Disaster recovery runbook](../runbooks/disaster-recovery.md)
- [PITR posture decision](../decisions/2026-06-01-pitr-posture.md)
- [Alerting runbook](alerting.md)
- [Stripe webhook replay runbook](stripe-webhook-replay-runbook.md)
- [RevenueCat webhook runbook](revenuecat-webhook-runbook.md)
- [Production-readiness audit verdict](../decisions/2026-05-14-production-readiness-audit-verdict.md)
