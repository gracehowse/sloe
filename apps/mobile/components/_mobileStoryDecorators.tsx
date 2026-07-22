import type { Decorator } from "@storybook/react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { Colors } from "@/constants/theme";
import type { RecipeCard } from "@/lib/types";

/** Standard 360px mobile frame used across Mobile/* Storybook stories. */
export const mobileStoryFrame: Decorator = (Story) => (
  <MobileStoryThemeProvider>
    <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
      <Story />
    </div>
  </MobileStoryThemeProvider>
);

export const mobileStoryFullscreen: Decorator = (Story) => (
  <MobileStoryThemeProvider>
    <div style={{ width: 360, minHeight: 640, background: "#F7F6FA" }}>
      <Story />
    </div>
  </MobileStoryThemeProvider>
);

export const mobileStorySafeArea: Decorator = (Story) => (
  <MobileStoryThemeProvider>
    <SafeAreaProvider>
      <div style={{ width: 360, background: "#F7F6FA" }}>
        <Story />
      </div>
    </SafeAreaProvider>
  </MobileStoryThemeProvider>
);

/** Theme colors passed into sheet-style presentational components. */
export const MOCK_SHEET_COLORS = {
  text: Colors.light.text,
  textSecondary: Colors.light.textSecondary,
  textTertiary: Colors.light.textTertiary,
  card: Colors.light.card,
  cardBorder: Colors.light.border,
  background: Colors.light.background,
  inputBg: Colors.light.backgroundSecondary,
  border: Colors.light.border,
  navPrimary: Colors.light.navPrimary,
  primaryForeground: Colors.light.text,
};

export const MOCK_RECIPE: RecipeCard = {
  id: "story-recipe-1",
  title: "Miso ginger salmon with sesame greens",
  image: null,
  creatorName: "Sloe Kitchen",
  creatorImage: "",
  servings: 2,
  calories: 520,
  protein: 42,
  carbs: 18,
  fat: 28,
  isVerified: true,
  savedCount: 128,
  isSaved: true,
  prepTimeMin: 10,
  cookTimeMin: 20,
};

export const DIGEST_SUCCESS_ARGS = {
  weekKey: "2026-W29",
  weekLabel: "14–20 Jul",
  daysLogged: 6,
  mealsLogged: 18,
  headline: "A steady, consistent week.",
  stats: {
    streakDays: 12,
    streakFreezesAvailable: 1,
    avgCalories: 2040,
    avgProtein: 128,
    proteinAdherencePct: 86,
    weightDeltaKg: -0.4,
    weightFirstKg: 72.1,
    weightLastKg: 71.7,
  },
  narrative: {
    closestToTarget: { label: "Wednesday", protein: 135, calories: 2080 },
    maintenanceLine: "Adaptive maintenance sits ~50 kcal under the formula.",
    usualMeal: {
      kind: "celebration" as const,
      name: "Oats + berries",
      count: 4,
    },
  },
  shareText: "My week on Sloe — 6 days logged, 12-day streak.",
  onShare: () => undefined,
  onDismiss: () => undefined,
  onRetry: () => undefined,
};

export const DIGEST_BLENDED_EXTRAS = {
  closestDayTargetCalories: 2100,
  patternWindowLabel: "last 4 weeks",
  dayOfWeekPattern: {
    highDay: "Saturday",
    lowDay: "Tuesday",
    deltaKcal: 280,
    highDayAvg: 2280,
    lowDayAvg: 2000,
  },
};
