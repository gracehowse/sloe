/**
 * Suppr design system — shared components.
 *
 * These are the building blocks specific to Suppr's
 * Icon-driven & Structured design language. They sit on
 * top of the shadcn/ui primitives.
 */

export { Badge, type BadgeProps, type BadgeVariant } from "./badge";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { MacroCard, type MacroType } from "./macro-card";
export { DailyRing } from "./daily-ring";
export { RemainingMacrosBar, type RemainingMacrosBarProps } from "./remaining-macros-bar";
export { ConfidenceDot, type ConfidenceLevel } from "./confidence-dot";
export { FitBadge, type FitLevel } from "./fit-badge";
export { SourceBadge, type SourcePlatform } from "./source-badge";
export { QuickAddPanel, type QuickAddPanelProps } from "./quick-add-panel";
export { CopyMealDialog } from "./copy-meal-dialog";
export { DuplicateDayDialog } from "./duplicate-day-dialog";
export { SaveMealDialog, type SaveMealDialogProps } from "./save-meal-dialog";
export {
  RenameSavedMealDialog,
  type RenameSavedMealDialogProps,
} from "./rename-saved-meal-dialog";
export {
  DestructiveConfirmDialog,
  type DestructiveConfirmDialogProps,
} from "./destructive-confirm-dialog";
export {
  TextPromptDialog,
  type TextPromptDialogProps,
} from "./text-prompt-dialog";
export { SavedMealsTab, type SavedMealsTabProps } from "./saved-meals-tab";
export {
  HydrationStimulantsCard,
  type HydrationStimulantsCardProps,
} from "./hydration-stimulants-card";
export {
  AddIngredientDialog,
  type AddIngredientDialogProps,
  type AddIngredientPayload,
} from "./add-ingredient-dialog";
export {
  OverrideIngredientDialog,
  type OverrideIngredientDialogProps,
} from "./override-ingredient-dialog";
export {
  RecipeNotesCard,
  type RecipeNotesCardProps,
} from "./recipe-notes-card";
export {
  CreateCustomFoodDialog,
  type CreateCustomFoodDialogProps,
  type CreateCustomFoodPayload,
} from "./create-custom-food-dialog";
export { PlanTemplatesDialog } from "./plan-templates-dialog";
export { WeeklyRecapCard, type WeeklyRecapCardProps } from "./weekly-recap-card";
export { VoiceLogDialog, type VoiceLogDialogProps } from "./voice-log-dialog";
export { PhotoLogDialog, type PhotoLogDialogProps } from "./photo-log-dialog";
export { AiPaywallDialog, type AiPaywallDialogProps, type AiPaywallFeature } from "./ai-paywall-dialog";

// Today-screen sub-cards (audit H3, 2026-04-18). `NutritionTracker.tsx`
// is the composition root; every new piece of Today behaviour lands in
// one of these files rather than inside the root.
export { TodayHeroRing, type TodayHeroRingProps } from "./today-hero-ring";
export { TodayEatAgainBanner, type TodayEatAgainBannerProps } from "./today-eat-again-banner";
export {
  TodayStreakInsightCard,
  type TodayStreakInsightCardProps,
} from "./today-streak-insight-card";
export { TodayFastingPill, type TodayFastingPillProps } from "./today-fasting-pill";
export { TodayStepsCard, type TodayStepsCardProps } from "./today-steps-card";
export {
  TodayActivityBonusCard,
  type TodayActivityBonusCardProps,
  type TodayWorkout,
} from "./today-activity-bonus-card";
export {
  TodayWeekView,
  type TodayWeekViewProps,
  type TodayWeekDay,
  type TodayWeekTotals,
} from "./today-week-view";
export {
  TodayDashboardMacroTiles,
  type TodayDashboardMacroTilesProps,
} from "./today-dashboard-macro-tiles";
export { TodayQuickLogStrip, type TodayQuickLogStripProps } from "./today-quick-log-strip";
export {
  TodayMealsSection,
  type TodayMealsSectionProps,
  type TodayMealSectionMeal,
  type TodayMealSectionPlanEntry,
} from "./today-meals-section";
export {
  TodayCompleteDayDialog,
  type TodayCompleteDayDialogProps,
} from "./today-complete-day-dialog";
export {
  TodayAddMealDialog,
  type TodayAddMealDialogProps,
  type AddMealMode,
  type UsdaHit,
  type UsdaFoodDetails,
} from "./today-add-meal-dialog";
export {
  TodayBarcodeDialog,
  type TodayBarcodeDialogProps,
  type TodayBarcodeConfirmPayload,
} from "./today-barcode-dialog";
export { TodayDateHeader, type TodayDateHeaderProps } from "./today-date-header";
