/**
 * CookbookSuccessView — the full-screen success state for cookbook-import.tsx
 * (recipe-import-redesign flag required). Extracted to keep the screen file
 * under the 400-line limit (ENG-621).
 *
 * Design: DS §3.9 / import.md §3.9 — CheckCircle 56px success-green,
 * Fraunces "Saved.", book name, "In your library" chip, View/Plan CTAs.
 * No modal. No Alert.
 */
import { View, Text, Pressable } from "react-native";
import { CheckCircle } from "lucide-react-native";
import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";

type Props = {
  savedCount: number;
  bookName: string;
  onViewLibrary: () => void;
  onBuildPlan: () => void;
};

export function CookbookSuccessView({
  savedCount,
  bookName,
  onViewLibrary,
  onBuildPlan,
}: Props) {
  const colors = useThemeColors();
  const accent = useAccent();
  const label = bookName.trim() || "your cookbook";

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="screen-cookbook-import-success"
    >
      <PushScreenHeader title="Import cookbook" onBack={onViewLibrary} />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: Spacing.xl,
        }}
      >
        {/* DS §3.9 / import.md §3.9: CheckCircle 56px success-green. */}
        <CheckCircle size={56} color={Accent.success} strokeWidth={1.5} />
        {/* DS §2.3: screen H1 in serif. */}
        <Text
          style={{
            ...Type.title,
            color: colors.text,
            marginTop: Spacing.md,
            textAlign: "center",
          }}
        >
          Saved.
        </Text>
        <Text
          style={{
            fontFamily: FontFamily.sansRegular,
            fontSize: 15,
            color: colors.textSecondary,
            marginTop: Spacing.xs,
            textAlign: "center",
          }}
        >
          {savedCount} {savedCount === 1 ? "recipe" : "recipes"} from {label}
        </Text>
        {/* "In your library" chip. */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: Radius.full,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
            marginTop: Spacing.sm,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: FontFamily.sansRegular,
              fontSize: 13,
              color: colors.textSecondary,
            }}
          >
            In your library
          </Text>
        </View>
        {/* Primary CTA: view library. */}
        <Pressable
          style={{
            backgroundColor: accent.primary,
            borderRadius: Radius.xl,
            paddingVertical: Spacing.md,
            alignItems: "center",
            marginTop: Spacing.xl,
            width: "100%",
            minHeight: 48,
            justifyContent: "center",
          }}
          onPress={onViewLibrary}
        >
          <Text
            style={{
              fontFamily: FontFamily.sansSemibold,
              color: accent.primaryForeground,
              fontSize: 15,
            }}
          >
            View library
          </Text>
        </Pressable>
        {/* Secondary CTA: plan. */}
        <Pressable style={{ marginTop: Spacing.md }} onPress={onBuildPlan}>
          <Text
            style={{
              fontFamily: FontFamily.sansRegular,
              fontSize: 14,
              color: accent.primarySolid,
            }}
          >
            Build your week in Plan
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
