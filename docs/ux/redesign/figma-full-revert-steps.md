# Full revert — Suppr Sloe Figma file

**File:** https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/

The Cursor agent **cannot** roll back this file from here. Figma does not expose “restore version” in the MCP tools we have. **You** must restore in Figma (takes ~2 minutes).

## Full revert (recommended)

1. Open the file in Figma (desktop or browser).
2. **File → Show version history** (or click the file name at the top → **Show version history**).
3. In the right-hand timeline, scroll to **before 4 June 2026** (before agent “borderless / alignment” edits).
4. Click a checkpoint and **preview** on canvas:
   - **Good:** Recipe/Cookbook/Plan cards have normal layout (even if they still have grey hairline borders).
   - **Bad:** Stacked grey slabs, ghost cards, misaligned artboard row, empty north-star placeholders.
5. When preview looks right, click **Restore this version** (top of the screen).
6. Wait for sync to finish, then **close the tab and reopen** the file.

Figma keeps history: restoring adds a new checkpoint; you can return to a later version from the timeline if needed ([Figma help](https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history)).

## Safer variant (keep a broken copy)

1. **File → Save a copy** → name e.g. `Suppr Sloe — broken 2026-06-04`.
2. On the **original** file, run the restore steps above.

## If no good checkpoint exists

- Check **Figma branching** (if enabled) for an older branch.
- Check team **deleted files** / another designer’s duplicate.
- Last resort: re-import from Stitch (`docs/ux/redesign/figma-today-step2-capture.md`) — partial recovery only.

## After revert

- Do **not** run bulk agent `use_figma` scripts on the whole page.
- Canonical Today reference: pick **one** frame (`654:2` or `659:2`) and align **other screens manually** or one frame per session with explicit approval.

## Agent commitment

No further automated Figma edits until you confirm the file is restored and which frame is canonical.

---

**2026-06-04:** User confirmed file reverted via version history.
