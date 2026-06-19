# Apple Health meal import — device runbook (F-03 / ENG-874)

**Owner:** Grace (physical iPhone)  
**Matrix:** [`health-sync-functionality-matrix.md`](./health-sync-functionality-matrix.md)  
**Audit:** [`docs/audits/2026-06-05-nutrition-debug-deep-dive/findings.md`](../audits/2026-06-05-nutrition-debug-deep-dive/findings.md) F-03

Agents cannot complete HS-01–HS-09 — they require live MFP → Health → Suppr on a **native dev build or TestFlight** (not Expo Go, not simulator-only).

**Encoded as a Maestro flow:** [`apps/mobile/.maestro/36_health_sync_mfp_import.yaml`](../../apps/mobile/.maestro/36_health_sync_mfp_import.yaml). Run it on the **physical iPhone** after the setup below — it drives connect → enable import → Sync Now → Today-assert (HS-01–HS-04) and leaves HS-05–HS-09 as inline manual steps with expected results. Before running, edit the `MFP_LOGGED_FOOD_NAME` placeholder in the flow to the food you logged in MFP today. The native HealthKit permission sheets are tapped by hand (iOS renders them outside the app). It is deliberately **not** in `config.yaml`, so it never runs in the simulator CI suite.

```bash
# from apps/mobile, with the device build installed + Metro reachable
maestro test .maestro/36_health_sync_mfp_import.yaml
```

## Before you start (10 min)

1. **Build:** Native dev client or TestFlight — `npm run mobile:ios:device:tunnel:pinned` for device Metro, or install latest TestFlight.
2. **MFP:** Log one food today; confirm **Health → Browse → Nutrition → Dietary Energy** shows a per-food sample (not only a day total).
3. **Suppr:** Signed in; open **Settings → Apple Health** (`suppr:///health-sync`).

## Execution order

| Step | ID | Action | Pass? | Notes |
|------|-----|--------|-------|-------|
| 1 | HS-01 | Health app → Dietary Energy → see MFP entry | ☐ | Baseline HK data |
| 2 | HS-02 | Health Sync → Connect → enable **Import meals** → grant dietary perms | ☐ | Toggle stays on |
| 3 | — | Tap **Check meal import** (`testID=health-sync-test-import`) | ☐ | Probe: external samples last 7d |
| 4 | HS-03 | **Sync Now** | ☐ | `lastResult` N > 0 or honest zero + reason |
| 5 | HS-04 | Today tab — same date as MFP log | ☐ | Meal in slot; ring updates |
| 6 | HS-05 | **Sync Now** again within 5 min | ☐ | No duplicate rows |
| 7 | HS-06 | Delete imported meal on Today → **Sync Now** | ☐ | Tombstone — meal stays gone |
| 8 | HS-07 | Toggle import **OFF** → **Sync Now** | ☐ | No new `apple_health` rows |
| 9 | HS-08 | Import ON + **Simple labels only** → sync new MFP food | ☐ | `Imported food (N kcal)` titles |
| 10 | HS-09 | Dev: `suppr:///dev/health-import-labels` | ☐ | Raw HK metadata for MFP |

## If HS-03 fails

Capture:

- Full `lastResult` text from Health Sync
- **Check meal import** alert body
- Screenshot of Health → Dietary Energy (per-food vs day total)
- Whether toggle **Import meals from Health** is on

File results in the matrix **Result** column and Linear **ENG-874**.

## Metro (physical device only)

```bash
npm run mobile:ios:device:tunnel:pinned
```

Simulator agents use **localhost** `http://127.0.0.1:8081` — do not use tunnel URL on sim.
