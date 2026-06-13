# Design Direction — "Calm ≠ Faint" (confident-fill)

**Status:** Brief — awaiting Grace's ratification + prototypes-before-code.
**Date:** 2026-06-13
**Author:** `design-director` (pixel-grounded), commissioned from the 2026-06-13 on-sim visual review.
**Captures:** `apps/mobile/screenshots/agent/design-review-2026-06-13/` (live iPhone 17 Pro sim).

---

## The through-line

Sloe has a real, recognisable identity (cream ground, white gallery cards, aubergine ink, Newsreader serif numerals vs Inter controls, calm spacing) — and **Progress already proves the system can hit premium.** The gap across the app is one root cause expressed three ways:

> **The flat-material system removed shadow as a hierarchy lever, and the team compensated by making everything low-contrast. But calm-tonal should buy hierarchy back through _fill saturation_, not borrow it from _greyness_.** The three moments that carry the product's promise — the cold-open hero, the differentiator verdict, the viral hook — each got the *quietest* possible treatment by default.

**The rule to encode:** on a flat-tonal surface, the **one most-important element per screen earns a confident fill** (saturated tint or solid); `tint-at-10%` is reserved for genuinely secondary affordances. Progress is the template (its adherence bars use confident macro-hue fills, not 10% washes).

---

## Move 1 — Cold-open calorie ring → real brand-gradient loop (highest first-impression leverage)

**Pixels:** the empty ring renders as pale concentric grey hoops around "1,231 LEFT" — reads as a loading skeleton, not a crafted hero. Root cause (confirmed in `CalorieRing.tsx`): empty branch paints the *track* colour, so there's **zero brand colour on the largest object on the cold-open screen**; the spec says empty = gradient but the empty branch never paints `AccentWinGradient`.

**The move:**
1. Paint the empty ring as a **full 360° `AccentWinGradient` sweep** (`#3B2A4D → #5B3B6E → #7E5C92`, existing stops) at **~0.32–0.40 opacity** (tune on-sim) via the Skia path (`SkiaRingArcs.tsx`, gated by the existing `ring_skia_v1` flag). A complete faint-plum loop = "ready"; three grey hoops = "broken".
2. Drop the empty-state inner 1px hairline (`CalorieRing.tsx` ~L534–544) — a compensation for the missing colour; redundant once the gradient carries presence.
3. Use the confident collapsed-hero stroke (0.085·S), not the thin macro stroke.

**New token:** propose `ringEmptyGradientOpacity = 0.36` in `theme.ts` (web-mirrored) rather than a call-site literal.
**Comparable:** Oura late-2025 (one confident hero metric); Apple Fitness empty rings (resting ring = complete soft loop, never grey skeleton).
**Effort/risk:** **M** — Skia path (already built + flag-gated; EAS build, not OTA). Must SEE on-sim (opacity is by-eye). Web parity: mirror on `DailyRing` / `--ring-bg-empty`.

## Move 2 — Fit-verdict chip → confident sage banner (highest strategic ROI; do first)

**Pixels:** "✓ Fits your day · -30%" on the recipe detail is a muted grey-green pill (code: `bg = Accent.success + "1A"` = 10% alpha → nearly invisible on cream). This is the *entire* "love food AND have goals" thesis rendered as the least important element on the screen.

**The move:**
1. Promote tag → **verdict banner**: full-width, **solid sage fill** (`Accent.success` `#5E7C5A` or deeper `successSolid` `#466046`), **white text + white check**, `Radius.lg`, `Spacing.md` vertical pad. One saturated element on the recipe detail is correct — it's the screen's reason to exist.
2. Lead with the human verdict ("Fits your day" loud); demote "· -30%" to a quiet inline modifier (white @80%).
3. Kill the 10%-wash for **all three** tones at once (fits → solid sage; over-half → solid amber `Accent.warning`; over-day → `Accent.destructive`) — root fix, not three symptom patches.
4. Fire `Haptics.notificationAsync(Success)` once on open when the verdict is "fits" (web analog: a ~200ms sage colour-pulse/scale-in).

**New token:** none (alpha 10%→100% + foreground→white, within existing tokens).
**Comparable:** Noom green/yellow/red food verdict; MacroFactor coaching verdicts.
**Effort/risk:** **S** — token/alpha/copy in `RecipeTitleBlock.tsx` + web `RecipeDetail.tsx`. Flag-gate + SEE on-sim. Highest ROI in the brief.

## Move 3 — Import-from-Reel card → hero affordance, not a nav row

**Pixels:** "Import from TikTok, Instagram & YouTube" is a flat grey-lilac slab (`accent.primarySoft` = plum @12%) with a small icon + chevron — a settings row, with *less* weight than the recipe photo cards beneath it. This is the viral-hook acquisition feature.

**The move (keep the tinted-slab grammar — flat-card law holds — raise the weight):**
1. Bump tint to a richer plum wash (`primarySoft` ~18–20%, or new `Accent.primarySoftStrong`).
2. Icon → **solid plum filled circle** (`Accent.primary` fill, white glyph) — a focal anchor.
3. Replace the passive `ChevronRight` with a small **filled "Paste link" pill** — turn "navigate" into "do the thing here".
4. Title → `Type.headline` (17 serif) so it reads as a section-leading feature.
5. (Optional, tune on-sim) a subtle `AccentWinGradient` left-edge / gradient icon-chip — Discover is the one place outside win-moments the brand gradient is permissible.

**New token:** propose `Accent.primarySoftStrong` (web-mirrored) only if 12% can't carry it on-sim.
**Comparable:** Recime import-from-link card; Pinterest "paste a link" capture surface.
**Effort/risk:** **S–M** — styling in `discover.tsx` (+ web `DiscoverFeed.tsx`). Gradient-edge variant needs Skia/care. Flag-gate + SEE on-sim.

## Move 4 (system) — Encode the "confident-fill" rule

On a flat-tonal surface, the one lead element per screen earns a confident fill; `tint-at-10%` is for secondary affordances only. Make Progress the template; pull Today/recipe-detail/Discover up to it. Encode via `design-system-enforcer` + `product-memory`.

---

## Leave alone (already at bar)

- **Progress** — the internal premium benchmark (coaching card, serif "103% · over", confident-fill adherence bars, W/M/6M/Y control). Reference, don't touch.
- Serif numeral system; flat-card/cream-ground/white-card material grammar; the ring **state-colour semantics** (empty=gradient / under=green / over=red — only the *craft* of the empty render changes); Plan's Generate/Adjust hierarchy; the recipe-detail macro row.

## Sequencing

**2 → 3 → 1** (do the chip first: smallest effort, biggest strategic payoff, no Skia dependency; batch the ring with other Skia work since it needs a native build). All four flag-gated; **every one needs an on-sim eyeball before commit** — the entire reason this review exists is that prior "calm" calls looked faint in render, not in code.

**Prescribed next step:** `ui-product-designer` builds the three rendered "after" states (gradient ring loop at the right opacity; sage verdict banner; import hero card) as prototypes **before** production code (prototype-before-code / visual-validation-mandatory). Grace red-lines the rendered pixels, then `executor` ships flag-gated with web parity.
