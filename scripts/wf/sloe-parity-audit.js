export const meta = {
  name: 'sloe-parity-audit',
  description: 'Exhaustive per-surface premium-parity audit: each fresh iOS capture vs its Figma frame + spec + the spacing scale + Mobbin best-practice. Categorised, ranked gap backlog (style / spacing / typography / functionality / photography / parity).',
  phases: [{ title: 'Audit', detail: 'one senior reviewer per surface, pixel-grounded' }],
}

const CAP = '/Users/graceturner/Suppr-1/apps/mobile/screenshots/agent/sweep-2026-06-09'
const DS = '/Users/graceturner/Suppr-1/docs/ux/redesign/_design-system.md'
const SPEC = '/Users/graceturner/Suppr-1/docs/ux/redesign/'

// Spacing scale is the explicit lever (Grace: spacing is a recurring weak spot).
const SPACING = 'xs:4 · sm:8 · md:16 · lg:20 · xl:24 · xxl:32 · xxxl:40 (apps/mobile/constants/theme.ts `Spacing`). Card gaps + padding MUST be on this scale, consistent, and matched to the Figma. Flag any off-scale value (e.g. 12) or any gap that reads too tight / too loose.'

const SURFACES = [
  { name: 'today', spec: 'today.md', impl: 'apps/mobile/app/(tabs)/index.tsx + components/today/*' },
  { name: 'plan', spec: 'plan.md', impl: 'apps/mobile/app/(tabs)/planner.tsx' },
  { name: 'shopping', spec: 'plan.md', impl: 'apps/mobile/app/shopping.tsx' },
  { name: 'library', spec: 'recipes.md', impl: 'apps/mobile/app/(tabs)/library.tsx' },
  { name: 'discover', spec: 'recipes.md', impl: 'apps/mobile/app/(tabs)/discover.tsx' },
  { name: 'barcode', spec: 'nutrition-log.md', impl: 'apps/mobile/app/(tabs)/barcode.tsx (sim has no camera — judge chrome only)' },
  { name: 'progress', spec: 'progress-insights.md', impl: 'apps/mobile/app/(tabs)/progress.tsx + components/progress/*' },
  { name: 'weight-tracker', spec: 'weight.md', impl: 'apps/mobile/app/weight-tracker.tsx' },
  { name: 'fasting', spec: 'habits.md', impl: 'apps/mobile/app/fasting.tsx' },
  { name: 'settings', spec: 'settings.md', impl: 'apps/mobile/components/settings/SettingsBundleContent.tsx' },
  { name: 'profile', spec: 'settings.md', impl: 'apps/mobile/app/profile.tsx' },
  { name: 'targets', spec: 'settings.md', impl: 'apps/mobile/app/targets.tsx' },
  { name: 'household', spec: 'settings.md', impl: 'apps/mobile/app/household-settings.tsx' },
  { name: 'nutrition-sources', spec: 'settings.md', impl: 'apps/mobile/app/nutrition-sources.tsx' },
  { name: 'health-sync', spec: 'settings.md', impl: 'apps/mobile/app/health-sync.tsx' },
  { name: 'recipe-create', spec: 'recipes.md', impl: 'apps/mobile/app/recipe/create.tsx' },
  { name: 'create-recipe-form', spec: 'recipes.md', impl: 'apps/mobile/app/create-recipe.tsx' },
  { name: 'import-shared', spec: 'import.md', impl: 'apps/mobile/app/import-shared.tsx' },
  { name: 'plan-import', spec: 'import.md', impl: 'apps/mobile/app/plan-import.tsx' },
  { name: 'cookbook-import', spec: 'import.md', impl: 'apps/mobile/app/cookbook-import.tsx' },
  { name: 'paywall', spec: 'paywall.md', impl: 'apps/mobile/app/paywall.tsx + components/paywall/*' },
  { name: 'weekly-recap', spec: 'progress-insights.md', impl: 'apps/mobile/app/weekly-recap.tsx' },
  { name: 'whats-new', spec: '', impl: 'apps/mobile/app/whats-new.tsx' },
  { name: 'today-log', spec: 'nutrition-log.md', impl: 'apps/mobile/components/today/LogSheet.tsx' },
]

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['surface', 'premiumTier', 'oneLine', 'gaps'],
  properties: {
    surface: { type: 'string' },
    premiumTier: { type: 'string', enum: ['premium', 'good', 'rough', 'broken'] },
    oneLine: { type: 'string', description: 'one-line verdict on how close to premium/Julienne this surface is' },
    gaps: {
      type: 'array', description: 'every concrete gap to premium parity, highest-impact first',
      items: {
        type: 'object', additionalProperties: false,
        required: ['category', 'issue', 'fix', 'severity'],
        properties: {
          category: { type: 'string', enum: ['style', 'spacing', 'typography', 'functionality', 'photography', 'parity'] },
          issue: { type: 'string' },
          fix: { type: 'string' },
          severity: { type: 'number', description: '1-5, 5 = most damaging to premium feel' },
        },
      },
    },
  },
}

phase('Audit')

const results = await parallel(SURFACES.map((s) => () =>
  agent(
    `You are a senior product designer + engineer auditing ONE iOS screen of "Sloe" (luxury recipe + nutrition app) for PREMIUM PARITY. Bar: editorial-luxury equal-or-better than Julienne, AND best-in-class vs the tracking/health apps on function. Colour is LOCKED (deep-plum #3B2A4D accent + clay-as-carbs) — do NOT raise colour-direction gaps.

READ:
1. Fresh iOS capture: ${CAP}/${s.name}.png
2. Design system (locked): ${DS}
3. ${s.spec ? `Per-surface spec (Figma + Mobbin intent): ${SPEC}${s.spec}` : 'No per-surface spec — judge vs the design system + Julienne bar.'}
4. The implementation to confirm functionality + find web-parity gaps: ${s.impl} (and its web mirror under src/app/ — glob for it).

SPACING IS A PRIORITY LENS: ${SPACING}

Produce an EXHAUSTIVE, categorised gap list for "${s.name}" — every concrete thing between this screen and premium parity:
- style: cheap/flat/off-bar visuals, weak hierarchy, inconsistent treatment, missing depth/polish.
- spacing: off-scale or inconsistent gaps/padding, too-tight or too-loose, mismatched to Figma. Be specific ("card gap 12, off-scale; should be 16/20").
- typography: sans where serif belongs (or vice-versa), wrong sizes/weights vs the type ramp.
- functionality: anything that looks broken/placeholder/dead, or a wired feature that reads wrong. (Note: empty test account — judge chrome, not missing data.)
- photography: missing/placeholder imagery where the agreed Sloe photography (FLUX) should be; cold/empty tiles.
- parity: where the web mirror likely diverges from this iOS surface (you can read both).

Rules: judge ONLY what's visible + what the code confirms. If the capture is an error/splash/blank, premiumTier="broken". Be concrete + actionable (each gap has a specific fix). Rank gaps by severity (5=worst). Return the structured verdict.`,
    { label: `audit:${s.name}`, phase: 'Audit', model: 'opus', schema: SCHEMA },
  ).then((v) => (v ? { ...v, surface: s.name } : null)),
))

const clean = results.filter(Boolean)
const order = { broken: 0, rough: 1, good: 2, premium: 3 }
const ranked = clean.slice().sort((a, b) => (order[a.premiumTier] - order[b.premiumTier]))
const counts = { premium: 0, good: 0, rough: 0, broken: 0 }
for (const r of clean) counts[r.premiumTier] = (counts[r.premiumTier] || 0) + 1
// Categorised gap tally across all surfaces
const byCat = {}
for (const r of clean) for (const g of (r.gaps || [])) byCat[g.category] = (byCat[g.category] || 0) + 1
// Flat, severity-sorted backlog for the fix phase
const backlog = clean.flatMap((r) => (r.gaps || []).map((g) => ({ surface: r.surface, ...g })))
  .sort((a, b) => b.severity - a.severity)

log(`Audited ${clean.length}/${SURFACES.length} surfaces — premium:${counts.premium} good:${counts.good} rough:${counts.rough} broken:${counts.broken}; ${backlog.length} gaps (${JSON.stringify(byCat)})`)

return { counts, byCategory: byCat, perSurface: ranked, backlog }
