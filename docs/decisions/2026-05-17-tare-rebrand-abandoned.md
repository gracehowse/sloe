# Decision — Tare rebrand abandoned

**Date:** 2026-05-17
**Author:** Grace (in conversation with Claude)
**Status:** Resolved
**Area:** Brand

## What changed

The "Tare" rebrand is abandoned. PR
[#288 (`chore(brand): swap app icon, display name, and in-app mark to
Tare`)](https://github.com/gracehowse/Suppr/pull/288) is closed without
merging. Branch `claude/tare-icon-name-bowl` is deleted. No Tare assets
or copy ever landed on `main`, so no revert is required.

The product remains **Suppr** for now. The earlier rebrand workflow
(see `2026-05-11-rebrand-and-entity-direction.md`) is paused at the
naming-shortlist stage — no finalist was selected.

## Why

Grace's call. The Tare cut shipped as a "targeted first pass" (icons +
display name + in-app mark only, no copy sweep, no bundle-id change).
On review, the rebrand direction itself isn't right for the product —
not a problem with the Tare execution specifically. Rather than keep
the PR parked and risk it getting stale-rebased or accidentally merged
later, we close it cleanly today and document the call.

This does NOT close out the underlying trademark-risk concern that
prompted the rebrand discussion in the first place
(`project_trademark_risk.md`, 2026-04-19: "Supper Club!" phonetic
conflict on the App Store). That risk is now re-opened and deferred —
to be revisited when the App Store first-public release timeline is
firmed up. Until then, the working name stays **Suppr**.

## What stays untouched

- `docs/decisions/2026-04-25-rebrand-naming-shortlist.md`
- `docs/decisions/2026-04-25-rebrand-naming-round-2.md`
- `docs/decisions/2026-04-25-rebrand-naming-round-3.md`
- `docs/decisions/2026-04-25-domain-and-suppr-club-rename.md`
- `docs/decisions/2026-05-11-rebrand-and-entity-direction.md`

These remain as historical record of the rebrand exploration. They
are NOT retracted — they captured a real decision-point. This doc
supersedes them on the question of "are we rebranding".

## What's affected downstream

- **Entity formation (A2 in `2026-05-11-rebrand-and-entity-direction.md`):**
  was queued for "the week Grace picks the rebrand name" so the
  Delaware LLC could be formed under the new name. With no rebrand,
  the entity can now be formed as **Suppr** directly — no longer
  gated on a name pick. Open question: confirm trademark posture for
  "Suppr" in classes 9 / 35 / 41 / 42 before incorporation, or
  proceed and accept the residual phonetic-conflict risk.
- **App Store submission:** no longer blocked on rebrand. Reverts
  to whatever the pre-submission readiness checklist
  (`2026-04-27-pre-submission-readiness.md`) requires.
- **Linear / Notion roadmap:** any open rebrand-related items roll
  forward as "Deferred", not "Done".

## Notion mirror

Will mirror to the Notion Decisions log
(`collection://ffbda5f6-6d65-4b18-8d3f-94c6f0a8837c`) in the same
turn this doc lands, per the repo's Notion-mirroring rule. Link back
to this file as the source of truth — no verbose duplication.
