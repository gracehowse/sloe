import { ScrollView, Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { SmartImage } from "@/components/ui/SmartImage";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { FontFamily, Spacing } from "@/constants/theme";
import {
  CREATOR_CHIP_INK,
  creatorInitialOf,
  creatorTintFor,
} from "@suppr/shared/discover/creatorChipPresentation";
import type { CreatorChip } from "@suppr/shared/discover/topCreators";

/**
 * CreatorRail — the Discover "top creators by saves" rail (ENG-1225 #14), the
 * mobile parity of `src/app/components/suppr/discover-creator-rail.tsx` and the
 * v3 prototype `.creator-rail` (`Sloe-App.html` L999-1007): a horizontal scroll
 * of circular creator chips (serif initial on a plum-family tint, or the avatar
 * photo) with the name below.
 *
 * Self-hides when there are no creators — the `creators` table is empty
 * pre-launch, so the rail shows nothing rather than fabricated chips, and lights
 * up automatically once creators exist. Tint + initial come from the shared
 * `creatorChipPresentation` helpers so a creator looks identical web↔mobile.
 */
const CHIP = 66;

export interface CreatorRailProps {
  creators: CreatorChip[];
  onSelect?: (creator: CreatorChip) => void;
}

export function CreatorRail({ creators, onSelect }: CreatorRailProps) {
  const colors = useThemeColors();
  if (creators.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: Spacing.dense, paddingRight: Spacing.xl }}
      style={{ marginBottom: Spacing.md }}
      accessibilityLabel="Creators to explore"
    >
      {creators.map((c) => (
        <PressableScale
          key={c.id}
          haptic="selection"
          onPress={() => onSelect?.(c)}
          accessibilityRole="button"
          accessibilityLabel={c.displayName}
          style={{ width: 74, alignItems: "center", gap: Spacing.sm }}
        >
          <View
            style={{
              width: CHIP,
              height: CHIP,
              borderRadius: CHIP / 2,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.avatarUrl ? colors.card : creatorTintFor(c.id),
            }}
          >
            {c.avatarUrl ? (
              <SmartImage
                source={{ uri: c.avatarUrl }}
                style={{ width: CHIP, height: CHIP }}
                recyclingKey={c.id}
              />
            ) : (
              <Text
                style={{
                  fontFamily: FontFamily.serifRegular,
                  fontSize: 24,
                  color: CREATOR_CHIP_INK,
                }}
              >
                {creatorInitialOf(c.displayName)}
              </Text>
            )}
          </View>
          <Text
            numberOfLines={2}
            style={{
              fontSize: 13,
              fontWeight: "500",
              lineHeight: 16,
              textAlign: "center",
              color: colors.text,
            }}
          >
            {c.displayName}
          </Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

export default CreatorRail;
