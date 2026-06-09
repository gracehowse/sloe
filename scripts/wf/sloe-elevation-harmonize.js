export const meta = {
  name: 'sloe-elevation-harmonize',
  description: 'Harmonize card elevation to ONE treatment per surface (Grace 2026-06-09: "on every page there are multiple styles fighting" — raised ring vs flat tiles). Page-ground cards get the soft lift; nested/inset cards stay flat. Web + mobile in lockstep, guard tests re-pinned.',
  phases: [{ title: 'Harmonize', detail: 'one agent per platform' }],
}

const RULES = [
  'THE RULE: every card sitting directly on the page ground (the screen/scroll background) uses the SOFT lift — mobile: <SupprCard lift="soft"> (or useCardElevation({variant:"soft"})); web: the `card-slab` class. Cards NESTED INSIDE another card (inset tiles, rows inside a sheet, sub-panels) stay FLAT — a card inside a card must not double-shadow. Decide per call site by reading the JSX context.',
  'Do NOT change the elevation system itself (SupprCard defaults, useCardElevation hook contract, theme.css token values, Elevation tokens). Flip CALL SITES only.',
  'TodayHeroRing (mobile) + today-hero-ring (web) are already soft — the reference. TodayDashboardMacroTiles (mobile) + today-dashboard-macro-tiles (web) were already flipped to soft this session — leave them.',
  'GUARD TESTS: the old "flat slabs" direction has guard tests (e.g. tests/unit/todayCardElevationSweep.test.ts "macro tiles use card-slab-flat", todayFlatCardFigma, settingsElevationFlag, progressDashboardElevation, supprPrimitives; mobile sloeCardHairlineBorders, todayFlatCardFigma). Re-pin them to the NEW rule (soft for page-ground, flat only for nested) — update assertions + the docblocks to cite "Grace 2026-06-09 one-treatment". NEVER delete a test; never leave one asserting the dead flat direction. cardElevationVariants pins the HOOK default = flat — that is the system contract, unchanged: leave it.',
  'After your flips, run ONLY the elevation-related test files you touched (single vitest invocations, not the suite) and your platform typecheck ONCE at the end.',
  'Keep edits minimal: the lift prop / className swap + a one-line comment citing the 2026-06-09 decision. No layout/spacing/colour changes.',
]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['platform', 'softened', 'keptFlat', 'testsRepinned', 'tscClean'],
  properties: {
    platform: { type: 'string' },
    softened: { type: 'array', items: { type: 'string' }, description: 'file — card(s) flipped to soft' },
    keptFlat: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'why'], properties: { file: { type: 'string' }, why: { type: 'string' } } }, description: 'call sites deliberately left flat (nested/inset) with the reason' },
    testsRepinned: { type: 'array', items: { type: 'string' } },
    tscClean: { type: 'boolean' },
  },
}

phase('Harmonize')

const TASKS = [
  {
    platform: 'mobile',
    prompt: 'MOBILE (apps/mobile). Audit every lift="flat" / useTodayCardElevation call site: ' +
      'components/today/{TodayMealsFigmaLayout,WeeklyInsightCard,TodayPlannedMealsCard,TodayFirstMealEmptyState,NorthStarBlock,TodayDashboardMacroBars,WeeklyCheckinBanner,TodayMealsSection,TodayActivityBonusCard,TodayActivityCard}.tsx, components/HydrationStimulantsCard.tsx, app/burn-detail.tsx, app/(tabs)/index.tsx (useTodayCardElevation caller). ' +
      'Also grep the whole of apps/mobile for any other lift="flat" or variant:"flat" call sites I missed and treat them by the same rule. ' +
      'Own the MOBILE guard tests under apps/mobile/tests/unit/ (e.g. todayFlatCardFigma, sloeCardHairlineBorders — whatever pins flat).',
  },
  {
    platform: 'web',
    prompt: 'WEB (repo root). Audit every `card-slab-flat` class usage: ' +
      'src/app/components/{Settings,HouseholdPanel,Profile}.tsx and src/app/components/suppr/{today-meals-section,today-week-sidebar,today-apple-health-card,today-steps-card,today-week-view,today-desktop-right-rail,today-activity-bonus-card,today-snap-shortcut,today-first-meal-empty-state,hydration-stimulants-card,today-weekly-insight-card}.tsx. ' +
      'src/app/components/ui/suppr-card.tsx is the SHARED shell — read it, understand its variant prop, do not change its defaults. ' +
      'Also grep src/ + app/ for any other card-slab-flat usages and treat them by the same rule. ' +
      'Own the ROOT guard tests under tests/unit/ (todayCardElevationSweep, settingsElevationFlag, progressDashboardElevation, supprPrimitives — whatever pins flat).',
  },
]

const results = await parallel(TASKS.map((t) => () =>
  agent(
    ['You are harmonizing card elevation on the Sloe app to ONE treatment per surface.', '', t.prompt, '', 'RULES:', ...RULES.map((r, i) => (i + 1) + '. ' + r), '', 'Return the structured result.'].join('\n'),
    { label: 'elevate:' + t.platform, phase: 'Harmonize', model: 'opus', agentType: 'executor', schema: SCHEMA },
  ).then((v) => (v ? { ...v, platform: t.platform } : { platform: t.platform, error: true })),
))

const clean = results.filter((r) => r && !r.error)
log('Harmonized ' + clean.length + '/2 platforms — softened: ' + clean.reduce((n, r) => n + (r.softened || []).length, 0) + ', kept-flat(nested): ' + clean.reduce((n, r) => n + (r.keptFlat || []).length, 0) + ', tests re-pinned: ' + clean.reduce((n, r) => n + (r.testsRepinned || []).length, 0))
return { perPlatform: clean, failed: results.filter((r) => !r || r.error).map((r) => r && r.platform) }
