import { memo } from "react";
import * as React from "react";
import { Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Trash2 } from "lucide-react-native";
import { Accent, Type } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { useThemeColors } from "@/hooks/use-theme-colors";

/** Swipe-left delete affordance for Today meal rows and Figma summary cards. */
function MealRowSwipeableImpl({
  mealId,
  onDeleteMeal,
  children,
}: {
  mealId: string;
  onDeleteMeal: (mealId: string) => void;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <Swipeable
      overshootRight={false}
      friction={2}
      renderRightActions={() => (
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          <PressableScale
            haptic="destructive"
            onPress={() => onDeleteMeal(mealId)}
            style={{
              width: 88,
              backgroundColor: Accent.destructive,
              justifyContent: "center",
              alignItems: "center",
            }}
            accessibilityRole="button"
            accessibilityLabel="Remove meal"
          >
            <Trash2 size={22} color={colors.destructiveForeground} />
            <Text style={{ ...Type.caption, color: colors.destructiveForeground, marginTop: 4 }}>
              Remove
            </Text>
          </PressableScale>
        </View>
      )}
    >
      {children}
    </Swipeable>
  );
}

export const MealRowSwipeable = memo(MealRowSwipeableImpl);
