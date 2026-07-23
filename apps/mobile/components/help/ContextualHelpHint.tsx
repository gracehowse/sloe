/**
 * ENG-1597 — contextual "?" hint (mobile). Opens an Alert with registry copy.
 * Web: `src/app/components/help/ContextualHelpHint.tsx`.
 */

import { Alert, Linking } from "react-native";
import { CircleHelp } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  CONTEXTUAL_HELP_FLAG,
  CONTEXTUAL_HELP_REGISTRY,
  type HelpTopicId,
} from "@suppr/shared/help/contextualHelp";

export function ContextualHelpHint({
  topicId,
  testID = "contextual-help-hint",
}: {
  topicId: HelpTopicId;
  testID?: string;
}) {
  const colors = useThemeColors();
  const enabled = isFeatureEnabled(CONTEXTUAL_HELP_FLAG);
  const topic = CONTEXTUAL_HELP_REGISTRY[topicId];
  if (!enabled || !topic) return null;

  return (
    <PressableScale
      testID={testID}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Help: ${topic.title}`}
      onPress={() => {
        const message = topic.paragraphs.map((p) => `• ${p}`).join("\n\n");
        const buttons = topic.learnMorePath
          ? [
              { text: "Learn more", onPress: () => void Linking.openURL(`https://getsloe.com${topic.learnMorePath}`) },
              { text: "Got it", style: "cancel" as const },
            ]
          : [{ text: "Got it", style: "cancel" as const }];
        Alert.alert(topic.title, message, buttons);
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
