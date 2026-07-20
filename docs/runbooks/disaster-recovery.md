# Disaster recovery — ops runbook

**Owner:** Grace
**Status:** Blocker 2 of [2026-05-14 production-readiness audit](../decisions/2026-05-14-production-readiness-audit-verdict.md) — Phase 1 deadline **2026-06-01**
**Last updated:** 2026-07-10 (ENG-1401) — nightly storage mirror **shipped** (`.github/workflows/storage-mirror.yml`, pending 5 repo secrets — see § Storage mirror). Stale bucket names corrected: the real buckets are `recipe-images` + `food-evidence` (the previously-named `recipe-photos`/`meal-photos` never existed in code). Live re-verification 2026-07-10: org still `free` plan → no PITR **and no managed daily backups**; `recipe-images` = 117 objects / ~50 MB. Plan decision still pending in [`docs/decisions/2026-06-01-pitr-posture.md`](../decisions/2026-06-01-pitr-posture.md) (ENG-1402).
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
| Postgres data (free tier) | Supabase | Daily logical backup | Once daily, vendor-scheduled | 7 days rolling | 24h | 4–8h (best effort, never rehearsed) | ✅ **VERIFIED 2026-06-01 — this is the live posture.** Org `pyeqbxhowqljzkzfmhsm` plan = `free` (Supabase MCP `get_organization`). Daily logical backup, 7-day retention, RPO 24h. |
| Postgres data (Pro/Team tier) | Supabase | PITR (continuous WAL) | Continuous | Plan-dependent (7 / 14 / 28 days) | ≤5min | 1–4h (best effort, never rehearsed) | ❌ **NOT ENABLED 2026-06-01.** PITR is a paid Pro+ add-on; project is on Free → PITR unavailable. The "with PITR" recovery paths below are aspirational until a plan upgrade. See [`docs/decisions/2026-06-01-pitr-posture.md`](../decisions/2026-06-01-pitr-posture.md). |
| Storage buckets | Supabase | None native (free or Pro) — relies on Postgres metadata + object durability | n/a | n/a | Unbounded if object deleted | Per-object best-effort | **VERIFICATION REQUIRED — see S3 below** |
| Edge functions code (canonical) | GitHub (repo) | Git history | Per commit | Forever | 0 | 0 (redeploy from `main`) | Yes — repo is authoritative |
| Edge functions code (deployed) | Supabase | Vendor-held copy | Per deploy | Latest only | n/a | 5–10min via `supabase functions deploy` | Yes |
| Vercel deploys | Vercel | Immutable deployment history | Per commit | Forever (Pro plan), 30d (Hobby) | 0 | <60s via "Promote to Production" | Yes |
| Mobile TestFlight builds | App Store Connect | TestFlight build archive | Per upload | **90 days then auto-expire** | n/a | 30–60min (re-archive + upload) | Partial — older builds drop off |
| Stripe data | Stripe | Vendor-owned | Continuous | Forever | n/a | n/a — Stripe is canonical | Yes (vendor SLA) |
| RevenueCat data | RevenueCat | Vendor-owned | Continuous | Forever | n/a | n/a — RC is canonical | Yes (vendor SLA) |

**Notes on the Postgres rows.** Supabase free-tier projects get **daily logical backups with 7-day retention** as a vendor-managed default. PITR (point-in-time recovery) is a paid add-on that buys you continuous WAL replay back to any second within the retention window. Without PITR, your RPO is **24 hours** — anything created today between the last nightly backup and the failure event is gone. With PITR, your RPO is **≤5 minutes** (WAL lag plus archive cadence). The audit verdict (2026-05-14) flagged this as the load-bearing posture decision before Phase 1 public traffic — see § Pre-Phase-1 checklist.

**Notes on Storage.** Supabase Storage does NOT have an opt-in object-versioning or cross-region replication setting today. If a user (or a bug) deletes an object, the bytes are gone. The Postgres `storage.objects` metadata row is captured in Postgres dumps, but the bytes are not. **Mitigation (ENG-1401, shipped 2026-07-10):** a nightly one-way mirror of the two real buckets (`recipe-images`, `food-evidence` — earlier drafts of this runbook named `recipe-photos`/`meal-photos`, which never existed in code) to a Cloudflare R2 bucket, via `.github/workflows/storage-mirror.yml`. Cost: pennies/month at the current ~50 MB. See § Storage mirror below for restore-from-mirror and the secrets it needs before its first green run.

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

**Response — with the mirror (ENG-1401, once its secrets are set):**

1. Identify affected object keys: `storage.objects` rows (or the app's broken-image reports) vs the mirror listing — `rclone lsjson dst:sloe-storage-mirror/recipe-images`.
2. Restore the bytes — either bulk (`rclone copy dst:sloe-storage-mirror/recipe-images src:recipe-images` with the same env-configured remotes the workflow uses) or per-key via download + `supabase storage cp`.
3. No comms needed if the nightly mirror RPO (< 24 h) beats the user retry window.

The mirror is **additive** (`rclone copy`, never `sync`): production deletions do NOT propagate, so the mirror can always recover a bad delete. Objects deleted in prod remain in R2 until manually pruned — review before pruning, that lag IS the recovery window.

### Storage mirror (ENG-1401)

`.github/workflows/storage-mirror.yml`, nightly 03:30 UTC + manual `workflow_dispatch`. Copies `recipe-images` + `food-evidence` to the R2 bucket `sloe-storage-mirror`, verifies with `rclone check --one-way`, writes per-bucket counts to the run summary, and files/updates a deduped `scheduled-cron-failure` issue on any failure (ENG-1400 pattern).

**Before its first green run, Grace must (one sitting, ~10 min):**
1. Supabase Dashboard → Project Settings → Storage → S3 access keys → create a key → repo secrets `SUPABASE_S3_ACCESS_KEY_ID` + `SUPABASE_S3_SECRET_ACCESS_KEY`.
2. Cloudflare → R2 → create bucket `sloe-storage-mirror` (no public access).
3. Cloudflare → R2 → Manage API Tokens → token scoped to that bucket (Object Read & Write) → repo secrets `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`, plus `R2_ACCOUNT_ID` from the R2 right rail.
4. Trigger the workflow manually (Actions → Storage mirror → Run workflow) and confirm the run summary shows source = mirror counts for both buckets. Record the first verified run in the rehearsal log below.

Until then the workflow fails loudly each night with a missing-secrets message and one deduped alert issue — by design (fail closed; a silent no-op was the ENG-1400 failure mode).

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

### S8 — Apple Sign-In (SIWA) auth outage

**Trigger:** Apple's Sign in with Apple service degrades or goes down. Symptom: `onAppleSignIn` (`apps/mobile/app/login.tsx`; mirrored in `apps/mobile/components/onboarding/steps/signup.tsx`) throws before or during `AppleAuthentication.signInAsync()`, or the returned identity token fails Supabase's `signInWithIdToken` verification. Users see the generic `formatAuthError` message — not a silent hang. **Triage in this order before assuming it's Apple:**

1. Check [Apple System Status](https://developer.apple.com/system-status/) — component "Sign in with Apple." If it isn't flagged there, don't write S8 comms yet — check steps 2–3 first.
2. Check [status.supabase.com](https://status.supabase.com) — component "Auth." A Supabase Auth degradation produces the identical user-facing symptom with zero Apple involvement.
3. Check recent deploys/migrations touching auth — rule out S4 (bad migration) or S5 (broken deploy) masquerading as a vendor outage.
4. **Known monitoring gap, stated honestly:** mobile Sentry telemetry is live (DSN shipped in `apps/mobile/app.json` — PRA-001/IM-03 fixed post-audit), but no dedicated alert rule exists yet for a SIWA-specific error spike; only the general "new issue / event spike" rule (Alarm 1, [`docs/operations/alerting.md`](../operations/alerting.md)) would catch it, with no SIWA-specific tagging. Until that's built, the practical detection signal is Apple's status page plus user/support reports.

**Blast radius — split by user type. This is not a uniform 100% mobile lockout** (correcting the originating audit finding, which read that way):

- **Returning mobile users are NOT blocked.** `apps/mobile/app/login.tsx` ships a full email/password + magic-link + password-reset flow that's always visible next to the Apple button — not gated behind Apple failing. "Continue with email" on the chooser (or landing there directly via "I already have an account") never calls Apple.
- **Apple-only accounts (no password ever set) still recover.** Both "Forgot password" (`onSendPasswordReset`) and "Sign in with magic link" (`onSendMagicLink`) authenticate by email lookup against Supabase `auth.users`, not by original signup provider — so they work for an Apple-only account too, sent to whichever email Supabase has on file (the user's real address, or their Apple private-relay address if they chose "Hide My Email" — relay mail delivery is a separate Apple system from SIWA and not typically affected by a SIWA-specific outage).
- **Brand-new mobile signups ARE fully blocked.** `apps/mobile/components/onboarding/steps/signup.tsx` is Apple-only by deliberate design (ENG-672, 2026-05-26 — the email field was removed on purpose: "Until real email sign-up ships, Apple Sign-In is surfaced as the single, honest path"). A user starting onboarding fresh during the outage has no on-device way to create an account.
- **Web is unaffected either way.** `app/login/ui.tsx` offers Apple + email; `app/onboarding` (web signup) is email/password-only with no Apple dependency at all.

**Response — this is (almost always) an outage on Apple's infrastructure, outside the team's control; the steps below are triage + comms, not a repair procedure:**

1. **Triage first** (Trigger steps 1–3 above). Only send S8-specific comms once Apple's status page — or a clear pattern of Apple-only failures with Supabase and our own deploys clean — confirms this is Apple-side.

2. **Comms — no new flag needed.** Flip the existing `dr-full-outage-banner` PostHog flag with S8-specific payload copy; the component already renders whatever `{ title, body }` the flag payload carries (§ Pre-Phase-1 checklist, `dr_full_outage_banner` row). Template below. **The reach caveat on that same checklist row carries over:** the banner is dark for mobile users who haven't consented to analytics — lead with status.suppr.club / X / Instagram, treat the in-app banner as a bonus surface, not the primary channel.
   - Point returning users at "Continue with email" on the same screen — don't send them anywhere else.
   - Point new users at signing up on suppr.app (web) as the interim path; a web-created account works immediately on mobile via the email login path once they open the app.

3. **There is nothing to fix.** Do not disable the Apple button app-wide as a "fix" — that breaks the one path unaffected users still prefer once Apple recovers, and buys nothing (the button already fails with a visible, non-blocking error). The only engineering lever available during this scenario is the comms in step 2.

4. **Monitor** Apple's status page. When "Sign in with Apple" clears, do one real end-to-end tap-test on a device/simulator before declaring recovery — Apple's status page has historically lagged actual service restoration.

5. **Drop the banner; post recovery comms** (template below).

6. **Post-incident, if the outage ran >2h:** pull `user_signed_up` counts from PostHog split by `method` (`apple` vs `email`) and `platform` (`mobile` vs `web`) for the outage window to size the actual new-signup loss. That number is the input to any future call on whether the ENG-672 Apple-only onboarding stance should grow an email fallback — not a decision to make mid-incident.

**Comms templates** for S2 / S7 / S8:

```
In-app banner (S2 — restoring):
"Suppr is temporarily restoring data from backup. We expect to be back online within a few hours. Thanks for your patience — Grace"

In-app banner (S7 — vendor outage):
"Suppr is temporarily down due to a Supabase outage. We're monitoring and will update at status.suppr.club."

In-app banner (S8 — SIWA outage):
"Sign in with Apple is temporarily down (Apple-side, not us). Already have
an account? Tap 'Continue with email' to sign in. New here? Sign up at
suppr.app on the web — your account works on the app too."

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

- [x] **Confirm Supabase plan + PITR availability.** ✅ 2026-06-01 via Supabase MCP — org `pyeqbxhowqljzkzfmhsm` plan = `free`, PITR **not** available (paid Pro+ add-on). § Backup posture table updated.
- [x] **Document actual backup retention from the dashboard.** ✅ Free plan = daily logical backup, 7-day rolling retention, RPO 24h. Table updated.
- [ ] **Rehearse one PITR restore to a scratch branch.** ⛔ **BLOCKED on Free plan** — both PITR restore and `supabase branches create` (the rehearsal protocol) require Pro+. Cannot rehearse as written until the plan decision lands ([`docs/decisions/2026-06-01-pitr-posture.md`](../decisions/2026-06-01-pitr-posture.md)). On Free, the only rehearsable path is "restore most-recent daily backup → new project," which still has never been timed — do that as the interim rehearsal.
- [ ] **Record rehearsal in the log table above.** First row replaces the placeholder.
- [ ] **Decide PITR upgrade vs accept 24h RPO; document in `docs/decisions/`.** Open `docs/decisions/YYYY-MM-DD-pitr-posture.md` capturing the decision + the cost trade-off. Reference back here.
- [ ] **Activate the storage mirror (workflow shipped — ENG-1401).** `.github/workflows/storage-mirror.yml` mirrors `recipe-images` + `food-evidence` to R2 nightly, but needs the 5 repo secrets + the `sloe-storage-mirror` R2 bucket created first — exact steps in § Storage mirror. Check this box after the first manually-triggered green run with matching counts.
- [x] **Build a `dr_full_outage_banner` component.** ✅ 2026-06-02. Built on web (`src/app/components/ops/DrOutageBanner.tsx`, mounted in `app/layout.tsx`) and mobile (`apps/mobile/components/ops/DrOutageBanner.tsx`, mounted in `apps/mobile/app/_layout.tsx`). Default-OFF kill switch on flag `dr-full-outage-banner`; renders a top-of-app destructive-token banner whose copy comes from the flag's PostHog payload (`{ title?, body? }` or a plain string), with a safe default fallback — so incident copy changes without a deploy. New `getFeatureFlagPayload` helper added to both analytics modules. Tested: `tests/unit/drOutageBanner.test.tsx` (web) + `apps/mobile/tests/unit/drOutageBanner.test.tsx` (mobile). To activate during an incident: turn the flag ON in PostHog (optionally set the payload copy). **Reach caveat found 2026-07-19, not previously written up:** the banner is **partial-reach on mobile** — `getPostHogClient()` (`apps/mobile/lib/analytics.ts`) never constructs a client for a user who declined or hasn't yet answered the analytics-consent prompt, so `isFeatureEnabled('dr-full-outage-banner')` is hard-`false` for that cohort regardless of the PostHog dashboard state. Web has no equivalent gate and reaches everyone. **Do not treat the in-app banner as guaranteed 100% reach during S2/S7 — lead comms with status.suppr.club / X / Instagram / email, and treat the banner as a bonus surface for consented users**, not the primary channel. Full writeup: [`../product/web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md) "Disaster-recovery / degraded-mode banner" row.
- [ ] **Keep a green TestFlight build always promoted.** Configure the EAS Update workflow so that whenever a new build is uploaded, the previous build stays at "Available" status for at least 14 days. Currently the previous build is sometimes manually expired — formalise the policy.
- [x] **Quarterly calendar reminder.** ✅ 2026-06-02. Recurring event "Suppr DR rehearsal (quarterly)" created on Grace's primary calendar — first run 2026-07-06 10:00 (America/Panama), `RRULE:FREQ=MONTHLY;INTERVAL=3`, with 1-day + 30-min reminders. Description links this runbook + the PITR-posture decision (first run gated on the plan decision, since rehearsal branches need a paid plan).

When every box is checked, the Blocker 2 row of the audit can be flipped to **Closed** in [`docs/decisions/2026-05-14-production-readiness-audit-verdict.md`](../decisions/2026-05-14-production-readiness-audit-verdict.md).

---

## Related

- Audit verdict: [`docs/decisions/2026-05-14-production-readiness-audit-verdict.md`](../decisions/2026-05-14-production-readiness-audit-verdict.md)
- Alerting runbook: [`docs/operations/alerting.md`](../operations/alerting.md) (Blocker 1, same audit)
- Stripe webhook replay runbook: [`docs/operations/stripe-webhook-replay-runbook.md`](../operations/stripe-webhook-replay-runbook.md) (this PR — companion to S1)
- RevenueCat webhook runbook: [`docs/operations/revenuecat-webhook-runbook.md`](../operations/revenuecat-webhook-runbook.md)
- Launch checklist: [`docs/launch/checklist.md`](../launch/checklist.md) — Phase 2 row dependencies
- Project rule on migrations: [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) § Non-negotiable rules (S4 above cites this)
- Product/parity coverage of the `dr_full_outage_banner` component itself (what it renders, the payload contract, platform-sync behaviour): [`docs/product/web-mobile-parity-scope.md`](../product/web-mobile-parity-scope.md) — "Disaster-recovery / degraded-mode banner" row. This runbook stays the source of truth for *when* to flip it and what to say; that doc covers *what the component does*.
- S8's onboarding-vs-login auth split, and the stale `apps/mobile/CLAUDE.md` "no email/password" line it depends on reading past: [`docs/journeys/onboarding-to-first-log.md`](../journeys/onboarding-to-first-log.md) § Open product questions.
