export const meta = {
  name: 'sloe-test-triage',
  description: 'Triage + fix the remaining aubergine-WIP unit-test failures. One agent per failing file: classify each failure (stale test / reconcile-regression / unfinished source), fix the mechanical + stale-test cases against the locked design system, report anything needing product judgment. Never weaken an assertion to pass.',
  phases: [{ title: 'Triage', detail: 'one agent per failing test file' }],
}

const FILES = [{"file":"tests/unit/cardElevationVariants.test.tsx","failed":1,"model":"sonnet"},{"file":"tests/unit/trajectoryCard.test.tsx","failed":1,"model":"sonnet"},{"file":"tests/unit/calorieRingOverageArc.test.tsx","failed":2,"model":"sonnet"},{"file":"tests/unit/todayActivityCardTd1.test.tsx","failed":1,"model":"sonnet"},{"file":"tests/unit/recipeDetailV3SourcePins.test.ts","failed":19,"model":"opus"},{"file":"tests/unit/sloeCardHairlineBorders.test.tsx","failed":2,"model":"sonnet"},{"file":"tests/unit/logWeightSheetWiring.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/designTokensPhase1.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/accentTokens.test.ts","failed":4,"model":"sonnet"},{"file":"tests/unit/createRecipeWizard.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/screenAuditFixesParity.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/todayFlatCardFigma.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/trustPostureSweepPhase4.test.tsx","failed":2,"model":"sonnet"},{"file":"tests/unit/hexTokenSweep.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/progressRangePicker.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/todayRhythmLayout.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/recipeSourceCardParity.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/barcodeVoiceResultRedesign.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/settingsLaneAubergineOutline.test.ts","failed":1,"model":"sonnet"},{"file":"tests/unit/todayLayoutTokens.test.ts","failed":1,"model":"sonnet"}]

const SCHEMA = {
  type:'object', additionalProperties:false,
  required:['file','startFailed','endFailed','green','fixes','needsJudgment'],
  properties:{
    file:{type:'string'},
    startFailed:{type:'number'},
    endFailed:{type:'number'},
    green:{type:'boolean'},
    fixes:{type:'array',items:{type:'object',additionalProperties:false,required:['test','side','rootCause'],properties:{test:{type:'string'},side:{type:'string',enum:['test','source','shim']},rootCause:{type:'string'}}}},
    needsJudgment:{type:'array',items:{type:'object',additionalProperties:false,required:['test','why'],properties:{test:{type:'string'},why:{type:'string'}}},description:'failures left unfixed because they need product/design judgment or net-new behaviour'},
  },
}

phase('Triage')

const results = await parallel(FILES.map((f)=> ()=>
  agent([
    'You are triaging + fixing failures in ONE unit-test file of the Sloe iOS app (apps/mobile). Work from /Users/graceturner/Suppr-1/apps/mobile.',
    '',
    'CONTEXT: A canonical "aubergine" redesign (accent #3B2A4D, clay = carbs macro only) was just reconciled with a parity-fix sweep. The aubergine work was mid-flight, so its own guard tests have '+f.failed+' failing assertion(s) in this file. Pre-reconcile (clay) source of any file is available via: git show e5b7f8fd:<path>. The aubergine direction is canonical and LOCKED.',
    '',
    'YOUR FILE: '+f.file+'  ('+f.failed+' failing test(s))',
    '',
    'STEP 1 — see the failures: npx vitest run '+f.file,
    'STEP 2 — for EACH failure, read the test AND the source it checks, and classify:',
    '  (a) STALE TEST — the source is CORRECT for the aubergine direction but the test hardcodes an old clay value / old structure / wrong token. FIX: update the test to read the SAME token the source uses (import from @/constants/theme), never a hardcoded hex. Never weaken/delete the assertion.',
    '  (b) RECONCILE REGRESSION — a clay-based file was restored over aubergine and lost an aubergine improvement (off-scale spacing, sans where serif belonged, a clay hex). FIX: re-apply the aubergine improvement to the SOURCE using locked tokens (Type.* serif, Spacing.* on-scale, aubergine accent). Match what the test pins.',
    '  (c) MECHANICAL SOURCE CONVERSION — the test pins a clear, unambiguous design-system rule (on-scale spacing, serif token, hairline border, aubergine accent) that the source has not yet adopted. FIX: make the small mechanical source change to satisfy the locked DS rule. ONLY if it is mechanical + unambiguous + matches docs/ux/redesign/_design-system.md.',
    '  (d) NEEDS JUDGMENT — the failure needs product/design judgment, net-new behaviour, or a structural redesign decision. DO NOT GUESS. Leave it failing and report it in needsJudgment with a precise why.',
    '',
    'HARD RULES:',
    '1. NEVER edit constants/theme.ts (locked). Read tokens from it.',
    '2. NEVER weaken, skip, or delete an assertion just to make it pass. If the test is right and the source is wrong, fix the SOURCE.',
    '3. Tests assert colours via TOKENS imported from theme, never hardcoded hexes.',
    '4. Colour = aubergine (#3B2A4D accent, clay=carbs only). Never reintroduce clay-as-accent.',
    '5. If you change a SOURCE component for parity, check for a web mirror (src/app/**) and keep it in sync — but most of these are token/source-pin tests on mobile source.',
    '6. Run ONLY your one test file via vitest as you iterate (NOT the full suite — CPU). Do a final npx tsc --noEmit ONCE at the end ONLY if you edited source .ts/.tsx (skip if you only edited a .test file, to save CPU).',
    '',
    'Iterate until your file is green OR only (d) needs-judgment failures remain. Return the structured result: startFailed, endFailed, green, the fixes you made (per test: which side + root cause), and any needsJudgment items.',
  ].join('\n'),
  { label:'triage:'+f.file.replace('tests/unit/','').replace('.test','').replace(/\.(ts|tsx)$/,''), phase:'Triage', model:f.model, agentType:'executor', schema:SCHEMA }).then(v=> v?{...v,file:f.file}:{file:f.file,error:true})
))

const clean=results.filter(r=>r&&!r.error)
const greenCount=clean.filter(r=>r.green).length
const totalFixed=clean.reduce((n,r)=>n+(r.fixes||[]).length,0)
const stillFailing=clean.reduce((n,r)=>n+(r.endFailed||0),0)
const judgment=clean.flatMap(r=>(r.needsJudgment||[]).map(j=>({file:r.file,...j})))
log('Triaged '+clean.length+'/'+FILES.length+' files — '+greenCount+' now green, '+totalFixed+' fixes applied, '+stillFailing+' still failing, '+judgment.length+' need judgment')
return { perFile: clean, greenCount, totalFixed, stillFailing, judgment, failed: results.filter(r=>!r||r.error).map(r=>r&&r.file) }
