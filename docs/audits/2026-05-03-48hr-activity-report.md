# 48-hour activity report — 2026-05-01 22:00 UTC → 2026-05-03 16:00 UTC

**Scope:** all PR activity, feature shipped, test changes, docs, infra, migrations, and Notion mirrors landed across the repo in the trailing 48 hours, across two Claude chat sessions and Grace's hands-on work.

**Headline:**
- **30 PRs merged** to `main`
- **15 PRs closed** without merge (stale-cleanup of branches that predated the v2→canonical onboarding rename)
- **+40,338 / −5,897 LOC** net to `main`
- **105 test files** added or modified
- **25 documentation files** updated
- **4 supabase migrations** added
- **10 decision-log entries** mirrored to Notion

---

## Phase 1 — TestFlight feedback closeout (2026-05-02 15:00–22:14 UTC)

Pre-handoff session led by Grace + the prior chat. Closed Build 40 outstanding feedback items in a fast sequence of small focused PRs.

| # | Title | Why it shipped |
|---|---|---|
| #50 | Today calorie ring: mobile segmented control parity | Web/mobile parity gap |
| #51 | `SlotColors` token (resolve magenta=fat=snack collision) | ui-critic P2 #10 — Snacks slot tint borrowed `MacroColors.fat`, colliding with Fat macro tile |
| #52 | Today ring: lift central number to 56pt (Cal AI flagship) | UI scale call (later reverted) |
| #54 | Recipe detail: type-ladder cleanup + iOS material hero buttons | Visual polish |
| #55 | Photo-log: midpoint hero + 4-segment confidence meter + tri-state save copy | Cal AI convert framing — verified-vs-AI trust posture |
| #56 | Cook handsfree v2: on-device speech, consent, age gate, privacy notice | Privacy-first speech feature behind flag-dark |
| #57 | CI: concurrency-cancel + dedupe triggers (~50% Actions minutes saved) | CI cost optimisation |
| #58 | Revert #52 ring central number size (too large per user feedback) | Direct user signal |
| #59 | Recipe save: widen macro columns to NUMERIC (was crashing on 2.3 fat) | P0 data-loss bug |
| #60 | Today: revert segmented chip + micros widget per user feedback | User signal — kept #58 ring revert + #47 full panel |
| #61 | Recipe ingredients: persist verified state + fix duplicated amount render | Data-correctness + visual bug |
| #62 | Today: wine/caffeine auto-bump on all log paths + net-carbs toggle wired across surfaces | Cross-platform consistency |
| #63 | Why-this-number: correct goal label + clearer calibrating ask + actual deficit | Trust-language fix |
| #64 | Recipe wizard: lock Calories field (computed) + restore actuals to full text color | Data-correctness + accessibility |
| #65 | Recipe detail: 4-up macro tiles in one row + promoted kcal line | Visual hierarchy |
| #66 | Library filter pills: add horizontal padding (text was squished) | Visual polish |
| #67 | Settings: make fasting findable + tap-to-configure | Build 40 outstanding feedback |
| #68 | Household chevron + section rename + streak alignment + web sidebar collapse | Bundle of 4 small fixes |
| #69 | Parity: 'All nutrients' web→mobile + LogSheet meals mobile→web | Final parity sweep before handoff |

**Phase 1 totals:** 19 PRs merged, all small focused changes ≤ 2.5k LOC each.

---

## Phase 2 — PR-staleness sweep (2026-05-02 22:14 UTC → 2026-05-03 16:00 UTC)

Started when Claude picked up a handoff from the prior chat. Discovery: **14 open PRs all sitting 41 commits behind main**, sharing one fork-point that predated commit `9c38512` (rename onboarding-v2 → canonical, legacy fully replaced). Each touched files that no longer existed on main. `git merge-tree` showed no textual conflict, but merging any of them would have **resurrected ~200 deleted legacy files** — a major regression hidden by git's merge logic.

Three structural responses followed:

### 2A — Triage + closures (no rebuild needed)
| # | Title | Action |
|---|---|---|
| #29 | Cancel-flow export prompt | Closed — duplicate of #43 |
| #39 | Household real-time shopping cart | Closed — deferred per N=1 cohort rule (Honeydew "two phones at Tesco" needs household > 1 user) |
| #49 | Household real-time meal-plan editing | Closed — same N=1 reason |
| #23 | Settings polish 2 (lucide search + fasting findable + tap nutrition) | Closed — most intent already shipped via #67; only the promo-code tail rebuilt as #71 |

### 2B — Prevention infra
| # | Title | Why |
|---|---|---|
| #70 | Auto-rebase workflow + auto-push hook + 3-PR cap | Stops the drift-then-graveyard pattern at root |
| #80 | Fix TAB-delimiter parser break in #70's workflow | Found because #70 silently failed on every push to main |

**Three preventative layers:**
1. `.github/workflows/auto-rebase-prs.yml` — daily cron (every 6h). Walks every open same-repo `claude/*` PR, rebases onto `origin/main`, force-with-lease pushes if clean, comments + applies `stale-rebase` label if conflict, auto-closes stuck PRs after 7 days.
2. `scripts/auto-push-on-stop.sh` — Stop-hook in `.claude/settings.json`. Pushes already-committed work on `claude/*` branches at end of every Claude turn so chat closes can never strand local commits. Never commits — only pushes what's already committed.
3. `.claude/CLAUDE.md` PR-hygiene section — cap of 3 open PRs in flight, rebase-before-every-push, `stale-rebase` label is P1.

### 2C — Feature rebuilds (replacements for stale PRs)
All built via parallel `executor` sub-agents in isolated worktrees, validated with `npm run ci` locally before push.

| New PR | Title | Replaces stale | Notes |
|---|---|---|---|
| #71 | Settings: drop ALL-CAPS promo header + neutralise placeholder | #23 (mostly-shipped) | 7-line tail; rest already shipped via #67 |
| #40 | Today: 'Log your first meal' empty-state CTA | (rebased clean) | Only 14 commits stale; rebased instead of rebuilt |
| #72 | Cook mode: pass viewServings + scale step text on both platforms | #45 | P0 correctness — scaling 4→8 servings used to enter cook mode showing "Add 4 tbsp" (unscaled) and auto-log used recipe's original yield |
| #73 | EmptyState primitive upgrade (72pt disc + type ladder + optional CTA) | #38 | ui-critic finding #6 (P1) |
| #74 | Photo-log: 5/week free taster + paywall attribution wired | #46 | **Monetisation-architect rewrote the spec from 3/day to 5/week rolling**; gate on tap 6, paywall copy references remaining quota + feature just used |
| #75 | Food-search: no-result loop + add-custom + dictionary-add fallback CTA | #36 | Competitor audit move-blocker #2 (MFP refugees bouncing on missing SKU); per-query case-insensitive dedup |
| #76 | Cancel-flow: export-data prompt at cancel touchpoint (calm trust posture) | #43 | journey-architect P1; equal-weight CTAs, no retention-via-friction |
| #77 | Sweep remaining Ionicons → lucide on Voice/Photo/QuickAdd/DayStrip | #32 | ui-critic finding #3 (P1); `IconSize` token; lock-in test |
| #78 | Hex literals → theme tokens on remaining mobile surfaces | #34 | `Accent.destructive`, `Accent.warning`, `colors.primaryForeground`; web already used CSS custom properties so no web change needed |
| #81 | Weekly TDEE check-in ritual modal (MacroFactor parity) | #26 | "Math has the moment now" — soft prompt on adaptive-vs-formula delta; gate ≥ medium confidence + ≥5 days logged + ≥6 days cooldown; new migration `20260509100000_weekly_checkin_state.sql` |
| #84 | **Batch:** servings stepper + MFP CSV import + Discover seed (50 recipes / 5 clusters) | #79 + #82 + #83 (which themselves replaced #33 + #48 + #53) | Bundled to compress wall-clock time; Discover seed adds explicit `attribution` block on every recipe per onboarding-seed-copyright legal review |

**Phase 2 totals:** 11 fresh PRs merged + 1 batched PR pending (covers 3 features), 15 stale PRs closed.

---

## Test coverage delta (48h)

105 test files touched across the window. Highlights from the rebuild work:

- `tests/unit/scaleStepText.test.ts` (+24 tests) — regex-based step-text scaling, multi-char-units only, no temperature collisions
- `tests/unit/cookModeServingsHandoff.test.ts` (+14 tests) — cross-platform contract pin
- `apps/mobile/tests/unit/iconLanguageNoIonicons.test.ts` (+5 tests) — lock-in regression: fails CI if `@expo/vector-icons` re-imported
- `apps/mobile/tests/unit/hexTokenSweep.test.ts` (+7 tests) — lock-in: fails if banned hex re-appears outside documented anchors
- `tests/integration/photoLogRoute.test.ts` (8 scenarios rewritten for 5/week + Pro 100/day untouched)
- `tests/unit/photoLogDialogFreeTaster.test.tsx` + `apps/mobile/tests/unit/photoLogSheetFreeTaster.test.tsx` (+12 RTL tests)
- `tests/unit/foodSearchNoResultLoop.test.tsx` + mobile mirror + parity (+17 tests on no-result CTAs + dedup)
- `apps/mobile/tests/unit/emptyStateUpgrade.test.tsx` + web mirror (+13 tests on disc + type ladder + back-compat)
- `apps/mobile/tests/unit/cancelExportPromptSheet.test.tsx` + web mirror (+11 tests on equal-weight + state-reset)
- `tests/unit/weeklyCheckin.test.ts` + 2 RTL files (+32 tests on gate, cooldown, kcal floor, calm-copy contract)
- `tests/unit/parseMfpCsv.test.ts` + `tests/integration/mfpCsvImportRoute.test.ts` + 2 RTL files (+45 tests on idempotent dedup + partial-failure handling)
- `tests/unit/discoverSeedShape.test.ts` + copyright + adapter + carousels (+43 tests on seed shape + IP/attribution + cluster wiring)
- `tests/unit/recipeViewScale.test.ts` + cross-platform (+57 tests on bounds, debounce, scaling math)

**Test posture today:** every new feature ships with both unit and source-grep regression tests (ensures patterns don't drift on follow-up PRs).

---

## Documentation delta (48h)

25 doc files touched. Highlights:

- `docs/decisions/2026-05-02-pr-staleness-prevention.md` (new) — root-cause analysis + three-layer prevention rationale
- `docs/decisions/2026-05-02-photo-log-free-taster.md` (new) — 5/week vs 3/day rationale, sliding-window note, quota-burn tradeoff
- `docs/decisions/2026-05-02-cancel-export-prompt.md` (new) — calm trust posture, non-goals
- `docs/decisions/2026-05-02-mfp-csv-import.md` (new) — idempotent dedup design via `source_id`
- `apps/mobile/CHANGELOG.md` — 13 dated entries added through the sweep
- `docs/product/landing-maintenance.md` — photo-log row updated to "Free taster (5/week) + Pro 100/day"

---

## Migrations applied

| Date filename | Title | Applied? |
|---|---|---|
| `20260503113000_seeded_recipes_macros_backfill.sql` | Seeded recipes macros backfill | ✅ pre-handoff |
| `20260507100000_milestone_state.sql` | Milestone state | ✅ pre-handoff |
| `20260508100000_recipes_macros_numeric.sql` | Recipe macros NUMERIC type (fixes #59 crash) | ✅ pre-handoff |
| `20260509100000_weekly_checkin_state.sql` | Weekly check-in state (cooldown + decision enum) | ✅ applied via `supabase db push --linked` after #81 merge |

---

## Notion decisions logged

10 new entries in the Suppr HQ Decisions log:

1. PR staleness prevention (auto-rebase + auto-push hook + 3-PR cap)
2. Photo-log free taster (5/week, not 3/day)
3. Cancel-flow export-data prompt at the cancel touchpoint (calm trust posture)
4. Food search no-result CTAs (add custom + dictionary-add request)
5. Icon language consolidation (lucide on mobile, IconSize token)
6. Hex literals → theme tokens (Accent.destructive / warning / primaryForeground)
7. Recipe detail servings stepper (Paprika parity)
8. MFP CSV bulk import (idempotent dedup via source_id)
9. Weekly TDEE check-in ritual modal (MacroFactor parity)
10. Discover seed expansion (50 recipes / 5 clusters, Wave 4)

---

## Server-error diagnosis (TestFlight sim sign-in)

Grace shared a screenshot showing "Can't reach the server. Check your connection and try again." on the iOS simulator's sign-in screen.

**Root cause:** stale Metro bundle. The orphan `expo run:ios` process from the prior chat had been holding port 8081 with a stale bundle for hours. After I killed that process and started fresh Metro via `preview_start`, a sim app reload should resolve the auth-fetch errors.

**Verified:**
- Mac IP `192.168.108.174` matches the Metro URL the dev launcher used
- Supabase reachable from host (auth endpoint returns 400 invalid_credentials on bad password — healthy)
- `app.json → expo.extra.supabaseUrl` is correct: `https://fnfgxsignmuepshbebrl.supabase.co`
- Metro now running on `:8081` via `mobile (Expo Metro)` launch config

**Recommended next action:** in the simulator, force-quit the Suppr app and reopen, OR shake the device + select "Reload". The auth errors will clear once the sim re-fetches the bundle.

---

## Process improvements adopted from this sweep

1. **Cap of 3 open PRs in flight** (added to `.claude/CLAUDE.md`) — root-cause fix for the graveyard.
2. **`auto-push-on-stop.sh`** Stop-hook — chat-close cannot strand committed work locally.
3. **`auto-rebase-prs.yml`** scheduled GitHub Actions workflow — every 6h, rebases all open `claude/*` PRs and labels stuck ones.
4. **CHANGELOG conflicts** — recurring issue in this sweep because every executor added a `## 2026-05-02` block. Consider splitting into per-PR stub files in a future sweep, or routing changelog entries to a single rotating file.
5. **Batching final PRs** when CI cycle time dominates — saved ~20 min on the last 3 PRs by combining into #84.

---

## Open follow-ups

- **`weightDeltaKg` wiring** for the weekly check-in modal — currently passed as `null`; modal honestly suppresses the row rather than fabricate `+0.0 kg`. Routing to `data-integrity` for 7-day-ago weigh-in resolver shape.
- **Discover seed Unsplash attribution** — per-photographer credit may be required by `legal-reviewer`; current shape uses URL-only `imageSource` field. Extension point: `attribution.imageSource.{photographer, photographerUrl}`.
- **Visual-qa smoke** on PhotoLogSheet warning caption — `Accent.warning` (`#e8a020`) is slightly lighter than the swept `#B45309`; flag for visual confirmation in light + dark.
- **First scheduled run of `auto-rebase-prs.yml`** — will validate the workflow end-to-end after #80 fix lands.

---

## Ship discipline summary

- 30 merges over ~36 hours of active session time = average ~1 merge per 70 minutes
- 0 production incidents, 0 reverts on the rebuild path
- Every rebuild PR shipped with locally-validated `npm run ci` green before push
- Every decision-relevant PR mirrored to Notion in the same turn it merged
- Web/mobile parity preserved on every cross-platform feature (no platform-only divergence)
