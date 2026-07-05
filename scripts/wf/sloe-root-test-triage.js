export const meta = {
  name: 'sloe-root-test-triage',
  description: 'Green the 71 root web/shared unit failures (vitest.unit.config.ts) the aubergine reconcile left stale. One agent per failing file: re-pin stale tests to the canonical redesigned source (aubergine accent + recipe-detail Figma 332:2), or flag genuine source gaps. Never weaken an assertion.',
  phases: [{ title: 'Triage', detail: 'one agent per failing root-unit file' }],
}

// Override with SUPPR_REPO_ROOT for a non-standard checkout location; falls
// back to cwd (the harness runs these from the repo root).
const REPO_ROOT = process.env.SUPPR_REPO_ROOT || process.cwd()

const FILES = [{"file":"tests/unit/recipeDetailMetaAndVerdict.test.ts","failed":21,"model":"opus"},{"file":"tests/unit/recipeDetailLayoutWeb.test.tsx","failed":15,"model":"opus"},{"file":"tests/unit/recipeDetailFigmaReskin.test.ts","failed":9,"model":"opus"},{"file":"tests/unit/recipeIngredientVerifyAndAmountFixes.test.ts","failed":4,"model":"sonnet"},{"file":"tests/unit/recipeViewScaleScreens.test.tsx","failed":4,"model":"sonnet"},{"file":"tests/unit/uiConsistencyRound2.test.ts","failed":4,"model":"sonnet"},{"file":"tests/unit/frostFlagTokens.test.ts","failed":3,"model":"sonnet"},{"file":"tests/unit/uiConsistencyPolishRound.test.ts","failed":3,"model":"sonnet"},{"file":"tests/unit/paywallDarkContrast.test.ts","failed":2,"model":"sonnet"},{"file":"tests/unit/importVerifySkeleton.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/libraryFilterPillPadding.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/progressPhase2Cards.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/todayAboveMealsCap.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/todayCardElevationSweep.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/trustPostureSweepPhase4.test.tsx","failed":1,"model":"sonnet"}]

const SCHEMA = {
  type:'object', additionalProperties:false,
  required:['file','startFailed','endFailed','green','fixes','needsJudgment'],
  properties:{
    file:{type:'string'},
    startFailed:{type:'number'}, endFailed:{type:'number'}, green:{type:'boolean'},
    fixes:{type:'array',items:{type:'object',additionalProperties:false,required:['test','side','rootCause'],properties:{test:{type:'string'},side:{type:'string',enum:['test','source','shim']},rootCause:{type:'string'}}}},
    needsJudgment:{type:'array',items:{type:'object',additionalProperties:false,required:['test','why'],properties:{test:{type:'string'},why:{type:'string'}}}},
  },
}

phase('Triage')

const results = await parallel(FILES.map((f)=> ()=>
  agent([
    'You are greening failures in ONE ROOT web/shared unit-test file of the Sloe app. Work from '+REPO_ROOT+' (repo root).',
    '',
    'CONTEXT: The canonical "aubergine" redesign is the shipped direction — accent = deep plum #3B2A4D (NOT clay), clay survives ONLY as the carbs macro colour, the brand_frost_secondary flag is RETIRED (decision: docs/decisions/2026-06-08-aubergine-accent-system.md). Recipe-detail was redesigned to the Figma 332:2 structure: the subtitle row was REMOVED, kcal moved to the leading CAL column of RecipeMacroStrip (serif 24px), serif titles, warm cream base. The canonical re-pinned reference for recipe-detail structure is tests/unit/recipeDetailV3SourcePins.test.ts (already updated to 332:2 and passing) — read it to learn the current canonical source shape. Many failing tests still pin the SUPERSEDED state (clay accent, recipe-detail v4 subtitle/kcal-line). Those are STALE TESTS.',
    '',
    'YOUR FILE: '+f.file+'  ('+f.failed+' failing test(s))',
    '',
    'STEP 1 — see failures: npx vitest run --config vitest.unit.config.ts '+f.file,
    'STEP 2 — for EACH failure, read the test AND the source it pins, and classify + fix:',
    '  (a) STALE TEST (clay→aubergine): test pins the old clay accent / retired frost flag, source correctly uses aubergine. FIX the TEST: assert the aubergine reality, reading tokens from src/styles/theme.css / @/constants/theme rather than hardcoding hexes. If a test ONLY exists to verify the removed frost-flag behaviour, delete just those obsolete cases (keep any still-valid coverage) and note it.',
    '  (b) STALE TEST (recipe-detail v4→332:2): test pins the removed subtitle/kcal-line/old structure; source is at 332:2. FIX the TEST: re-pin to the canonical 332:2 structure the source actually renders (cross-check against recipeDetailV3SourcePins.test.ts + the live source).',
    '  (c) SOURCE-PIN DRIFT: a triage/reconcile changed the source (e.g. ProgressEnergyTriad inlined, filter pill padding 13→12) and the test still pins the old token/structure. FIX: if the new source is correct per the locked design system, re-pin the test; if the test pins a locked DS rule the source violated, fix the SOURCE to satisfy it (on-scale spacing / serif / aubergine token).',
    '  (d) GENUINE SOURCE GAP / NEEDS JUDGMENT: the test demands intended behaviour the source genuinely does NOT implement (a half-finished redesign, missing feature, real copy/logic decision). DO NOT mask it by weakening the test. Leave it failing and report it in needsJudgment with a precise why.',
    '',
    'HARD RULES:',
    '1. NEVER weaken, skip, or delete an assertion just to make it pass. Deleting is allowed ONLY for cases that test genuinely-removed behaviour (e.g. the retired frost flag) — and you must say so.',
    '2. NEVER edit constants/theme.ts or src/styles/theme.css token VALUES. Read tokens from them.',
    '3. Colour = aubergine #3B2A4D accent, clay = carbs only. Never reintroduce clay-as-accent.',
    '4. Tests assert colours via TOKENS, not hardcoded hexes, wherever possible.',
    '5. If you edit SOURCE for a (c) fix, keep web↔mobile parity (find the mirror) and run npx tsc --noEmit ONCE at the end (web: from root; if you touched apps/mobile, also cd apps/mobile && npx tsc --noEmit).',
    '6. Run ONLY your one file via vitest as you iterate (NOT the full suite — CPU).',
    '',
    'Iterate until your file is green OR only (d) needs-judgment failures remain. Return startFailed, endFailed, green, the fixes (per test: side + root cause), and any needsJudgment items.',
  ].join('\n'),
  { label:'root:'+f.file.replace('tests/unit/','').replace('.test','').replace(/\.(ts|tsx)$/,''), phase:'Triage', model:f.model, agentType:'executor', schema:SCHEMA }).then(v=> v?{...v,file:f.file}:{file:f.file,error:true})
))

const clean=results.filter(r=>r&&!r.error)
const green=clean.filter(r=>r.green).length
const totalFixed=clean.reduce((n,r)=>n+(r.fixes||[]).length,0)
const stillFailing=clean.reduce((n,r)=>n+(r.endFailed||0),0)
const judgment=clean.flatMap(r=>(r.needsJudgment||[]).map(j=>({file:r.file,...j})))
log('Root-triage '+clean.length+'/'+FILES.length+' files — '+green+' green, '+totalFixed+' fixes, '+stillFailing+' still failing, '+judgment.length+' need judgment')
return { perFile: clean, green, totalFixed, stillFailing, judgment, failed: results.filter(r=>!r||r.error).map(r=>r&&r.file) }
