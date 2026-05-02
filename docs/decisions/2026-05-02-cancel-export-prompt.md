# Cancel-flow export prompt — calm-tone trust posture

**Date:** 2026-05-02
**Area:** Settings, retention, trust
**Status:** Resolved
**Owners:** product-lead (intent), customer-lens (audit), this PR (build)

## Decision

When the user taps "Manage subscription" on Settings (mobile or web), Suppr
shows its own bottom sheet **before** routing to the platform's billing /
customer-center surface. The sheet has two equal-weight options:

1. **Take your data with you** — calls `nutritionLogToCsv` against the
   user's `nutrition_entries` rows and presents the platform share
   sheet (mobile) / triggers a `Blob` download (web).
2. **Continue cancelling** — routes to RevenueCat customer-center
   (mobile) / `/account/billing` Stripe portal (web).

## Posture

This is a **calm-tone trust** moment, not retention-via-friction.

* No "Wait, are you sure?", no offers, no upsells, no last-minute
  discount.
* Both options are visually equal — same border, same row height, same
  card weight. The export option happens to render above continue-
  cancelling because that is the order in which the user will weigh
  them, not because it is "preferred".
* Copy is descriptive: "Your data is yours. You can take it with you, or
  carry on to the cancellation page — whichever you prefer." There is no
  "we're sorry to see you go".
* Closing the sheet does not block the cancel; tapping the backdrop
  emits a separate analytics event (`cancel_export_dismissed`, reserved
  — currently unused) so accidental closes can be distinguished from
  deliberate routing in future analytics.

## Why surface this at all?

Customer-lens audit (2026-05-02): every competitor either (a) charges
export as a paid feature, or (b) hides it deep in settings. None of them
surface it at the cancellation moment, when the value is highest. Suppr
already has the export helpers (`nutritionLogToCsv` +
`nutritionLogCsvFilename` shipped 2026-04-19, G-6); the only missing
piece was the moment.

The result is the user leaving with their data in hand instead of
feeling locked in. That is what we want — not a saved subscription, but
a kept relationship.

## Why not retention-friction?

* Suppr's brand voice (`docs/ux/voice-guidelines-2026-04-19.md`) is
  *calm, factual, supportive*. Retention friction at the cancel moment
  is the antithesis.
* TestFlight feedback in 2026-04 (multiple slips logged in `docs/
  testflight-feedback/`) consistently flagged "this app feels like it
  respects me" — adding a desperate save-attempt would burn that
  goodwill on the way out the door.
* The "kept relationship" outcome is the actual product win:
  ex-customers who left feeling respected return, and tell others to
  try us. Friction-driven retention farms churn that we re-pay later.

## What this is NOT

* Not a paywall — both buttons are free actions.
* Not a free-trial extension offer — there is no offer.
* Not a survey ("why are you leaving?") — that is a fundamentally
  different kind of moment and would belong AFTER the cancel, not
  before.

## Implementation pointers

* Mobile: `apps/mobile/components/settings/CancelExportPromptSheet.tsx`,
  wired into `apps/mobile/app/(tabs)/settings.tsx` Manage-subscription row.
* Web: `src/app/components/suppr/cancel-export-prompt-dialog.tsx`,
  wired into `src/app/components/Settings.tsx` (new pro-tier
  "Manage subscription" link on the Plan card).
* Analytics: `cancel_export_prompt_shown`, `cancel_export_chosen` (with
  `rowCount`), `cancel_proceeded` (with `exportedFirst` boolean).
* Shared CSV helper: `src/lib/export/nutritionLogToCsv.ts` (G-6,
  2026-04-19) — single source of truth for the file format. Web + mobile
  produce byte-identical CSVs (pinned by `tests/unit/nutritionLogToCsv.test.ts`).

## Follow-ups

* If we later add a "leaving feedback" surface, it must fire **after**
  the platform billing surface, not as a wedge in this flow. Routing
  to a survey here would re-introduce the friction we explicitly avoid.
* The export today is `nutrition_entries` only. A future expansion to
  cover weight history, custom foods, recipe library saves etc. would
  fit naturally inside this same sheet — it is the right surface, just
  scope-limited today.
