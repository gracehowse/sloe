# Muted-text contrast — the "MacroFactor route" (2026-06-23)

**Status:** Resolved (Grace, 2026-06-23). **Area:** Design system / a11y.

## Context

The `storybook` addon-a11y job was red on ~247 WCAG AA color-contrast
failures. The instinct was that the Sloe v3 "white-on-white elevation" model
(bright white cards on a near-white ground, separated by soft shadow rather
than borders) might be the cause.

## Decision

**It is NOT the white-on-white. It was the text colour, full stop.**

- WCAG AA contrast governs **text** (and meaningful icons/graphics) against
  *their immediate background* — it says nothing about a card's edge
  contrasting with the page. A bright-white card on a near-white ground with a
  shadow is fully AA-compliant; the separation is a shadow, and shadows aren't
  text. **Keep the elevation look — it's what makes Sloe feel premium, and it
  passes.** Do NOT add borders or beige fills to "fix" contrast.
- Every failure was a foreground colour: the light-grey muted-text token
  (`--foreground-tertiary` #9B93A3 = 2.96:1 on white — the ~243 dominant
  failures), a faint amber, and a too-weak chip scrim.

**Adopt the MacroFactor route** (Grace's call): muted/secondary text is a
**readable medium grey (~5:1)**, never a light grey; hierarchy comes from
**size + weight + the dark→medium-grey step**, not from making secondary text
disappear.

- `--foreground-tertiary` / `Accent.textTertiary`: **#9B93A3 → #6E6874**
  (5.39 white / 4.94 card / 4.81 cream — AA PASS). This lands Sloe's muted
  grey **in the same band as MacroFactor and Mercury**, both of which run the
  white-on-white-elevation look with readable medium-grey secondary text.
- Ultra-light grey stays valid only for **large** text (≥24px / ≥18.7px bold),
  which gets the 3:1 bar.

"For now — we can always assess" (Grace): ship #6E6874; revisit the exact tone
later if it reads heavy.

## References (Mobbin)

- **MacroFactor** (direct nutrition comparable, the proof): white cards on a
  faint-grey ground, near-black primary numbers, **readable medium-grey**
  sublabels ("Today", "of 1220", "35 / 77g"). Hierarchy via size/weight, not
  lightness. <https://mobbin.com/screens/8d1b33b3-e5b3-46ef-a84f-58ad83b06f50>
- **Mercury** (fintech gold standard for premium minimal): white-on-white with
  soft elevation; "Wire"/"Pending"/"30D" sub-labels are a readable medium
  slate. <https://mobbin.com/screens/82e8f14d-9bf6-4956-bb4d-8d9306d167d3>

## Shipped

- PR #600 (merged) — amber warning text → `--accent-warning-solid`.
- PR #601 — `--foreground-tertiary` #9B93A3 → #6E6874 (both platforms) + two
  straggler fixes (apple-health hint opacity, FeaturedHero "Tonight's pick"
  scrim). `npm run test:storybook` now fully green (0 contrast failures,
  200/200). Token comments in `src/styles/theme.css` +
  `apps/mobile/constants/theme.ts`; regression guard in
  `tests/unit/sloeContrastTokens.test.ts`.
