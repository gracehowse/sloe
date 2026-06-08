# Recipes / Library — Figma frame `527:2` spec

**Frame PNG (READ FIRST):** `docs/ux/redesign/frames/library-527-2.png`
Source: Figma `B3UdOFup7ITersgNuoXh0l` node `527:2`.

## Tokens
Cream `#F6F5F2` · plum `#3B2A4D` · body grey `#6A6072` · clay `#C8794E` (active pill) · Newsreader headings · Inter body.

## Layout (top → bottom)
1. **Header:** "Sloe" wordmark left + avatar (plum circle) right.
2. **"Recipes"** — Newsreader ~30px plum.
3. **Sub-tabs:** "Library" (active, plum underline) / "Discover" (grey). Underline indicator, not pills.
4. **Search** — full-width cream rounded-full field, search icon, "Search your recipes".
5. **Category pills** — single horizontal scroll row: `All`(clay fill, white text) / `Breakfast` / `Lunch` / `Dinner` / `Dessert` / `Quick 30` (unselected = cream, grey text).
6. **Count line** — "24 saved recipes" (Inter ~13px grey).
7. **2-COLUMN recipe grid** — each card:
   - Full-bleed **photo**, rounded ~16–20, ~172px tall.
   - **Bookmark** icon, circular translucent, overlaid top-right.
   - Below image: **title** (Newsreader ~17px plum, may wrap 1–2 lines) + meta row `★ 4.8 · 25 min` (Inter ~13px; star clay/amber, text grey).
   - NO macro numbers on the card, NO "..." menu, seamless (no heavy border).

## Biggest deltas vs current app
1. App cards are **1-column full-width** → make a **2-column grid**.
2. App cards show **macros** (`312 kcal · 55g · 4g · 8g`) → show **`★ rating · time`** instead.
3. App has an **extra filter row** (`All·8 / Saved·8 / Imported`) above the category pills → the frame has only the **one category-pill row**. Fold saved/imported into the category logic or a less prominent control; don't stack two filter rows.
4. App has a **"Create" button + "Recent" sort** in the header strip → frame just shows the count. Keep Create reachable (the FAB/＋ already creates; or a small icon) but don't reproduce the heavy sort+create strip; match the frame's calm count line.
5. App card has a **"..." overflow menu** → frame uses just the bookmark; move overflow into the detail screen or a long-press.

## Preserve (wired — never drop)
Library/Discover switch, search, category filtering, saved vs imported distinction (re-expressed, not deleted), bookmark/save toggle, create-recipe entry, tap-card→detail navigation, the recipe count.
