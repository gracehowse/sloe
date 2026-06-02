# Plan win-moment headline + `/planner` route canonicalisation (2026-05-31)

**Status:** Resolved
**Area:** Plan tab / web routing / cross-platform
**Owner:** Grace
**Tickets:** ENG-820 (Plan win-moment), ENG-806 (`/planner` dead-end)
**Initiative:** Redesign — Design Direction 2026 (see
`docs/decisions/2026-05-31-design-director-review-and-direction.md`)

## What changed

Two Plan-surface items from the 2026-05-31 design-director review.

### ENG-820 — state-aware "Hits your targets N of 7" headline + Plan haptics

The Plan tab's payoff line — *"Hits your targets N of 7 days"* — rendered as
inert flat text, and the two most consequential Plan commits (generating a
week, moving a meal) committed silently. The 5th-spine-rule direction asks the
landmark "every day lands on target" to read as a quiet win and consequential
commits to be felt.

Behind the **`redesign_winmoment`** flag (old behaviour preserved in the
flag-off arm on both platforms):

- **State-aware headline colour.** The headline colours by a tone derived from
  the already-computed week summary score, via a new shared classifier
  `planWeekHeadlineTone(score)` in `src/lib/planning/planWeekSummary.ts` so web
  and mobile can never disagree on which weeks are a win:
  - `win` (every day lands, `hits === total`) → the reserved win token
    (`Accent.win` / `var(--accent-win)`, gold `#F2A93B`)
  - `progress` (some days land) → amber (`Accent.warning` / `var(--warning)`) —
    never red, consistent with the "over-budget signals stay amber" rule
  - `calm` (no day lands yet, `hits === 0`) → muted secondary text —
    informative, not alarming
  Flag OFF → today's flat foreground colour.
- **Reserved win-moment (mobile).** When the week first crosses *into* 7/7 (a
  rising-edge guard, so re-mounting an already-7/7 plan never replays it), the
  headline does a one-shot scale pulse (`withSequence(SPRING_SNAPPY → SPRING_DEFAULT)`
  from the shared motion vocabulary) and fires a loud success haptic
  (`Haptics.notificationAsync(Success)`).
- **Settle haptics (mobile).** Plan-generate completion and move-meal commit
  each fire a Medium *impact* settle haptic — distinct from the reserved loud
  success notification — so the commit is felt. Flag-gated.
- **Web.** Colour shift only (+ `transition-colors` easing). There is no
  Haptics API on web, so the headline colour + the subtitle carry the payoff.
  The web summary card already carries the soft `card-elevated` shadow, so no
  extra elevation work was owed there.

The mobile summary card additionally picks up the soft resting-card elevation
via the shared `useCardElevation()` hook (behind `design_system_elevation`),
converting the last hand-rolled hairline-border card on the Plan summary
surface to the one-elevation model. Plan day/meal rows were left alone: their
top borders are *list-row dividers*, not card-as-shadow substitutes, so the
ENG-795 day-card elevation pass (`recipes-plan-elevation-v2`) owns those
separately.

No new analytics event was added — the win haptic rides on the existing
`meal_plan_generated` / `meal_moved_in_plan` commit beats; the win-moment is a
tactile/colour treatment, not a tracked landmark overlay like Today's.

### ENG-806 — `/planner` web dead-end → redirect to `/plan`

The web product had **two** plan routes: `/plan` rendered the real, working
web plan (the `(product)` shell mounts `HomePageClient` → `MealPlanner`; the
App shell derives the "plan" view from the pathname), while a *separate* stub
at `app/planner/page.tsx` dead-ended to a "your plan lives in the iOS app — get
the app" wall. One working URL, one dead end, for the same surface.

That stub made sense when web had **no** Plan surface at all (premium-bar audit
2026-05-12). That gap is now closed — `/plan` is the real thing. So `/planner`
now **permanently redirects (HTTP 308) to `/plan`** via `permanentRedirect`,
collapsing to **one canonical web plan route**. Any old `/planner` link (push
notification, web share, marketing copy, bookmark) now lands on the real plan
instead of a wall.

This is a pure routing fix with no visual surface of its own (the user never
sees the stub again), so per `CLAUDE.md` it needs **no feature flag**. Both
`/planner` and `/plan` are outside `PUBLIC_ROUTES`, so middleware still 307s
unauthed visitors to `/login` before the redirect runs — it can't leak the
plan surface to logged-out users.

The now-redundant `planner` entry in the web authed-screenshot tour
(`tests/e2e/screenshots/web-authed-storagestate.spec.ts`) was dropped — it
would just duplicate the `plan` capture.

## Cross-platform parity

| Aspect | Web | Mobile |
|---|---|---|
| Headline tone source | `planWeekHeadlineTone` (shared) | `planWeekHeadlineTone` (shared) |
| Win colour | `var(--accent-win)` | `Accent.win` |
| Progress colour | `var(--warning)` | `Accent.warning` |
| Calm colour | `var(--muted-foreground)` | `colors.textSecondary` |
| Win pulse | — (no analog needed) | scale pulse on rising edge |
| Success haptic on win | — (no Haptics API) | `notificationAsync(Success)` |
| Settle haptic on generate/move | — (no Haptics API) | `impactAsync(Medium)` |
| Summary card elevation | already `card-elevated` | `useCardElevation()` (new) |
| `/planner` route | 308 → `/plan` | n/a (native Plan tab) |

The haptic / pulse asymmetry is **platform-capability**, not drift — web has no
Haptics API, and the colour shift is the shared payoff. Documented here so
`sync-enforcer` does not flag it.

## Tests

- `tests/unit/planWeekSummary.test.ts` — unit tests for `planWeekHeadlineTone`
  (win / progress / calm / guards; the 6/7 false-win guard).
- `apps/mobile/tests/unit/planWinMomentParity.test.ts` — source-text parity:
  both platforms gate on `redesign_winmoment`, both use the shared classifier,
  the tone→colour mapping per platform, the rising-edge success haptic, the two
  settle haptics, and the headline test hooks.
- `tests/unit/plannerRouteRedirect.test.ts` — `/planner` permanently redirects
  to `/plan` and no longer renders the dead-end wall.

## Flags

- `redesign_winmoment` — gates the whole Plan win layer (headline tone + pulse
  + all haptics). Already provisioned for the Today win-moment work.
- `design_system_elevation` — gates the mobile summary-card soft elevation
  (shared with the project-wide card sweep).
- ENG-806 needs no flag (pure routing fix).
