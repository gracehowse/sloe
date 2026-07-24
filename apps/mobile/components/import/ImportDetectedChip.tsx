import { Alert, Text, View } from "react-native";
import {
  CalendarDays,
  Check,
  FileSpreadsheet,
  FileText,
  Layers,
  Link2,
  Play,
  type LucideIcon,
} from "lucide-react-native";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  classifyImport,
  type ImportKind,
} from "@suppr/shared/recipe-import/classifyImport";
import { importDetectSubline } from "@suppr/shared/recipe-import/importInputSamples";

function iconFor(kind: ImportKind): LucideIcon {
  if (kind === "social") return Play;
  if (kind === "collection") return Layers;
  if (kind === "csv") return FileSpreadsheet;
  if (kind === "plan-text") return CalendarDays;
  if (kind === "recipe-text") return FileText;
  return Link2;
}

export function ImportDetectedChip({ input }: { input: string }) {
  const accent = useAccent();
  const colors = useThemeColors();
  const v3 = isFeatureEnabled("import_input_v3_polish");
  const result = classifyImport(input);
  if (result.kind === "empty") return null;
  const Icon = iconFor(result.kind);

  if (v3) {
    const subline = importDetectSubline(result.kind);
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel={`Detected: ${result.label}. ${subline}`}
        testID="import-detected-chip"
        data-variant="row"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          borderRadius: Radius.lg,
          backgroundColor: accent.primarySoft,
          paddingHorizontal: Spacing.dense,
          paddingVertical: Spacing.sm,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.lg,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={accent.primarySolid} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...Type.body, fontWeight: "600", color: colors.text }}>
            Detected: {result.label}
          </Text>
          {subline ? (
            <Text style={{ ...Type.caption, color: colors.textSecondary }}>
              {subline}
            </Text>
          ) : null}
        </View>
        <Check size={17} color={accent.success} />
      </View>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Detected: ${result.label}`}
      testID="import-detected-chip"
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: Spacing.xs + 2,
        borderRadius: Radius.full,
        backgroundColor: accent.primarySoft,
        paddingHorizontal: Spacing.dense,
        paddingVertical: Spacing.xs + 1,
      }}
    >
      <Icon size={14} color={accent.primarySolid} />
      <Text style={{ ...Type.caption, fontWeight: "500", color: accent.primarySolid }}>
        Detected: {result.label}
      </Text>
    </View>
  );
}

export default ImportDetectedChip;
