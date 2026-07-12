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
// FitBadge removed — build 10 F-11 (TestFlight `AA63DQ7xd2gRhdjC3L7gjtE`,
// 2026-04-19). See resolved.md.
export { SourceBadge, type SourcePlatform } from "./source-badge";
export {
  SponsoredDisclosure,
  type SponsoredDisclosureProps,
  type DisclosureKind,
} from "./sponsored-disclosure";
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
export { Digest, type DigestProps, type DigestUsualMeal, type DigestSlot } from "./digest";
export { VoiceLogDialog, type VoiceLogDialogProps } from "./voice-log-dialog";
export { PhotoLogDialog, type PhotoLogDialogProps } from "./photo-log-dialog";
export { AiPaywallDialog, type AiPaywallDialogProps, type AiPaywallFeature } from "./ai-paywall-dialog";
export {
  ActivityLevelPreview,
  type ActivityLevelPreviewProps,
} from "./activity-level-preview";
export {
  ActivityLevelPickerDialog,
  type ActivityLevelPickerDialogProps,
} from "./activity-level-picker-dialog";

// Today-screen sub-cards (audit H3, 2026-04-18). `NutritionTracker.tsx`
// is the composition root; every new piece of Today behaviour lands in
// one of these files rather than inside the root.
export { TodayHeroRing, type TodayHeroRingProps } from "./today-hero-ring";
// TodayEatAgainBanner removed (ENG-984, 2026-06-17) — the Eat-again banner
// was suppressed from Today on 2026-05-22 (v4) and rendered nowhere on web
// or mobile thereafter. The dead component + its barrel export are retired.
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
export { TodayRecentsRow, type TodayRecentsRowProps } from "./today-recents-row";
export {
  TodayMealsSection,
  type TodayMealsSectionProps,
  type TodayMealSectionMeal,
} from "./today-meals-section";
export {
  TodayCompleteDayDialog,
  type TodayCompleteDayDialogProps,
} from "./today-complete-day-dialog";
export {
  TodayAddMealDialog,
  type TodayAddMealDialogProps,
  type AddMealMode,
} from "./today-add-meal-dialog";
export {
  TodayBarcodeDialog,
  type TodayBarcodeDialogProps,
  type TodayBarcodeConfirmPayload,
} from "./today-barcode-dialog";
export { TodayDateHeader, type TodayDateHeaderProps } from "./today-date-header";
// Desktop Today chrome (2026-04-20 Claude Design Today-prototype port).
// Rendered only at `lg:` widths by `TodayDesktopFrame` — mobile-web Today
// keeps its single-column flow and does not consume these. (The rail's
// TodayWeeklyInsightCard was DELETED in ENG-1495 — it duplicated the
// tracker's own THIS WEEK card, `TodayDesktopRightRail`.)
export {
  TodayHouseholdGlanceBar,
  type TodayHouseholdGlanceBarProps,
} from "./today-household-glance-bar";
export {
  TodayAppleHealthCard,
  type TodayAppleHealthCardProps,
} from "./today-apple-health-card";
// D4 (2026-04-21) — Progress-page Apple Health card. Reads from
// `health_snapshots` via the web adapter; separate from the Today-
// right-rail `TodayAppleHealthCard` above which reads `profiles`.
export {
  AppleHealthCard,
  type AppleHealthCardProps,
} from "./apple-health-card";
