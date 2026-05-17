# Decision — Tare rebrand abandoned (rebrand still wanted, name TBD)

**Date:** 2026-05-17
**Author:** Grace (in conversation with Claude)
**Status:** Resolved
**Area:** Brand

## What changed

The **"Tare" cut specifically** is abandoned. PR
[#288 (`chore(brand): swap app icon, display name, and in-app mark to
Tare`)](https://github.com/gracehowse/Suppr/pull/288) is closed without
merging. Branch `claude/tare-icon-name-bowl` is deleted. No Tare assets
or copy ever landed on `main`, so no revert is required.

**A rebrand is still wanted.** The product continues to ship under the
working name **Suppr** as a placeholder until a new finalist name is
picked. The earlier naming workflow
(`2026-05-11-rebrand-and-entity-direction.md`, `2026-04-25-rebrand-naming-*`)
is unresolved at the finalist stage — Tare was tried as a candidate,
visualised end-to-end, and rejected on review. Pick is open again.

## Why

Grace's call. The Tare cut shipped as a "targeted first pass" (icons +
display name + in-app mark only, no copy sweep, no bundle-id change).
Once visualised end-to-end on a Tare-skinned dev build, the name
itself didn't feel right for the product — too literal a kitchen-scale
reference for what is primarily a recipe + tracking app, not a
weighing tool. The Tare execution was clean; the name is the problem.

This does **not** mean "the rebrand idea is wrong". The original
drivers persist:

- The trademark-risk concern (`project_trademark_risk.md`, 2026-04-19:
  "Supper Club!" phonetic conflict on the App Store) is unresolved.
- The "Suppr Club → Suppr" simplification (ENG-148, ENG-172) is on
  hold pending the broader rebrand outcome — not independently
  shipped.
- App Store submission still benefits from a final name being chosen
  before public release to avoid app-listing churn.

The session-level decision is narrow: **stop the Tare-specific
implementation work and keep the rebrand-pending state honest**
rather than letting the unmerged PR rot on a stale branch.

## What stays untouched

- `docs/decisions/2026-04-25-rebrand-naming-shortlist.md`
- `docs/decisions/2026-04-25-rebrand-naming-round-2.md`
- `docs/decisions/2026-04-25-rebrand-naming-round-3.md`
- `docs/decisions/2026-04-25-domain-and-suppr-club-rename.md`
- `docs/decisions/2026-05-11-rebrand-and-entity-direction.md`

These remain as the historical record of the rebrand exploration —
including Tare's place in that history as a tried-and-rejected
candidate. They are **not** retracted. This doc supersedes them only
on the specific question of "is Tare the answer?" — not on the
broader "are we rebranding?" question (the answer to which remains
yes, name TBD).

## What's affected downstream

- **Entity formation (A2 in `2026-05-11-rebrand-and-entity-direction.md`):**
  was queued for "the week Grace picks the rebrand name" so the
  Delaware LLC could be formed under the new name. **Preferred path
  unchanged:** still wait for the new name pick before forming the
  entity. **Fallback if the name pick drags past the Atlas
  deadline:** form as "Suppr" with a planned rename transaction
  later — Stripe Atlas allows entity name changes for a fee, but
  it's friction worth avoiding if the name pick can land in time.
- **App Store submission:** still benefits from a final name being
  chosen first. Not strictly blocked — submission can ship under
  "Suppr" and rename via App Store Connect later — but a rename
  post-launch costs marketing momentum and app-listing reviews.
  Treat name pick as a soft pre-submission gate, not a hard one.
- **`SupprMark` / wordmark assets:** stays as-is. The Tare asset
  pack (`docs/brand/tare/` and prototypes from the working tree, now
  in `stash@{0}` on `claude/tare-icon-name-bowl` in the main clone)
  is **kept as reference** for the next naming round — not deleted.
- **Linear / Notion roadmap:** rebrand-related items (ENG-148,
  ENG-172, ENG-183) stay **Open — name TBD**, not Deferred and not
  Done. ENG-172 is updated this session with the Tare-abandonment
  context.

## Open follow-ups (not in this PR)

- [ ] Pick a new candidate name (or shortlist). Owner: Grace, with
  `brand-manager` agent input. No firm deadline yet — informally
  gated by Atlas-formation timing.
- [ ] Trademark clearance check for the chosen name in classes 9
  (mobile software) / 35 (advertising) / 41 (education) / 42 (SaaS)
  before public commitment.
- [ ] Re-skin (icons, display name, in-app mark) when the name is
  picked — re-using the Tare execution pattern (targeted first pass,
  no bundle-id change) as the template, since that mechanical bit
  worked cleanly.

## Notion mirror

Will mirror to the Notion Decisions log
(`collection://ffbda5f6-6d65-4b18-8d3f-94c6f0a8837c`) in the same
turn this doc lands, per the repo's Notion-mirroring rule. Link back
to this file as the source of truth — no verbose duplication.
