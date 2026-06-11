import { Stack, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, Type } from "@/constants/theme";
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
      {/* e2e walk 2026-06-10: hide the stock stack header — it rendered a
          system-font "Not found" title + a floating chevron-in-circle,
          both off the Sloe language. The screen carries its own recovery
          CTA, so no header chrome is needed. */}
      <Stack.Screen options={{ headerShown: false }} />
      {/* headers census 2026-06-10: stale stack-header residue was already
          gone (this is now a centred 404 error state with its own CTA, not a
          push screen — PushScreenHeader's back-chevron would be wrong UX).
          Only the two hand-rolled literals converge to tokens. */}
      <Text style={{ ...Type.label, color: colors.textTertiary }}>404</Text>
      <Text style={{ ...Type.screenTitle, color: colors.text, textAlign: "center" }}>
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
        <Text style={{ color: colors.primaryForeground, fontSize: 15, fontWeight: "700" }}>
          Back to Today
        </Text>
      </Pressable>
    </View>
  );
}
