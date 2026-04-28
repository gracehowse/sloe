# Visual QA — pixel-level audit, post-Phase 5 (commit `5149bce`)

**Owner:** visual-qa specialist
**Status:** Findings (summary form — full body returned in agent transcript only)
**Scope:** every surface in shipped Suppr, web + mobile, post-Phase-5

> **Note on completeness:** The agent claimed to deliver the full ~5000-word audit inline but only returned the structured deliverable summary in its message. The full per-surface drift inventory is not captured here — re-run with explicit "deliver full body inline" if needed for Phase 6 elevation spec.

---

## Top 5 cheap-looking surfaces in the shipped app

1. **Cook Mode screen** — completely flat layout, Menlo timer font, emoji "🎉" as done-state illustration, step-number square that is mis-radiused (`borderRadius: 8` makes a rounded rectangle, not a circle as the circular intent suggests), nav buttons with no enabled/disabled visual distinction.
2. **Onboarding multi-step form** — Ionicons throughout, `fontWeight: "900"` (non-system weight), `borderWidth: 2` plan cards heavier than everything else in the app, invisible back button.
3. **Progress stat grid (2×2 tiles)** — "47%" Flexbox width hack, overline labels with wrong weight/tracking, "Tap for breakdown" chevron footer that competes with the stat value.
4. **Planner summary card** — flat `Accent.primary + "14"` tint standing in for an unimplemented gradient. Explicitly acknowledged in code as a known gap.
5. **Shopping List empty state** — emoji-as-illustration, asymmetric CTA button shape, Ionicons import.

---

## Counts across the codebase

(Confirmed from code reads, not grep totals. Conservative.)

- **Spacing literals (ad-hoc, confirmed unique instances in major surfaces):** 60+ across the 11 surfaces reviewed. The value `14` alone appears 12+ times as a padding or margin literal across 7 files.
- **Type literals (ad-hoc font sizes not in the Type scale):** 50+ in the 11 surfaces reviewed. The 28pt screen-title pattern alone accounts for 5+ instances; 10pt appears 6+ times; 12pt appears 10+ times.
- **Colour literals (hardcoded hex/rgba):** 20+ confirmed instances. `"#fff"` appears at minimum 10 times across CTA buttons and action text. `rgba(255,255,255,0.94)` and its variants account for 3 more.

---

## Top 3 surfaces broken in dark mode

1. **Recipe Detail — floating header buttons** (`apps/mobile/app/recipe/[id].tsx:1099`) — `backgroundColor: "rgba(255,255,255,0.94)"` makes back/share/bookmark buttons always white regardless of colour scheme. On dark screens over dark images, they are the only bright element and look visually broken relative to the dark system.
2. **Library — bookmark dot and remove button** (`apps/mobile/app/(tabs)/library.tsx:298, 330`) — white bookmark pill and black-scrim remove button have no dark-mode adaptation. The remove button at `rgba(0,0,0,0.45)` is nearly invisible against dark card images in dark mode.
3. **Progress loading spinner** (`apps/mobile/app/(tabs)/progress.tsx`) — ActivityIndicator uses `color={t.accent}` = `Accent.primary` (`#4c6ce0`) rather than `colors.tint` (`Accent.primaryLight` in dark mode). The wrong (less bright) blue renders in dark mode.

---

## Implications for Phase 6 elevation

The pixel-level drift catalogued above maps directly to the Phase 6 elevation pass:

1. **Token enforcement lint** — the `Type ladder — custom lint rule` Tasks DB row is the right vehicle. Banning `fontSize: <number>` and `color: "#xxx"` literals app-wide via custom eslint rule will surface the long-tail beyond what was reviewed here.
2. **Per-surface refit** — the 5 cheap-looking surfaces (Cook Mode, Onboarding, Progress stat grid, Planner summary, Shopping empty) each need a discrete `ui-product-designer` brief.
3. **Dark-mode pass** — the 3 broken surfaces are quick fixes (~15min each) but indicate a systemic issue: components writing `"#fff"` or `rgba(255,255,255,...)` directly instead of consuming `colors.text` / `colors.background` from the theme. A grep-replace sweep is warranted.

---

## Routes for follow-up

- **`executor` (quick wins)**: dark-mode 3-surface fix (replace literals with theme tokens). Replace emoji "🎉" / shopping-list emoji with proper iconography. Fix Cook Mode step-number radius bug.
- **`ui-product-designer`**: per-surface refit briefs for the 5 cheap-looking surfaces.
- **`code-quality`**: ship the custom eslint rule for token enforcement (already a P2 Tasks DB row).
- **`design-system-enforcer`**: consume the drift inventory once the full agent body is recovered. Cross-reference against `docs/specs/2026-04-27-production-design-spec.md` Part 1 (foundation tokens) to see which sections aren't being honoured.

---

## Re-run note

To recover the full per-surface drift body, fan visual-qa again with prompt: **"Return the FULL audit body inline in your response message. Do not return only the deliverable summary. The earlier run lost the per-surface findings to the transcript file which the orchestrator cannot read."**
