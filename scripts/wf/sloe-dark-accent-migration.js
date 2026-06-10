export const meta = {
  name: 'sloe-dark-accent-migration',
  description: 'Migrate static Accent.primary* reads to the scheme-resolved useAccent() hook so the aubergine accent inverts on dark (design-director 2026-06-09 move 1 — dark titles/CTAs/eyebrows currently render deep plum #3B2A4D on near-black, invisible). 58 files, 6 disjoint clusters.',
  phases: [{ title: 'Migrate', detail: 'one agent per file cluster' }],
}

const CLUSTERS = [["apps/mobile/app/(tabs)/discover.tsx","apps/mobile/app/meal-nutrition.tsx","apps/mobile/components/Badge.tsx","apps/mobile/components/household/ReceivedInvitesBanner.tsx","apps/mobile/components/paywall/PaywallCta.tsx","apps/mobile/components/tabs/LogTabBarButton.tsx","apps/mobile/components/today/ProgressStoryGate.tsx","apps/mobile/components/today/TodayEatAgainBanner.tsx","apps/mobile/components/today/TodayMealsSection.tsx","apps/mobile/components/today/WhyThisNumberSheet.tsx"],["apps/mobile/app/(tabs)/index.tsx","apps/mobile/app/nutrition-sources.tsx","apps/mobile/components/EmptyState.tsx","apps/mobile/components/nutrition/MacroIconRow.tsx","apps/mobile/components/progress/ProgressAverageAdherence.tsx","apps/mobile/components/tabs/SupprTabBar.tsx","apps/mobile/components/today/SavedMealPortionSheet.tsx","apps/mobile/components/today/TodayEatAgainScroller.tsx","apps/mobile/components/today/TodayQuickLogStrip.tsx","apps/mobile/components/ui/RootErrorBoundary.tsx"],["apps/mobile/app/+not-found.tsx","apps/mobile/app/profile.tsx","apps/mobile/components/JournalDatePickerModal.tsx","apps/mobile/components/nutrition/NutritionDetailEmptyState.tsx","apps/mobile/components/recap/GoalPaceControls.tsx","apps/mobile/components/today/LogFab.tsx","apps/mobile/components/today/TodayActivityBonusCard.tsx","apps/mobile/components/today/TodayEditMealModal.tsx","apps/mobile/components/today/TodaySnapShortcut.tsx","apps/mobile/components/ui/SearchResultConfidenceChip.tsx"],["apps/mobile/app/health-sync.tsx","apps/mobile/app/targets.tsx","apps/mobile/components/MoveMealSheet.tsx","apps/mobile/components/onboarding/mobile-flow.tsx","apps/mobile/components/recap/GoalPaceRetuneSheet.tsx","apps/mobile/components/today/Milestone30DayModal.tsx","apps/mobile/components/today/TodayActivityCard.tsx","apps/mobile/components/today/TodayFastingPill.tsx","apps/mobile/components/today/WeeklyCheckinBanner.tsx","apps/mobile/components/ui/TrustChip.tsx"],["apps/mobile/app/household-settings.tsx","apps/mobile/app/weekly-recap.tsx","apps/mobile/components/RulerSlider.tsx","apps/mobile/components/onboarding/steps/data-bridges.tsx","apps/mobile/components/settings/DevFlagOverrides.tsx","apps/mobile/components/today/NorthStarBlock.tsx","apps/mobile/components/today/TodayCompleteDayModal.tsx","apps/mobile/components/today/TodayHeroRing.tsx","apps/mobile/components/today/WeeklyCheckinModal.tsx"],["apps/mobile/app/macro-detail.tsx","apps/mobile/app/whats-new.tsx","apps/mobile/components/SaveMealSheet.tsx","apps/mobile/components/onboarding/steps/welcome.tsx","apps/mobile/components/settings/SettingsBundleContent.tsx","apps/mobile/components/today/ProgressHeadline.tsx","apps/mobile/components/today/TodayDateHeader.tsx","apps/mobile/components/today/TodayMealsFigmaLayout.tsx","apps/mobile/components/today/WhereThisComesFromSheet.tsx"]]

const SCHEMA = {
  type:'object', additionalProperties:false,
  required:['cluster','migrated','keptStatic','tscClean'],
  properties:{
    cluster:{type:'number'},
    migrated:{type:'array',items:{type:'string'}},
    keptStatic:{type:'array',items:{type:'object',additionalProperties:false,required:['file','why'],properties:{file:{type:'string'},why:{type:'string'}}}},
    tscClean:{type:'boolean'},
  },
}

phase('Migrate')

const results = await parallel(CLUSTERS.map((c, i) => () =>
  agent([
    'You are migrating static accent reads to the scheme-resolved hook in the Sloe iOS app (apps/mobile). Work ONLY on your assigned files.',
    '',
    'WHY: the accent must INVERT on dark (deep plum #3B2A4D is invisible on near-black). The provider now resolves it: apps/mobile/context/theme.tsx exports useAccent() which returns the dark-lifted aubergine family ({primary:#7E5C92, primaryLight:#9A7BAA, primarySolid:#C4ACD0, primarySoft:rgba(154,123,170,0.18)}) when the resolved scheme is dark, and the canonical deep-plum family on light. READ that file first.',
    '',
    'YOUR FILES:',
    ...CLUSTERS[i].map(f=>'- '+f),
    '',
    'FOR EACH FILE: find every read of Accent.primary, Accent.primaryLight, Accent.primarySolid, Accent.primarySolidDark, Accent.primarySoft, Accent.primarySoftDark, Accent.primaryForeground, Accent.brandBlue, Accent.brandBlueLight (the PRIMARY family only) and replace with the hook value:',
    '  1. Component body / render-scope read → const accent = useAccent() (import { useAccent } from "@/context/theme"); use accent.primary etc. If the component already calls useAccent(), reuse it.',
    '  2. EXISTING manual scheme switches like (isDark ? Accent.primarySolidDark : Accent.primarySolid) or (colors.background === "#FFFFFF" ? ... : ...) → collapse to accent.primarySolid (the hook does the switch now). Same for primarySoft/primarySoftDark pairs.',
    '  3. Module-scope StyleSheet.create entries using Accent.primary* → MOVE that property out of the static sheet into an inline/render-scope style fed by the hook (keep the rest of the sheet static). NEVER call hooks at module scope.',
    '  4. Non-component module code (constants, helpers outside React) → leave static but add to keptStatic with why. Navigation themes / non-React contexts likewise.',
    '  5. Accent.primaryForeground (white-on-fill) is the same on both schemes — migrating it is optional; if the component already has the hook, use it for consistency.',
    '',
    'DO NOT touch: Accent.success/warning/destructive/activity/info (status family), MacroColors, AccentWinGradient, navPrimary, colors.* — only the primary/brand aubergine family.',
    'DO NOT change visual values on LIGHT — the hook returns the identical light family, so a correct migration is pixel-identical on light.',
    'DO NOT edit apps/mobile/constants/theme.ts or context/theme.tsx (already done).',
    'TESTS: if a unit test pins a migrated component reading the static value, update the test to mock/read via the hook or accept both schemes — never weaken intent. Run only tests related to your files.',
    'At the end run npx tsc --noEmit (from apps/mobile) ONCE; fix any errors you introduced.',
    '',
    'Return: migrated (files actually changed), keptStatic (file+why), tscClean.',
  ].join('\n'),
  { label:'accent:'+i, phase:'Migrate', model:'sonnet', agentType:'executor', schema:SCHEMA }).then(v=> v?{...v,cluster:i}:{cluster:i,error:true})
))

const clean=results.filter(r=>r&&!r.error)
log('Migrated '+clean.reduce((n,r)=>n+(r.migrated||[]).length,0)+' files; kept-static '+clean.reduce((n,r)=>n+(r.keptStatic||[]).length,0)+'; failed clusters: '+results.filter(r=>!r||r.error).length)
return { perCluster: clean, failed: results.filter(r=>!r||r.error).map(r=>r&&r.cluster) }
