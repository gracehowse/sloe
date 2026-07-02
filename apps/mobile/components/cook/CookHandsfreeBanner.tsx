import { Text, View, StyleSheet } from "react-native";
import { Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";

export interface CookHandsfreeBannerProps {
  visible: boolean;
}

/** Voice handsfree transparency banner (Paprika parity, 2026-05-01). */
export function CookHandsfreeBanner({ visible }: CookHandsfreeBannerProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  if (!visible) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: accent.primary + "10",
          borderColor: accent.primary + "30",
        },
      ]}
      accessibilityLiveRegion="polite"
      testID="cook-handsfree-banner"
    >
      <Text style={[styles.title, { color: colors.text }]}>
        Screen stays awake while you cook.
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Voice control (say &quot;next&quot;, &quot;back&quot;, &quot;repeat&quot;) is coming soon. We don&apos;t record audio yet.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  title: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  sub: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});
