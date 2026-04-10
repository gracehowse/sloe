/** Stable event names for PostHog / product analytics. */
export const AnalyticsEvents = {
  checkout_started: "checkout_started",
  checkout_completed_return: "checkout_completed_return",
  recipe_saved: "recipe_saved",
  food_logged: "food_logged",
  barcode_lookup: "barcode_lookup",
  recipe_import_url: "recipe_import_url",
  recipe_import_image: "recipe_import_image",
  meal_plan_generated: "meal_plan_generated",
  shopping_list_generated: "shopping_list_generated",
  smart_suggestion_saved: "smart_suggestion_saved",
  profile_targets_saved: "profile_targets_saved",
  cook_mode_started: "cook_mode_started",
  cook_mode_completed: "cook_mode_completed",
  cook_mode_meal_logged: "cook_mode_meal_logged",
  first_run_step_completed: "first_run_step_completed",
  empty_state_cta_clicked: "empty_state_cta_clicked",
  pricing_page_viewed: "pricing_page_viewed",
  recipe_page_viewed: "recipe_page_viewed",
  onboarding_completed: "onboarding_completed",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
