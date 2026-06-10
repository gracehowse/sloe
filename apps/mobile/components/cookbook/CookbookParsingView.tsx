/**
 * CookbookParsingView — the full-screen "parsing in progress" state for
 * cookbook-import.tsx. Extracted to keep the screen file under the 400-line
 * limit (ENG-621).
 *
 * Design: DS §3.3 — line-art glyph (ChefHat, no spinner), serif step label,
 * thin terracotta progress track, muted sub-copy.
 */
import { View, Text } from "react-native";
import { ChefHat } from "lucide-react-native";
import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";

type Props = {
  parsingMessage: string;
  onBack: () => void;
};

export function CookbookParsingView({ parsingMessage, onBack }: Props) {
  const colors = useThemeColors();
  const accent = useAccent();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="screen-cookbook-import-parsing">
      <PushScreenHeader title="Import cookbook" onBack={onBack} />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: Spacing.xl,
        }}
      >
        {/* DS §3.3: line-art glyph — no spinner. */}
        <ChefHat size={80} color={colors.text} strokeWidth={1.5} />
        <Text
          style={{
            ...Type.title,
            marginTop: Spacing.md,
            color: colors.navPrimary,
            textAlign: "center",
          }}
        >
          {parsingMessage}
        </Text>
        {/* Thin terracotta progress track (DS §3.3). */}
        <View
          style={{
            width: 240,
            height: 2,
            backgroundColor: colors.card,
            borderRadius: Radius.full,
            marginTop: Spacing.md,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 2,
              width: "60%",
              backgroundColor: accent.primary,
              borderRadius: Radius.full,
            }}
          />
        </View>
        <Text
          style={{
            marginTop: Spacing.sm,
            fontFamily: FontFamily.sansRegular,
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          Ingredients are matched to Sloe foods — exclude any bad rows before saving.
        </Text>
      </View>
    </View>
  );
}
