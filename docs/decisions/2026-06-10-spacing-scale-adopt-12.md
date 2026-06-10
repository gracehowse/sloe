# Decision: adopt 12 into the spacing scale

- **Date:** 2026-06-10
- **Status:** Resolved (Grace approved)
- **Area:** Design system (web + mobile)
- **Linear:** ENG-1012

## Decision

The canonical spacing scale becomes **{4, 8, 12, 16, 20, 24, 32, 40}**.
Mobile token: `Spacing.dense = 12` (`apps/mobile/constants/theme.ts`).
Web token: `--space-dense: 0.75rem` (`src/styles/theme.css`); Tailwind's
native `p-3`/`gap-3` (12px) are now legal utilities.

## Why

The 2026-06-10 fresh-eyes census found 875 off-scale spacing literals; the
three heaviest were **6 (246×), 12 (224×), 10 (169×)** — ~75% of all
violations. 12 was a **missing scale step, not 224 bugs**: the 8→16 jump is
too coarse for chip/pill internal padding and dense meal-row rhythm, which is
why 12 (and its neighbours 10 and 6) kept being reached for. Corroborating:
`macroTileGridGap = 12` was already a documented intentional carve-out.

Alternative rejected: migrating all 875 literals onto the scale-with-a-hole —
fights the rhythm the surfaces actually need and triples the migration diff.

## Consequences

1. The 224 existing `12` literals are **legal values awaiting tokenisation**
   (route through `Spacing.dense` during the ENG-1012 migration), not bugs.
2. `6` and `10` literals snap onto {4, 8, 12} surface-by-surface with pixel
   verification — no blind sed (migration tracked in ENG-1012).
3. Write-discipline contracts updated in the same change: root
   `.claude/CLAUDE.md`, `apps/mobile/CLAUDE.md`,
   `.claude/agents/_project-context.md` (design craft contract).
4. The `macroTileGridGap = 12` carve-out comment can be retired once it
   reads from `Spacing.dense`.

Source analysis: `docs/ux/reviews/2026-06-10-fresh-eyes/design-director-review.md`
§3 ("the headline census, root-caused") and §6 rule 1.
