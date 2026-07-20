/**
 * Settings Recipes/Streak tile row — only when BOTH stats are non-zero
 * (ENG-1614). A lone stat folds into the profile subline instead.
 */
import { Text, View } from "react-native";
import { Spacing } from "@/constants/theme";
import { TILE_RADIUS } from "@/components/ui/SupprCard";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { SettingsProfileStatsTile } from "@suppr/shared/settings/settingsProfileStats";

export function SettingsProfileStatsTiles({
  tiles,
  semanticStatRoles,
  accentColor,
  streakColor,
}: {
  tiles: SettingsProfileStatsTile[];
  semanticStatRoles: boolean;
  accentColor: string;
  streakColor: string;
}) {
  const colors = useThemeColors();
  const elevation = useCardElevation();

  return (
    <View
      testID="settings-profile-stats-tiles"
      style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm }}
    >
      {tiles.map((tile) => {
        const color = semanticStatRoles
          ? colors.text
          : tile.kind === "recipes"
            ? accentColor
            : streakColor;
        return (
          <View
            key={tile.kind}
            // One-card-treatment (2026-06-09): page-ground soft card chrome;
            // accent lives in the numeral, not the border. Non-interactive
            // (View, not Pressable) — display-only stats.
            style={[
              {
                flex: 1,
                alignItems: "center",
                paddingVertical: Spacing.dense,
                borderRadius: TILE_RADIUS,
                backgroundColor: elevation.liftBg ?? colors.card,
                borderWidth: elevation.useBorder ? 1 : 0,
                borderColor: colors.cardBorder,
              },
              elevation.shadowStyle,
            ]}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color }}>{tile.value}</Text>
            <Text
              style={{
                fontSize: 10,
                color: colors.textTertiary,
                marginTop: Spacing.xs,
              }}
            >
              {tile.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
