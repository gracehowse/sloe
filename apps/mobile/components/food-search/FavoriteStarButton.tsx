/**
 * FavoriteStarButton — the ONE star treatment shared across every surface
 * that stars a food (teardown #1, ENG-1041, 2026-06-11).
 *
 * Before this, the QuickAddPanel rendered an inline `<StarIcon>` with a
 * literal `#F78A32` hex; surfacing favourites in the search panel would have
 * spawned a near-duplicate. Per the CLAUDE.md "same element, same treatment"
 * rule (and the colour-token rule), the star is extracted here, tokenised onto
 * `Accent.warning` (Sloe amber), and reused everywhere. Filled amber = starred,
 * outline secondary = not starred; disabled + dimmed while a toggle is in
 * flight (no double-submit).
 */
import * as React from "react";
import { Pressable } from "react-native";
import { Star } from "lucide-react-native";

import { Accent } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export function FavoriteStarButton({
  starred,
  pending,
  onToggle,
  size = 22,
  testID,
}: {
  /** Whether this food is currently a favourite (filled star). */
  starred: boolean;
  /** Whether a toggle is in flight (disabled + dimmed — no double-submit). */
  pending?: boolean;
  /** Toggle handler. Caller owns the optimistic add/remove + revert. */
  onToggle: () => void;
  size?: number;
  testID?: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.();
        if (pending) return;
        onToggle();
      }}
      hitSlop={12}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={starred ? "Unstar food" : "Favourite this food"}
      accessibilityState={{ selected: starred, disabled: !!pending }}
      testID={testID}
      style={{ paddingHorizontal: 6, opacity: pending ? 0.5 : 1 }}
    >
      <Star
        size={size}
        color={starred ? Accent.warning : colors.textSecondary}
        fill={starred ? Accent.warning : "transparent"}
        strokeWidth={2.25}
      />
    </Pressable>
  );
}

export default FavoriteStarButton;
