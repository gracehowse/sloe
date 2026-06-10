/**
 * Recipe detail — action-pill row (Figma `332:2`, section 3). Web parity:
 * the action-pill row in `src/app/components/RecipeDetail.tsx`.
 *
 * Horizontal pills, 46px tall, rounded-full:
 *   - Start Cooking — aubergine OUTLINE (transparent bg, 1.5px aubergine
 *     border + aubergine label/icon) → opens Cook Mode. The everyday primary
 *     is an outline, not a filled slab (Sloe treatment system, 2026-06-08 —
 *     `docs/prototypes/sloe-component-treatments.html` §1); fill is reserved
 *     for the FAB + conversion-critical CTAs.
 *   - Log — cream pill, ink label → opens the log flow (off-white secondary)
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
  // Aubergine accent for the primary "Start Cooking" CTA — rendered as an
  // OUTLINE (1.5px `primarySolid` border + `primarySolid` label/icon on a
  // transparent ground), per the Sloe treatment system. Cream Log/Edit pills
  // keep theme surfaces. On dark, `primarySolidDark` carries the lifted
  // aubergine so the outline + label stay legible on the dark card.
  const accent = useAccent();
  const outlineColor =
    colors.background === "#FFFFFF" ? accent.primarySolid : accent.primarySolidDark;

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
          // Aubergine OUTLINE (Sloe treatment §1): transparent ground +
          // 1.5px aubergine border, NOT a filled slab.
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: outlineColor,
        }}
      >
        <UtensilsCrossed size={18} color={outlineColor} />
        <Text
          style={{
            fontFamily: FontFamily.sansSemibold,
            fontSize: 14,
            fontWeight: "700",
            color: outlineColor,
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
