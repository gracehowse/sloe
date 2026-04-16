import type { WeekSummaryMode } from "../lib/nutrition/weekSummaryWindow";

export type NotificationPrefs = {
  showMealTimestamps: boolean;
  newRecipes: boolean;
  mealReminders: boolean;
  weeklyReport: boolean;
  creatorUpdates: boolean;
  /** Tracker burn/deficit strip: last 7 days vs calendar week containing selected day. */
  weekSummaryMode: WeekSummaryMode;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  showMealTimestamps: false,
  newRecipes: true,
  mealReminders: false,
  weeklyReport: true,
  creatorUpdates: true,
  weekSummaryMode: "rolling",
};

export type AppNotificationKind =
  | "welcome"
  | "followed_recipe_published"
  | "recipe_published"
  | "recipe_unpublished"
  | "meal_plan_ready"
  | "recipe_saved";

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  createdAt: string;
  readAt: string | null;
  title: string;
  body?: string;
  recipeId?: string;
};

