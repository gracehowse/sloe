# Implementation specs — Skia ring · CTA weight map · serif titles (2026-06-09)

ui-product-designer output, persisted from the session transcript. Each spec
is implementation-ready. Cross-platform rule: every visual change lands on
web in the same commit.

---

## SPEC 1 — Skia calorie ring + overflow + win moment

**Needs an EAS rebuild (Skia is native; NOT OTA-rampable). Flag `ring_skia_v1`,
default OFF until the rebuild is on TestFlight; SVG path stays as fallback.**

- New `apps/mobile/components/charts/SkiaCalorieRing.tsx`, drop-in same props
  as `CalorieRing.tsx`; host `TodayHeroRing.tsx` picks via flag.
- Geometry unchanged (ratios `0.44`/`0.05`/`0.028`, macro radii
  `0.368/0.314/0.259` × SIZE, round caps, −90° start) so
  `calorieRingGeometry` tests + web parity hold.
- Fill animates via Reanimated SharedValue → Skia Path `end` (UI thread).
  `withSpring(pct, Motion.springSoft)` with `overshootClamping: true`;
  reduce-motion → instant set. Centre number STAYS RN `<Text>` inside
  `PostHogMaskView` (Skia canvases can't be replay-masked).
- **Overflow (over-budget): brightening-plum SweepGradient — DECIDED, amber
  REJECTED** (`docs/decisions/2026-06-09-ring-overflow-brightening-plum.md`):
  light `#5B3B6E → #9A7BAA`, dark `#815E91 → #C4ACD0`, blurred leading-cap
  glow in the end-stop, same origin, `overFrac` sweep, cap at one extra lap.
  No `ring_warm_overflow_v1` sub-flag — ships with `ring_skia_v1`.
- Goal-hit glow: second arc path, `BlurMask(blur: STROKE×0.9)`, opacity
  0→0.6→0 over 600ms; win-flag uses win-gradient end-tone (`#7E5C92` light /
  `#C4ACD0` dark). Reduce-motion: static 0.3 frame for 600ms.
- State machine: empty → filling → near (90–99%) → hit (100%) → overflow.
- Haptics (iOS, reduce-motion does NOT suppress): near-entry `Medium`;
  goal-hit `Medium → 80ms → Success` (upgrade `use-win-moment.ts` L127);
  overflow-entry single soft `Medium`; long-press `selectionAsync`.
- Web analog (`suppr/daily-ring.tsx`): keep existing winSpectrum pulse +
  odometer; add the plum-gradient overflow via SVG linearGradient
  approximation + two CSS vars (`--ring-overflow-warm-from/-to` naming →
  use plum values per the decision doc). Same commit as mobile overflow.

## SPEC 2 — CTA weight map (the principled rule + 4 changes)

**Rule: FILLED aubergine = (a) the FAB, (b) pay/signup conversion (paywall,
onboarding funnel) ONLY. Every other on-screen primary = aubergine OUTLINE
(1.5px primarySolid border + label). Bare text = dismissal/alternatives only,
never a screen's primary. Off-white SEC = the secondary of a pair.**

Audited all 50 CTAs across the 23 light captures; only these change:

| CTA | Current | → Target | Files |
|---|---|---|---|
| import-shared "Import" | filled slab | OUTLINE | `apps/mobile/app/import-shared.tsx` + web import mirror |
| "LOG TODAY" planned rows | bare caps text | compact outline pill (keep caps; padH 10 padV 4, radius full) | `apps/mobile/app/(tabs)/index.tsx` + web Today planned rows |
| weekly-recap "Log a meal" | bare text | outline button | `apps/mobile/app/weekly-recap.tsx` + web |
| whats-new "Done" | bold text | compact outline pill (lowest priority) | `apps/mobile/app/whats-new.tsx` |

Explicitly DEFENDED (regression-pin, do not "promote"): create-recipe
"Save Recipe" + wizard "Continue" stay OUTLINE (content-authoring is a task,
not conversion); paywall trial stays FILLED; FAB stays the one filled moment.
Guard pins: extend `todayLaneAubergineOutline.test.ts` (+ import/weekly-recap
lanes). NOTE (post-spec): assert the scheme-resolved `accent.primarySolid`
form, not the static constant.

## SPEC 3 — Unified serif screen titles

Truth from pixels: ONLY Targets is genuinely Inter; Health-Sync is serif
28/700, Household serif 28/600, weekly-recap nav title Inter-bold. Fix =
consolidation via two new `Type` tokens (mirror web classes
`.screen-title`/`.nav-title`):

- `Type.screenTitle` — Newsreader serifSemibold 28/34, weight 600,
  letterSpacing −0.3, `colors.text`. For large left-aligned in-body H1s:
  **Targets ("Daily targets" — the one real Inter→serif fix), Health-Sync
  (700→600), Household (tokenise), Weight & Trends + Nutrition-sources
  (tokenise).**
- `Type.navTitle` — Newsreader serifMedium 18/22, weight 500, letterSpacing
  −0.1. Change `PushScreenHeader.tsx:66` from `Type.headline` → `Type.navTitle`
  (the single shared lever); move weekly-recap's Inter-bold nav title onto it.
  Weekly-recap's in-body "Jun 8–14" stays `Type.title` (content headline).
- Rule of thumb: large left-aligned top-of-scroll title → `screenTitle`;
  compact nav-bar-row title → `navTitle`.
- Guard: `screenTitleSerif.test.ts` pinning the four screens + both tokens.

## Risks

- Skia = EAS rebuild; do NOT ramp `ring_skia_v1` on older builds (crash).
- Specs 2+3 are JS-only, OTA-safe. (Session note: Grace authorized dropping
  per-change flags for redesign-conformance work in this initiative.)
- Perf: only the Today hero goes Skia in v1; WinMomentPlayer stays SVG.
