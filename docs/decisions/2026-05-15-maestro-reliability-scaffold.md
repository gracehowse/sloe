# Maestro reliability scaffold — testID contract + reset script + seed script + per-PR validation flows

**Date:** 2026-05-15
**Status:** Resolved
**Area:** Tooling / E2E

## Context

PR #246 (`fix(today): uncrowd meal section header on narrow widths`,
commit `5586f0f`) flag-gated a Snacks header relayout behind
`today_log_usual_row_v2`. Validating that PR end-to-end on iOS sim via
Maestro hit a wall of friction that had nothing to do with the change
itself:

- Stale `maestro-driver-iosUITests-Runner` and `maestro.cli.AppKt`
  processes from prior sessions (sometimes days old) silently
  conflicted with new `maestro test` runs — steps skipped or hung
  without surfacing an error.
- Text-based matchers (`tapOn: "Keep current"`,
  `assertVisible: "Today"`) returned false against buttons clearly on
  screen. RN modal layers on iOS 26.4 expose nodes the accessibility
  tree probe doesn't always see.
- The test account had no Snacks data on the day under test, so the
  Snacks slot was either dim/empty or not rendered, and the layout
  under test could not be exercised.
- `/tmp/...` artifact paths were cleaned by the sandbox mid-session,
  losing screenshots.
- Permissions: an agent driving these flows lacked the ability to
  `pkill` stale drivers or run the seed/reset scripts.

Net effect: ~45 minutes of automation friction produced zero validation
proof. The PR was merged on code-review confidence and Grace's manual
test alone.

## Decision

Build a small reliability scaffold so the *next* PR — any PR — that
needs a Maestro-driven validation can run in a single command and
either pass or fail cleanly:

1. **testID contract on the touched components**, named symmetrically
   on web + mobile so a single locator works on both surfaces. Names
   are documented in `apps/mobile/.maestro/README.md` and asserted in
   unit tests on both platforms (parity-locked).

   For `TodayMealsSection`:

   ```
   today-slot-{Slot}
   today-slot-header-{Slot}
   today-slot-chevron-{Slot}
   today-log-usual-pill-in-header-{Slot}   (flag-off)
   today-log-usual-row-{Slot}              (flag-on)
   today-log-usual-pill-{Slot}             (flag-on)
   ```

2. **`scripts/maestro-reset.sh`** — kills stale Maestro / driver /
   xcodebuild processes owned by `$USER`, ensures the requested sim is
   booted (default iPhone 17 Pro), terminates the app, prints a single
   `READY` / `NOT_READY` line. Safe to run repeatedly. Does not
   uninstall the app or touch any other user's processes.

3. **`scripts/e2e-seed-today-snacks.ts`** — idempotent fixture seeder
   for the E2E user. Uses `SUPABASE_SERVICE_ROLE_KEY` to wipe prior
   `E2E:` fixtures and insert 1 saved meal (long name, Snacks slot) +
   2 today entries. Refuses to run against any email outside an
   allow-list of domains to bound blast radius.

4. **Per-PR validation flow**
   `apps/mobile/.maestro/validation/today_snacks_v2.yaml` — short,
   testID-driven, writes screenshots to
   `.maestro/artifacts/today_snacks_v2/`. Asserts the six PR-plan
   checks for PR #246.

5. **Single npm entrypoint** `npm run e2e:today-snacks` chains:
   `maestro:reset` → `e2e:seed:today-snacks` → `maestro test
   .maestro/validation/today_snacks_v2.yaml`.

6. **Allowlist additions** documented in
   `apps/mobile/.maestro/README.md` for the agent harness. Added to
   `.claude/settings.local.json` by the user — the agent cannot
   self-modify its own permissions.

## Why this is the right shape

- **testID over text matching** — empirically the single biggest cause
  of flaky Maestro runs on RN/iOS 26.4. A testID is a stable contract;
  text is a fragile guess.
- **Service-role seed over UI driving** — driving the log sheet to seed
  Snacks takes ~6 taps and 10+ minutes via Maestro, fails ~half the
  time, and depends on network. A service-role SQL insert is
  deterministic, idempotent, and runs in <1 s.
- **Reset script over hoping for a clean state** — stale drivers are
  the second-biggest cause of "Maestro hangs." Always reset before a
  run.
- **One npm entrypoint** — so the next agent running PR #N validation
  doesn't have to discover all this from scratch.

## What this is NOT

- Not a replacement for the regression suite (`npm run test:e2e`).
  Validation flows are PR-scoped, run on demand, against a seeded
  fixture; the regression suite covers the canonical user flows on
  whatever state the E2E user happens to have.
- Not a replacement for human eyeballs on the artifact screenshots —
  the flow asserts presence / tap behaviour, not pixel quality.
  Premium-bar concerns still need a human.
- Not a generalised testID scheme for the whole app — added only on
  the components touched by PR #246. Future PRs add testIDs to the
  components *they* touch; the README documents the naming pattern.

## Follow-ups (deferred)

- Add testIDs to other Today surfaces (calorie ring, macro tiles) the
  next time those components are touched.
- Wire `e2e:today-snacks` into CI as a post-merge canary for the
  Snacks slot (only when iOS runner stability allows).
- Generalise `scripts/e2e-seed-today-snacks.ts` into
  `scripts/e2e-seed/` with one file per validation flow.

## References

- PR #246: `fix(today): uncrowd meal section header on narrow widths`
  (commit `5586f0f`).
- PostHog flag id 678945: `today_log_usual_row_v2`.
- `apps/mobile/.maestro/README.md` — testID contract + reliability
  scaffolding docs.
- `apps/mobile/.maestro/validation/today_snacks_v2.yaml` — the flow.
- `scripts/maestro-reset.sh` — driver cleanup.
- `scripts/e2e-seed-today-snacks.ts` — fixture seeder.
