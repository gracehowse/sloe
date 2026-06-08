# Recipe detail — Figma frame `332:2` spec

**Frame PNG (READ THIS FIRST):** `docs/ux/redesign/frames/recipe-detail-332-2.png`
**Current app capture (the BEFORE):** `docs/ux/redesign/frames/_app-recipe-current.png`
Source: Figma `B3UdOFup7ITersgNuoXh0l` node `332:2`. Frame width 500 (≈ mobile 390 scaled). All colours/sizes below are from the frame's `get_design_context`.

## Tokens used in this frame
- Cream surface `#F6F5F2` · plum ink `#3B2A4D` · body grey `#6A6072` · faint grey `#9B93A3` · hairline `#E8E2EC`
- Clay (primary CTA) `#C8794E` · sage (protein) `#7C8466` · clay (carbs) `#C8794E` · amber (fat) `#C9892C`
- "Fits your day" chip: bg `rgba(94,124,90,0.1)`, text/icon `#5E7C5A` (sage)
- Newsreader (serif) for headings/numbers; Inter for body/labels

## Layout, top → bottom

### 1. Hero (height 375px, FULL-BLEED)
- Full-bleed recipe **photo** edge-to-edge (no rounded corners, no nav bar above it).
- Top gradient scrim `rgba(0,0,0,0.4)` → transparent, 88px tall, padding 16/24.
- Overlaid on the scrim: **back** button (left) + **bookmark** + **share** buttons (right). Each is a 40px circle, bg `rgba(255,255,255,0.2)`, white 24px icon.
- **No-photo fallback:** keep a tasteful cream/plum placeholder filling the full 375px hero with the controls still overlaid — do NOT regress to a separate cream nav bar.

### 2. Title block (padding 24)
- **Title** — Newsreader Regular 36px, `#3B2A4D`, line-height 45.
- **Attribution** (when source exists) — Inter 14px `#6A6072`: `via ` + `@handle` (medium, `#221B26`) + ` · ` + `See original` (underlined). Hide the row if no source.
- **"Fits your day" verdict chip** — sage pill (bg `rgba(94,124,90,0.1)`, text `#5E7C5A`), checkmark icon, 36px tall, rounded-full. This is the recipe's fit-to-target verdict (maps to the app's existing "% of your day" logic) — keep the verdict computation, restyle as this chip with verdict-toned copy.

### 3. Action row (horizontal, gap 12, pills 46px tall, rounded-full)
- **Start Cooking** — clay `#C8794E` fill, white text, icon, ~156px. → opens Cook Mode.
- **Log** — cream `#F6F5F2`, text `#221B26`, icon. → opens the log sheet.
- **Ask** — cream pill, icon. → AI coach. **If no Ask/coach handler exists in the app, OMIT this pill (3-pill row) and add a Linear note that Ask (frame `185:2`) is net-new — do NOT build a placeholder screen.**
- **Edit** — cream pill, icon. → edit recipe.

### 4. Macro card (cream `#F6F5F2`, rounded-16, 93px, padding ~21)
- 4 evenly-spread cells, each: big value (Newsreader 24px) + label (Inter 10px, uppercase, tracking 1px, `#6A6072`).
- Colour the VALUES per macro: **Cal `#3B2A4D`** · **Pro `#7C8466` (sage)** · **Carb `#C8794E` (clay)** · **Fat `#C9892C` (amber)**.

### 5. Meta row (24px tall, icons + text, Inter 14px)
- `★ 4.8 (213)` · `⏱ 20 min` · `📊 Easy` · `🗂 10 Items`. Rating value `#221B26` medium, count `#9B93A3`; others `#6A6072`. Use real recipe data; hide a stat if unknown.

### 6. Hairline divider `#E8E2EC`, then Ingredients section (gap 16)
- Header row: **"Ingredients"** (Newsreader 24px `#3B2A4D`) left, **"For N servings"** (Inter 14px `#6A6072`) right.
- **Thumbnail grid**, 4 per row: each cell 104px wide — image in a **cream `#F6F5F2` rounded-24 tile, 104px tall** (object-contain), then name (Inter medium 12px `#221B26`) + amount (Inter 12px `#6A6072`), centered. Use ingredient images when data has them; otherwise a clean cream tile with the ingredient initial/icon — NOT an empty box.
- **"View all N ingredients"** text button, rounded-24, full width.

### 7. Method section (gap 24, top padding 16)
- **"Method"** (Newsreader 24px `#3B2A4D`).
- Steps (gap 32): each is a row — **number** (Newsreader 30px `#9B93A3`, e.g. `01`) + column with **title** (Inter medium 16px `#221B26`) + **paragraph** (Inter 16px `#6A6072`, line-height 26).

### 8. Sticky footer (white `rgba(255,255,255,0.9)`, 85px, padding 24/16, space-between)
- **Left — Yield + servings stepper:** "YIELD" label (Inter 10px uppercase `#6A6072`) above a row: cream round 32px **−** button, value (Newsreader 20px `#3B2A4D`), cream round 32px **+** button. (This REPLACES the app's standalone mid-body servings card — move it here.)
- **Right — "Cook Mode"** clay `#C8794E` pill, 52px tall, white text + icon. → Cook Mode.

## Biggest deltas vs current app (from `_app-recipe-current.png`)
1. Hero is a separate cream **nav bar + gradient placeholder** → make it a **full-bleed hero with overlaid controls**.
2. Missing **attribution** line.
3. Missing **action pill row** (Start Cooking / Log / Ask / Edit).
4. Servings is a **mid-body card** → move to the **footer** next to Cook Mode.
5. Footer is "Log all · kcal" → should be **servings + Cook Mode** (Log moves up into the pill row).
6. Macro values aren't macro-coloured → **Pro sage / Carb clay / Fat amber**.
7. Missing **meta row** (rating · time · difficulty · item count).
8. Ingredients should be a **thumbnail grid**; Method should be **numbered serif steps**.

## Preserve (wired — never drop)
Cook Mode, Log, Edit, servings stepper + scaling, allergen info ("Not tagged for allergens" — place it after the meta row or in the ingredients/details area), fiber, the fit-to-target verdict, bookmark/save, share.
