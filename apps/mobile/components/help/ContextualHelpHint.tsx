/**
 * ENG-1597 — contextual "?" hint (mobile). Opens an Alert with title + bullets.
 * Web: `src/app/components/help/ContextualHelpHint.tsx`.
 */

import { Alert } from "react-native";
import { CircleHelp } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  IN_APP_HELP_IMPORT_FLAG,
  type ContextualHelpTopic,
} from "@suppr/shared/help/importLoopHints";

export function ContextualHelpHint({
  topic,
  testID = "contextual-help-hint",
}: {
  topic: ContextualHelpTopic;
  testID?: string;
}) {
  const colors = useThemeColors();
  const enabled = isFeatureEnabled(IN_APP_HELP_IMPORT_FLAG);
  if (!enabled) return null;

  return (
    <PressableScale
      testID={testID}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Help: ${topic.title}`}
      onPress={() => {
        Alert.alert(topic.title, topic.bullets.map((b) => `• ${b}`).join("\n\n"));
      }}
      style={{
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: Spacing.xs,
      }}
    >
      <CircleHelp size={18} color={colors.textSecondary} />
    </PressableScale>
  );
}
