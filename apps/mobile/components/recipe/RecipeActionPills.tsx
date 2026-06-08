/**
 * Recipe detail — action-pill row (Figma `332:2`, section 3). Web parity:
 * the action-pill row in `src/app/components/RecipeDetail.tsx`.
 *
 * Horizontal pills, 46px tall, rounded-full:
 *   - Start Cooking — clay fill, white text/icon → opens Cook Mode
 *   - Log — cream pill, plum ink → opens the log flow
 *   - Edit — cream pill → edit recipe (owner-only; hidden otherwise)
 *
 * The "Ask" pill from the frame is intentionally OMITTED: there is no
 * AI-coach / assistant handler in the app (Ask is net-new, Figma frame
 * `185:2`). Building a placeholder screen would violate the no-fakes rule.
 * See report + `docs/ux/redesign/figma-migration-tracker.md`.
 */
import { ActivityIndicator, Text, View } from "react-native";
import { Pencil, PlusCircle, UtensilsCrossed } from "lucide-react-native";

import { FontFamily, Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";

type RecipeActionPillsProps = {
  onStartCooking: () => void;
  onLog: () => void;
  logging: boolean;
  /** When set, render the Edit pill (owner-only). */
  onEdit?: () => void;
  haptic?: "confirm" | "none";
};

export function RecipeActionPills({
  onStartCooking,
  onLog,
  logging,
  onEdit,
  haptic = "none",
}: RecipeActionPillsProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the primary
  // "Start Cooking" CTA fill. Cream Log/Edit pills keep theme surfaces.
  const accent = useAccent();

  const creamPill = {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  };
  const pillLabel = {
    fontFamily: FontFamily.sansSemibold,
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.text,
  };

  return (
    <View
      style={{ flexDirection: "row", gap: 12 }}
      testID="recipe-action-pills"
    >
      <PressableScale
        haptic={haptic}
        onPress={onStartCooking}
        accessibilityRole="button"
        accessibilityLabel="Start cooking"
        testID="recipe-action-start-cooking"
        style={{
          flex: 1.6,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 46,
          borderRadius: Radius.full,
          backgroundColor: accent.primary,
        }}
      >
        <UtensilsCrossed size={18} color={colors.primaryForeground} />
        <Text
          style={{
            fontFamily: FontFamily.sansSemibold,
            fontSize: 14,
            fontWeight: "700",
            color: colors.primaryForeground,
          }}
          numberOfLines={1}
        >
          Start Cooking
        </Text>
      </PressableScale>

      <PressableScale
        haptic={haptic}
        onPress={onLog}
        disabled={logging}
        accessibilityRole="button"
        accessibilityLabel="Log this recipe"
        testID="recipe-action-log"
        style={[creamPill, { opacity: logging ? 0.6 : 1 }]}
      >
        {logging ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <PlusCircle size={18} color={colors.text} />
            <Text style={pillLabel} numberOfLines={1}>
              Log
            </Text>
          </>
        )}
      </PressableScale>

      {onEdit ? (
        <PressableScale
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Edit recipe"
          testID="recipe-action-edit"
          style={creamPill}
        >
          <Pencil size={16} color={colors.text} />
          <Text style={pillLabel} numberOfLines={1}>
            Edit
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
