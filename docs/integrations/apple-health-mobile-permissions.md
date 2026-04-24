# Apple Health — mobile permission & connect flow (reference)

**Purpose:** Single place to restore context if Health Connect regresses (stuck spinner, “nothing happens”, timeouts, or duplicate prompts).  
**Primary code:** `apps/mobile/lib/healthSync.ts`, `apps/mobile/app/health-sync.tsx`.

---

## Intended behaviour

1. User opens **More → Health Sync** and taps **Connect Health Data** (native dev build only; not Expo Go).
2. iOS may show the system Health permission UI once (or not, if the user already decided for this app).
3. On success, the screen switches to **Sync Now**, toggles unlock, and an **Alert** plus inline **last result** text confirm state.
4. **`health_sync_apple_connected`** in AsyncStorage remembers that connect completed so returning to the screen still shows **Sync Now** (see key below).

---

## Architecture (why it is this way)

### Two-stage `initHealthKit` (`requestHealthPermissions`)

- **Stage 1 — body metrics only** (`HEALTH_KIT_STAGE1_READ`): steps, weight, body fat %, active/basal energy, workouts — small read set so the system sheet is reliable.
- **Stage 2 — dietary quantities** (`HEALTH_KIT_STAGE2_READ` = body + `HEALTH_DIETARY_IMPORT_PERMISSION_KEYS`): needed for meal import; **does not** request `FoodCorrelation` (known failures on current iOS + `react-native-health`; meal import still works without it — see comments in `healthSync.ts`).
- **Writes** on both stages: `HEALTH_KIT_NUTRITION_WRITE` (energy, macros, fiber) for exporting meals to Health.

### Retry path

- **`requestDietaryHealthPermissions`**: second stage only, used when the user turns on **Import meals from Health** after body sync already succeeded.

---

## Safeguards (do not remove without re-reading this doc)

| Safeguard | Where | Why |
|-----------|--------|-----|
| **`isAvailable` timeout** (~20s) | `healthSync.ts` — `HEALTH_IS_AVAILABLE_TIMEOUT_MS`, `isAvailableDetailed` | If the native bridge never calls back, JS would hang forever on the first `await` → Connect spinner never clears. |
| **`initHealthKit` timeout** (3 min per stage) | `HEALTH_PERMISSION_INIT_TIMEOUT_MS` (180_000), `initHealthKitPromiseWithTimeout` | Permission UI can stay open while the user reads; iOS only completes the callback after **Allow / Don’t Allow**. Too short a timeout looked like a random failure; too long still beats an infinite hang. |
| **No global dedupe mutex** on `requestHealthPermissions` | `export async function requestHealthPermissions` → `runRequestHealthPermissions` | A previous design returned a **single shared Promise** for all taps. If that promise never settled, **every later Connect** awaited the same hung promise forever. UI already disables the button via **`connecting`** on the screen. |
| **`connecting` + spinner** | `health-sync.tsx` — `handleConnect` | User-visible progress; avoids “tap does nothing” when the sheet does not appear. |
| **`try/catch` in `handleConnect`** | `health-sync.tsx` | Surfaces unexpected JS errors instead of a silent no-op. |
| **`useFocusEffect` cleanup** | `health-sync.tsx` | `setConnecting(false)` on blur so leaving Health Sync does not leave a permanent spinner if native is slow. |
| **Persist “connected” for UI** | AsyncStorage key **`health_sync_apple_connected`** | `connected` is React state only; without persistence, leaving the screen showed **Connect** again even when Health was already authorized (confusing; looked like a broken second tap). Cleared with other Health prefs when **More → Reset plan** wipes app data (`more.tsx` `multiRemove`). |
| **Timeout-specific user copy** | `runRequestHealthPermissions` catch blocks | Distinguishes “waited too long / stay on this screen” from generic permission errors. |

---

## Known iOS / product behaviour

- After the user has already allowed or denied categories, **Apple may not show the sheet again**; the app can still succeed silently. Success copy mentions this; **Sync Now** is the proof data path works.
- User should **stay on Health Sync** until the flow finishes; switching tabs mid-flow can delay or confuse when the callback runs relative to timers.

---

## Expo / build requirements

- **`EXPO_PUBLIC_HEALTH_SYNC_ENABLED`** must not be `"false"`.
- **`loadAppleHealthKit`** resolves `NativeModules.AppleHealthKit` or `RCTAppleHealthKit` at **call time** (not at module import) — required for RN New Architecture / bridgeless so methods are not undefined.

---

## Quick regression checklist

1. Dev build on device → More → Health Sync → Connect → complete or dismiss Apple sheet → **Sync Now** appears; no infinite spinner.
2. Leave screen and return → still **Sync Now** if `health_sync_apple_connected` is set.
3. If native is wedged: within ~20s you should get **`isAvailable`** timeout messaging, not a spinner forever.
4. If `initHealthKit` never completes: within **3 min per stage** you should get a timeout **Alert**, not a spinner forever.

---

## Related docs

- Product / UX redesign notes: `docs/decisions/2026-04-22-health-sync-redesign.md`
- High-level integration: `docs/integrations/apple-health.md`
- TestFlight / feedback cross-links: `docs/testflight-feedback/tracker.md` (HealthKit items)
