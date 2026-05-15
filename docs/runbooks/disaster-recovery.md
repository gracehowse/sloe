# Disaster recovery — ops runbook

**Owner:** Grace
**Status:** Blocker 2 of [2026-05-14 production-readiness audit](../decisions/2026-05-14-production-readiness-audit-verdict.md) — Phase 1 deadline **2026-06-01**
**Last updated:** 2026-05-14
**Supersedes:** the implicit posture of "Supabase has backups, we'll figure it out" — that was acceptable at N=1 TestFlight, not at Phase 1 public traffic.

The 2026-05-14 production-readiness audit found:
- no DR runbook (this file closes that)
- backup posture **unverified** in the Supabase dashboard
- PITR window **not declared** (free-tier daily backups vs paid PITR delivers RPO=24h vs RPO≤5min — Grace must confirm which plan is live)
- **no rehearsed restore** — a restore that has never been rehearsed is a restore that doesn't exist

This runbook closes the runbook gap. The verification + rehearsal items are checklisted in § Pre-Phase-1 checklist at the bottom — they are Grace-only actions that cannot be completed in-repo.

---

## Scope

What this runbook covers — every persistent asset whose loss would be revenue-affecting, user-affecting, or recovery-time-affecting:

1. **Postgres data** — Supabase managed Postgres. The product's source of truth (profiles, user_foods, recipes, plans, log entries, stripe_webhook_events, revenuecat_events, all RLS-protected user data).
2. **Storage buckets** — Supabase Storage. User uploads: recipe photos, meal photos, avatar images.
3. **Edge functions** — Supabase Edge Functions code. Source of truth lives in the repo (`supabase/functions/`); deployed copy lives in Supabase. Both must exist.
4. **Vercel deploys** — web app deployment history. Immutable per-commit deploys; rollback target.
5. **Mobile TestFlight builds** — iOS bundle archives. 90-day TestFlight expiry — old builds drop off.
6. **Stripe data** — subscription state, customer records, invoice history. Lives in Stripe; we hold a denormalised view in `profiles.stripe_customer_id` + `stripe_webhook_events`.
7. **RevenueCat data** — entitlement state, transaction history. Lives in RevenueCat; we hold a denormalised view in `profiles.user_tier` + `revenuecat_events`.

What this runbook does **not** cover:
- Vercel project settings / env vars (manual snapshot via Vercel CLI export quarterly — flagged as follow-up).
- DNS records (Cloudflare zone backups via export — flagged as follow-up).
- PostHog / Sentry / Linear / Notion data (vendor-held, vendor-recoverable, not on critical path).

---

## Backup posture

| Asset | Provider | Backup type | Frequency | Retention | RPO | RTO | Verified? |
|---|---|---|---|---|---|---|---|
| Postgres data (free tier) | Supabase | Daily logical backup | Once daily, vendor-scheduled | 7 days rolling | 24h | 4–8h (best effort, never rehearsed) | **VERIFICATION REQUIRED — Grace check production plan in Supabase dashboard** |
| Postgres data (Pro/Team tier) | Supabase | PITR (continuous WAL) | Continuous | Plan-dependent (7 / 14 / 28 days) | ≤5min | 1–4h (best effort, never rehearsed) | **VERIFICATION REQUIRED — Grace confirm if PITR add-on enabled** |
| Storage buckets | Supabase | None native (free or Pro) — relies on Postgres metadata + object durability | n/a | n/a | Unbounded if object deleted | Per-object best-effort | **VERIFICATION REQUIRED — see S3 below** |
| Edge functions code (canonical) | GitHub (repo) | Git history | Per commit | Forever | 0 | 0 (redeploy from `main`) | Yes — repo is authoritative |
| Edge functions code (deployed) | Supabase | Vendor-held copy | Per deploy | Latest only | n/a | 5–10min via `supabase functions deploy` | Yes |
| Vercel deploys | Vercel | Immutable deployment history | Per commit | Forever (Pro plan), 30d (Hobby) | 0 | <60s via "Promote to Production" | Yes |
| Mobile TestFlight builds | App Store Connect | TestFlight build archive | Per upload | **90 days then auto-expire** | n/a | 30–60min (re-archive + upload) | Partial — older builds drop off |
| Stripe data | Stripe | Vendor-owned | Continuous | Forever | n/a | n/a — Stripe is canonical | Yes (vendor SLA) |
| RevenueCat data | RevenueCat | Vendor-owned | Continuous | Forever | n/a | n/a — RC is canonical | Yes (vendor SLA) |

**Notes on the Postgres rows.** Supabase free-tier projects get **daily logical backups with 7-day retention** as a vendor-managed default. PITR (point-in-time recovery) is a paid add-on that buys you continuous WAL replay back to any second within the retention window. Without PITR, your RPO is **24 hours** — anything created today between the last nightly backup and the failure event is gone. With PITR, your RPO is **≤5 minutes** (WAL lag plus archive cadence). The audit verdict (2026-05-14) flagged this as the load-bearing posture decision before Phase 1 public traffic — see § Pre-Phase-1 checklist.

**Notes on Storage.** Supabase Storage does NOT have an opt-in object-versioning or cross-region replication setting today. If a user (or a bug) deletes an object, the bytes are gone. The Postgres `storage.objects` metadata row is captured in nightly Postgres backups, but the bytes are not. **Mitigation candidate — pre-Phase-1 decision:** for user-facing critical buckets (`recipe-photos`, `meal-photos`), set up a one-way mirror to an external S3-compatible store (Backblaze B2 or Cloudflare R2) via a nightly cron. Cost estimate: ~£2/month for current volume. Tracked as follow-up in § Pre-Phase-1 checklist row 6.

---

## Scenarios + response procedures

Each scenario lists: trigger, blast radius, response, comms. Procedures use exact CLI / SQL where possible. The rule across every scenario: **never restore directly over `public`**. Always restore to a scratch namespace, diff, then surgical write.

### S1 — Single-table corruption

**Trigger:** a deploy or a bad UPDATE wipes/mangles rows on one table (e.g. `user_foods` truncated by a missing `WHERE`). Sentry surfaces a 5xx surge; Supabase logs show the offending statement.

**Blast radius:** that one table. Other tables intact.

**Response:**

1. **Stop the bleed.** If a deploy caused it, rollback in Vercel (see S5) so the broken code path stops writing further. If it was a manual SQL ad-hoc, that's done by definition.

2. **Restore the table to a scratch schema, NOT to public.**

   **With PITR (paid):**
   ```bash
   # Supabase dashboard route — preferred
   # 1. Open Supabase dashboard → Project → Database → Backups
   # 2. Click "Restore" → "Point in time" → pick T_just_before_corruption
   # 3. Select "Restore to a new project" (NOT in-place). This creates
   #    a sibling project at the chosen timestamp.
   # 4. Use that sibling project's connection string as the source for
   #    a logical dump of just the affected table:
   pg_dump \
     --host=<sibling-project-host> \
     --port=5432 \
     --username=postgres \
     --dbname=postgres \
     --schema=public \
     --table=user_foods \
     --no-owner \
     --no-acl \
     --file=/tmp/user_foods_pitr.sql

   # 5. Restore that dump into the live project under a scratch schema:
   psql "$LIVE_DB_URL" -c "create schema if not exists dr_scratch;"
   psql "$LIVE_DB_URL" -v ON_ERROR_STOP=1 \
     -c "set search_path = dr_scratch;" \
     -f /tmp/user_foods_pitr.sql
   ```

   **Without PITR (free-tier daily backup):**
   - Open Supabase dashboard → Project → Database → Backups → pick the most recent daily backup before corruption.
   - Click "Restore" → "Restore to a new project". Same flow as above; the source data is just up-to-24h-stale.

3. **Diff the scratch table against live.**
   ```sql
   -- Counts:
   select count(*) as scratch_rows from dr_scratch.user_foods;
   select count(*) as live_rows from public.user_foods;

   -- Rows present in scratch but missing in live (the corruption gap):
   select s.id, s.* from dr_scratch.user_foods s
   left join public.user_foods l on l.id = s.id
   where l.id is null
   limit 100;

   -- Rows where columns differ (the corruption mutation):
   -- (Build per-column comparison as needed.)
   ```

4. **Surgical re-insert or column patch.** For the missing-rows case:
   ```sql
   insert into public.user_foods (col_a, col_b, ...)
   select col_a, col_b, ... from dr_scratch.user_foods s
   where not exists (select 1 from public.user_foods l where l.id = s.id);
   ```
   For the mutated-rows case: `update ... from dr_scratch.user_foods ... where ...`.

5. **Drop the scratch schema:** `drop schema dr_scratch cascade;`

6. **Comms.** If the corruption was user-visible: post a 2-line in-app banner via the kill-switch flag (`dr_user_banner`); send an email to all affected users (filter by who had rows in the gap). Body template at § Comms templates.

**Rule:** never `delete from public.user_foods where ...` followed by `insert ... from scratch` — primary-key collisions and trigger side-effects make this brittle. Prefer the `not exists` insert + per-row update pattern.

### S2 — Full database loss

**Trigger:** the entire Supabase Postgres instance is unrecoverable (vendor reports total project loss, or destructive `drop database` from a leaked service-role key, or unrecoverable schema migration cascade).

**Blast radius:** the whole product. Auth, profiles, recipes, plans, logs — all of it.

**Response:**

1. **Comms first.** This is the public-incident scenario. Within 15 minutes:
   - Post an in-app banner via the kill-switch flag: "Suppr is temporarily down. We're restoring data from backup. Updates at status.suppr.club." (Flag: `dr_full_outage_banner`. **Pre-Phase-1 follow-up:** the flag exists in `isFeatureEnabled` but no banner component renders it. See checklist row 7.)
   - Post on status.suppr.club / X / Instagram. Template at § Comms templates.

2. **Restore the project.**
   - Supabase dashboard → Project → Database → Backups → pick the most recent backup (or PITR timestamp).
   - "Restore to a new project" (Supabase does not currently support in-place full-DB restore on the free tier; on Pro/Team, in-place is available — confirm in the dashboard at the time, the UI changes).
   - This creates a new project at `<new-ref>.supabase.co` with the restored data.

3. **Repoint the app.**
   - Vercel → Settings → Environment Variables → update `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the new project values.
   - Update `apps/mobile/lib/supabase.ts` config — but mobile builds are stuck on the previous URL until a new TestFlight build ships. **This is the load-bearing constraint for mobile recovery.** Plan: ship an emergency TestFlight build with the new URL the same day. RTO for mobile is bottlenecked by App Store review (~10 min for TestFlight builds in 2026).

4. **Verify auth migration.** Supabase auth users carry over with the project restore. Smoke-test login on web before announcing recovery.

5. **Update DNS / domain mapping if changed.** Supabase domain mapping (`api.suppr.app`) must be re-attached to the new project.

6. **Drop the banner; post recovery comms.**

**RTO target:** 4–8h best-effort. **This has never been rehearsed end-to-end.** See § Pre-Phase-1 checklist.

### S3 — Storage bucket corruption

**Trigger:** files in a Supabase Storage bucket are deleted, overwritten, or corrupted. Could be a deploy bug, a bad client write, or accidental dashboard action.

**Blast radius:** the user-uploaded media for affected rows. Metadata in `storage.objects` is restorable from the Postgres backup (per S1); the **bytes are not**.

**Response — today (no mirror exists):**

1. Check the Postgres backup `storage.objects` rows for the corrupted bucket. You can confirm what _should_ be there but not retrieve the bytes.
2. If a specific user reports it: ask them to re-upload. Apologise.
3. Open a Linear P0 to triage — every storage object lost without mirror is real user-data lost.

**Response — once mirror is set up (see follow-up):**

1. Identify affected object keys via `storage.objects` diff vs the mirror manifest.
2. For each key: download from mirror, re-upload to Supabase via `supabase storage cp`.
3. No comms needed if mirror RPO < user retry window.

**Decision pending Phase 1:** set up the nightly S3/B2 mirror or accept the per-object-best-effort posture. Strongly recommend the mirror — ~£2/month is cheap insurance for user-uploaded photos.

### S4 — Wrong migration applied

**Trigger:** a migration was applied (either to dev or production) that destroyed data, mangled a constraint, or rolled the project into an invalid state.

**CRITICAL — read first:** per [`CLAUDE.md`](../../.claude/CLAUDE.md) Non-negotiable rules:

> **Never apply Supabase migrations via MCP `apply_migration` for files committed to `supabase/migrations/`.** MCP rewrites `schema_migrations.version` to wall-clock NOW(), causing drift from file timestamps (which are sometimes deliberately future-dated for monotonic ordering). Stage the SQL file and ask Grace to run `supabase db push --linked`. Same forbidance applies to Dashboard "Save as migration".

If S4 happened because MCP `apply_migration` was used, the recovery path is **fixing the `schema_migrations` table** in addition to undoing the change.

**Response:**

1. **Capture the current state of `schema_migrations` BEFORE doing anything.**
   ```sql
   select version, name, statements
   from supabase_migrations.schema_migrations
   order by version desc
   limit 20;
   ```
   Copy this to a scratch file (`/tmp/dr-schema-migrations-pre-rollback.txt`).

2. **Write the down-migration.** Every migration in `supabase/migrations/` should have a paired `_revert.sql` either inline (DROP-IF-EXISTS pattern) or as a sibling file. If a paired revert doesn't exist for the bad migration, write it now in `supabase/migrations/YYYYMMDDHHMMSS_revert_<slug>.sql`. The revert should fully undo: DROP added objects, restore dropped columns from PITR (per S1), and re-apply previous constraints.

3. **Apply the revert via `supabase db push --linked`.** NOT via MCP `apply_migration`. NOT via Dashboard "Save as migration".

   ```bash
   cd /Users/graceturner/Suppr-1
   supabase db push --linked
   ```

4. **If MCP was used to apply the bad migration:** fix `schema_migrations.version` manually so future `db push` doesn't try to re-apply. Use the timestamp from the filename, not NOW():
   ```sql
   update supabase_migrations.schema_migrations
   set version = '20260514120000'  -- the actual filename timestamp
   where name = 'the_bad_migration_name';
   ```

5. **Verify.** Re-run the capture query from step 1; confirm `version` matches the filename timestamp. Confirm the schema is back to expected.

6. **Add a regression test.** If the bad migration shipped a schema invariant that was wrong, add a SQL-level check (CHECK constraint, trigger, or test query) so it can't happen silently again.

### S5 — Vercel deploy broken

**Trigger:** the latest production deploy is broken (5xx surge, blank pages, runtime errors). Sentry + Vercel function-error alarms (per [alerting runbook](../operations/alerting.md) Alarm 5) fire within ~5 minutes.

**Blast radius:** web only. Mobile is unaffected.

**Response — instant rollback:**

1. Vercel dashboard → Project → Deployments.
2. Find the latest known-good deploy (one above the broken one, marked "Promoted to Production").
3. Click the deploy → ⋯ menu → **Promote to Production**.
4. Vercel re-routes production traffic to the older immutable deploy within ~60 seconds.

5. **Confirm.** Hit `https://suppr.app/api/healthz` (or whatever the canonical health route is — check `/api/healthz` if it exists; if not, hit the homepage and confirm 200).

6. **Open a post-incident Linear P0** referencing the broken commit. Don't merge a forward-fix without root-causing — re-promote of the broken deploy is the same outage.

**Rollback is reversible** (the broken deploy is still in history; you can re-promote it after a fix). Vercel never deletes deploys on the Pro plan.

### S6 — Mobile build crashes on launch

**Trigger:** new TestFlight build ships, opens, crashes immediately. Sentry surfaces a `JS exception during root render` issue, or a native crash in the App Store Connect crash logs.

**Blast radius:** mobile only. Web unaffected. Cohort = N=1 (Grace) today, so usually low-stakes.

**Response — instant rollback:**

1. App Store Connect → My Apps → Suppr → TestFlight → builds list.
2. Find the previous known-good build.
3. Expire the broken build (set "Stop testing" on the broken row).
4. Existing TestFlight installs of the broken build won't auto-roll-back — affected users must manually open TestFlight and tap "Previous Build". (TestFlight does not have Vercel-style instant production-promote.) For Grace = redownload yourself; for any wider cohort, ship a quick comms note.

5. **Open a Linear P0** with the Sentry crash issue link + the build number that broke.

**Note:** TestFlight builds expire after 90 days. If a known-good build older than 90 days is needed, the cliff is real — there's no "older build" left. **Mitigation:** keep a fresh-enough green build always promoted (TestFlight allows multiple builds active simultaneously up to your tester limit). Tracked in checklist row 8.

### S7 — Supabase regional outage

**Trigger:** Supabase status page reports a regional outage (Supabase publishes incidents at status.supabase.com). Our project is single-region — when that region is down, we're down.

**Blast radius:** the entire product. No multi-region failover today.

**Response — accept the downtime:**

1. **No automatic failover.** Supabase free + Pro tiers do not offer multi-region replicas. Team tier offers read replicas but no automatic failover. Building app-level multi-region is out of scope for Phase 1.

2. **Comms within 15 minutes.**
   - Post in-app banner via the kill-switch flag (`dr_full_outage_banner`).
   - Post on status.suppr.club / X / Instagram. Tone: "We're temporarily down due to a Supabase outage. We're monitoring status.supabase.com and will update when restored."

3. **Monitor.** Refresh status.supabase.com every 15 minutes. When green, smoke-test login, then drop the banner.

4. **Post-mortem if outage > 2h.** Add to Linear as a tail-risk follow-up. Re-evaluate whether multi-region readiness should jump priority for Phase 1.

**Comms templates** for S2 / S7:

```
In-app banner (S2 — restoring):
"Suppr is temporarily restoring data from backup. We expect to be back online within a few hours. Thanks for your patience — Grace"

In-app banner (S7 — vendor outage):
"Suppr is temporarily down due to a Supabase outage. We're monitoring and will update at status.suppr.club."

Public post (S2 — full restore):
"We're working through an unexpected database issue and restoring from
backup. We'll have an update within the hour. If you need to reach us:
gracehowse@outlook.com."

Recovery post (any scenario):
"Suppr is back. If you notice anything weird about your data, reply to
this thread or email gracehowse@outlook.com — we'll check it."
```

---

## RPO / RTO targets vs delivery

| Asset | RPO target | RPO delivered | RTO target | RTO delivered | Gap |
|---|---|---|---|---|---|
| Postgres data (free tier) | ≤1h | 24h | 4h | Best effort, never rehearsed | Plan upgrade OR accept 24h RPO |
| Postgres data (with PITR) | ≤5min | ≤5min | 4h | Best effort, never rehearsed | Rehearse once |
| Storage buckets | ≤24h | Unbounded if deleted | 24h | Per-object best-effort | Mirror cron pre-Phase-1 |
| Edge functions code | 0 | 0 | <10min | <10min | None |
| Vercel deploys | 0 | 0 | <1min | <1min | None |
| Mobile builds | 0 (in repo) | 0 | <60min | <60min (re-archive + upload) | 90-day TestFlight expiry — keep current build live |
| Stripe data | n/a | n/a | n/a | n/a | None — vendor canonical |
| RevenueCat data | n/a | n/a | n/a | n/a | None — vendor canonical |

**Honest read:** RTO targets are aspirational until a real restore is rehearsed. Today, "4h" is a guess. The quarterly rehearsal protocol below converts the guess into a measurement.

---

## Quarterly rehearsal protocol

The rule: a restore that has never been rehearsed is a restore that doesn't exist.

**Cadence:** quarterly. Calendar reminder owned by Grace.

**Steps:**

1. **Create a DR rehearsal branch.**
   ```bash
   supabase branches create dr-rehearsal-$(date +%Y-%m-%d) --persistent=false
   ```
   This spins up a sibling Postgres with a copy of production data at the branch point. Costs accrue while the branch is alive — delete it at the end.

2. **Pick one scenario** from S1 / S2 / S4 above. Rotate scenarios each quarter so all three get tested over a year.

3. **Execute the procedure** against the rehearsal branch, NOT production. Time each step with a stopwatch.

4. **Record results** in the rehearsal log below — start time, end time, scenario, who ran it, what broke, what got fixed.

5. **Delete the branch** when done:
   ```bash
   supabase branches delete dr-rehearsal-<date>
   ```

6. **Update RTO targets above** based on measured times. The "delivered" column should track reality.

### Rehearsal log

Append-only. Newest at the top. Initial row left blank with a forward date — Grace fills on the first rehearsal.

| Date | Scenario | Operator | Wall-clock RTO | Issues hit | Notes / lessons |
|---|---|---|---|---|---|
| YYYY-MM-DD (target: first rehearsal before 2026-06-01) | _e.g. S1 — single-table corruption on `user_foods`_ | Grace | _hh:mm_ | _list_ | _per-step notes_ |

---

## Pre-Phase-1 checklist

These items must be closed by **2026-06-01** (per Blocker 2 deadline in the [audit verdict](../decisions/2026-05-14-production-readiness-audit-verdict.md)). Each item is a Grace-only action that cannot be completed in-repo.

- [ ] **Confirm Supabase plan + PITR availability.** Open Supabase dashboard → Project → Settings → Subscription. Note the plan (Free / Pro / Team) and whether PITR is enabled. Edit the "Postgres data" rows in § Backup posture above to match reality.
- [ ] **Document actual backup retention from the dashboard.** Supabase dashboard → Database → Backups → record the actual retention window the project is on (free = 7 days; PITR varies). Edit the table.
- [ ] **Rehearse one PITR restore to a scratch branch.** Use the protocol in § Quarterly rehearsal above. Time each step. Record in the rehearsal log.
- [ ] **Record rehearsal in the log table above.** First row replaces the placeholder.
- [ ] **Decide PITR upgrade vs accept 24h RPO; document in `docs/decisions/`.** Open `docs/decisions/YYYY-MM-DD-pitr-posture.md` capturing the decision + the cost trade-off. Reference back here.
- [ ] **Set up storage bucket mirror (or document accepting the gap).** Spike a Backblaze B2 or Cloudflare R2 mirror cron for `recipe-photos` and `meal-photos`. Cost: ~£2/month at current volume. If skipping, capture the decision in `docs/decisions/YYYY-MM-DD-storage-mirror.md`.
- [ ] **Build a `dr_full_outage_banner` component.** The flag is referenceable today via `isFeatureEnabled("dr-full-outage-banner")`, but there is no banner component that renders against it. Build it on web (`src/components/ops/DrOutageBanner.tsx`) and mobile (`apps/mobile/components/ops/DrOutageBanner.tsx`). Renders a top-of-app red banner with text fetched from a PostHog flag payload so copy can change without a deploy.
- [ ] **Keep a green TestFlight build always promoted.** Configure the EAS Update workflow so that whenever a new build is uploaded, the previous build stays at "Available" status for at least 14 days. Currently the previous build is sometimes manually expired — formalise the policy.
- [ ] **Quarterly calendar reminder.** Put a recurring quarterly event in Grace's calendar: "Suppr DR rehearsal". Owner: Grace.

When every box is checked, the Blocker 2 row of the audit can be flipped to **Closed** in [`docs/decisions/2026-05-14-production-readiness-audit-verdict.md`](../decisions/2026-05-14-production-readiness-audit-verdict.md).

---

## Related

- Audit verdict: [`docs/decisions/2026-05-14-production-readiness-audit-verdict.md`](../decisions/2026-05-14-production-readiness-audit-verdict.md)
- Alerting runbook: [`docs/operations/alerting.md`](../operations/alerting.md) (Blocker 1, same audit)
- Stripe webhook replay runbook: [`docs/operations/stripe-webhook-replay-runbook.md`](../operations/stripe-webhook-replay-runbook.md) (this PR — companion to S1)
- RevenueCat webhook runbook: [`docs/operations/revenuecat-webhook-runbook.md`](../operations/revenuecat-webhook-runbook.md)
- Launch checklist: [`docs/launch/checklist.md`](../launch/checklist.md) — Phase 2 row dependencies
- Project rule on migrations: [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) § Non-negotiable rules (S4 above cites this)
