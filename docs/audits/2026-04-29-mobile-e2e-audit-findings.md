# Mobile E2E audit findings — 2026-04-29

**Trigger:** rebuilding the Maestro test suite after the 6→4 IA collapse (2026-04-27) to drive premium-feel papercut hunting via screenshot regression. Test coverage had silently decayed because `verify-maestro-suite` only checks file existence, not selector validity. The audit uncovered both flow-side bugs and **real product gaps** that would be unreachable to users in production.

This doc is the system-of-record for what we found. Repo-side fixes (testIDs, selector swaps) are in `apps/mobile/` and `.maestro/`. Product-gap follow-ups belong on the roadmap and should mirror to Notion per `CLAUDE.md`.

---

## Test infrastructure delivered

### New stable selectors (testIDs added to source)

| Component / file | testID | Purpose |
|---|---|---|
| `(tabs)/_layout.tsx` × 4 | `tab-today`, `tab-recipes`, `tab-plan`, `tab-you` | Tab bar buttons. Replaces the `.*Today, tab.*` regex which iOS 26 broke (dropped the VoiceOver `, tab` suffix). |
| `components/ui/SubTabPill.tsx` | `subtab-{id}` (e.g. `subtab-discover`, `subtab-settings`, `subtab-library`, `subtab-progress`, `subtab-plan`, `subtab-shopping`) | All sub-tab pill nav. Convention applied via primitive — every consumer (Recipes, You, Plan headers) gets it for free. |
| `components/today/LogFab.tsx` | `today-log-fab` | The persistent log FAB on Today (replaces retired quick-log strip). |
| `components/today/LogSheet.tsx` | `log-sheet-root`, `log-sheet-backdrop`, `log-sheet-search-row` | LogSheet modal anchors. Note: testIDs on Views inside `<Modal>` with `accessibilityViewIsModal` are unreliable in Maestro's iOS 26 traversal — see "RN Modal a11y caveat" below. |
| `app/(tabs)/discover.tsx` | `discover-import-cta` | Import row on Discover (the visible text "Import from TikTok, Instagram..." was too long / brittle for `text:` matching). |
| `app/weight-tracker.tsx` | `weight-tracker-input` | Weight number input. Already existed; flow now uses it. |

### Visual regression infrastructure

- `apps/mobile/scripts/maestro-screenshot-diff.mjs` — pixelmatch + pngjs comparator. Scans `screenshots/latest/` against `screenshots/baseline/` and emits an HTML report at `screenshots/diff/report.html`.
- Flags: `--update-baseline`, `--threshold=0.001` (default), `--tolerance=0.1` (per-pixel).
- Scripts: `npm run mobile:test:screens:diff`, `npm run mobile:test:screens:update-baseline`.
- Screenshot points wired into:
  - `02_today_screen.yaml` — `today-01-loaded`, `today-02-scrolled`, `today-03-log-sheet`, `today-04-voice-{upsell,sheet}`, `today-05-search-modal`
  - `33_meal_journal.yaml` — `journal-01-day-strip`, `journal-02-meals-section`, `journal-03-log-sheet`
  - `25_import_shared.yaml` — `import-01-discover`, `import-02-idle`

### Suite hygiene

- `shared/login.yaml` now starts every flow with `launchApp` for state isolation.
- All sub-tab pill taps switched from `text: "^Discover$"` to `id: "subtab-discover"` (etc.) for stability.
- All tab bar taps use testIDs.

### Cross-platform parity tasks completed

- Tests updated (this audit).
- Documentation updated (`apps/mobile/.maestro/README.md` "Stable selectors" section + this audit doc).
- No web-side changes in scope; web/mobile test parity remains a known gap.

---

## Real product findings

These are bugs / gaps that affect actual users, not test plumbing. Ranked by user impact.

### 1. `/more` page is UI-orphaned **(P0 / critical)**

**What:** The 2026-04-28 Group G IA decision (`docs/decisions/2026-04-28-group-g-ia-collapse.md`) removed the "More" sub-tab pill from the You tab, leaving only Progress + Settings. The plan was to fold all `/more` content into `/settings` across batches B-E and convert `/more` to a redirect for one release.

**Status:** Batch A landed (pill removed). Batches B-E are not yet shipped. The `/more` page still renders its full content but **has no UI navigation entrypoint**.

**User impact:** the following are currently unreachable from any tap path:

- Stat pills (Recipes saved count, Streak)
- Membership upgrade card / Manage subscription
- **Goals & Targets section** — Daily Targets editor, Dashboard Widgets, Week Starts On
- **Connections section — Apple Health setup, Notifications row**
- Recipes section — Create Recipe row
- App section — Appearance theme, Export nutrition log, Help & Information
- Legal — Privacy Policy, Terms of Use
- **Danger Zone — Reset, Erase data, Delete account**

This includes Apple Health connection, Daily Targets editing, account deletion — all material flows.

**Recommended fix:** ship Group G batches B-E to migrate content into `/settings`, OR ship the redirect (`/more` → `/settings` with a "We've moved things — find each section in its new home" banner) immediately. Current state is a regression in user agency.

### 2. Fasting screen has no entrypoint when no fast is active **(P1)**

**What:** `app/fasting.tsx` is reachable only via `TodayFastingPill` in `(tabs)/index.tsx:3217`, which renders **only** when `activeFastStart` is truthy (a fast is in progress).

**User impact:** a user who configured fasting in onboarding but isn't currently fasting cannot reach the fasting screen to start one. The setting is dead until they manually start a fast through some other path (which currently doesn't exist).

**Recommended fix:** add a "Start fast" entry on Today (when no fast active) or in Settings (Tracking extras section). Decision needed: is fasting a first-class feature with its own entry point, or a small Settings toggle?

### 3. Discover filter pill set changed silently **(P3 / record-keeping)**

**What:** The Discover filter pills used to include "Low Carb" — the test asserted it explicitly. The current pill set excludes it. No decision doc references the change.

**User impact:** if intentional, harmless. If accidental drift, low-carb users lose a useful filter.

**Recommended fix:** confirm intent with `git log -p apps/mobile/app/(tabs)/discover.tsx | grep -i "low carb"`. If intentional, add to changelog. If accidental, restore.

### 4. Discover search placeholder pivoted **(record-keeping)**

**What:** Placeholder changed from "Search 48,000+ recipes" → "Search recipes" (`(tabs)/discover.tsx:580`, with comment calling out the previous claim was aspirational vs the real catalog).

**User impact:** none — this is honest and good. Documenting because the test caught it.

### 5. RN Modal accessibility traversal caveat (iOS 26) **(test-infra note, not a product bug)**

**What:** testIDs on Views inside React Native's `<Modal>` with `accessibilityViewIsModal={true}` are unreliable in Maestro's accessibility traversal on iOS 26. The modal contents render in a separate UIKit accessibility window that Maestro doesn't always read.

**Workaround applied:** post-FAB-tap assertions in `32_food_search_modal.yaml` and `22_barcode_scanner.yaml` switched from `id: log-sheet-root` to `text: "^Log a meal$"` (the visible header text always renders in the tree).

**Implication for accessibility:** worth a manual VoiceOver pass on the LogSheet to confirm screen-reader users can actually traverse it correctly. This is the iOS 26 system-level accessibility tree, and our test framework's behaviour is a proxy for what real assistive tech will see.

### 6. Progress tile labels rely on CSS `textTransform: "uppercase"` **(accessibility concern, P2)**

**What:** "Avg Calories", "Protein Hit", "Streak" tile titles (`(tabs)/progress.tsx:1211`) use `textTransform: "uppercase"` for visual styling. The underlying text node is mixed-case. This means:

- Screen readers read "Avg Calories" (correct, intelligible)
- Visual users see "AVG CALORIES" (intentional design)
- BUT — Maestro/automation reads "Avg Calories" too, which caused the regex `.*AVG CALORIES.*` to never match (now fixed).

**Implication for accessibility:** screen-reader vs visual presentation is correctly aligned (both intelligible). The test bug taught us this is a CSS pattern in widespread use across the codebase — worth auditing other surfaces for consistency.

### 7. FatSecret / FDC API may be unavailable in dev/test environments **(test-infra constraint)**

**What:** `32_food_search_modal.yaml` types "chicken breast", waits for results, drills into one to verify the portion picker. In the latest run, results either didn't come back or the drill-down conditional didn't fire — assertion timed out at 57s.

**Implication:** food search end-to-end coverage requires a working catalog API in the test env. Either mock the response or ensure dev has API keys for FatSecret + FDC. Document the env requirement in the README's Authentication section.

---

## Test execution state

After this audit, the suite has 29 flows. Approximate state of each as of 2026-04-29:

**Reliably passing (5+):** Meal plan, Library, Macro detail, Onboarding, Notifications Prompt, plus likely Today, Meal Journal (have screenshot calls), and others not in the most recent visible output.

**Failing — content drift to reconcile:** Discover (Low Carb pill), Progress (scroll order for `7d` after my Daily Calories scroll insertion).

**Failing — real product gaps blocking the test:** Settings hub, Profile & targets, More menu, Health Sync, Create Recipe, Nutrition Sources, Profile Settings — all blocked by the `/more` UI orphan.

**Failing — environmental:** Food search modal (API), Fasting (no entrypoint), Barcode (LogSheet RN Modal traversal).

**Failing — cascading:** Meal nutrition, Profile & targets — when a preceding flow fails mid-execution and leaves the app on a deep route, `launchApp` resumes there because Expo Router persists nav state in AsyncStorage. The wait-for-Today in `shared/login.yaml` then times out.

**Cascade fix not yet attempted:** `launchApp: { clearState: true }` would force-clear AsyncStorage on every launch and break the cascade — but adds ~5s of re-login time per flow. Worth doing once the `/more` migration lands and the underlying flows are reliable.

---

## Recommended next steps

1. **Ship Group G batches B-E** (or the temporary redirect). This single change will unblock 7 test flows AND restore reachability of Apple Health, account deletion, daily target editing, etc.
2. **Add a Fasting entrypoint** to Today or Settings.
3. **Run `npm run mobile:test:screens:update-baseline`** to promote the screenshots from the passing flows (Today, Meal Journal, Import if it ran) into baseline. Then begin the premium-feel papercut review using `screenshots/baseline/`.
4. **Once Group G migration lands**, revisit Maestro suite health — at that point cascading state-pollution failures should resolve themselves and we can re-audit.
5. **VoiceOver manual pass** on the LogSheet to verify modal accessibility (separate from automation).

---

## Mirror to Notion (per CLAUDE.md)

Pending entries — Notion MCP not used in this session. Add when reconnected:

- **Decisions log row** — title "Mobile E2E audit findings 2026-04-29", area Product, status Resolved, link to this file.
- **Roadmap row** — "Group G batches B-E migration" — status In progress, area Product. Note this audit blocks 7 test flows + restores UI access to Apple Health / account deletion / Daily Targets.
- **Roadmap row** — "Fasting screen entrypoint" — status Open, area Product, P1.
- **Tasks DB row** — "Confirm Discover filter pill change (Low Carb removal) — intentional or drift?" — status Open, area Product.
- **Tasks DB row** — "Manual VoiceOver pass on LogSheet (RN Modal accessibility)" — status Open, area QA.
- **Tasks DB row** — "Document FatSecret / FDC test env requirements in mobile/.maestro/README.md" — status Open, area Test infra.
