# Project Rules

This is one product across web and mobile.

## Decision framework — before answering

Before answering any non-trivial question or implementing a change:

1. List the top 3 ways this could fail in production or real-world usage.
2. Give 3 alternative approaches with trade-offs.
3. Rate your confidence from 1-10 and explain what you are uncertain about.

Then provide your recommended approach.

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

## Linear updates — non-negotiable

Linear is the canonical task list (per `feedback_work_from_linear.md`). **Initiative status updates** are the rollup mechanism — project-level updates are deprecated on this workspace (confirmed 2026-05-16 against Business trial; the feature has been removed from newer Business workspaces in favour of initiatives, not a toggle).

**When you close ≥1 issue, move state on any issue, or add new issues inside an initiative's projects, post an initiative status update before ending the session.** Don't post empty updates — silence is the right move when nothing moved.

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

Current initiative inventory (as of 2026-05-16):

- **`Launch 2026-07-01`** — time-bound viral push (target 2026-07-01). Projects: Phase 0 — Viral push prep, Pre-launch monetisation + billing, Pre-launch incorporation + legal, MFP-refugee capture, Premium bar audit (2026-05-12), **Today tab** (dual), **Recipes tab** (dual).
- **`Surface polish`** — non-time-bound per-tab UX polish. Projects: Today tab (dual), Progress tab, Recipes tab (dual), Plan tab, Onboarding + Auth, Landing + Marketing site.
- **`Platform foundations`** — non-time-bound technical infra. Projects: Schema refactor, Operations, Design system cleanup, Post-iOS platform.

**Dual-initiative pattern:** Today tab and Recipes tab roll up to BOTH Surface polish (ongoing polish home) and Launch 2026-07-01 (launch-blocking work home). These are the two surfaces genuinely on the launch critical path — Today = retention; Recipes = viral hook landing. Their health flows to both initiatives' rollups. Other surfaces stay single-initiative under Surface polish.

**`launch-blocker` label (workspace-wide):** for issue-level granularity inside any project. Apply to any issue that must ship before 2026-07-01. Use the Linear filter `label:launch-blocker` for a cross-cutting "everything blocking launch" view that doesn't care which project/initiative the issue lives under.

Don't try to enable project status updates — there's no workspace toggle for it; Linear removed the feature. `save_status_update type: "project"` returns "not enabled for this workspace" — don't retry.

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

## iOS Simulator Testing (MCP — eyes and hands)

**Do not ask Grace to drag simulator screenshots into chat.** Use the **`ios-simulator` MCP server** (see `docs/testing/agent-eyes-and-hands.md` and `.cursor/mcp.json`). Prerequisite: `npm run agent:verify-tools` passes (IDB + companion).

When asked to test a feature or verify a mobile UI change:

1. **Metro running**: `npm run mobile:dev` or `npm run mobile:dev:maestro` (port 8081 for Maestro-aligned flows).
2. **Dev client on sim**: `npm run mobile:ios:simulator` if not installed or after native dependency changes.
3. **`get_booted_sim_id`** — confirm a booted simulator.
4. **`launch_app`** — `bundle_id: com.supprclub.supprapp`, `terminate_running: true` after module-level layout/font/ring changes (Fast Refresh is not enough).
5. **Navigate** — prefer **deep links** from `sitemap.md` (`simctl openurl` / MCP equivalents); then `ui_find_element`, `ui_tap`, `ui_swipe` (scroll is required for below-fold Today content).
6. **Verify** — `ui_describe_all` or `ui_find_element`; compare expected labels/states.
7. **See pixels** — `screenshot` or `ui_view`; **Read the image file** in the repo (`apps/mobile/screenshots/agent/`). Never claim visual pass from accessibility text alone.
8. **Report** — pass/fail per surface + screenshot path.

### MCP tool names (`ios-simulator`)

| Intent | Tool |
|--------|------|
| Booted UDID | `get_booted_sim_id` |
| Launch Suppr | `launch_app` |
| Full a11y tree | `ui_describe_all` |
| Find by label | `ui_find_element` |
| Tap / swipe / type | `ui_tap`, `ui_swipe`, `ui_type` |
| Screenshot | `screenshot` or `ui_view` |

Shell fallback when MCP unavailable: `idb`, `xcrun simctl` — same semantics as `sitemap.md`.

### When something looks wrong

1. `ui_describe_all` — expected vs actual elements
2. Screenshot for Grace only if MCP cannot fix in-session
3. Propose a code fix; re-run steps 4–7 after rebuild/relaunch

### Suppr specifics

- **Bundle id:** `com.supprclub.supprapp`
- **Auth:** Apple Sign In (no email/password QA form)
- **Tabs:** Today / Plan / ＋(FAB) / Recipes / Progress — Settings via avatar, not a tab
- **Map:** `sitemap.md` (deep links + tabs)
- **idb PATH:** `~/.local/bin/idb` via pipx + Python 3.12 (`fb-idb` breaks on 3.14)

## Web App Testing (Playwright — eyes and hands)

The web equivalent of the iOS sim loop above. **Do not ask Grace to paste browser screenshots.** Drive + screenshot the running web app yourself with **`scripts/web-drive.mjs`** — a repo-native CLI over the Playwright the repo already ships (no MCP / new dependency). It is the web analogue of `idb`: launch, navigate, read the DOM/accessibility tree, screenshot to a file.

When asked to test web or mobile-web, or to check web/mobile parity:

1. **Serve**: `npm run dev` — app at `http://localhost:3000` (Next.js + Turbopack). Helper reads `WEB_DRIVE_BASE_URL` to target another host/port. (Browser is preinstalled; if `chromium.launch()` fails once, run `npx playwright install chromium`.)
2. **Launch / point**: every `web-drive` command spins up a fresh headless Chromium against the dev server and exits non-zero with an actionable message if nothing is listening.
3. **Navigate** — pass a route; for signed-in surfaces (Today / Activity / Plan) add **`--auth`** to load the committed session (`tests/e2e/.auth/user.json`) so you land on the app, not `/login`. Multi-step: `web-drive.mjs flow <route> click:".." fill:".."="v" wait:ms goto:/p shot:f.png`.
4. **Read state** — `web-drive.mjs snap <route>` prints the **ARIA accessibility tree** (the web `ui_describe_all`); `dom <route> [--sel CSS]` dumps HTML; `text <route> [--sel CSS]` dumps visible text; `eval <route> "<js>"` returns JSON for getComputedStyle / contrast checks.
5. **Screenshot** — `web-drive.mjs shot <route> [--out FILE] [--auth] [--vp desktop|mobile|WxH] [--full] [--dark] [--flags a,b]`. Default out: `screenshots/web-drive/<route>-<vp>.png`. Dev overlay is auto-hidden (matches what ships). **Read the PNG file** in the repo — never claim a visual pass from the accessibility text alone (SEE, don't just orchestrate).
6. **Report** — pass/fail per surface + screenshot path. For **parity**, capture mobile-web at **`--vp mobile`** (390×844) and compare against the iOS sim capture of the same surface; visible UI changes Grace makes on mobile must land on the equivalent web surface.

### web-drive commands (`scripts/web-drive.mjs`)

| Intent | Command |
|--------|---------|
| Screenshot a route | `node scripts/web-drive.mjs shot /today --auth --vp mobile` |
| Element-only shot | `node scripts/web-drive.mjs shot /pricing --sel "main" --out screenshots/web-drive/pricing.png` |
| Accessibility tree | `node scripts/web-drive.mjs snap /today --auth` |
| DOM / text dump | `node scripts/web-drive.mjs dom /pricing --sel "main"` · `… text /`|
| getComputedStyle etc. | `node scripts/web-drive.mjs eval / "JSON.stringify(getComputedStyle(document.body).backgroundColor)"` |
| Multi-step flow | `node scripts/web-drive.mjs flow /login fill:'you@domain.com'="x" wait:500 shot:after.png` |
| Force flags ON | add `--flags design-system-colours,redesign-motion` (client-side `__SUPPR_FORCE_FLAGS__`) |

`--vp` accepts `desktop` (1440×900), `mobile` (390×844), or `WxH`; `--dark` emulates dark mode; captures render at 2× for retina sharpness.

### Notes

- **Stale auth state** → `shot --auth` warns when it redirects to `/login`. Regenerate: `E2E_EMAIL=… E2E_PASSWORD=… npx playwright test auth.setup.ts --project=setup`.
- **Repo E2E remains `npm run test:e2e`** (the Playwright test runner + golden screenshots). `web-drive` is for **agent-driven interactive verification** during implementation — the screenshot specs in `tests/e2e/screenshots/` are the durable regression layer.
- **Fallback:** the `playwright` MCP (`@playwright/mcp`, listed in `.cursor/mcp.json`) drives the browser too when the CLI isn't an option, but prefer `web-drive.mjs` — it runs from any shell + CI and leaves files on disk to Read.

## Git hooks

Hooks live under `scripts/git-hooks/` (see `prepare-commit-msg`). New machines need the same `core.hooksPath` setting.