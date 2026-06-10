# Value censuses — fresh-eyes review 2026-06-10
Canonical scales: Spacing {4,8,16,20,24,32,40} · Radius {4,6,8,12,9999} · tokens-only colour

## Mobile: off-scale spacing literals (padding/margin/gap/top/bottom/left/right)
   1 apps/mobile/components/ui/collapsible.tsx:42:marginTop: 6
   1 apps/mobile/components/ui/collapsible.tsx:39:gap: 6
   1 apps/mobile/components/ui/TrustChip.tsx:120:paddingVertical: 3
   1 apps/mobile/components/ui/SubTabPill.tsx:80:gap: 6
   1 apps/mobile/components/ui/SubTabPill.tsx:101:paddingHorizontal: 5
   1 apps/mobile/components/ui/SkeletonRow.tsx:194:gap: 6
   1 apps/mobile/components/ui/ConfidenceChip.tsx:60:paddingVertical: 3
   1 apps/mobile/components/today/WhereThisComesFromSheet.tsx:195:paddingVertical: 14
   1 apps/mobile/components/today/WhereThisComesFromSheet.tsx:106:paddingTop: 12
   1 apps/mobile/components/today/WeeklyInsightCard.tsx:381:gap: 6
   1 apps/mobile/components/today/WeeklyInsightCard.tsx:375:gap: 6
   1 apps/mobile/components/today/WeeklyCheckinModal.tsx:313:marginBottom: 10
   1 apps/mobile/components/today/WeeklyCheckinModal.tsx:216:marginBottom: 6
   1 apps/mobile/components/today/WeeklyCheckinModal.tsx:126:marginBottom: 6
   1 apps/mobile/components/today/WeeklyCheckinModal.tsx:113:marginBottom: 12
   1 apps/mobile/components/today/WeeklyCheckinBanner.tsx:118:paddingVertical: 6
   1 apps/mobile/components/today/WeeklyCheckinBanner.tsx:117:paddingHorizontal: 12
   1 apps/mobile/components/today/TodayWeekView.tsx:618:paddingHorizontal: 12
   1 apps/mobile/components/today/TodayStreakInsightCard.tsx:88:paddingVertical: 6
   1 apps/mobile/components/today/TodayStreakInsightCard.tsx:87:paddingHorizontal: 10
   1 apps/mobile/components/today/TodayStreakInsightCard.tsx:38:gap: 12
   1 apps/mobile/components/today/TodayStreakInsightCard.tsx:104:paddingHorizontal: 6
   1 apps/mobile/components/today/TodaySnapShortcut.tsx:146:paddingHorizontal: 6
   1 apps/mobile/components/today/TodaySnapShortcut.tsx:137:gap: 6
   1 apps/mobile/components/today/TodayQuickLogStrip.tsx:122:gap: 3
   1 apps/mobile/components/today/TodayPlannedMealsCard.tsx:126:paddingVertical: 12
   1 apps/mobile/components/today/TodayNutrientsModal.tsx:74:paddingHorizontal: 12
   1 apps/mobile/components/today/TodayNutrientsModal.tsx:73:paddingVertical: 10
   1 apps/mobile/components/today/TodayNutrientsModal.tsx:45:paddingTop: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:985:paddingHorizontal: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:966:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:887:gap: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:867:gap: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:866:paddingHorizontal: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:865:padding: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:852:marginBottom: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:793:paddingHorizontal: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:792:paddingVertical: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:791:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:767:paddingHorizontal: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:766:paddingVertical: 9
   1 apps/mobile/components/today/TodayMealsSection.tsx:731:paddingBottom: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:729:paddingHorizontal: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:720:paddingHorizontal: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:698:paddingHorizontal: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:239:marginTop: 3
   1 apps/mobile/components/today/TodayMealsSection.tsx:239:gap: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:1571:paddingVertical: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:1550:paddingVertical: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:1441:paddingHorizontal: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:1440:paddingBottom: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:1439:paddingTop: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:1438:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1404:paddingHorizontal: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:1403:paddingVertical: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:1402:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1379:paddingHorizontal: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:1378:paddingVertical: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:1377:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1348:paddingVertical: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1347:paddingHorizontal: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:1332:paddingVertical: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1331:paddingHorizontal: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:1322:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1306:padding: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:1305:marginVertical: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1304:marginHorizontal: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:1272:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1233:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1206:gap: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:1194:paddingVertical: 9
   1 apps/mobile/components/today/TodayMealsSection.tsx:1106:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1077:paddingVertical: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1076:paddingHorizontal: 12
   1 apps/mobile/components/today/TodayMealsSection.tsx:1075:gap: 6
   1 apps/mobile/components/today/TodayMealsSection.tsx:1065:paddingTop: 12
   1 apps/mobile/components/today/TodayMealsFigmaLayout.tsx:96:gap: 12
   1 apps/mobile/components/today/TodayMealsFigmaLayout.tsx:127:padding: 12
   1 apps/mobile/components/today/TodayHeroRing.tsx:217:paddingHorizontal: 12
   1 apps/mobile/components/today/TodayHeroRing.tsx:177:paddingHorizontal: 10

### total off-scale spacing instances:
875

## Mobile: off-scale borderRadius literals (not 4/6/8/12/9999)
   1 apps/mobile/components/ui/WinMomentPlayer.tsx:145:borderRadius: 2
   1 apps/mobile/components/ui/SupprCard.tsx:27:borderRadius: 24
   1 apps/mobile/components/ui/SubTabPill.tsx:102:borderRadius: 9
   1 apps/mobile/components/today/WhereThisComesFromSheet.tsx:107:borderRadius: 3
   1 apps/mobile/components/today/WeeklyCheckinModal.tsx:109:borderRadius: 24
   1 apps/mobile/components/today/TodayWeekView.tsx:487:borderRadius: 3
   1 apps/mobile/components/today/TodayStreakInsightCard.tsx:50:borderRadius: 10
   1 apps/mobile/components/today/TodaySnapShortcut.tsx:97:borderRadius: 22
   1 apps/mobile/components/today/TodayNutrientsModal.tsx:75:borderRadius: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:987:borderRadius: 999
   1 apps/mobile/components/today/TodayMealsSection.tsx:908:borderRadius: 10
   1 apps/mobile/components/today/TodayMealsSection.tsx:512:borderRadius: 11
   1 apps/mobile/components/today/TodayMealsSection.tsx:502:borderRadius: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:493:borderRadius: 14
   1 apps/mobile/components/today/TodayMealsSection.tsx:1229:borderRadius: 3
   1 apps/mobile/components/today/TodayMealsSection.tsx:1078:borderRadius: 999
   1 apps/mobile/components/today/TodayHero.tsx:163:borderRadius: 999
   1 apps/mobile/components/today/TodayEditMealModal.tsx:500:borderRadius: 2
   1 apps/mobile/components/today/TodayEditMealModal.tsx:393:borderRadius: 14
   1 apps/mobile/components/today/TodayEditMealModal.tsx:380:borderRadius: 2
   1 apps/mobile/components/today/TodayDashboardMacroBars.tsx:232:borderRadius: 3
   1 apps/mobile/components/today/TodayDashboardMacroBars.tsx:222:borderRadius: 3
   1 apps/mobile/components/today/TodayCompleteDayModal.tsx:88:borderRadius: 40
   1 apps/mobile/components/today/TodayActivityCard.tsx:95:borderRadius: 3
   1 apps/mobile/components/today/TodayActivityCard.tsx:100:borderRadius: 3
   1 apps/mobile/components/today/TodayActivityBonusCard.tsx:434:borderRadius: 10
   1 apps/mobile/components/today/SavedMealPortionSheet.tsx:291:borderRadius: 14
   1 apps/mobile/components/today/SavedMealPortionSheet.tsx:282:borderRadius: 2
   1 apps/mobile/components/today/PostOnboardingPushExplainer.tsx:172:borderRadius: 32
   1 apps/mobile/components/today/PortionPickerSheet.tsx:69:borderRadius: 2
   1 apps/mobile/components/today/NorthStarBlock.tsx:764:borderRadius: 2
   1 apps/mobile/components/today/NorthStarBlock.tsx:742:borderRadius: 999
   1 apps/mobile/components/today/NorthStarBlock.tsx:726:borderRadius: 999
   1 apps/mobile/components/today/NorthStarBlock.tsx:679:borderRadius: 999
   1 apps/mobile/components/today/Milestone30DayModal.tsx:114:borderRadius: 32
   1 apps/mobile/components/today/LogSheet.tsx:941:borderRadius: 3
   1 apps/mobile/components/today/LogSheet.tsx:1746:borderRadius: 32
   1 apps/mobile/components/today/LogSheet.tsx:1684:borderRadius: 5
   1 apps/mobile/components/today/LogSheet.tsx:1581:borderRadius: 14
   1 apps/mobile/components/today/LogSheet.tsx:1565:borderRadius: 2

## Mobile: literal hex colours outside theme.ts
apps/mobile/app/nutrition-sources.tsx
apps/mobile/app/targets.tsx
apps/mobile/app/login.tsx
apps/mobile/app/whats-new.tsx
apps/mobile/app/household-settings.tsx
apps/mobile/app/profile.tsx
apps/mobile/app/recipe/verify.tsx
apps/mobile/app/create-recipe.tsx
apps/mobile/app/fasting.tsx
apps/mobile/app/(tabs)/discover.tsx
apps/mobile/app/recipe/[id].tsx
apps/mobile/app/(tabs)/progress.tsx
apps/mobile/app/(tabs)/notifications.tsx
apps/mobile/app/dev/health-import-labels.tsx
apps/mobile/app/dev/calorie-ring-states.tsx
apps/mobile/components/NutritionSourceBadge.tsx
apps/mobile/app/(tabs)/planner.tsx
apps/mobile/components/PlanTemplatesSheet.tsx
apps/mobile/app/health-sync.tsx
apps/mobile/components/themed-text.tsx
apps/mobile/components/QuickAddPanel.tsx
apps/mobile/components/SponsoredDisclosure.tsx
apps/mobile/components/GradientAvatar.tsx
apps/mobile/components/OptionCard.tsx
apps/mobile/components/Badge.tsx
apps/mobile/app/import-shared.tsx
apps/mobile/components/DigestBlended.tsx
apps/mobile/components/IngredientImageTile.tsx
apps/mobile/components/AppLaunchScreen.tsx
apps/mobile/components/ui/TrustChip.tsx
apps/mobile/components/ui/RootErrorBoundary.tsx
apps/mobile/components/tabs/LogTabBarButton.tsx
apps/mobile/components/ui/SearchResultConfidenceChip.tsx
apps/mobile/components/discover/DiscoverHeroCard.tsx
apps/mobile/app/(tabs)/index.tsx
apps/mobile/components/settings/SettingsBundleContent.tsx
apps/mobile/app/(tabs)/library.tsx
apps/mobile/components/progress/TrajectoryCard.tsx
apps/mobile/components/settings/DevFlagOverrides.tsx
apps/mobile/components/today/TodayHeroRing.tsx

### total hex-literal instances (mobile, outside theme):
     188
