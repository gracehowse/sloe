# Button system: solid primary / ghost secondary (Withings/Alma grammar)

**Date:** 2026-06-12
**Status:** Resolved — **Grace approved the red-line 2026-06-12** ("go")
**Area:** Design system — buttons / CTAs, both platforms
**Supersedes:** the "Today lane — aubergine OUTLINE primary CTAs" treatment (pinned by `apps/mobile/tests/unit/todayLaneAubergineOutline.test.ts` + web twin). Follows `docs/decisions/2026-06-12-flat-card-surfaces.md`.
**Linear:** ENG-1079 (implementation guide on the issue)
**Red-line:** `docs/design-explorations/2026-06-12-button-system-withings/{prototype.html,redline.png}`

## Problem

On the now-flat cream surfaces, the **aubergine-outline** primary CTAs (Complete Day, "Add to Today") and **`colors.card` beige-fill** secondaries (the LogSheet "Search" sibling, acknowledgments) read as weak, floating, and muddy — they blend into the ground. Grace: *"complete day button and other beige buttons seem out of place."*

## Research (Mobbin, 2026-06-12)

Every comparable on a light ground uses one grammar; nobody uses outline or beige fill as a standalone CTA:
- [Alma](https://mobbin.com/screens/d5d1920d-5970-4437-92d8-e9097400bac1) — the closest analogue (flat white card on warm ground): solid dark-green "Add new weight entry" + solid-fill active segment.
- [Withings](https://mobbin.com/screens/421c0cc3-4374-4bf9-9497-2cf4929e6b1a) black/[brand-blue](https://mobbin.com/screens/7e85fbe1-961c-43ac-9fb5-f4b8039af167) solid pills · [Alan](https://mobbin.com/screens/1a1e28d9-d220-4f01-a372-585b55e5cccf) solid purple · [pliability](https://mobbin.com/screens/8ac4cdc5-bc30-4d38-883e-1029f90d4533) solid + grey chips.

## Decision

1. **Primary action → solid aubergine fill.** `accent.primarySolid` (#3B2A4D) / web `bg-primary-solid`, white label, `Radius.full` pill, `Type.headline`. Exactly ONE per screen (FAB + conversion paywalls excepted, per the existing one-CTA rule). Pressed = `accent.primary` + `PressableScale` haptic; disabled + loading ship with it. White-on-#3B2A4D ≈ 12:1 contrast.
2. **Secondary → ghost.** Transparent, NO border, plum label, same radius/padding. Replaces both the outline AND the beige `colors.card` fill.
3. **Quick-action chips** (water +100/+250, portion ×) → keep `Colors.fillQuiet` quiet fill, but only INSIDE white cards (contrast holds); never standalone on cream.
4. **Unchanged:** segmented-control active thumb (its own treatment, not a button); FAB; calorie-ring colour mapping.

## Rollout

One shared `SupprButton` primitive (`variant: "primary" | "ghost"`), web + mobile, then ~20 call-site migrations (each screen's top action → primary, rest → ghost). Unflagged (founder-requested visual fix, consistent with the flat-card + ring waves). Repoint the aubergine-outline guard tests to assert solid-primary/ghost; primitive-level + contrast pins. Light + dark captures of every CTA surface before merge. Sequenced AFTER the flat-card wave (shared files).

### Migration status (2026-06-12)

- **Primitive** — shipped both platforms: `apps/mobile/components/ui/SupprButton.tsx` + `src/app/components/suppr/suppr-button.tsx`, pinned by `{apps/mobile,}/tests/unit/supprButton.test.tsx`.
- **Recipe + plan call-sites** — migrated: recipe-detail action row (`RecipeActionPills`: Log/"Add to today" → primary, Edit → ghost), create-recipe wizard footer (`CreateRecipeWizard`: Continue + Save private → primary, Publish to community → ghost), web import flow (`RecipeUpload`: Import / Save to my library / Publish / Match-to-database → primary, Save as draft / paste-dialog Cancel → ghost). Guard pins: `apps/mobile/tests/unit/recipeButtonSystem.test.ts` + `tests/unit/recipeButtonSystemWeb.test.ts` (the latter also carries the cross-platform primitive-parity pin).
- **Today / Log-sheet call-sites + the aubergine-outline guard repoint** — owned by the Today + Log-sheet migration lanes; each repoints its slice of `{apps/mobile/tests/unit/todayLaneAubergineOutline.test.ts,tests/unit/todayLaneAubergineOutlineWeb.test.tsx}` as it lands its component change.
- **Live light + dark CTA captures** — pending, owned by the consolidated migration capture pass once all call-sites land.
