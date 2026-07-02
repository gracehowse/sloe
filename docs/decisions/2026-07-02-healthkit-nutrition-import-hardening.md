# HealthKit nutrition import hardening (ENG-1023)

## Context

After the ENG-1019 HealthKit mutex serialized native bridge calls, Grace's iOS 26.6 device no longer crashed from concurrent dietary probes. The remaining risk was a quieter failure mode: nutrition import could still re-request dietary permissions during general Health connect, log opaque `[object Object]` bridge errors, or let a never-calling native callback stall follow-up diagnostics.

## Decision

- Body HealthKit permissions stay separate from nutrition import permissions. The app requests body metrics on the main Connect path and requests the dietary core set only from the nutrition-import affordance.
- `health_nutrition_import_enabled` is a default-on mobile kill switch. Turning it off skips dietary permission requests and nutrition import reads while leaving steps, weight, and energy sync intact.
- HealthKit sample reads use a 30s per-call timeout by default. Tests and device investigations may lower it with `EXPO_PUBLIC_HEALTH_SYNC_CALL_TIMEOUT_MS`.
- Bridge errors are logged with method, timestamp, date range, and permission key where applicable. The app keeps an in-memory ring buffer of the last 10 bridge calls plus the last error for debug inspection.
- Debug inspection is pull-based via `getHealthSyncStatusForDebug()` / `useHealthSyncStatus()` rather than always-on UI polling.

## Parity

This is mobile-only by construction. Web cannot read Apple Health / HealthKit, so there is no equivalent web bridge to update.

## Verification

- Unit tests pin the react-native-health dietary permission key allow-list.
- Unit tests pin mutex serialization, timeout release, and debug breadcrumb exposure.
- Unit tests pin bridge error stringification for object-shaped native errors.
