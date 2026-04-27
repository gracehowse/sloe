# Decision log: CI gates — Playwright e2e (already wired) + static migration check (P1-11, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P1 #11 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The audit reported "No web E2E in CI; no migration drift check in CI." On inspection only the second was true — Playwright e2e is already wired (`E2E (smoke)` step in `.github/workflows/ci.yml`), but the migration check needed a CI-friendly mode.

---

## Decision

Two things shipped:

1. **Static migration check at the CI level.** New `--static` flag on `scripts/check-migration-drift.ts` runs filename-format and duplicate-detection over local files only, no Supabase auth required. Wired into `.github/workflows/ci.yml` after the production-env checklist step. Catches:
   - Filenames that don't match `<14-digit timestamp>_<name>.sql`.
   - Duplicate timestamps (two files with the same prefix would race at apply time).
   - Duplicate migration names (would silently shadow earlier migrations in `schema_migrations`).
2. **`--migrations-dir <path>` flag** on the same script so unit tests can target fixture directories without `cwd` games. The Vitest test file (`tests/unit/migrationDriftStatic.test.ts`) builds five synthetic fixtures (clean, malformed, duplicate timestamp, duplicate name, real-repo) and asserts each exits with the expected status + stderr.

The full drift comparison (vs the linked Supabase project's `schema_migrations`) stays a local / scheduled task — it needs Supabase CLI auth which we don't want to grant to GitHub Actions for every PR. Documented as a manual `npm run check:migrations` step in the prelaunch checklist.

The CI run on Playwright e2e was **already in place** (verified by reading `.github/workflows/ci.yml`):

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
- name: Build
  run: npm run build
- name: E2E (smoke)
  env:
    PLAYWRIGHT_BASE_URL: http://127.0.0.1:3100
    E2E_EMAIL: ${{ secrets.E2E_EMAIL }}
    E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
  run: |
    npm run start -- --port 3100 &
    npx wait-on http://127.0.0.1:3100/login
    npm run test:e2e
```

So no e2e additions were required. The audit had grepped for `playwright` in `.github/workflows/` and missed the inline `npm run test:e2e` invocation.

## Rationale

The migration set is the most consequential part of the codebase to keep clean — a malformed filename or a duplicate timestamp will explode at `supabase db push` time, after the bad file has already shipped to a feature branch. Pushing the check left to PR time costs nothing (~50 ms locally) and prevents the entire class of foot-gun.

Static-only at the CI layer is the right level: the full drift check needs a linked Supabase project and the credentials to query its `schema_migrations` table. Granting that to GitHub Actions just so we can run it on every PR is a security trade we shouldn't take. The drift check stays where the maintainer with linked-project access already runs it (locally, before push, and as part of `npm run prelaunch:checklist`).

## Alternatives considered

- **Full drift check in CI with a service-role secret.** Rejected. Service-role keys in GitHub secrets that any PR-author with write access can exfiltrate via a workflow change is the wrong threat model. Static + manual covers the actual error classes.
- **Move the check into a custom ESLint rule.** Considered. ESLint can't easily walk a non-JS directory and the rule would need to fire only on migrations, not the rest of the tree. The standalone script + CI step is simpler.
- **Keep the existing `--strict` mode and run it without auth.** Doesn't work — strict mode requires the remote query to know what's local-only.

## Implementation

- `scripts/check-migration-drift.ts`:
  - New `--static` flag: runs only the local-file validation (`staticValidationErrors`); skips `fetchRemoteMigrations`. Exits 1 on any structural problem with a human-readable list to stderr.
  - New `--migrations-dir <path>` flag: lets callers target a directory other than `cwd/supabase/migrations`. Used by the test fixtures.
- `package.json`: added `"check:migrations:static": "node --import tsx scripts/check-migration-drift.ts --static"` shortcut.
- `.github/workflows/ci.yml`: new step `Migration filename + duplicate check (static, no Supabase auth)` runs `npm run check:migrations:static` between `verify-production-env` and `typecheck`.
- `tests/unit/migrationDriftStatic.test.ts`: 5 tests covering the real repo (assert 0 + clean output) plus four synthetic fixtures (duplicate timestamp, malformed name, duplicate name, clean two-file). **5/5 green.**

## Platforms affected

- **CI (GitHub Actions):** new step adds ~50 ms to every PR. No new secrets required.
- **Web + Mobile + Supabase:** none.
- **Developer workflow:** `npm run check:migrations:static` available locally as a fast pre-push smoke; `npm run check:migrations` (with linked project) remains the comprehensive check.

## Verification

- `tests/unit/migrationDriftStatic.test.ts` — 5/5 green.
- Static check run on the real `supabase/migrations/` (92 files): clean, exits 0.
- Workflow YAML syntax is unchanged outside the new step; existing jobs untouched.

## Related artefacts

- [Opus 4.7 codebase review §3.4](../audits/2026-04-25-opus47-codebase-review.md#34-web-e2e-and-migration-drift-checks-not-in-ci)
- [scripts/check-migration-drift.ts](../../scripts/check-migration-drift.ts)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Predecessor: 2026-04-18 Supabase migration-drift inventory (`docs/planning/supabase-migration-drift-inventory.md`) — the operational context the script was built for.

## Revisit when

- A new structural failure mode is observed (e.g. someone commits an empty `.sql` file, or a migration with `\r\n` line endings on a case-insensitive FS). Add a check.
- A future Supabase CLI version changes the canonical filename pattern (e.g. supports underscored timestamps). Update the regex.
- We add a scheduled GitHub Actions cron that does run the full drift check (would need org-level Supabase secrets — out of scope today).
