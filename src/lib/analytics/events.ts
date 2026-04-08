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
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
