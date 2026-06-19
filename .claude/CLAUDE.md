# Project Rules

This is one product across web and mobile.

**Agent doc layout:** Global rules live in this file (`.claude/CLAUDE.md`). A tracked
mirror at repo-root **`AGENTS.md`** exists so Codex, Cursor, and other agents on a
fresh clone see the same requirements — run `npm run sync:agent-docs` after editing
this file. Mobile-scoped rules: **`apps/mobile/CLAUDE.md`**.

## Decision framework

Match the rigour to the stakes — a light touch on the obvious, full weight on
anything consequential or hard to reverse. The goal is a well-reasoned, decisive
answer, not a fixed ritual.

For anything non-trivial, before you land:

- **Pressure-test it.** How would this actually fail in production or real use?
  Name the failure modes that are genuinely real — not a quota of three.
- **Weigh the alternatives worth weighing**, and say why the others lose. No
  strawmen; and never float a quick or temporary fix as a live option — propose
  the correct one and state its cost.
- **Be honest about what's uncertain.** Add a confidence read (1–10) when it
  changes how much to trust the answer; skip it when it would just be noise.

Then commit to one recommendation — don't hand back a menu.

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
- **No screen file over 400 lines.** If a component grows past 400 lines, extract a `use<Screen>()` hook or break child components into their own files. The 3,400-line `(tabs)/index.tsx` and 2,671-line `NutritionTracker.tsx` are legacy — every new touch should move toward the 400-line target, not away from it. (ENG-621)

## UI write discipline — non-negotiable

Design drift is prevented at write time, not caught in review. Review sweeps
kept passing surfaces Grace then faulted for spacing/consistency because the
rules only existed in review agents — nobody writing UI code had them. They
apply to EVERY line of UI code, whoever writes it (Claude or Cursor). Full
contract: "Design craft contract" in `.claude/agents/_project-context.md`.

- **Tokens only.** Colour, spacing, radius, type, and shadow values come from
  `apps/mobile/constants/theme.ts` (mobile) / `src/styles/theme.css` + the
  Tailwind theme (web). No literal hexes, no off-scale numbers. If the value
  you need doesn't exist, add the token first, then use it.
- **Spacing snaps to the scale:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40
  (12 adopted 2026-06-10, ENG-1012 — the dense chip/row step). An 18px
  padding or 10px gap is a bug even if it looks fine.
- **Radius snaps to:** 4 / 6 / 8 / 12 / full.
- **Type comes from the ramp** (`Type` on mobile; type-scale-gated classes on
  web) — no ad-hoc font sizes or weights.
- **States ship with the element, not as polish.** Interactive = pressed
  (mobile, via `PressableScale` with the right `haptic` weight) / hover +
  `:focus-visible` + active (web), plus disabled, plus loading on async
  commits (disable + progress — no double-submit, no silent success/failure).
- **One filled CTA per screen** (FAB + conversion surfaces excepted — see the
  2026-06-09 CTA decision). Secondary = outline, tertiary = ghost.
- **Elevation per the one-card decision:** page-ground cards soft lift,
  nested cards flat — one treatment per surface.
- **Same element, same treatment.** Before styling a chip/pill/row/header,
  check how the nearest existing sibling renders it and match exactly — or
  document why this one is deliberately different.

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
visible to Grace + waste deploy slots. Three rules:

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
3. **Scope your checks to what you touched.** Don't run the full
   `npm run ci` after a one-surface change — it wastes time and
   context on irrelevant output, and the CPU contention flakes
   timing-sensitive tests (see `feedback_no_concurrent_full_suites_with_workflow`).
   Touched only mobile → `npm run mobile:lint && npm run
   mobile:typecheck && npm run mobile:test`. Touched only web →
   `npm run typecheck && npm run lint && npm run test`. Run the full
   `npm run ci` once at the end, before the final push.

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

## Linear updates — non-negotiable

Linear is the canonical task list (per `feedback_work_from_linear.md`).

### Agent ownership (Cursor / Claude / Codex)

**Peer-review model** (2026-06-18): Claude **directs and reviews**; Cursor + Codex **implement and QA** (user lens vs engineer lens). QA findings triage through Claude — never Cursor↔Codex ping-pong. Decision: `docs/decisions/2026-06-18-agent-peer-review-model.md`.

Linear **assignee** = accountable human (usually Grace). **Delegate** = app user doing the work (**Cursor** and **Codex** only). **Claude** = labels only (`agent/claude`), never delegate. Full setup: `docs/planning/linear-agent-ownership.md`.

### Agent pickup & delivery (non-negotiable)

**Work from Linear only.** Full workflow: `docs/planning/linear-agent-workflow.md`.

**Pickup:** Cursor → `delegate:Cursor` + `label:agent/cursor`. Codex → `delegate:Codex` + `label:agent/codex` + `ready-for-agent` + **Todo**. Claude → triage/review/planning via `label:agent/claude`; `label:qa-finding` = triage queue. **Do not** assign QA findings directly between Cursor and Codex.

**Before coding:** read ticket → list expected files in a comment → `git fetch origin main && git rebase origin/main` → branch `agent/<agent>/<linear-id>-short-name` → stay in scope.

**After coding:** scoped lint/typecheck/tests → commit → PR linked to ticket → move ticket to **In Review** (PR open) → Linear comment with summary, risks, testing.

**Status mapping until custom workflow states exist:** Todo + `ready-for-agent` = ready for agent; **In Review** = PR open.

Linear has **two different concepts**:

1. **Project state** (`Backlog` / `Planned` / `In Progress` / `Completed` / `Canceled`) — the lifecycle badge on the project bar. **Linear never auto-updates this when issues close.** Agents must set it explicitly via MCP `save_project` with `state`, or run `npm run linear:sync-status` after bulk issue closures.
2. **Status update posts** (narrative rollups on the Updates tab) — **both** initiative and project level. Linear's initiative overview flags **"child projects requiring updates"** when projects lack a `lastUpdate` post (separate from lifecycle state). Post via MCP `save_status_update` (`type: "project"` or `"initiative"`), or run `npm run linear:sync-status-updates` after bulk syncs.

**When you close ≥1 issue, move state on any issue, or add new issues inside an initiative's projects:** (1) set project **state** if the lifecycle changed (`save_project` or `npm run linear:sync-status`); (2) post **project** and **initiative status updates** if child projects would show as needing updates (`save_status_update` or `npm run linear:sync-status-updates`). Don't post empty updates — silence is the right move when nothing moved.

Tool call:

```
mcp__linear-server__save_status_update
  type: "initiative"
  initiative: "<name or id>"
  health: "onTrack" | "atRisk" | "offTrack"
  body: <markdown>
```

Body shape — group project work under `## <Project name>` subheaders so readers can scan by surface. Use a short shipped / open / deferred frame per project, then a brief health rationale at the end.

Set `health` deliberately — it's what the planning level looks at first. Initial-health updates (first time setting health on an initiative that had `null`) are OK even without state movement; the health field itself is the change.

Current initiative inventory (as of 2026-06-11, post-restructure — 7 active; see `docs/planning/2026-06-11-linear-restructure.md`):

- **`Launch 2026-07-01`** — time-bound viral push (target 2026-07-01). Projects: **Gate 0 — launch hardening** (the 2026-06-11 audit's net-new P0/P1 security/data/parity cluster), AI features (dual), Pre-launch monetisation + billing, Pre-launch incorporation + legal, MFP-refugee capture, Premium bar audit (2026-05-12, mostly Duplicate-state — effectively closed), **Today tab** (dual), **Recipes tab** (dual).
- **`Surface polish`** — non-time-bound per-tab UX polish. Projects: Today tab (dual), Progress tab, Recipes tab (dual), Plan tab, Onboarding + Auth, Landing + Marketing site, **Category-leading growth backlog** (the ENG-927→979 growth features — beta-window, NOT launch-blockers).
- **`Platform foundations`** — non-time-bound technical infra. Projects: Schema refactor, Operations, Design system cleanup, Post-iOS platform, **AI features** (dual), **Synthetic persona testing**, Architecture enablers (ex-Premium-P5).
- **`Redesign — Design Direction 2026`** — the Sloe redesign. Projects: Figma conformance migration (the 6 open DECISION issues ENG-919–925 live under Redesign P0 — Foundations, awaiting Grace's ratification), Redesign P0–P5.
- **`Recipe import, AI imagery & creators`** — the import wedge + creator plane. Projects: Creator platform, AI image generation, Import posture & legal (ENG-857/858/859 the legal launch bundle).
- **`Full-product audit sweep — 2026-05-25`** — Project: Audit sweep remediation.
- **`Plan Import`** — Projects: Sprint 1 (paste + auto-rebalance), Sprint 2 (PDF + image).

Archived 2026-06-11: **`Premium experience — launch bar`** (superseded — its premium-bar program folded into Redesign + Gate 0 + the launch-readiness audit; its architecture-enabler issues live on under Platform foundations).

**Dual-initiative pattern:** Today tab and Recipes tab roll up to BOTH Surface polish (ongoing polish home) and Launch 2026-07-01 (launch-blocking work home). These are the two surfaces genuinely on the launch critical path — Today = retention; Recipes = viral hook landing. Their health flows to both initiatives' rollups. Other surfaces stay single-initiative under Surface polish.

**`launch-blocker` label (workspace-wide):** for issue-level granularity inside any project. Apply to any issue that must ship before 2026-07-01. Use the Linear filter `label:launch-blocker` for a cross-cutting "everything blocking launch" view that doesn't care which project/initiative the issue lives under.

Project and initiative **status update posts** clear the "child projects requiring updates" banner in Linear. Lifecycle state still updates via `save_project` / `save_initiative` or `npm run linear:sync-status`.

## No silent deferrals — non-negotiable

On 2026-05-26 Grace kept re-discovering the same gaps (FatSecret micros silently skipped, OFF micros stale, onboarding-seed persistence "staged for follow-up") because prior sessions parked them in **code comments** — `TODO`, `intentionally skipped`, `for now`, `not yet wired`, `staged for follow-up` — never tracked anywhere. A `code-quality` audit found ~22 such untracked gaps. Buried-in-a-comment is invisible: it rots until the founder trips over it again.

Rule: **a deferral is never silent.** When you defer real work, do ONE of:

1. **Fix it now** (preferred for anything bounded/small), or
2. **Open a Linear issue** and reference its ID in the comment (`// deferred: see ENG-NNN`), or
3. If it's a permanent, correct design choice, say so explicitly (`intentionally <reason> — not a gap`) so it never reads as pending.

Banned: a comment describing unresolved work with no Linear reference (`TODO`, `for now`, `not yet`, `staged for follow-up`, `known gap`, `should eventually`). If it's worth a comment, it's worth a ticket or a fix.

When a flow/step is **removed or superseded**, delete the dead code + its stale "staged for follow-up" comments in the same change (e.g. the cut onboarding recipe-picker `finalStep.ts`/`recipes.tsx`) — don't leave them implying pending work.

Audit cadence: run the `code-quality` silent-deferral sweep at each milestone review; every new `TRACK` item gets a Linear issue that turn.

## Git commits

**One-time per clone:** strip tool footers from commit messages (e.g. `Made-with: Cursor`):

```bash
git config core.hooksPath scripts/git-hooks
```

## Mobile (iOS) work

Mobile-specific conventions (bundle id, tabs, auth, iOS-only target) live in
**`apps/mobile/CLAUDE.md`**, loaded automatically when you work under
`apps/mobile/`.

To drive the iOS simulator — test/verify a mobile UI change, capture pixels,
reproduce a TestFlight report — the full MCP playbook is the
**`suppr-ios-sim-testing`** skill, which loads on demand. The rule that stays
here because it's behavioural, not how-to: **never ask Grace to drag simulator
screenshots into chat** — drive the sim yourself and Read the PNG.

## Web app work

To drive the web app — test web or mobile-web, check web↔mobile parity,
capture pixels — the full `scripts/web-drive.mjs` playbook is the
**`suppr-web-testing`** skill, which loads on demand. The rule that stays here
because it's behavioural: **never ask Grace to paste browser screenshots** —
drive + screenshot it yourself, and SEE the PNG (don't claim a pass from the
ARIA tree alone).

## Git hooks

Hooks live under `scripts/git-hooks/` (see `prepare-commit-msg`). New machines need the same `core.hooksPath` setting.

## Cursor Cloud (cloud agents)

Durable notes for cloud-agent VMs (Linux, deps pre-installed via the startup
script: `npm ci` at root + in `apps/mobile`, plus `npx playwright install
chromium`). `AGENTS.md` is gitignored, so cloud-agent context lives here.

- **Web is the runnable surface.** `npm run dev` → http://localhost:3000.
  Standard commands are in the README "Scripts" table / `package.json`.
- **The web app talks to the LIVE hosted Supabase with no `.env.local`** — the
  browser client falls back to the hard-coded prod project in
  `utils/supabase/info.tsx`. Email sign-up returns a session immediately (no
  confirmation), so auth/data work out of the box — but **test signups/writes
  hit the real prod DB; use throwaway `…@example.com` emails.** Set
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to point dev at a
  non-prod project (resolver in `utils/supabase/publicConfig.ts`).
- The boot log `[Suppr] Missing server env (…)` is **expected and non-fatal** —
  only server-only features (service-role ops, USDA/FatSecret, Stripe) need those
  secrets; client food search + meal logging work without them.
- **Never run `npm run build` and `npm run dev` together** — both write `.next`
  and corrupt each other.
- `scripts/web-drive.mjs` probes `127.0.0.1:3000` (not `localhost`). Drive
  interactive auth/sign-up flows in a real desktop browser — the helper is built
  for unauthenticated/`--auth`-storage-state captures, not interactive login.
- **The mobile app can't run on the Linux cloud VM** (needs macOS + Xcode sim).
  `mobile:lint` / `mobile:typecheck` / `mobile:test` and `npx expo export` do
  run here; mobile typecheck needs **root** `node_modules` (shared `@suppr/shared/*`).
- CI pins Node 20; the cloud VM runs Node 22, which installs/builds/tests fine.