# Design-Director Review + Unifying Design Direction (2026-05-31)

**Status:** Resolved (direction ratified; execution tracked in Linear)
**Area:** Design / cross-platform
**Owner:** Grace

## What this is

First full run of the new `design-director` agent — a whole-product visual review that
judges Suppr as one designed canvas (not per-surface). Ran as an Ultracode workflow:
9 forensic readers over **188 pixel-grounded screenshots** (mobile, current branch
working tree, captured crash-free via the idb/simctl deep-link pipeline — see
`docs/audits/2026-05-31-design-director-review/`) + 4 agents researching the 2026
external bar (palette, depth, motion, delight).

Raw findings: `docs/audits/2026-05-31-design-director-review/findings-raw.json`
Full 57-issue triage: `docs/audits/2026-05-31-design-director-review/issue-triage.md`

## Verdict

**Good, not yet Premium.** Suppr has a genuine, protectable signature — warm cream
canvas (`#fbfaf6`), single brand blue (`#588CE4`), the tri-state calorie ring, an
8-hue macro token system — that already beats MyFitnessPal and Cal AI on the home
surfaces. **It dilutes the deeper you go**: the logging flow, detail screens, and the
web app drop to "competent tracker." Depth, Motion, and Delight are the product-wide
floor (Prototype/Cheap tier on most groups); Palette and Identity are already strong.

### Scorecard (tier per lens)

| Group | Identity | Palette | Consistency | Depth | Motion | Delight |
|---|---|---|---|---|---|---|
| Today + logging | Good | Good | Generic | Generic | Prototype | Generic |
| Recipes | Good | Premium | Generic | Generic | Prototype | Generic |
| Plan | Good | Good | Good | Generic | Good | Generic |
| Progress + weight | Good | Good | Generic | Generic | Prototype | Prototype |
| Macro detail | Generic | Good | Prototype | Generic | Cheap | Cheap |
| Settings | Good | Good | Good | Generic | Generic | Generic |
| Fasting/paywall | Good | Good | Generic | Generic | Generic | Good |
| Web desktop | Generic | Good | Generic | Good | Prototype | Prototype |
| Web mobile | Good | Generic | Generic | Good | Prototype | Generic |

## The direction — 5 spine rules (make it one product)

1. **One elevation model.** Soft ambient shadow (~6% opacity, ~12 radius, no border)
   on every resting card; delete hairline-borders standing in for shadow.
   `Elevation.card` in `apps/mobile/constants/theme.ts` is currently a zeroed no-op —
   the philosophy exists, it's just turned off. Dark mode: shadows OFF, tonal lift ON.
2. **One primary action colour.** Blue (`#588CE4`) for *every* commit CTA. Reserve
   green (`#56A775`) strictly for the calorie-ring state — today it's overloaded as
   primary-action + ring-state + macro-hue.
3. **A dedicated win-colour + one reserved win-moment**, distinct from the static
   success token, gated to landmarks only (day closed at/under target, macro hit,
   3/7/30-day streak) — never every log.
4. **One motion vocabulary.** A single spring system, odometer-style number tweens
   (the biggest, most-visible 2026 gap), and an element→sheet morph on open.
5. **One brand mark + one accent everywhere** — in-app, auth, web, marketing
   (currently three marks; web hardcodes violet ×99).

## Root causes (fix the root, not the 57 symptoms)

- **No depth model** (7 groups flat) — root: `Elevation.card` zeroed → one token.
- **Action-colour drift** — root: no enforced "commit = primary" rule.
- **Dead win-moments / flat delight** — root: no tiered feedback system (PressableScale
  haptics exist but are flat/unused on CTAs; no number tweens). 2026 bar = quiet
  <100ms confirm on every log + one reserved loud win-moment at landmarks.
- **Brand-mark fracture** (P0) — grey ring / black "S" / blue, plus web violet.
- **Native-component intrusions** — raw iOS action sheet for meal long-press;
  off-brand error boundary.

## Bugs surfaced (beyond design)

- **P0** — Notifications screen render crash: Supabase realtime `.on('postgres_changes')`
  registered AFTER `.subscribe()` at `apps/mobile/app/notifications.tsx:226`. Invalid;
  crashes the screen (dev render-error / prod error-boundary).
- **P1** — `suppr:///plan` deep-link → "We couldn't find that" recipe-404. Plan tab
  works via the tab bar; the deep-link is mis-wired.
- **P1** — Dev marker leaks into a user-facing Settings row.
- **UX** — Ingredient editing is buried (`⋯ → Edit recipe`); tapping an ingredient in
  recipe view shows only an info alert, not an editor — not what users expect.

## Coverage caveats (honest)

- ~~Authed **mobile-web** is ~40% holes (many captures were login-walls).~~
  **RESOLVED 2026-05-31:** re-captured with a fresh session — 14 distinct of 16 surfaces
  now real (today/home/plan/planner/progress/settings/profile/shopping/import/create/
  fasting/notifications); discover/library/recipes are one Recipes shell behind 3 routes;
  billing 404s (app-store-managed). No mobile-web app-gate exists in code — the holes were
  a stale-session capture artifact, not an intentional wall. New finding: the weekly
  check-in modal overlays Today on **web** too (mobile/web parity), and a Next.js dev
  "1 Issue" error badge shows on the authed web build (investigate).
- A few phantom error-boundary captures + the Plan group polluted by the recipe-404
  deep-link — flagged, not reviewed as real.
- **Coverage audit (2026-05-31):** the review was a genuine whole-product pass — 193 real
  captures across 10 groups, **all 35 ix-* interaction sub-states included** (none fell out);
  direction holds, no fresh synthesis needed. Small gaps NOT in any review group, all real
  surfaces that *reinforce* the 5 rules (not contradict): mobile **Shopping list**
  (`shopping-s00..s03`) and **web-desktop authed** notifications/create/fasting. (Doc earlier
  said "188"; the grp union is 193 — bookkeeping, not a hole.)
- The chrome-layer breakage (Next.js "1 Issue" badge + unstyled cookie bar over the authed
  app) is confirmed on **web-desktop** too, not only mobile-web — ENG-802/804 apply to both.
- Capture-time crashes on barcode/import/cook/weekly-recap deep-links may be a real signal
  (those flows fell through under the capture pipeline), not only stale phantoms — worth a look.

## Prototype (for red-lining)

Interactive, iPhone-framed HTML prototype of the "after" state — with the motion/delight
animated (odometer tween → ring fill → reserved win-moment celebration):
`docs/prototypes/2026-05-31-design-direction/index.html` (open in a browser; toggle
Before/After, tap the + to fire the win-moment). Rendered frames alongside it.

Additional surface prototypes (same shared kit `_kit.css`, all before/after):
- `surface-search-results.html` — the flat food-search list → unified segmented control + elevated result cards + legible confidence chips
- `surface-meal-actionsheet.html` — the raw iOS action sheet → branded cream sheet with thumbnail + macro preview (ENG-799)
- `surface-web-coldopen.html` — web violet/flat-ring/broken-CTA → blue, unified gradient, enabled CTA, web win-analog

## Process note

Captured crash-free via deep-link + `simctl` framebuffer + `idb` tap/swipe/describe
because Maestro's WDA dies on iOS 26.5 (`viewHierarchy 500`, hangs). See
`reference_crashfree_capture_pipeline` in agent memory.
