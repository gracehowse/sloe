export const meta = {
  name: 'sloe-elevation-pass2',
  description: 'Extend the one-card-treatment soft elevation (docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md) beyond Today: Plan, Progress, Settings, Shopping + remaining screens with page-ground cards — mobile + web mirrors in lockstep. Nested cards stay flat.',
  phases: [{ title: 'Extend', detail: 'one agent per surface cluster' }],
}

const RULES = [
  'THE RULE (decision doc docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md): every card sitting directly on the page ground gets the SOFT lift — mobile: <SupprCard lift="soft"> or useCardElevation({variant:"soft"}) (spread shadowStyle on an OUTER wrapper, liftBg ?? card bg, useBorder for the hairline — copy the weight-card pattern in progress.tsx); web: `.card-slab` class or <SupprCard elevation="card">. Cards NESTED inside another card/sheet stay FLAT. Bespoke hand-rolled card styles (borderWidth+borderRadius+bg with no elevation hook) on page-ground cards should be routed through the elevation system, not given hand-rolled shadows.',
  'Do NOT change the elevation system itself (SupprCard defaults, useCardElevation contract, tokens).',
  'Do NOT touch layout, spacing, radii, colours, or copy — elevation only.',
  'Update any guard test that pins the old flat/bespoke chrome for the cards you change (re-pin, never delete). Run only the tests you touched + your platform typecheck once at the end.',
  'iOS shadow rule: RN clips shadows under overflow:hidden — shadow on an OUTER wrapper (SupprCard already handles this; bespoke conversions must too).',
  'If a card is deliberately a TINTED INSET (e.g. the lilac THIS WEEK story gate wash, slot-tinted chips) sitting inside the page rhythm as an accent rather than a content card, use judgment: content cards lift; pure tint-wash banners may stay flat — record the call in keptFlat with why.',
]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['cluster', 'softened', 'keptFlat', 'testsRepinned', 'tscClean'],
  properties: {
    cluster: { type: 'string' },
    softened: { type: 'array', items: { type: 'string' } },
    keptFlat: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'why'], properties: { file: { type: 'string' }, why: { type: 'string' } } } },
    testsRepinned: { type: 'array', items: { type: 'string' } },
    tscClean: { type: 'boolean' },
  },
}

phase('Extend')

const CLUSTERS = [
  { key: 'plan-shopping', prompt: 'PLAN + SHOPPING, both platforms: apps/mobile/app/(tabs)/planner.tsx, apps/mobile/app/shopping.tsx (+ their components: PlanEmptyState, PlanTemplatesSheet day cards if page-ground), web src/app/components/MealPlanner.tsx + ShoppingList.tsx. The Plan summary slab, day meal-list card(s), and shopping list group cards are page-ground.' },
  { key: 'progress', prompt: 'PROGRESS, both platforms: apps/mobile/app/(tabs)/progress.tsx (weight card already spreads cardElevation — check which variant it resolves and make page-ground cards soft; AVERAGE ADHERENCE card via ProgressAverageAdherence; DigestStoryCard, TrajectoryCard, WeightSparseState etc. if page-ground), web src/app/components/ProgressDashboard.tsx (bare <SupprCard> defaults to slab-flat — give page-ground cards elevation="card") + progress components (progress-average-adherence, trajectory-card, digest-story-card, progress-story-gate: the lilac story-gate wash is a tint banner — judgment call). Guard tests: progressDashboardElevation.test.tsx + any source-pins.' },
  { key: 'settings-secondary', prompt: 'SETTINGS + SECONDARY SCREENS, both platforms: apps/mobile/components/settings/SettingsBundleContent.tsx (Pro banner, stat tile, Your-name card, row-group cards), apps/mobile/app/{targets,profile,household-settings,health-sync,nutrition-sources,fasting,weight-tracker,weekly-recap,whats-new}.tsx — page-ground cards only; web mirrors src/app/components/{Settings,Targets,HouseholdSettingsPage,FastingTimer}.tsx + app/whats-new/page.tsx etc. Guard tests: settingsElevationFlag + whatsNewScreen + weeklyRecapScreen + any source-pins.' },
]

const results = await parallel(CLUSTERS.map((c) => () =>
  agent(
    ['You are extending the Sloe one-card-treatment soft elevation to more surfaces. READ the decision doc first: docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md, and the reference implementations: apps/mobile/components/today/TodayHeroRing.tsx (SupprCard lift=soft), apps/mobile/app/(tabs)/progress.tsx weight card (useCardElevation spread), web src/app/components/suppr/today-hero-ring.tsx (.card-slab).', '', 'YOUR CLUSTER: ' + c.prompt, '', 'RULES:', ...RULES.map((r, i) => (i + 1) + '. ' + r), '', 'Return the structured result.'].join('\n'),
    { label: 'elevate2:' + c.key, phase: 'Extend', model: 'opus', agentType: 'executor', schema: SCHEMA },
  ).then((v) => (v ? { ...v, cluster: c.key } : { cluster: c.key, error: true })),
))

const clean = results.filter((r) => r && !r.error)
log('Pass 2: ' + clean.length + '/3 clusters — softened ' + clean.reduce((n, r) => n + (r.softened || []).length, 0) + ', kept-flat ' + clean.reduce((n, r) => n + (r.keptFlat || []).length, 0) + ', tests ' + clean.reduce((n, r) => n + (r.testsRepinned || []).length, 0))
return { perCluster: clean, failed: results.filter((r) => !r || r.error).map((r) => r && r.cluster) }
