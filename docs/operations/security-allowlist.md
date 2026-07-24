# npm-audit security allow-list

**Owner:** Grace
**Status:** living document — append rows when a `npm audit` finding is consciously accepted (and never silently ignored)
**Last updated:** 2026-07-24 — wired up `audit-ci` (root `audit-ci.json` / `apps/mobile/audit-ci.json`) so this doc's rows are now **actually enforced by CI**, not just a human paper trail; see the postcss/expo-share-intent row below, the first real occupant.

This doc backs the `dep-audit` CI job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). That job runs `audit-ci --high --skip-dev` (via the checked-in `audit-ci.json` / `apps/mobile/audit-ci.json` configs) on both the web root and `apps/mobile`. Any high or critical finding **fails the build** unless it's in the matching `audit-ci.json`'s `allowlist`. The allow-list is the escape valve for findings that have been triaged and consciously deferred — never for "I don't have time today, mute it."

---

## Principles

1. **No silent suppression.** Every allow-list entry in `audit-ci.json` / `apps/mobile/audit-ci.json` must have a matching row below. As of 2026-07-24, `audit-ci` genuinely reads those config files — an allow-listed advisory ID suppresses CI; anything else still fails the build. Each config entry also carries its own `expiry` field (ISO date), enforced by `audit-ci` itself: once expired, CI fails again automatically as a forced revisit, independent of whether anyone remembers to check this doc.
2. **Expiry date is mandatory** — both here (the "Review by" column) and in the matching `audit-ci.json` entry's `expiry` field. Keep the two in sync. When the date passes, either the upstream fix shipped (remove both the row and the config entry) or the deferral is consciously extended (bump both dates + add a note).
3. **Critical severity is never allow-listed.** If a critical-severity finding lands and can't be patched today, ship a workaround the same day. Don't add it to this list.
4. **High severity is allow-listed only with a written reason.** Acceptable reasons:
   - "Affects dev-only path; CI runs `--skip-dev` already" → row not needed; skip-dev handles it.
   - "Transitive dep, fix not yet released upstream, monitoring upstream issue X" → row required with the issue link.
   - "Affects code path we don't exercise (e.g. SSR-only API in a CSR build, or a build-tool-only path never reachable from the shipped binary)" → row required with the reasoning that proves the path is dead/unreachable at runtime.
5. **Mobile and web tracked separately.** Different package trees, different `audit-ci.json` files; same rules.

---

## Allow-list (web — `/`)

| Advisory ID | Package | Severity | Reason for deferral | Upstream tracker | Added | Review by | Added by |
|---|---|---|---|---|---|---|---|
| _(none — empty allow-list)_ | | | | | | | |

## Allow-list (mobile — `/apps/mobile`)

| Advisory ID | Package | Severity | Reason for deferral | Upstream tracker | Added | Review by | Added by |
|---|---|---|---|---|---|---|---|
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | `postcss` (transitive, via `expo-share-intent` → `expo` → `@expo/cli` → `@expo/metro-config`) | High | Freshly-published advisory (not present when `main` last passed CI on 2026-07-23 with the identical mobile lockfile) — not a regression from any PR. The vulnerable path is PostCSS's previous-sourcemap auto-loading during Metro/build tooling; it isn't reachable from the shipped TestFlight binary, only from the build/dev environment. The only fix (`npm audit fix --force`) installs `expo@57.0.8` — a 3-major-version SDK jump (54→57) that also requires `expo-share-intent` 5→8 (a 3-major bump on a native share-sheet module) plus synced bumps of `expo-constants`/`expo-linking` and a native `expo prebuild` regen. That's a full SDK-modernization project needing its own sim-validated regression pass across every screen, not a same-PR patch. Deferred pending that properly scoped upgrade. | [expo-share-intent compatibility table](https://github.com/achorein/expo-share-intent) (SDK 57 needs 8.0+) | 2026-07-24 | 2026-08-23 | Claude |

---

## When CI's `dep-audit` job fails

1. Read the failure log — `audit-ci` prints the offending advisory IDs, severities, and suggested fixes (same underlying data as `npm audit`).
2. **First option:** run `npm audit fix` locally. If it patches without breaking tests, commit and re-push.
3. **Second option:** if the fix requires a major bump (`npm audit fix --force`), open a separate PR for that bump and validate it didn't introduce regressions. Major bumps are not auto-allowed — they need human review.
4. **Third option (rare):** if the finding can't be patched today, add an entry to the relevant `audit-ci.json` (with `active: true`, a `notes` field, and an `expiry` date max **30 days** out) **and** a matching row above. Re-push — CI will now actually pass (until expiry).
5. **Never:** disable the job. Never drop the `--high` threshold to `--critical` to skip highs. Never widen `--skip-dev` scope beyond dev-only deps.

---

## Where the rules come from

- The CI job runs at `.github/workflows/ci.yml`, job `dep-audit`, via `audit-ci` reading `audit-ci.json` (root) and `apps/mobile/audit-ci.json`.
- The mobile audit runs in `apps/mobile/` to catch RN / Expo-specific advisories that don't surface at the root.
- `--skip-dev` is intentional — dev dependencies (vitest, playwright, eslint, etc.) ship to no user. If a dev advisory looks scary, run `npx audit-ci --config audit-ci.json` without `skip-dev` locally to inspect it; don't add it to the gate.

## Related

- [Launch checklist](../launch/checklist.md) — security-floor row
- [Decisions log — 2026-05-13 tooling stack](../decisions/2026-05-13-tooling-stack-linear-sentry-qodo.md) — Sentry/Linear/Qodo adoption
- 2026-05-14 production-readiness audit — origin of this gate
