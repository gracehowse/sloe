# Production readiness — hardening tail (ENG-1414, PRA-015/IM-16 + PRA-016)

- **Date:** 2026-07-20
- **Area:** Mobile release safety net (TestFlight) + dependency posture
- **Status:** Decided + built. One item genuinely needs Grace (App Store Connect API key provisioning — not something an agent can do); one item is explicitly a repo/account security-setting toggle an agent should not flip unattended.
- **Linear:** [ENG-1414](https://linear.app/suppr/issue/ENG-1414/production-readiness-hardening-tail-sev-2) (parent: ENG-1390)

This bundles two unrelated sev-2 findings from the 2026-07-05 deep audit
(`docs/audits/2026-07-05-deep-audits/audit2-production-readiness/findings.json`)
into one ticket, per how the ticket itself is scoped. They're documented
together here for the same reason — small, independent, one PR.

---

## 1. PRA-015/IM-16 — TestFlight 90-day expiry alarm

### Problem

TestFlight builds auto-expire 90 days after upload. The only guard against
the promoted build lapsing (no install path, no rollback target once a
wider cohort exists) was a recurring 60-day **calendar reminder**
(`docs/operations/founder-safety-net.md` §3, set 2026-06-02) — a human
process. The audit's point: a calendar reminder is exactly the mechanism
that silently fails during a busy launch month or a 7-day absence, which
are the two scenarios this safety net exists for.

### Decision

Build "Alarm 10" for real: `POST /api/cron/testflight-expiry-check`
(`app/api/cron/testflight-expiry-check/route.ts`, logic in
`src/lib/server/testflightExpiryCheck.ts`), invoked weekly (Monday 09:00
UTC) by `.github/workflows/scheduled-crons.yml` — the same
GitHub-Actions-cron-hits-a-Vercel-route pattern as every other scheduled
job in this repo (`supabase-advisor-check`, `household-purge`,
`entitlement-reconcile`). It:

1. Signs a 20-minute ES256 JWT for the App Store Connect API.
2. Calls `GET /v1/builds?filter[app]=ASC_APP_ID&sort=-uploadedDate&limit=1&fields[builds]=version,uploadedDate,expirationDate,expired`.
3. Computes whole days remaining until `expirationDate`.
4. `Sentry.captureMessage` at `level: "error"`, fingerprinted per build
   version, when under **21 days** remain (PRA-015's explicit threshold —
   also alerts on an already-expired build or zero builds returned, both
   strictly worse states). This lands in the same Sentry project as every
   other alarm, so Alarm 1's existing "new issue created" rule
   (`docs/operations/alerting.md`) delivers it to `gracehowse@outlook.com`
   with **no additional Sentry configuration** — the alerting infrastructure
   already exists, this just feeds it a new signal.

### Why reuse `scripts/fetch-testflight-feedback.mjs`'s ASC_* env var names, not new ones

`scripts/fetch-testflight-feedback.mjs` already authenticates to this exact
App Store Connect API (same ES256-JWT scheme) using `ASC_KEY_ID` /
`ASC_ISSUER_ID` / `ASC_PRIVATE_KEY` / `ASC_APP_ID`, read from `.env.local`
for that local script. This is the same physical credential (one App Store
Connect API key) the new cron needs — reusing the same four names means
Grace provisions **one** key with **one** naming scheme, usable from both
the local script and the Vercel-hosted cron, instead of two different env
var names for the same secret. The only real difference: the local script
resolves `ASC_PRIVATE_KEY` as either an inline PEM or a path to the `.p8`
file; the Vercel route has no persistent filesystem, so `ASC_PRIVATE_KEY`
**must** be the inline PEM contents when set in Vercel (its environment
variable editor supports multi-line values — paste the full
`-----BEGIN PRIVATE KEY-----...-----END PRIVATE KEY-----` block).

### Clean-skip (200), not a crash or a 503, when unconfigured

This is the one item in ENG-1414 that requires a real secret only Grace can
provision (an App Store Connect API key is scoped to her Apple Developer
account — no agent can generate or approve one in this sandbox). Per the
task, the route must **fail gracefully, not crash**, when
`ASC_KEY_ID`/`ASC_ISSUER_ID`/`ASC_PRIVATE_KEY`/`ASC_APP_ID` are unset — and
per the codebase's own established pattern for this exact situation
(`entitlementReconcileJob.ts`'s Stripe-not-configured clean skip, see
`docs/decisions/2026-07-10-entitlement-reconciliation-cron.md` §4), the
route returns `200 {"ok": true, "skipped": "app_store_connect_not_configured"}`
rather than a `503`. A `503` would trip `scheduled-crons.yml`'s
failure-alerting (ENG-1400) and open a GitHub issue every week until the key
is provisioned — a false alarm for an integration that's dark by design
until then. The cron secret gate (`SUPPR_CRON_SECRET`) is unaffected by this
and still 503s/401s on its own misconfiguration, same as every other cron —
that's a real, always-page-worthy misconfiguration, unlike an
optional/not-yet-provisioned third-party key.

### What Grace needs to provision (not done in this PR — cannot be, in this sandbox)

1. **App Store Connect → Users and Access → Integrations → App Store
   Connect API → Team Keys**: generate a new key. **Access level: App
   Manager** is sufficient (read-only access to Builds; do not grant Admin
   — least privilege). Note the **Key ID** and **Issuer ID** shown on that
   page, and download the `.p8` private key file **once** (Apple does not
   let you re-download it).
   - If Grace prefers to reuse the *existing* key already generated for
     `scripts/fetch-testflight-feedback.mjs` (if one exists in `.env.local`
     already) rather than mint a new one, that's fine too — same
     permissions requirement (App Manager) applies, and the same key can
     back both the local script and this cron.
2. In **Vercel → suppr project → Settings → Environment Variables**, add
   for the **Production** environment:
   - `ASC_KEY_ID` — the Key ID from step 1.
   - `ASC_ISSUER_ID` — the Issuer ID from step 1 (same for every key on the
     account).
   - `ASC_PRIVATE_KEY` — the full inline contents of the downloaded `.p8`
     file, including the `-----BEGIN/END PRIVATE KEY-----` lines.
   - `ASC_APP_ID` — Suppr's numeric `ascAppId` (already known — it's the
     same value used for `ASC_APP_ID` in `.env.local` for the feedback
     script, e.g. `6762522932` per that script's doc comment example).
3. Redeploy (or wait for the next natural deploy) so the new env vars are
   live, then either wait for the next Monday 09:00 UTC tick or run it on
   demand: `gh workflow run scheduled-crons.yml -f
   target=testflight-expiry-check`. Confirm the run's logged response body
   shows `"ok": true` with a real `version` / `daysRemaining` (not
   `"skipped"`).
4. Once confirmed armed and green, the 60-day calendar reminder in
   `founder-safety-net.md` §3 can be retired — **not before**, per that
   section's explicit note. Until Grace does steps 1–3, that reminder is
   still the only live guard.

### Alternatives rejected

- **Vercel Cron instead of GitHub Actions.** Rejected for the same reason
  every other scheduled job in this repo already avoids it: the Vercel
  Hobby plan rejects sub-daily schedules for the *other* crons sharing this
  workflow, and more fundamentally Vercel cron invocations cannot send
  custom headers — every cron route here fails closed without
  `X-Cron-Secret`. A weekly-only job could technically use a native Vercel
  cron, but splitting one job onto a different invocation mechanism than
  every sibling cron for no functional benefit is needless inconsistency.
- **A dedicated email/webhook integration instead of Sentry.** Rejected:
  Sentry's routing to `gracehowse@outlook.com` already exists and is tested
  (Alarm 1). Standing up a second delivery path for one alarm adds a
  maintenance burden (a second thing that can silently break) for zero
  marginal benefit over reusing the one that's already proven to work.
- **A lower/higher day threshold than 21.** Kept at PRA-015's explicit
  recommendation — 21 days gives a full three weeks of runway to ship or
  re-promote a build even if the weekly poll's most recent run was right
  before the threshold was crossed (worst case: the alarm could be up to
  ~6 days late relative to the instant the 21-day line is crossed, given a
  weekly cadence — still comfortably inside the 90-day window with margin
  to act).
- **A separate `scripts/check-testflight-expiry.mjs` CLI script** (as one
  audit finding variant, IM-16, suggested) instead of a `route.ts` +
  `src/lib/server/*.ts` pair. Rejected: every other scheduled job in this
  repo is a Next.js API route invoked by `scheduled-crons.yml`, not a
  standalone script invoked some other way. A CLI script would need its own
  separate scheduling mechanism (it can't run inside GitHub Actions against
  Vercel's env vars without re-plumbing secrets), duplicating
  infrastructure the route pattern gets for free.

### Failure modes pressure-tested

- **ASC API key expires or is revoked.** `fetchLatestBuild` throws on a
  non-2xx response → `Sentry.captureException` (level default = error) +
  `502` → `scheduled-crons.yml`'s 3-retry-then-open-a-GitHub-issue path
  fires for real, which is correct: an ASC auth failure IS a real
  misconfiguration worth paging on (unlike "never configured").
- **ASC returns a build with no `expirationDate`.** Defensive path: warns
  to Sentry (`level: "warning"`, distinct fingerprint) rather than silently
  treating a missing field as "not expiring" — the one field this alarm
  exists to read must never silently short-circuit to "fine."
- **The app has zero TestFlight builds at all** (e.g. between a full
  archive-delete and the next upload). Alerts as `level: "error"` — this is
  a strictly worse state than "expiring soon," never a reason to stay
  quiet.
- **Cron fires but Grace is offline for the full week.** By design — the
  21-day threshold and weekly cadence give multiple weekly re-alerts before
  the 90-day cliff (fingerprinted, so they collapse into one Sentry issue
  rather than paging fresh each time), not a single one-shot warning.

---

## 2. PRA-016 — npm audit posture + posthog-js + Dependabot

### Problem (as audited 2026-07-05)

14 web + 23 mobile moderate `npm audit` advisories; the audit specifically
called out `posthog-js` pinning a vulnerable `@opentelemetry/core` range
(`GHSA-8988-4f7v-96qf`, unbounded memory allocation, `<2.8.0`) and
recommended enabling Dependabot alerts (described as "one settings
toggle").

### Findings on re-audit (2026-07-20)

**The posthog-js/OpenTelemetry sub-finding was already resolved before this
ticket started.** `fix(ENG-1353)` (commit `be89e77d`, 2026-07-04 — one day
before the audit's own evidence snapshot) bumped `posthog-js` from
`^1.376.2` to `^1.396.6` to clear an unrelated 10-CVE DOMPurify cluster, and
per that commit's own message the newer posthog-js also **dropped its
bundled `@opentelemetry/*` dependency entirely** — the finding's cluster
disappeared as a side effect, not just the direct `posthog-js` CVEs. A fresh
`npm audit` (both `--omit=dev` and full) on current `main` confirms zero
`posthog-js` or `@opentelemetry/*` findings; the one `@opentelemetry/core`
copy still in the tree (pulled in by an unrelated dependency, not
`posthog-js`) resolves to `2.8.0` — the first patched version, not the
vulnerable `<2.8.0` range. No further posthog-js bump is needed for this
ticket; `package.json` already reflects it.

**Ran `npm audit fix` (no `--force`) in both trees**, per the task's
explicit instruction to accept only the non-breaking fix level:

- Web: `npm audit --omit=dev` moderate count unchanged at 4 (the fix
  updated several dev-tree transitive resolutions, but the 4 production
  advisories — `postcss` XSS via the `next` → `@sentry/nextjs` /
  `@vercel/analytics` chain — only have a fix "available via `npm audit fix
  --force`", which would install `next@9.3.3` (a major downgrade of a
  currently-newer `next`, per npm's dependency solver) — a genuinely
  breaking change out of scope here.
- Mobile: `npm audit --omit=dev` moderate count 23 → 22. The remaining 22
  are one connected cluster (`@expo/config-plugins` → `xcode` → `uuid`,
  `GHSA-w5hq-g745-h8pq`) whose only fix path bumps `expo-linking` across a
  breaking range — also out of scope for a `--force`-free fix.
- Both lockfile-only changes (no `package.json` dependency ranges moved) —
  confirmed via `git diff --stat`.

**Residual `--force`-only advisories are explicitly out of scope for this
ticket**, per the audit's own recommendation text ("`npm audit fix` + bump
posthog-js + Dependabot toggle" — not "force-fix everything," and a Next.js
major bump or an Expo canary-track bump are both meaningfully-sized,
review-worthy changes of their own). Tracked, not silently dropped:
[ENG-1625](https://linear.app/suppr/issue/ENG-1625/residual-npm-audit-advisories-requiring-a-breaking-change-bump-next).

**Dependabot toggle — confirmed off, not flipped by this PR.** Read-only
`gh api repos/gracehowse/sloe/vulnerability-alerts` returns `404` (disabled)
and `gh api repos/gracehowse/sloe/automated-security-fixes` returns
`{"enabled": false, "paused": false}`. Both GitHub repository **security
settings** are off. This PR does not flip them — enabling/disabling a
repository's security-alerting posture is a settings change outside an
agent's remit to make unilaterally, even when a task explicitly names it as
a to-do. **Grace: enable both** via **GitHub → repo → Settings → Code
security**:
  - **Dependabot alerts** — toggle on (this also surfaces the current 4 web
    + 22 mobile residual advisories natively in the Security tab, instead
    of only via manual `npm audit`).
  - **Dependabot security updates** — toggle on once alerts are on (auto-PRs
    for future vulnerabilities; distinct from — and complementary to — the
    version-update schedule already configured in `.github/dependabot.yml`,
    which handles routine minor/patch bumps but not security-triggered
    out-of-band PRs).
  Note `.github/dependabot.yml` (the version-update config) was already
  correctly set up before this ticket — root npm, mobile npm, and
  github-actions ecosystems are all covered on a weekly schedule. The gap
  was purely the separate native alerts/security-updates toggle, which
  lives in repo Settings, not in that YAML file.

### Alternatives rejected

- **`npm audit fix --force` to clear every remaining advisory.** Rejected
  per explicit task instruction and on the merits: the web fix would
  downgrade `next` to `9.3.3` (years behind current, a different
  application framework version entirely) and the mobile fix would bump
  `expo-linking` across what Expo's own dependency graph flags as a
  breaking range — both need their own scoped, tested PR with a real
  regression pass, not a drive-by inside a bundled hardening-tail ticket.
- **Flip the Dependabot repo-settings toggle via `gh api` PUT.** Rejected —
  see above. Read-only inspection is fine; a write to a repository security
  setting is not something to do unattended inside an automated PR, even
  when it's the literal action item.
- **Re-bump posthog-js anyway "to be safe."** Rejected as needless churn:
  the current `^1.396.6` is already well past the vulnerable range and the
  fix commit's own message confirms the mechanism (dropped bundled
  OpenTelemetry entirely) directly addresses the CVE class, not just the
  version number. Bumping further with no functional reason adds review
  surface for zero security benefit.

### Failure modes pressure-tested

- **A new `npm audit fix` run in CI silently reintroduces a fixed range.**
  Not a risk from this change specifically — `npm audit fix` without
  `--force` never widens a range past what's already declared in
  `package.json`; it only re-resolves within existing semver constraints.
- **Grace enables Dependabot alerts and gets flooded by the 26 known
  residual advisories immediately.** Expected and fine — that's the
  intended behavior (visibility), and both clusters are already documented
  here with their root cause and why they're deferred, so it reads as
  "known, tracked" rather than "surprise, uninvestigated."
