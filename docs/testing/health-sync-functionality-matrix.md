# Apple Health meal import — functionality test matrix

**Audit:** 2026-06-04 (MFP → Health → Suppr)  
**Deep dive:** 2026-06-05 — [`docs/audits/2026-06-05-nutrition-debug-deep-dive/findings.md`](../audits/2026-06-05-nutrition-debug-deep-dive/findings.md)  
**Owner:** Grace (device execution) · Cursor (diagnostics + fixes)  
**Build requirement:** Native iOS dev build or TestFlight — **not** Expo Go. **Metro:** tunnel URL for physical device (`npx expo start --tunnel`).

## Preconditions (all cases)

- Physical iPhone with MyFitnessPal linked to Apple Health (Dietary Energy sharing on).
- Suppr signed in; More → Health Sync reachable.
- At least one **individual** dietary energy sample from MFP visible under Health → Browse → Nutrition → Dietary Energy (not only a day total).

## Matrix

| ID | Preconditions | Steps | Expected | Pass criteria | Status |
|----|---------------|-------|----------|---------------|--------|
| HS-01 | Native build, MFP food logged today | Open Health → Dietary Energy | MFP entry with kcal + time | Baseline: HK data exists | **Blocked — physical iPhone + live MFP** (sim/Expo Go insufficient) |
| HS-02 | HS-01 | Health Sync → Connect → enable **Import meals from Health** → grant dietary permissions | Toggle stays on; no timeout | Permissions OK | **Blocked — ENG-874** |
| HS-03 | HS-02 | Tap **Sync Now** | `lastResult` shows import summary | N > 0 for fresh MFP food, or honest zero with reason | **Blocked — ENG-874** |
| HS-04 | HS-03 | Return to Today (same date as MFP log) | Meal in correct slot | Journal + ring update | **Blocked — ENG-874** |
| HS-05 | HS-04 | Sync Now again within 5 min | No duplicate rows | Dedup via `health_sample_id` | **Blocked — ENG-874** |
| HS-06 | HS-04 | Delete imported meal on Today → Sync Now | Meal does not reappear | Tombstone respected | **Blocked — ENG-874** |
| HS-07 | HS-02 off | Toggle import OFF → Sync Now | No new `apple_health` rows | Gate respected | **Blocked — ENG-874** |
| HS-08 | HS-02 | Enable **Simple labels only** → sync new MFP food | `Imported food (N kcal)` titles | Generic label path | **Blocked — ENG-874** |
| HS-09 | Dev build | Open `dev/health-import-labels` | Raw HK metadata for MFP samples | Informs label fixes | **Blocked — ENG-874** |

## Diagnostic affordances (shipped 2026-06-04)

| Control | Location | Purpose |
|---------|----------|---------|
| **Check meal import** | Health Sync (`testID=health-sync-test-import`) | Read-only probe: external energy samples in last 7 days |
| **Send test meal** | Health Sync | Export write probe (existing) |
| Import summary copy | Sync Now `lastResult` | Distinguishes no samples / deduped / insert failed |

## Automation hooks

- Maestro: [`apps/mobile/.maestro/24_health_sync.yaml`](../../apps/mobile/.maestro/24_health_sync.yaml)
- E2E: [`apps/mobile/e2e/24-health-sync.test.ts`](../../apps/mobile/e2e/24-health-sync.test.ts)
- Unit: [`apps/mobile/tests/unit/nutritionImportDiagnostics.test.ts`](../../apps/mobile/tests/unit/nutritionImportDiagnostics.test.ts)

## Decision doc

[`docs/decisions/2026-06-04-apple-health-mfp-import-audit.md`](../decisions/2026-06-04-apple-health-mfp-import-audit.md)

## Grace handoff (physical device — ENG-874)

**Runbook:** [`health-sync-device-runbook.md`](./health-sync-device-runbook.md) (F-03 — step-by-step checklist).

Run on a **native dev build or TestFlight** (not Expo Go). Log one food in MFP, confirm it appears in Apple Health → Dietary Energy, then execute HS-01–HS-09 in order. Record results in the **Result** column.

| ID | Result (Pass / Fail / Notes) |
|----|------------------------------|
| HS-01 | |
| HS-02 | |
| HS-03 | Use **Check meal import** first if Sync Now shows ambiguous zero |
| HS-04 | |
| HS-05 | |
| HS-06 | |
| HS-07 | |
| HS-08 | |
| HS-09 | Dev menu: `suppr:///dev/health-import-labels` when available |

**If HS-03 fails:** capture `lastResult` text, probe alert from **Check meal import**, and whether Dietary Energy shows per-food samples (not only a day total).
