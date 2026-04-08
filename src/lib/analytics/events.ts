/** Stable event names for PostHog / product analytics. */
export const AnalyticsEvents = {
  checkout_started: "checkout_started",
  checkout_completed_return: "checkout_completed_return",
  recipe_saved: "recipe_saved",
  food_logged: "food_logged",
  barcode_lookup: "barcode_lookup",
  recipe_import_url: "recipe_import_url",
  recipe_import_image: "recipe_import_image",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
