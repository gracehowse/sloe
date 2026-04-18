/**
 * Suppr design system — shared components.
 *
 * These are the building blocks specific to Suppr's
 * Icon-driven & Structured design language. They sit on
 * top of the shadcn/ui primitives.
 */

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
