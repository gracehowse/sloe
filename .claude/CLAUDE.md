# Project Rules

This is one product across web and mobile.

## Non-negotiable rules
- Web and mobile must stay in sync at all times
- No feature is complete without:
  - implementation
  - testing
  - documentation
  - cross-platform review
- Documentation must be updated immediately after every meaningful change
- Tests must be updated immediately after every meaningful change
- Prefer correctness over speed
- Prefer real, validated functionality over mocked or partial functionality
- If nutrition / ingredient matching is uncertain, do not guess
- Use count-to-weight normalisation where reasonable
- Ask for clarification only when uncertainty materially affects nutrition accuracy
- **Never apply Supabase migrations via MCP `apply_migration` for files committed to `supabase/migrations/`.** MCP rewrites `schema_migrations.version` to wall-clock NOW(), causing drift from file timestamps (which are sometimes deliberately future-dated for monotonic ordering). Stage the SQL file and ask Grace to run `supabase db push --linked`. Same forbidance applies to Dashboard "Save as migration".

## Quality bar
- Best-in-class UX
- Production-ready logic
- Strong state handling
- Clear user journeys
- No accidental divergence between platforms

## Required workflow
For any meaningful feature, fix, or change:
1. Audit affected area
2. Plan change
3. Implement
4. Check web/mobile parity
5. Update tests
6. Update documentation
7. Re-audit or run release gate if appropriate

## Nutrition-specific rules
For ingredient matching:
- parse ingredient
- detect count vs weight vs household measure
- infer sensible edible weight where safe
- generate multiple candidate matches
- validate nutrition plausibility
- reject low-confidence matches
- only ask for clarification when uncertainty materially affects nutrition

## PR hygiene — non-negotiable

On 2026-05-02 we discovered 14 open PRs that had drifted 41 commits behind `main`, predating the v2→canonical onboarding rename. None could be rebased without manual intent reconstruction; all were closed or rebuilt from intent. Root cause: PRs were opened in parallel and never refreshed against `main` as new work landed.

Three rules to keep this from recurring:

1. **Cap of 3 open PRs in flight at any time.** Before opening a new PR, check `gh pr list --state open` — if 3+ are already open, merge or close one first. Spinning up agents in parallel is fine; opening their PRs in parallel is not.
2. **Rebase before push, every push.** `git fetch origin main && git rebase origin/main` before `git push`. If main moved >5 commits since branch point, rebase regardless of conflicts — easier now than later.
3. **The auto-rebase workflow** (`.github/workflows/auto-rebase-prs.yml`) runs every 6h, force-pushes clean rebases, and flags PRs it can't rebase as `stale-rebase`. Stuck-stale PRs auto-close after 7 days. **Treat the `stale-rebase` label as a P1 — fix or close that day.**

Plus a hook safety net: `scripts/auto-push-on-stop.sh` runs at end-of-turn and pushes any unpushed commits on `claude/*` branches, so chat closes can never strand commits locally.

## Feature flags — non-negotiable

On 2026-05-13 we shipped five sessions of UI changes without
before/after screenshots and without a flag-gated rollout. That
violated `feedback_visual_validation_mandatory.md` and shipped
visual changes blind. Two complementary rules from now on:

1. **Visual or structural changes ship behind a feature flag.**
   Use `isFeatureEnabled("flag-name")` from `@/lib/analytics` on
   web or the mobile equivalent in `apps/mobile/lib/analytics.ts`.
   Gate the new path, leave the old path alive in the `else`, ramp
   via PostHog dashboard. Once the flag has held 100% for two
   weeks with no regression, the gate can be removed in a follow-
   up cleanup PR.

   Applies to: tab order, navigation, layout, divider patterns,
   colour mappings, animation timings, copy that changes meaning
   (not typo fixes).

   Does NOT apply to: pure logic / API changes, bug fixes with
   no visual surface, typo-only copy fixes, internal-only
   utilities.

2. **Session replay is on (web + mobile) — use it.** PostHog
   captures every consent-accepted session with inputs masked. When
   a TF report arrives, the first move is to scrub the replay
   before opening the repo. See
   `docs/decisions/2026-05-13-session-replay-and-feature-flags.md`
   for the privacy posture (masking selectors, console-log opt-out,
   project-level toggles).

   Session replay is the safety net, not the gate. It does not
   replace the "validate in sim before push" rule from
   `feedback_validate_in_sim_before_push.md`.

## CI hygiene — non-negotiable

CI runs more gates than a single `npm test` does. Failures are
visible to Grace + waste deploy slots. Two rules:

1. **Run `npm run ci` locally before every push.** Mirrors the CI
   workflow — verify-production-env + web typecheck + web vitest +
   `next build` + mobile typecheck + mobile vitest. If it fails
   locally, do not push. (`next build` is in the chain because
   Next 15's PageProps constraint is build-time only — `tsc --noEmit`
   won't catch e.g. async `searchParams` violations on its own.)
2. **Watch CI after every push.** `gh run watch` after `git push`,
   or `gh run list --limit 3` to confirm the latest is green. If
   the most recent run is red, fix it BEFORE moving to the next
   task. A red main blocks all collaborators.

Common reasons local-vs-CI diverge:
- TypeScript build cache. Local `.tsbuildinfo` may carry stale
  type info from prior runs. CI starts cold. Re-run `tsc --noEmit`
  with no cache if you suspect drift.
- Date-dependent tests. Anything using `new Date()` in a fixture
  is calendar-day-of-week sensitive. Use a deterministic helper
  (see `dateKeyInPreviousWeek` in `weeklyRecapPushRoute.test.ts`)
  or `vi.useFakeTimers()` (carefully — async tests with real
  setTimeouts will hang).
- Missing env vars. CI has minimal env (`VERIFY_STRICT=0`); local
  may have more. Check `.github/workflows/ci.yml` for the canonical
  env set.
  
## Notion mirroring — non-negotiable

Grace runs a Notion workspace ("Suppr HQ") that mirrors the operating view of Suppr. The repo is the canonical source of truth for code, docs, decisions, and the roadmap. Notion holds the higher-level operating layer: working task list, decisions log, roadmap state, content calendar, vendors, runway.

**When you ship a feature, resolve a decision, or change roadmap state in this repo, mirror the change to Notion in the SAME turn.** Don't wait for Grace to ask.

Notion workspace anchors:

- Suppr HQ home: https://www.notion.so/34859b415030817a8232d802fc9acc78
- Company: https://www.notion.so/34859b415030810491ccc8a4d52a319e
- Product & engineering: https://www.notion.so/34859b41503081e084d3f710df3918b3
- Growth & marketing: https://www.notion.so/34859b41503081b19a6afac92503ce68
- Operations & finance: https://www.notion.so/34859b415030817eb0ddd934d8b86287
- Tasks DB: https://www.notion.so/55ab62d91aa9488796ad84a0f14672a3 (data source `collection://a10d55ea-64fe-4468-8a92-65c2b5e6d6df`)
- Decisions log DB: https://www.notion.so/731ee63201584879b311a69cea4dc523 (data source `collection://ffbda5f6-6d65-4b18-8d3f-94c6f0a8837c`)
- Roadmap DB: https://www.notion.so/6d5e815b6a4c404d845d8a48f19ae673 (data source `collection://c6e2c4f1-5b3b-4c3f-8dff-7c026a453749`)
- Content calendar DB: https://www.notion.so/312e13d7cb01432d9452b7cc3cd05e35 (data source `collection://8968ab9f-c355-4e2d-beb5-e8afe4cd9998`)
- Vendors & subscriptions DB: https://www.notion.so/073c8f08a5464316a74b91da49cf74af (data source `collection://f9fd3f22-ffda-4687-88b1-b32368a3f57b`)

Mirror rules:

- New file in `docs/decisions/` → add a row to the Decisions log with title, date, area, status (Resolved unless explicitly tentative), one-line summary, and the GitHub blob URL to the repo file.
- Phase/state change or new item in `docs/product-roadmap.md` → add or update the matching Roadmap row. Keep state values in `{Shipped, In progress, Open, Deferred}`.
- Feature fully shipped (implementation + tests + docs + cross-platform review) → mark matching Roadmap row as Shipped and close any matching open Tasks (Status → Done).
- New paid vendor or subprocessor added to the stack → add to Vendors & subscriptions with category, plan, monthly cost (£), renewal, critical?, URL.
- New marketing asset drafted/published → add to Content calendar with channel, status, publish date, asset link.
- **Never duplicate verbose repo docs into Notion.** Link back to repo paths (e.g. `docs/decisions/...`) as the source of truth.

If the Notion MCP isn't connected in a session, do the repo work as normal and list the pending Notion mirror actions at the end of the response so Grace can re-run them when connected.

## Git commits

**One-time per clone:** strip tool footers from commit messages (e.g. `Made-with: Cursor`):

```bash
git config core.hooksPath scripts/git-hooks
```

Hooks live under `scripts/git-hooks/` (see `prepare-commit-msg`). New machines need the same `core.hooksPath` setting.