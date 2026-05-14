# P2 proposal table — detail / settings surfaces

**Status:** EMPTY (populated after S6 audit run)
**Bucket size:** ~70 surfaces
**Capture set:** `docs/audits/2026-05-15-premium-sweep-v2/captures/P2/`
**Auditor report (S6 output):** `docs/audits/2026-05-15-premium-sweep-v2/P2-auditor-report.md`

**Posture for this bucket:** function-first. Visual polish only where
it's been letting the side down. Cap proposal density at ~30
actionable rows; split into P2a / P2b only if the auditor produces
more.

---

## In-flight tripwire

- Items in this bucket: **0** (table not yet populated)
- Reverts so far: **0 / 2**
- On 2nd revert: bucket pauses; mini-retro required at
  `docs/audits/2026-05-15-premium-sweep-v2/P2-tripwire-retro.md`,
  and Grace must approve resuming before any further row touches code.

---

## Surface scope (~70)

### Web — settings + profile + auth-adjacent
- `app/settings/page.tsx` — Settings
- `app/profile/page.tsx` — Profile editor
- `app/targets/page.tsx` — Targets
- `app/notifications/page.tsx` — Notifications
- `app/account/billing/page.tsx` — Account billing
- `app/fasting/page.tsx` — Fasting
- `app/creator/[id]/page.tsx` — Creator profile
- `app/reset-password/page.tsx` — Reset password

### Web — minor dialogs
- `src/app/components/suppr/why-this-number-dialog.tsx`
- `src/app/components/suppr/weekly-checkin-dialog.tsx`
- `src/app/components/suppr/milestone-30-day-dialog.tsx`
- `src/app/components/suppr/activity-level-picker-dialog.tsx`
- `src/app/components/suppr/cancel-export-prompt-dialog.tsx`
- `src/app/components/suppr/rename-saved-meal-dialog.tsx`
- `src/app/components/suppr/destructive-confirm-dialog.tsx` (DC9 surface)
- `src/app/components/suppr/text-prompt-dialog.tsx`

### Web — legal + informational
- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/licences/page.tsx`
- `app/dmca/page.tsx`
- `app/whats-new/page.tsx`
- `app/help/page.tsx`
- `app/roadmap/page.tsx`

### Mobile — settings + profile + integrations
- `apps/mobile/app/(tabs)/settings.tsx` — Settings
- `apps/mobile/app/profile.tsx` — Profile editor
- `apps/mobile/app/targets.tsx` — Targets (DC11 / DC14 surfaces)
- `apps/mobile/app/household-settings.tsx` — Household
- `apps/mobile/app/health-sync.tsx` — Health Sync
- `apps/mobile/app/nutrition-sources.tsx` — Nutrition Sources
- `apps/mobile/app/(tabs)/notifications.tsx` — Notifications
- `apps/mobile/app/notifications-prompt.tsx` — Notifications prompt
- `apps/mobile/app/fasting.tsx` — Fasting
- `apps/mobile/app/creator/[id].tsx` — Creator profile
- `apps/mobile/app/(tabs)/more.tsx` — More sub-tab

### Mobile — recap + history + recipe-create
- `apps/mobile/app/weekly-recap.tsx` — Weekly Recap
- `apps/mobile/app/whats-new.tsx` — What's New
- `apps/mobile/app/progress-metric.tsx` — Progress metric detail
- `apps/mobile/app/create-recipe.tsx` — Create recipe
- `apps/mobile/app/import-shared.tsx` — Import shared recipe
- `apps/mobile/app/recipe/create.tsx` — Recipe create (alt)
- `apps/mobile/app/recipe/verify.tsx` — Recipe verify

### Mobile — minor sheets
- `apps/mobile/components/AddIngredientSheet.tsx`
- `apps/mobile/components/recipe/CreateRecipeActionSheet.tsx`
- `apps/mobile/components/household/HouseholdInviteSheet.tsx`
- `apps/mobile/components/recap/GoalPaceRetuneSheet.tsx`
- `apps/mobile/components/settings/CancelExportPromptSheet.tsx`
- `apps/mobile/components/today/Milestone30DayModal.tsx`
- `apps/mobile/components/today/WeeklyCheckinModal.tsx`
- `apps/mobile/components/today/WhereThisComesFromSheet.tsx`
- `apps/mobile/components/today/WhyThisNumberSheet.tsx`
- `apps/mobile/components/progress/AllWeightDataSheet.tsx`
- `apps/mobile/components/today/FullNutrientPanelSheet.tsx`
- `apps/mobile/components/JournalDatePickerModal.tsx`

---

## Capture map

(empty — populated at S6)

---

## Proposal table

`Item type`: SUBTRACT / TIGHTEN / REPLACE / NEW
`Complexity`: cleanup (<1h) / refactor (1-4h) / new build (>4h) / design-needed
`Status` lifecycle: proposed → approved → in-progress → implemented → sim-validated → `[x]` (or → rejected / reverted)

| # | Surface | Item type | What changes | What it duplicates / weakens | Before screenshot path | After-target description | Affected platforms | DC# touched | Auditor verdict | Complexity | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|

(empty — populated at S6 from auditor report)

---

## Refuse-to-pass (sub-list)

(empty)

---

## Defended Choices touched (sub-list)

Likely to include DC9 (reset modal soft/hard split), DC11 (adaptive
TDEE in Free tier — Targets surface), DC14 (profile dark mode +
safety-floor warning), DC15 (UK/EU VAT-inclusive pricing — pricing /
checkout flow). Filled from S6 auditor report.

(empty)
