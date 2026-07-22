import type { ReactNode } from "react";
import type { IngredientRow, RecipeCard } from "@/types/recipe";
import { AppDataProvider } from "@/context/AppDataContext";
import { AuthSessionProvider } from "@/context/AuthSessionContext";
import { HouseholdProvider } from "@/context/HouseholdContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { RecipeCollectionsProvider } from "@/context/RecipeCollectionsContext";
import { Toaster } from "./ui/sonner";

/** Minimal app provider stack for host-level composition stories. */
export function HostStoryProviders({ children }: { children: ReactNode }) {
  return (
    <AuthSessionProvider>
      <NotificationProvider>
        <HouseholdProvider>
          <RecipeCollectionsProvider>
            <AppDataProvider>
              {children}
              <Toaster richColors position="top-center" />
            </AppDataProvider>
          </RecipeCollectionsProvider>
        </HouseholdProvider>
      </NotificationProvider>
    </AuthSessionProvider>
  );
}

export function HostProductShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 480, maxWidth: "100%", background: "var(--bg)", minHeight: 640 }}>
      {children}
    </div>
  );
}

export function HostDesktopShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 960, maxWidth: "100%", background: "var(--bg)", minHeight: 720 }}>
      {children}
    </div>
  );
}

export const noop = () => undefined;

export function recipeCard(id: string, title: string, overrides: Partial<RecipeCard> = {}): RecipeCard {
  return {
    id,
    title,
    image: null,
    creatorName: "Sloe",
    creatorImage: "",
    servings: 4,
    calories: 520,
    protein: 32,
    carbs: 48,
    fat: 18,
    isVerified: true,
    savedCount: 0,
    isSaved: false,
    prepTimeMin: 10,
    cookTimeMin: 25,
    ...overrides,
  };
}

export const cookModeIngredients: IngredientRow[] = [
  {
    name: "salmon fillet",
    amount: "2",
    unit: "",
    calories: 280,
    protein: 40,
    carbs: 0,
    fat: 12,
    isVerified: true,
    source: "usda",
  },
  {
    name: "miso paste",
    amount: "2",
    unit: "tbsp",
    calories: 70,
    protein: 4,
    carbs: 8,
    fat: 2,
    isVerified: true,
    source: "off",
  },
];

export const cookModeSteps = [
  "Preheat the oven to 200°C.",
  "Whisk miso paste with a splash of water until smooth.",
  "Brush the salmon with the miso glaze and roast for 12 minutes.",
  "Rest for 2 minutes, then serve with greens.",
];
