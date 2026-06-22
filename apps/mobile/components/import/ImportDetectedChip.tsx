import { Text, View } from "react-native";
import {
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Link2,
  Play,
  type LucideIcon,
} from "lucide-react-native";
import { useAccent } from "@/context/theme";
import { Radius, Spacing, Type } from "@/constants/theme";
import {
  classifyImport,
  type ImportKind,
} from "@suppr/shared/recipe-import/classifyImport";

/**
 * ImportDetectedChip (mobile, ENG-1225 #3) — parity mirror of the web chip: the
 * unified Import wedge's live "Detected: {label}" cue. Runs the shared
 * `classifyImport` over the pasted text and shows what we'll do with it before
 * the user commits, so one paste field can accept anything. Renders null for
 * empty input.
 */
// Generic glyphs (lucide dropped brand icons) — the label carries the platform.
function iconFor(kind: ImportKind): LucideIcon {
  if (kind === "social") return Play; // reel / video
  if (kind === "csv") return FileSpreadsheet;
  if (kind === "plan-text") return CalendarDays;
  if (kind === "recipe-text") return FileText;
  return Link2; // recipe-url
}

export function ImportDetectedChip({ input }: { input: string }) {
  const accent = useAccent();
  const result = classifyImport(input);
  if (result.kind === "empty") return null;
  const Icon = iconFor(result.kind);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Detected: ${result.label}`}
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
