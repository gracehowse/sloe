import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useRouter } from "expo-router";
import { PressableScale } from "@/components/ui/PressableScale";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

export function CreatorGoPublicPromo() {
  const colors = useThemeColors();
  const accent = useAccent();
  const router = useRouter();

  if (!isFeatureEnabled("creator_profile_v3")) return null;

  return (
    <View
      testID="creator-go-public-promo"
      style={{
        marginTop: Spacing.md,
        flexDirection: "row",
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: Radius.lg,
        backgroundColor: colors.card,
        padding: Spacing.md,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: Radius.md,
          backgroundColor: accent.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={17} color={accent.primarySolid} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...Type.body, fontWeight: "600", color: colors.text }}>
          Share your own recipes
        </Text>
        <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs, lineHeight: 18 }}>
          Make a recipe public and it shows up here for your followers.
        </Text>
        <PressableScale
          haptic="selection"
          onPress={() => router.push("/create-recipe")}
          accessibilityRole="button"
          accessibilityLabel="Go public"
          style={{
            marginTop: Spacing.sm,
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.xs,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            borderRadius: Radius.full,
            paddingHorizontal: Spacing.dense,
            paddingVertical: Spacing.sm,
          }}
        >
          <Sparkles size={15} color={colors.text} />
          <Text style={{ ...Type.caption, fontWeight: "600", color: colors.text }}>Go public</Text>
        </PressableScale>
      </View>
    </View>
  );
}
