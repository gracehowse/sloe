/**
 * ENG-943 — "Add to shopping list" action for the mobile recipe detail
 * (`recipe/[id].tsx`). The host is screen-budget-pinned, so ALL of the logic
 * (household scope resolution, parse + aggregate, persist the delta, feedback,
 * analytics) lives here and the host just renders the component.
 *
 * Flag-gated by `recipe_shopping_list_v1` (default-ON, REDESIGN_DEFAULT_ON) at
 * the call site — the host renders this only when the flag is on, leaving the
 * legacy plan-only list as the kill-switch path.
 *
 * Calm "building your list" framing (no health claims; lists are ingredients).
 * Tertiary affordance (ghost) — the screen's one filled CTA is Log in the
 * sticky bar; this sits below the ingredient grid as a quiet outline pill.
 *
 * Web mirror: `src/app/components/recipe/AddToShoppingListAction.tsx`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { ShoppingCart } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { getMyHousehold } from "@suppr/shared/household/householdClient";
import { shoppingScopeFor } from "@suppr/shared/household/shoppingScope";
import {
  appendRecipeToShoppingListClient,
} from "@suppr/shared/planning/appendRecipeToShoppingListClient";
import {
  buildingYourListMessage,
  type RecipeIngredientLine,
} from "@suppr/shared/planning/appendRecipeToShoppingList";

type AddToShoppingListButtonProps = {
  recipeId: string;
  recipeTitle: string;
  userId: string | null;
  ingredients: readonly RecipeIngredientLine[];
  /** Servings-view multiplier so the list buys the scaled amount on screen. */
  multiplier?: number;
};

export function AddToShoppingListButton({
  recipeId,
  recipeTitle,
  userId,
  ingredients,
  multiplier = 1,
}: AddToShoppingListButtonProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onPress = useCallback(async () => {
    if (busy) return;
    if (!userId) {
      Alert.alert("Sign in to build a list", "Your shopping list saves to your account.");
      return;
    }
    if (ingredients.length === 0) {
      Alert.alert("Nothing to add", "This recipe has no ingredients yet.");
      return;
    }
    setBusy(true);
    try {
      // Resolve household scope so the list is shared correctly (solo vs household).
      let householdId: string | null = null;
      try {
        const { data } = await getMyHousehold(supabase as never, userId);
        householdId = data?.household?.id ?? null;
      } catch {
        householdId = null;
      }
      const scope = shoppingScopeFor({ userId, householdId });

      const res = await appendRecipeToShoppingListClient({
        client: supabase as never,
        scope,
        recipeTitle,
        ingredients,
        multiplier,
      });

      if (!mounted.current) return;

      if (!res.ok) {
        Alert.alert("Couldn't update your list", "Please try again in a moment.");
        return;
      }

      track("recipe_shopping_list_added", {
        recipeId,
        ingredientCount: res.ingredientCount,
        addedCount: res.addedCount,
        mergedCount: res.mergedCount,
        platform: "mobile",
      });

      Alert.alert("Shopping list", buildingYourListMessage(res));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, userId, ingredients, recipeTitle, multiplier, recipeId]);

  const styles = stylesFor(colors.border, accent.primarySolid);

  return (
    <PressableScale
      haptic="confirm"
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Add ingredients to shopping list"
      accessibilityState={{ disabled: busy, busy }}
      testID="recipe-add-to-shopping-list"
      style={[styles.row, busy && styles.rowBusy]}
    >
      <View style={styles.inner}>
        {busy ? (
          <ActivityIndicator size="small" color={accent.primarySolid} />
        ) : (
          <ShoppingCart size={18} color={accent.primarySolid} strokeWidth={1.75} />
        )}
        <Text style={[styles.label, { color: accent.primarySolid }]} numberOfLines={1}>
          {busy ? "Building your list…" : "Add to shopping list"}
        </Text>
      </View>
    </PressableScale>
  );
}

function stylesFor(borderColor: string, accentColor: string) {
  return StyleSheet.create({
    row: {
      borderRadius: Radius.full,
      borderWidth: 1.5,
      borderColor: accentColor,
      paddingVertical: Spacing.dense,
      paddingHorizontal: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBusy: { opacity: 0.6, borderColor },
    inner: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    label: {
      ...Type.button,
    },
  });
}
