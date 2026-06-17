# Today hero ring — saturated track ("greyed-full" grammar)

**Date:** 2026-06-16
**Status:** Resolved — implemented on `claude/today-ring-track-contrast`; founder approved the v2 (bold) level in-sim.
**Area:** Design system — calorie ring track, both platforms
**Process:** Founder reopened the ring ("the hero reads empty"); `design-director` + Mobbin study (Apple Fitness, Oura/Bevel, MacroFactor/Cal AI/Yazio, Google Fit).

## Problem

At a partly-logged day (e.g. 912 of 1231 left, ~26% logged), the Today hero read as **empty**. Forensic proof: the unfilled arc measured `~(244,243,246)` against a pure-white card — a **~10/255 luminance separation**, below the threshold of perception. So ~74% of the largest object on the home screen was a near-white smudge on white. This is the **Google Fit failure mode** (thin faint rings → reads unfinished), named in the Mobbin study.

The ring's faint frost-mist track (`ringTrack` `#EDEAF1` / web `--ring-bg`) was the cause — **not** the ring's size.

## Decision

Adopt **Apple Fitness's grammar**: the unfilled track is a **saturated tint of the ring's own hue**, so the empty/low-fill ring reads as a confident **"greyed-out full state"**, not a void (the founder's own reference: *"this is how Apple's multi rings look — the empty state is literally a greyed out full state"*).

| Element | Was | Now (light / dark) |
|---|---|---|
| Calorie (outer) track, **logged** state | frost-mist `#EDEAF1` (~10/255 off card) | `ringTrackBold` = plum tint **`rgba(59,42,77,0.24)`** / **`rgba(129,94,145,0.34)`** |
| Each macro track (expanded) | frost-mist at `0.4` opacity | a tint of its **own hue** (`macroColors[i]`) at **`0.28`** opacity |
| Calorie track, **empty** (consumed 0) | `borderStrong` + gradient loop | unchanged |
| Ring **size** | R≈0.44·S (large) | **unchanged — kept** |

### Why keep the big ring

The `design-director`'s decisive point: MacroFactor/Cal AI shrink their rings *because they never solved the faint-track problem* — the small number-led layout is their workaround for this exact bug. Apple keeps a big ring and fixes the track. Sloe does the same: keep the big multi-ring (the differentiator) and fix the track. The 2026-06-04 "ring too small" call stands — **not reversed.**

### Level calibration (in-sim)

- **v1 (14% / 16%)** — the specialist's conservative "subordinate" level. Rendered too soft/pastel vs the Apple reference.
- **v2 (24% / 28%)** — bolder. Reads as a confident greyed-full ring. **Founder approved v2 in-sim.**

## Behaviour across states

- **0% (empty):** unchanged — `borderStrong` track + brand-gradient loop.
- **~26% (the bug case):** deep-plum-tint full ring + bright plum arc on the filled quarter; macro tracks each a faint tint of their hue. **This is what was broken; this is what's fixed.**
- **Near-full / over-budget:** fill covers the track; colour mapping (plum under+over, red signal in chip+centre) **untouched.**

## Validation

iOS sim (light), expanded multi-ring at ~26%: rendered + forensically measured (track lifted off the white card; the four tracks now read as colored concentric rings). Founder approved v2 in-sim. Mobile + web typecheck clean; ring/track tests updated + green both platforms (`calorieRingEmptyTrackContrast`, `dailyRingEmptyTrackContrast`, + the ring suite). Dark-mode values set proportionally (0.34 / 0.28) but tuned by reason, not a separate dark render — revisit if flagged.

## Parity

Mobile `CalorieRing.tsx` (Skia path `SkiaRingArcs.tsx` + SVG fallback `MacroRing`) and web `daily-ring.tsx` move in lockstep; token `ringTrackBold` ↔ `--ring-track-bold` (light + dark). The redundant `macroTrackColor` (Skia) / `trackColor` (SVG `MacroRing`) props were removed — macro tracks now derive from `macroColors`.

## Not in scope (prototype-first)

Bumping the expanded calorie stroke (6px→11px) — reopens ENG-1064, so deferred to a prototype-first pass per the `design-director`.
