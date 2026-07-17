import { Text, View, StyleSheet } from "react-native";
import { Spacing, Radius, Type } from "@/constants/theme";
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
          backgroundColor: accent.primarySoft,
          borderColor: accent.primarySoftStrong,
        },
      ]}
      accessibilityLiveRegion="polite"
      testID="cook-handsfree-banner"
    >
      <Text style={[Type.captionStrong, { color: colors.text }]}>
        Screen stays awake while you cook.
      </Text>
      <Text style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
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
});
