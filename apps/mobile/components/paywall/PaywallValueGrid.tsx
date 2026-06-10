import { StyleSheet, Text, View } from "react-native";
import { Link2, SlidersHorizontal, Sparkles, Cloud, type LucideIcon } from "lucide-react-native";

import { FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  PAYWALL_VALUE_PROPS,
  type PaywallValueProp,
} from "@suppr/shared/landing/paywallValueProps";

/**
 * 2×2 value-prop grid — Sloe Pro paywall (Figma `284:2`).
 *
 * Four condensed Pro benefits in cream rounded cards (icon + title +
 * one-line description). Copy + order come from the shared
 * `PAYWALL_VALUE_PROPS` SSOT so the mobile paywall and web `/pricing`
 * can't drift. Icons render in clay (the frame's outline glyphs).
 *
 * Each row maps 1:1 to an existing gate (recipe import, macro-fitting
 * plan, AI logging, cloud sync) — presentational restyle, not a new
 * claim. See `paywallValueProps.ts`.
 */
const ICONS: Record<PaywallValueProp["icon"], LucideIcon> = {
  Link2,
  SlidersHorizontal,
  Sparkles,
  Cloud,
};

export function PaywallValueGrid() {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the value-prop glyphs.
  const accent = useAccent();
  const styles = makeStyles(colors);
  return (
    <View style={styles.grid} testID="paywall-value-grid">
      {PAYWALL_VALUE_PROPS.map((prop) => {
        const Icon = ICONS[prop.icon];
        return (
          <View
            key={prop.key}
            testID={`paywall-value-${prop.key}`}
            style={styles.card}
            accessibilityRole="summary"
            accessibilityLabel={`${prop.title}. ${prop.description}`}
          >
            <Icon size={20} color={accent.primarySolid} strokeWidth={1.75} />
            <Text style={styles.title}>{prop.title}</Text>
            <Text style={styles.desc}>{prop.description}</Text>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    card: {
      // Two-up: (100% − gap) / 2. flexBasis with a tiny subtraction so
      // the gap doesn't overflow to a third row.
      flexBasis: "47%",
      flexGrow: 1,
      borderRadius: Radius.xl * 2,
      padding: Spacing.lg,
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontFamily: FontFamily.sansSemibold,
      fontSize: 15,
      color: colors.text,
      marginTop: Spacing.md,
    },
    desc: {
      fontFamily: FontFamily.sansRegular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
}
