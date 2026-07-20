/**
 * LogSheetBarcodeFreePromise — the loud "Scan a barcode" CTA + the "free
 * forever" reassurance line under the LogSheet input methods. Extracted from
 * `LogSheet.tsx` (ENG-1303) so that flagship sheet stays under its line-count
 * pin while the v3 method-grid wiring lands. Presentation-only; the host owns
 * whether it shows (`showBarcodeFreePromise && barcode?.onOpen`). Mirror of the
 * web `LogSheetBarcodeFreePromise`.
 */

import { Pressable, Text, View } from "react-native";
import { ScanBarcode } from "lucide-react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  BARCODE_FREE_FOREVER_DETAIL,
  BARCODE_FREE_FOREVER_HEADLINE,
  BARCODE_LOUD_CTA_LABEL,
} from "@suppr/nutrition-core/barcodeFreePromise";

export function LogSheetBarcodeFreePromise({ onOpen }: { onOpen: () => void }) {
  const colors = useThemeColors();
  const accent = useAccent();
  return (
    <View style={{ marginHorizontal: Spacing.md, marginTop: Spacing.sm, gap: Spacing.sm }}>
      <Pressable
        testID="log-sheet-loud-barcode-cta"
        accessibilityRole="button"
        accessibilityLabel={BARCODE_LOUD_CTA_LABEL}
        onPress={onOpen}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Spacing.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          borderRadius: Radius.xl,
          borderWidth: 1,
          borderColor: accent.primarySoftStrong,
          backgroundColor: accent.primarySoft,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <ScanBarcode size={18} color={accent.primary} />
        <Text
          style={{
            fontFamily: Type.bodyLarge.fontFamily,
            fontSize: Type.bodyLarge.fontSize,
            lineHeight: Type.bodyLarge.lineHeight,
            fontWeight: "600",
            color: accent.primarySolid,
          }}
        >
          {BARCODE_LOUD_CTA_LABEL}
        </Text>
      </Pressable>
      <Text
        testID="log-sheet-barcode-free-promise"
        style={{
          fontSize: 11,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 16,
        }}
      >
        {BARCODE_FREE_FOREVER_HEADLINE} {BARCODE_FREE_FOREVER_DETAIL}
      </Text>
    </View>
  );
}
