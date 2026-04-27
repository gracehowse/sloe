# Decision log: Apple Watch + widget — foundation already shipped, native target deferred (P2-27, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — foundation already shipped; native Xcode work tracked as **P3-31**
**Trigger:** P2-27 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit asked for "Watch complication for daily kcal remaining + protein remaining. Refresh widgetSnapshot.ts to expose the same data."

---

## Decision

The data foundation for both the iOS widget and an Apple Watch complication is **already shipped** at `src/lib/nutrition/widgetSnapshot.ts` (Batch 5.12). The canonical schema includes:

- `kcalConsumed`, `kcalTarget` — kcal remaining = target − consumed.
- `proteinLeftG`, `carbsLeftG`, `fatLeftG` — already negative-aware.
- `fastActive`, `fastStartsAt`, `fastTargetHours` — fast state for a complication that swaps to "X:XX left in fast" when active.

Storage keys (`SUPPR_WIDGET_SNAPSHOT_KEY`, `SUPPR_WIDGET_SNAPSHOT_FILENAME`) and the deep-link URL (`WIDGET_TAP_DEEP_LINK = "suppr://today/remaining"`) are already constants in the same file.

The remaining work is **Xcode-native**: a WidgetKit extension target in `apps/mobile/ios/`, App Group entitlement on both the main app and the extension, SwiftUI complication views, and an Expo config plugin so the extension survives `expo prebuild`. None of that is a code-session deliverable; it's iOS platform engineering.

Tracked as **P3-31** in the post-launch v1.1 backlog.

## Rationale

The 2026-04-18 product decision deliberately removed the iOS home/lock-screen widget from launch scope because the native target is meaningful work that didn't justify holding the launch. The same logic applies to the Watch complication. The audit's ask was real but the only piece of it that could ship from a JS/TS codebase was the data shape — which already shipped months ago.

The `widgetSnapshot.ts` module is intentionally pure (no side effects, no persistence, no clock reads except via injected `now`) so the native extension can adopt it without runtime coupling. When the v1.1 PR ships the WidgetKit extension, the JS-side change is one line: `apps/mobile/lib/widgetSnapshot.ts` writes the same JSON to the App Group container; the Swift side reads it.

## Alternatives considered

- **Add the Swift WidgetKit extension now.** Out of scope for this session. Requires Xcode project surgery, code signing, entitlement files, an Expo config plugin to make the extension survive `expo prebuild`, and TestFlight regression testing. ~2 days of focused iOS work. The launch window is the wrong sequencing.
- **Ship a "fake widget" via a pinned home screen shortcut.** Rejected. Misleading; not what users expect from "Apple Watch complication."
- **Defer P2-27 entirely as out-of-scope for launch.** Would skip even the foundation acknowledgement; less useful than this short-form decision-doc that tracks the v1.1 work explicitly.

## Implementation

- **No code change today.** Foundation already exists at `src/lib/nutrition/widgetSnapshot.ts` (shipped Batch 5.12, 2026-04-18).
- New task **P3-31** captures the Xcode work for the v1.1 cycle.

## Platforms affected

- **Mobile (iOS):** no change today; v1.1 will add a native WidgetKit extension.
- **Web / Mobile (Android) / Supabase:** none. Apple-only feature.

## Verification

- `widgetSnapshot.ts` schema is stable and tested elsewhere; no surface change.
- The audit's ask ("kcal remaining + protein remaining") maps to existing snapshot fields with no addition needed.

## Related artefacts

- [Opus 4.7 codebase review §6.3](../audits/2026-04-25-opus47-codebase-review.md) (P2-27)
- [`src/lib/nutrition/widgetSnapshot.ts`](../../src/lib/nutrition/widgetSnapshot.ts)
- Follow-up: **P3-31** — Apple Watch complication + iOS widget Swift extension.

## Revisit when

- An iOS engineer (or Grace with iOS bandwidth) is ready to land the WidgetKit extension. Spec is in P3-31; data shape is ready.
- The audit's other widget asks (lock-screen, home-screen) get prioritised — same Swift target serves all three surface families.
- Apple ships a more constrained Watch complication API in a future watchOS release (e.g. SwiftData for live-updating complications). Re-scope.
