# Design-director full-canvas review — 2026-06-09

Pixel-grounded review of all 23 light + 17 dark captures
(`apps/mobile/screenshots/agent/sweep-dd-2026-06-09/`), HEAD `f756a454`.
Persisted from the session transcript; the numbered moves drive the current
polish queue (see `docs/planning/sloe-polish-handoff-2026-06-09.md`).

## Verdict

- **Light: Premium, knocking on Flagship.** One coherent designed product —
  serif-with-restraint, warm-grey cards on cream with one soft lift, food
  photography as the colour hero, aubergine rationed. Today/Recipe-detail/
  Discover sit next to the best food apps.
- **Dark (at review time): Prototype** — one root cause: the accent never
  inverted (static `#3B2A4D` reads on near-black). **FIXED this session**
  (`e417be7e`, `30b497fe`, `affc0d06`): scheme-resolved `useAccent()`,
  172 reads migrated. Re-audit dark before declaring parity.
- Overall at review time: **Good**, gated by dark; expected Premium after
  the dark fixes (now shipped) are re-audited.

## The 5 moves (status at handoff)

1. **Dark accent inversion** — ✅ SHIPPED + pixel-verified (today, paywall,
   settings, planner, fasting dark captures in
   `sweep-dd-2026-06-09/dark-fixed/`).
2. **Serif screen titles everywhere** — spec'd (Spec 3), NOT yet implemented.
   Only Targets is truly Inter; Health-Sync 28/700 + Household 28/600 +
   weekly-recap nav title need normalising to the new tokens.
3. **Skia ring + overflow + sequenced haptic** — spec'd (Spec 1), needs EAS
   rebuild, flag `ring_skia_v1`. Overflow colour decided: **brightening plum**
   (`docs/decisions/2026-06-09-ring-overflow-brightening-plum.md`), amber
   REJECTED.
4. **CTA filled/outline drift** — spec'd (Spec 2): only 4 changes (import-shared
   "Import" filled→outline; LOG TODAY rows + weekly-recap "Log a meal"
   bare-text→outline pill; whats-new "Done"→outline pill). Wizard "Continue"
   STAYS outline (rule: filled = FAB + pay/signup conversion only).
5. **Green form labels + haptic rebalance** — create-recipe eyebrows
   green→textSecondary; haptics: selection for pickers/pills, Medium for
   confirms, Light = preview only. NOT yet implemented.

## Other findings (not yet fixed)

- Dark captures missing for: household-settings, health-sync,
  nutrition-sources, whats-new (assume accent now fixed, but capture to
  confirm). Log sheet / cook mode / onboarding never captured.
- Settings dark cards slightly low-contrast vs ground (second-order).
- Win-moment has no web analog (colour pulse + number tween spec'd in Spec 1).
- `navPrimary` token cleanup pending (aubergine doc follow-up).

## Tier list at review time (pre-dark-fix)

Flagship-light: Today, Recipe detail. Premium-light: Discover, Paywall,
Library, Plan, Progress, Weight tracker, Fasting. Good-light: Settings,
Targets, Shopping, Create-recipe, Weekly recap, Household, Health-sync,
Nutrition-sources, What's-new. Dark was Prototype/Generic across the board
(pre-fix).
