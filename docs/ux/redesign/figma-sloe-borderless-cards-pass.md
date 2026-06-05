# Figma — borderless warm slab (whole Sloe · Screens pass)

**File:** [Suppr Sloe](https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/) (`B3UdOFup7ITersgNuoXh0l`)  
**Page:** `Sloe · Screens`  
**Spec:** Content cards — borderless `#F6F5F2`, light `cardSoft` shadow (`0 6px 18px rgba(34,27,38,0.16)` — strengthened 0.10 → 0.16 on 2026-06-04 so the slab lifts off the white page on-device; the `#F6F5F2`/`#FFFFFF` delta is only ~10 lum so the shadow carries all the separation), white screen fill. Keep strokes on small **Button/Link** actions, chips, search, Log Dinner dashed CTA.

## Why Today looked “fixed” but 02/03/04 did not

Early passes only updated **Today** frames (and staging copies at x≈11200). The screenshot row **02 · Recipe detail**, **03 · Cookbook**, **04 · Plan** (x≈620–1756) were untouched — **16–18 grey `#E8E2EC` borders** each.

## Pass 5 — whole core screens (2026-06-04)

- **63 section-level mobile frames** processed in one sweep  
- **321** grey card borders removed  
- **413** card fills + soft shadows applied  

### Frames in the user’s screenshot

| Frame | Node | Grey borders after |
|-------|------|-------------------|
| 02 · Recipe detail | `332:2` | 0 |
| 03 · Cookbook | `527:2` | 0–5 (search/chips may keep line) |
| 04 · Plan | `309:2` | 0–3 |
| 01 · Today (canonical) | `654:2` @ x≈3420 | 0 |

## Canonical Today

Use **`654:2`** (`01 · Today (canonical · borderless warm slab)`), not deprecated **`308:2`**.

## Pass 6 — every page in file (2026-06-04)

User requirement: **all pages**, not only Today or 02/03/04.

| Page | Action |
|------|--------|
| **Sloe · Screens** | **77** top-level screens walked; **148+95** `#E8E2EC` strokes removed; content surfaces → `#F6F5F2` + `cardSoft` (light) or dark hairline |
| **Sloe · Design System** | **37** strokes removed on Card / Macro / Meal / tile components (**8** components, **18** shadows) |

**Audit after pass:** `greyBorders: 0` on both pages (except dashed Log Dinner CTA).

Sections covered: `01 · Core app` through `10 · Keep features`, **06 Web**, **07 Landing**, **08 Web onboarding**, **09 Today deep dive**, drill-downs, loading/dark/onboarding states.

## ⚠️ Pass 5–7 reverted in practice — file damaged (2026-06-04)

Bulk fills/shadows on **nested** frames broke layouts (ghost cards, grey headers/week cells). **Restore via Figma version history** — see `figma-recovery-2026-06-04.md`. Do **not** treat Pass 5–7 as successful.

## Pass 7 — full alignment to canonical Today (2026-06-04) [FAILED — see recovery doc]

Cross-app pass so **654:2** patterns apply beyond card chrome alone.

| Area | Action | Count (approx.) |
|------|--------|-----------------|
| **Plum centre FAB** | All `Navigation` 56×56 log buttons → `#3B2A4D` | 29 |
| **Macro tiles** | 228×96 (±) cells → `#F6F5F2`, 12px radius, `cardSoft` | 22 |
| **Plan day cards** | Wednesday-style summary cards | 18 |
| **Recipe detail** | Horizontal CAL/PRO/CARB strip + macro cells | 87 |
| **Cookbook grid** | Recipe cards 16px radius, slab + shadow | 28 |
| **Progress** | Stat cards in Progress frame | 3 |
| **Hero toggles** | Remaining/Consumed track → `#EFEFEF`, no hairline | 17 |
| **Insight blocks** | Named insight frames → slab + shadow | 3+ |
| **Meal rows / thumbs** | Stroke cleared, 8px thumb radius | ongoing |
| **S6 over ring** | Coral arcs → damson `#6A4B7A` | 18 |
| **S6 chip** | **Over budget** copy | 1 |
| **Fibre** | Fiber → Fibre (file already clean) | 0 |
| **Design System** | Card/Macro/Meal/TabBar components | 16 |

**Audit:** `greyBorders: 0` both pages; **28** plum FABs on Screens.

**Intentional strokes kept:** filter chips, small outline buttons (Log/Ask/Edit), dashed Log Dinner, search fields.

## Refresh Figma

Close/reopen the file tab if thumbnails still show old bordered cards.
