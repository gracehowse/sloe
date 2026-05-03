# Cancel-flow export prompt at the cancel touchpoint (calm trust posture)

- **Date:** 2026-05-02
- **Area:** Product / journey-architect
- **Status:** Resolved
- **Replaces:** stale PR #43 (41 commits behind main, predated the v2 → canonical onboarding rename, rebuilt on current main per PR-staleness-prevention sweep)

## Decision

Surface the data-export prompt AT the cancel touchpoint, instead of leaving it buried in Settings. Tapping "Manage subscription" on web (Settings → Plan card) or mobile (Settings → Membership) opens a Suppr-owned interstitial first:

- **Mobile:** `CancelExportPromptSheet` (bottom sheet) — `apps/mobile/components/settings/CancelExportPromptSheet.tsx`
- **Web:** `CancelExportPromptDialog` (modal) — `src/app/components/suppr/cancel-export-prompt-dialog.tsx`

Two equal-weight cards:

1. **Take your data with you** — fires the existing `nutritionLogToCsv` export. Sheet stays open after success so the user can still continue or dismiss.
2. **Continue to manage** — closes the sheet and routes to RevenueCat's `presentCustomerCenter()` (mobile) or `/account/billing` (web Stripe portal).

The X / backdrop tap dismisses without action.

## Posture

**Calm trust, not retention-via-friction.**

This explicitly is **NOT** a retention-engineering surface:

- Both cards have **equal visual weight**. Same border, same background, same icon-tile treatment. Neither is the "highlighted primary" CTA.
- **No offers, no upsells, no last-minute discount.** The user came to manage their subscription — we are not the gatekeeper to that surface.
- **No friction stacks.** The user can dismiss or proceed in one tap. The export is offered as a courtesy, not as a hurdle.
- **No counters, no "you've logged X meals" copy.** That would weaponise the user's own engagement against their decision to leave.

The single product-marketing frame is: *"You may want a copy of your nutrition log first. You can do both — export now and still manage your subscription after."* That's it.

## Why this matters (closes journey-architect P1)

> "The export prompt is buried deep in Settings. A user who taps 'Manage subscription' and cancels never sees the export prompt unless they actively look for it. The export is reactive (user must find it), not proactive (not shown at cancel time)."

Pre-2026-05-02 the CSV-export flow lived 4–5 taps deep in Settings → Privacy & Security on web and Settings bundle → Data on mobile. There was no surface anywhere in the cancel path that mentioned data portability. A user who cancelled and lost their backups would have a justified support claim against us. The interstitial closes that gap with a single trust-grade screen.

## Non-goals

- **Not a paywall.** No upsell, no "downgrade to Free instead?", no "are you sure?" friction.
- **Not a retention dashboard.** No "look at all the X you'll lose" loss-aversion language.
- **Not a redo of the export UX.** The CSV path itself (`nutritionLogToCsv`, `nutritionLogCsvFilename`) is unchanged — same bytes, same filename shape, same pinned-bytes test (`tests/unit/nutritionLogToCsv.test.ts`) covers both entry points.
- **Not a new permission gate.** `presentCustomerCenter()` and `/account/billing` permissions are unchanged; this just inserts a single prompt before the handoff.

## Analytics

Three new events on the existing PostHog stream (`src/lib/analytics/events.ts`):

| Event | When it fires | Payload |
|---|---|---|
| `cancel_export_prompt_shown` | The sheet/dialog opens | `{ source: "mobile" \| "web", tier: string }` |
| `cancel_export_chosen` | "Take your data with you" tapped | `{ source: "mobile" \| "web", tier: string }` |
| `cancel_proceeded` | "Continue to manage" tapped | `{ source: "mobile" \| "web", tier: string }` |

`tier` carries the user's current tier at the cancel touchpoint (`"free"` / `"base"` / `"pro"` / any future SKU label) so the funnel can slice export-uptake by who's actually about to leave.

The X / backdrop dismiss does **not** fire its own event — silence is itself the signal, and adding a `cancel_dismissed` event would invite over-fitting to a pure trust surface.

## Parity matrix

| Surface | Mobile | Web |
|---|---|---|
| Component | `CancelExportPromptSheet` | `CancelExportPromptDialog` |
| Trigger | Membership card → "Manage subscription" row | Plan card → "Manage subscription" button (non-free users) |
| Export action | `nutritionLogToCsv` → `expo-file-system` cache write → iOS share sheet | `nutritionLogToCsv` → Blob → anchor download |
| Continue action | `presentCustomerCenter()` (RC) with App Store / Play Store fallback | `window.location.href = "/account/billing"` (Stripe Customer Portal) |
| Equal-weight CTAs | Yes (matched border, background, icon tile) | Yes (matched border, background, icon tile) |
| Stays open after export | Yes | Yes |
| Analytics | `cancel_export_prompt_shown` / `cancel_export_chosen` / `cancel_proceeded` with `source: "mobile"` | Same events with `source: "web"` |
| State-reset on close | N/A (sheet has no internal state to reset) | `cancelPromptExporting` resets to `false` on close so the next open starts clean |

No intentional divergence beyond the platform-native handoff target (RC vs Stripe). Both send the same byte-shape CSV through the same helper.

## Tests

- `apps/mobile/tests/unit/cancelExportPromptSheet.test.tsx` — 5 RTL tests pinning equal-weight rendering, single-fire export CTA, success-state row count, close-vs-continue intent separation, and null-export resilience.
- `tests/unit/cancelExportPromptDialog.test.tsx` — 6 RTL tests mirroring the mobile coverage plus state-reset on dialog close/re-open.
- `tests/unit/nutritionLogToCsv.test.ts` (existing) — pinned bytes; both entry points produce identical CSV.

## Files changed

- **New:**
  - `apps/mobile/components/settings/CancelExportPromptSheet.tsx`
  - `src/app/components/suppr/cancel-export-prompt-dialog.tsx`
  - `apps/mobile/tests/unit/cancelExportPromptSheet.test.tsx`
  - `tests/unit/cancelExportPromptDialog.test.tsx`
  - `docs/decisions/2026-05-02-cancel-export-prompt.md` (this file)
- **Modified:**
  - `apps/mobile/components/settings/SettingsBundleContent.tsx` — `handleManageSubscription` now opens the sheet; CSV runner extracted into `runExportCsv` so the sheet and the standalone row share one code path.
  - `src/app/components/Settings.tsx` — Manage subscription Link → button + dialog mount; CSV runner extracted into `runCsvExport`.
  - `src/lib/analytics/events.ts` — three new event entries.
  - `apps/mobile/CHANGELOG.md` — entry under 2026-05-02.
