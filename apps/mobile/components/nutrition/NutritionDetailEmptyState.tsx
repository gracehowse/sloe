import { Text, View, type ViewStyle } from "react-native";
import { type LucideIcon } from "lucide-react-native";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled } from "@/lib/analytics";
import { PressableScale } from "@/components/ui/PressableScale";

/**
 * NutritionDetailEmptyState — shared empty / error / nothing-here structure
 * for the two sibling nutrition-detail screens (`macro-detail`,
 * `meal-nutrition`). ENG-825 (Redesign — Design Direction 2026, macro /
 * meal-nutrition lane).
 *
 * Before this component the two screens each hand-rolled their own empty /
 * error states: the macro-detail empty state was a centred line of text + a
 * full-saturated-macro-colour Pressable (opacity-only press), floating in a
 * sea of whitespace; the meal-nutrition error / no-slot states were a centred
 * Ionicon + heading + a plain Pressable "Go back". Two different structures,
 * two icon sets, two CTA colours. This unifies all of them into one elevated,
 * iconified card with a single commit-colour CTA.
 *
 * Flag behaviour (visual changes stay gated, OLD path alive in the else):
 *   - `design_system_elevation` ON  → the body wraps in an elevated card
 *     (`useCardElevation`) with the modern `Radius.xl` corner + an icon
 *     chip, so the empty state reads as a designed surface, not a dead end.
 *     OFF → the legacy flat, card-less centred layout (no surface chrome).
 *   - `design_system_colours` ON  → the CTA fills BLUE (`accent.primary`,
 *     the single commit-action colour) via `PressableScale`. OFF → the
 *     caller's legacy `ctaColorLegacy` fill (e.g. the saturated macro hue
 *     on macro-detail) on a `PressableScale` — the scale press is a pure
 *     micro-interaction upgrade with no colour change, so it isn't gated.
 *
 * The CTA is OPTIONAL: error states that only need a "Go back" affordance
 * still get the elevated card + icon, with the CTA wired to `onPress`.
 */
export interface NutritionDetailEmptyStateProps {
  /** Lucide glyph rendered in the icon chip (e.g. Salad / CircleAlert). */
  icon: LucideIcon;
  /** Bold heading line. */
  title: string;
  /** Supporting copy under the heading. */
  subtitle?: string;
  /** CTA label. When omitted, no button renders. */
  ctaLabel?: string;
  /** CTA press handler. Required when `ctaLabel` is set. */
  onPress?: () => void;
  /**
   * Legacy CTA fill colour for the flag-OFF (`design_system_colours`) path —
   * e.g. the saturated macro hue on macro-detail, or `accent.primary` on the
   * meal-nutrition error states (which were already blue). When the flag is
   * ON the CTA always fills BLUE regardless of this value.
   */
  ctaColorLegacy?: string;
  /** Optional leading icon inside the CTA (e.g. Plus for "Log a meal"). */
  ctaIcon?: LucideIcon;
  /** a11y label for the CTA. Defaults to `ctaLabel`. */
  ctaA11yLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function NutritionDetailEmptyState({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  onPress,
  ctaColorLegacy,
  ctaIcon: CtaIcon,
  ctaA11yLabel,
  testID,
  style,
}: NutritionDetailEmptyStateProps) {
  const accent = useAccent();
  const colors = useThemeColors();
  const elevation = useCardElevation();
  const softElevation = isFeatureEnabled("design_system_elevation");
  const redesignColours = isFeatureEnabled("design_system_colours");

  const ctaColor = redesignColours ? accent.primary : (ctaColorLegacy ?? accent.primary);

  const body = (
    <View style={{ alignItems: "center", gap: Spacing.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: Radius.full,
          backgroundColor: colors.inputBg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: Spacing.xs,
        }}
      >
        <Icon size={26} color={colors.textTertiary} strokeWidth={1.75} />
      </View>
      <Text
        style={{
          ...Type.headline,
          color: colors.text,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: colors.textSecondary,
            textAlign: "center",
            maxWidth: 300,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      {ctaLabel && onPress ? (
        <PressableScale
          haptic="selection"
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={ctaA11yLabel ?? ctaLabel}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: Spacing.md,
            paddingHorizontal: Spacing.xl,
            paddingVertical: 11,
            borderRadius: Radius.md,
            backgroundColor: ctaColor,
          }}
        >
          {CtaIcon ? <CtaIcon size={16} color={colors.primaryForeground} strokeWidth={2.25} /> : null}
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primaryForeground }}>
            {ctaLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );

  // Flag ON → elevated card surface with the modern radius. Flag OFF → the
  // legacy flat, card-less centred layout (unchanged structure).
  if (!softElevation) {
    return (
      <View
        testID={testID}
        style={[{ alignItems: "center", paddingVertical: Spacing.xxl }, style]}
      >
        {body}
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        {
          marginTop: Spacing.lg,
          borderRadius: Radius.xl,
          backgroundColor: elevation.liftBg ?? colors.card,
          borderWidth: elevation.useBorder ? 1 : 0,
          borderColor: colors.cardBorder,
          paddingVertical: Spacing.xxl,
          paddingHorizontal: Spacing.lg,
        },
        elevation.shadowStyle,
        style,
      ]}
    >
      {body}
    </View>
  );
}

export default NutritionDetailEmptyState;
