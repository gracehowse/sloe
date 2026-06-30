import { Text } from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";

/**
 * ENG-954 — calm, de-shaming plateau insight (mobile). When the recent stretch
 * is flat but the longer trend is still toward goal, reframe the stall as
 * normal physiology instead of leaving the terse trend verdict to read as "no
 * progress". Body-neutral, no health-claim. Renders nothing when the flag is
 * off (the screen passes `enabled`, resolved from
 * `progress_plateau_insight_v1`) or when there is no plateau read (`line` null).
 *
 * Extracted from `(tabs)/progress.tsx` to keep that screen under its line
 * budget (ENG-952/954 touch). Parity: web `WeightPlateauInsight` renders the
 * identical line behind the same flag.
 */
export function WeightPlateauInsight({
  enabled,
  line,
  dimColor,
  elevatedColor,
}: {
  enabled: boolean;
  line: string | null | undefined;
  dimColor: string;
  elevatedColor: string;
}) {
  if (!enabled || !line) return null;
  return (
    <Text
      testID="progress-plateau-insight"
      style={{
        ...Type.caption,
        color: dimColor,
        marginTop: Spacing.sm,
        backgroundColor: elevatedColor,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.dense,
        paddingVertical: Spacing.sm,
        lineHeight: 16,
      }}
    >
      {line}
    </Text>
  );
}
