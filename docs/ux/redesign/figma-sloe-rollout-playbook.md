# Sloe Figma rollout playbook — from Today to other screens

Use this after a version-history restore. **2026-06-04:** flat borderless applied to **all 77** Sloe · Screens frames + Design System card components. For new frames, apply **one at a time** — do not run reckless page-wide scripts.

**Canonical frame:** `654:2` (`01 · Today`) in **01 · Core app** @ x=60 — **flat** borderless `#F6F5F2` (no resting shadow). **`659:2`** is lift exploration only, not SSOT.

**File:** [Suppr Sloe](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/) · **Plugin logic (single frame):** `figma-sloe-card-chrome-plugin.js`

---

## 1. Card chrome (copy to every screen)

These three properties on **leaf content cards only**:

| Property | Light | Dark (`L5`, etc.) |
|----------|-------|-------------------|
| Fill | `#F6F5F2` (Sloe `surface-card`) | `#2A2730` |
| Stroke | **None** on content cards (remove `#E8E2EC` hairline) | 1px hairline `#E8E2EC` optional |
| Shadow | **None** on resting content cards (flat slab) | No soft shadow; rely on fill + hairline |
| Page / screen background | `#FFFFFF` | `#19181C` (or frame’s dark page token) |

**Radius:** keep existing (often 12px macros, 16px hero / large cards).

### Leaf cards on Today (your screenshot)

Apply chrome to **this node only** (not its parent Section / Header / Main Content):

- Calorie **hero** card (rings + Goal/Eaten/Bonus)
- Each **macro** tile (Protein, Carbs, Fat, Fibre)
- **North star** / “What to eat next” outer frame (photo can stay full-bleed inside)
- Each **meal row** card (Breakfast, Lunch, …)
- Optional: Weekly insight / steps cards on TD frames

### Do **not** put slab fill + shadow on

- Screen root, `Header`, `Main Content`, week-strip **cells**
- Search bars, filter **chips**, segmented controls (unless they are literally a card)
- **Log Dinner** dashed CTA (keep dashed stroke)
- Small outline buttons (Log, Ask, Edit)
- Photo / `Image (` layers (image fill stays)
- Parent wrapper around the whole meals list (wrapper should be **transparent**, no shadow)

---

## 2. Today-only (do not blindly paste on Recipe / Cookbook / Plan)

| Element | Change | Tokens / notes |
|---------|--------|----------------|
| Week strip | No filled pill; selected day = **clay number + clay dot**; logged = **sage dot** | Decision: `2026-06-03-today-week-strip-minimal-current-day.md` |
| Status chip | e.g. **Under budget** (green), **Over budget** on S6 | Copy per state frame |
| Hero rings | Plum calorie ring `#3B2A4D`; macro rings in ochre/olive/sage palette | Not a “card chrome” change |
| Remaining / Consumed toggle | Track `#EFEFEF`, clear grey hairline on track | Inside hero only |
| Centre **Log FAB** | **Plum** `#3B2A4D` on 56×56 nav button | Decision: `2026-06-04-plum-nav-clay-content-cta-split.md` |
| Inline CTAs | **Clay** — Log Dinner label area, Save, etc. | Not plum |
| Coach line | Serif italic under hero | Typography only |
| North star | Photo hero + “Fits your day” chip + dinner copy | Layout; keep image un-slabbed |
| Copy | **Fibre** not Fiber | British |

---

## 3. Per-screen mapping (card chrome only)

Work in this order so you can compare to Today on the same canvas row.

### 02 · Recipe detail (`332:2`)

| Leaf surface | Chrome? |
|--------------|---------|
| Hero / image block | Image only; outer summary card if it’s a filled panel → slab |
| Nutrition summary / macro strip cells | Yes, each cell |
| Ingredients row circles | Usually **no** (icons); section container only if it’s a bordered rectangle |
| Method steps container | Per step card if framed; else section background stays white |

### 03 · Cookbook (`527:2`)

| Leaf surface | Chrome? |
|--------------|---------|
| Each **recipe grid card** | Yes — one flat `#F6F5F2` fill, no shadow |
| Search field | Keep border |
| Filter chips | Keep stroke |
| Bottom nav | Plum FAB only; bar background unchanged |

### 04 · Plan (`309:2`)

| Leaf surface | Chrome? |
|--------------|---------|
| Day summary / calorie bar card | Yes |
| Each **meal slot** row card | Yes |
| Calendar strip cells | **No** fill (like week strip) |
| Regenerate button | Outline/dashed rules as designed |

### 05 · Progress

| Leaf surface | Chrome? |
|--------------|---------|
| Stat / metric cards | Yes |
| Chart background | Usually white page, not slab — unless design shows a card wrapper |

### 06 · Import

| Leaf surface | Chrome? |
|--------------|---------|
| Paste link field | Keep border |
| Photo / Paste / Scan tiles | Yes if they are card frames |

---

## 4. Calm workflow (one frame per session)

1. Duplicate the frame or work on a branch copy.
2. List **leaf** rectangles named like Hero, Macro, Meal, Card, Recipe.
3. For each leaf: set fill → remove `#E8E2EC` stroke → leave **flat** (no resting shadow).
4. Clear accidental fill/shadow on parents (Header, wrappers).
5. Screen-specific pass (FAB, chips, strip) **only if that screen has them**.
6. Zoom 100% screenshot; compare to Today reference.
7. Mark frame done in file name or a checklist comment.

**Optional:** Run `applySloeCardChrome(frameId, isDark)` from `figma-sloe-card-chrome-plugin.js` for **one** `frameId` — still review manually; script skips photos, Log Dinner, week strip, chips.

---

## 5. What the agent did wrong (reverted)

Passes 5–7 ran `findAll`-style logic over **nested** frames → grey fills on headers/week cells, **double shadows**, broken Cookbook grid. The **intended** spec is sections 1–4 above, not “every frame that looks like a card.”

---

## 6. Code / Stitch (already aligned — separate from Figma)

| Layer | Location |
|-------|----------|
| Tokens | `src/styles/theme.css` — `--card: #F6F5F2`, `--elev-card-soft` |
| Web class | `.card-slab` on Today components |
| Mobile | `Elevation.cardSoft`, `SupprCard` |
| Stitch | `docs/prototypes/stitch-sloe/_buildtoday.mjs` — `CARD_SLAB` |

Figma can lag code until you apply this playbook frame by frame.
