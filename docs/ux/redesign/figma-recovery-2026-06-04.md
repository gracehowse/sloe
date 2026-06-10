# Figma file recovery — automated pass rollback

**File:** [Suppr Sloe](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/) (`B3UdOFup7ITersgNuoXh0l`)  
**Date:** 2026-06-04  
**Status:** **Restored by user** (2026-06-04). **Canonical Figma chrome:** flat borderless `#F6F5F2` only (`docs/decisions/2026-06-04-figma-flat-borderless-slab.md`) — not `659:2` cardSoft lift.

## What went wrong

Agent passes (Pass 5–7) applied **`#F6F5F2` fills** and **`cardSoft` shadows** to **thousands of nested frames**, not only top-level content cards. That caused:

- Grey slabs on **headers**, **week-strip cells**, **search bars**, and **parent wrappers**
- **Stacked shadows** (parent + child both shadowed) → “ghost” duplicate cards
- **Cookbook / Plan / Today** layouts looking broken or overlapped

This is **not** fixable with another automated sweep. Trying will likely make it worse.

## Recover via Figma version history (required — user action)

1. Open the file in Figma (browser or desktop).
2. Click the file name → **Show version history** (or **File → Show version history**).
3. Pick a version **before** the agent bulk edits (likely **3–4 June 2026**, before “borderless” mass updates — use preview).
4. **Restore** that version (or duplicate to a new file first: **File → Save a copy** then restore the copy).
5. Close and reopen the tab; confirm **02 / 03 / 04 / Today** look like your prior design (bordered cards acceptable).

If you use **Figma branching**, restore from `main` or the last known-good branch instead.

## After restore — safe alignment (manual or one frame at a time)

Only promote patterns from **`654:2` (chosen Today)** surgically:

| Apply to | Node type | Do **not** apply to |
|----------|-----------|---------------------|
| Hero, macro, meal, recipe **leaf** cards | Single frame with card fill | Parents, sections, headers, week cells |
| Remove stroke | `#E8E2EC` on those leaf cards only | Buttons, chips, search, dashed CTAs |
| Shadow | One shadow on the **same** leaf node | Nested children that already sit on the card |
| Plum FAB | 56×56 centre log in `Navigation` | — |

**Do not** run whole-page `findAll` fill/shadow loops again.

## Canonical reference after restore

- Chosen Today: `654:2` (or re-create from Stitch `today.html` + measured spec)
- Agent doc (card spec only): `figma-sloe-card-chrome-plugin.js` — use **per-frame** with explicit node IDs, not page-wide

## Contact

If version history does not go back far enough, say so — recovery may require duplicating from a backup file or re-importing Stitch captures (see `figma-today-step2-capture.md`).
