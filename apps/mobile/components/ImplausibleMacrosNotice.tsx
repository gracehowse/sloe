/**
 * ImplausibleMacrosNotice (ENG-1420) — inline warning + "save anyway"
 * acknowledgement shown inside CreateCustomFoodSheet when the server rejects
 * the macros as implausible (HTTP 422). Presentational only: the parent owns
 * the block/acknowledge state and re-submits with `acknowledgeImplausible:
 * true` when ticked. Mirrors the web
 * `src/app/components/suppr/ImplausibleMacrosNotice.tsx`.
 */
import { Pressable, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";

/** Identical copy on web + mobile (parity-pinned). Mirrors the message
 *  `/api/custom-foods` returns and the barcode-contribution wording. */
export const IMPLAUSIBLE_MACROS_COPY =
  "Macro values don't pass a basic sanity check. Please double-check the numbers.";

type Props = {
  /** Whether the server has flagged the current macros (sheet stays open). */
  visible: boolean;
  acknowledged: boolean;
  onToggle: () => void;
  colors: { text: string; cardBorder: string; background: string };
};

export default function ImplausibleMacrosNotice({
  visible,
  acknowledged,
  onToggle,
  colors,
}: Props) {
  if (!visible) return null;
  return (
    <View
      style={{
        marginTop: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Accent.warningSolid,
        backgroundColor: colors.background,
      }}
      accessibilityLiveRegion="polite"
      testID="custom-food-implausible-warning"
    >
      <Text style={{ ...Type.caption, color: Accent.warningSolid, marginBottom: Spacing.sm }}>
        {IMPLAUSIBLE_MACROS_COPY}
      </Text>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: acknowledged }}
        accessibilityLabel="These numbers are correct — save anyway"
        testID="custom-food-implausible-ack"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: Radius.sm,
            borderWidth: 1,
            borderColor: acknowledged ? Accent.warningSolid : colors.cardBorder,
            backgroundColor: acknowledged ? Accent.warningSolid : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {acknowledged ? <Check size={14} color={Accent.primaryForeground} /> : null}
        </View>
        <Text style={{ ...Type.caption, color: colors.text, flex: 1 }}>
          These numbers are correct — save anyway
        </Text>
      </Pressable>
    </View>
  );
}
