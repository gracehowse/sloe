# npm-audit security allow-list

**Owner:** Grace
**Status:** living document — append rows when a `npm audit` finding is consciously accepted (and never silently ignored)
**Last updated:** 2026-07-21 (first allow-list row — postcss/next advisory, ENG-1638)

This doc backs the `dep-audit` CI job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). That job runs `npm audit --audit-level=high --omit=dev` on both the web root and `apps/mobile`. Any high or critical finding **fails the build**. The allow-list below is the escape valve for findings that have been triaged and consciously deferred — never for "I don't have time today, mute it."

---

## Principles

1. **No silent suppression.** Every allow-list row must have an entry below. CI does not read this file — it relies on `npm audit`'s `--omit` flag if and when we install `audit-ci` (currently unused; we run plain `npm audit`). When we add a vulnerability to be skipped, we capture the rationale here as the human-readable record.
2. **Expiry date is mandatory.** Every row has a "review by" date. When that date passes, either the upstream fix shipped (remove the row) or the deferral is consciously extended (update the date + add a note).
3. **Critical severity is never allow-listed.** If a critical-severity finding lands and can't be patched today, ship a workaround the same day. Don't add it to this list.
4. **High severity is allow-listed only with a written reason.** Acceptable reasons:
   - "Affects dev-only path; CI runs `--omit=dev` already" → row not needed; the omit handles it.
   - "Transitive dep, fix not yet released upstream, monitoring upstream issue X" → row required with the issue link.
   - "Affects code path we don't exercise (e.g. SSR-only API in a CSR build)" → row required with the file path that proves the path is dead.
5. **Mobile and web tracked separately.** Different package trees; same rules.

---

## Allow-list (web — `/`)

| Advisory ID | Package | Severity | Reason for deferral | Upstream tracker | Added | Review by | Added by |
|---|---|---|---|---|---|---|---|
| [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | postcss (nested under `next`) | Moderate | Every stable `next@15.x` (incl. latest 15.5.21) pins its nested `postcss` to the exact vulnerable `8.4.31`; only the unstable `16.3.0-preview.x` line carries the fix. `npm audit fix --force` would downgrade `next` to `9.3.3` (rejected — major breaking change). A targeted `overrides` entry is low-risk on its own but only applies cleanly against a from-scratch lockfile regen (~1,040 package nodes touched in testing) — too large to bundle into a scoped dep-audit fix. Doesn't fail this gate today (moderate, gate is `--audit-level=high`). See [ENG-1638](https://linear.app/suppr/issue/ENG-1638/dependency-postcss-xss-advisory-ghsa-qx2v-qp2m-jg93-pinned-by-next15x) for full rationale + revisit triggers. | [ENG-1638](https://linear.app/suppr/issue/ENG-1638/dependency-postcss-xss-advisory-ghsa-qx2v-qp2m-jg93-pinned-by-next15x) | 2026-07-21 | 2026-08-20 | Claude |

## Allow-list (mobile — `/apps/mobile`)

| Advisory ID | Package | Severity | Reason for deferral | Upstream tracker | Added | Review by | Added by |
|---|---|---|---|---|---|---|---|
| _(none — empty allow-list)_ | | | | | | | |

---

## When CI's `dep-audit` job fails

1. Read the failure log — `npm audit` prints the offending advisory IDs, severities, and suggested fixes.
2. **First option:** run `npm audit fix` locally. If it patches without breaking tests, commit and re-push.
3. **Second option:** if the fix requires a major bump (`npm audit fix --force`), open a separate PR for that bump and validate it didn't introduce regressions. Major bumps are not auto-allowed — they need human review.
4. **Third option (rare):** if the finding can't be patched today, add a row above with a written reason and a review-by date max **30 days** out. Re-push.
5. **Never:** disable the job. Never `--audit-level=critical` to skip highs. Never `--omit` whole categories beyond the existing `--omit=dev`.

---

## Where the rules come from

- The CI job runs at `.github/workflows/ci.yml`, job `dep-audit`.
- The mobile audit runs in `apps/mobile/` to catch RN / Expo-specific advisories that don't surface at the root.
- `--omit=dev` is intentional — dev dependencies (vitest, playwright, eslint, etc.) ship to no user. If a dev advisory looks scary, run `npm audit` without `--omit=dev` locally to inspect it; don't add it to the gate.

## Related

- [Launch checklist](../launch/checklist.md) — security-floor row
- [Decisions log — 2026-05-13 tooling stack](../decisions/2026-05-13-tooling-stack-linear-sentry-qodo.md) — Sentry/Linear/Qodo adoption
- 2026-05-14 production-readiness audit — origin of this gate
