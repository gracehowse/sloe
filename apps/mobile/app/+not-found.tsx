import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Accent, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * ERR-04 fix (audit 2026-04-28): the previous `<Redirect href="/" />`
 * silently dumped the user back at Today with zero explanation when a
 * stale share link or deleted recipe URL was tapped. Now we surface a
 * proper "We couldn't find that" screen with a recovery CTA so the
 * user knows what happened.
 */

export default function NotFound() {
  const accent = useAccent();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + Spacing.xxl,
        paddingHorizontal: Spacing.xl,
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.lg,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1,
          color: colors.textTertiary,
          textTransform: "uppercase",
        }}
      >
        404
      </Text>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: colors.text,
          textAlign: "center",
        }}
      >
        We couldn&apos;t find that
      </Text>
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: colors.textSecondary,
          textAlign: "center",
          maxWidth: 320,
        }}
      >
        The link may be stale or the recipe may have been deleted.
      </Text>
      <Pressable
        onPress={() => router.replace("/(tabs)")}
        accessibilityRole="button"
        accessibilityLabel="Back to Today"
        style={({ pressed }) => ({
          backgroundColor: accent.primary,
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
          borderRadius: 12,
          opacity: pressed ? 0.85 : 1,
          marginTop: Spacing.md,
        })}
      >
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
          Back to Today
        </Text>
      </Pressable>
    </View>
  );
}
