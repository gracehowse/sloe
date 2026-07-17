import { memo } from "react";
import * as React from "react";
import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { Accent, Radius, ShadowColor, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PostLogSuggestionToast — the calm post-log "what to eat next"
 * micro-moment (ENG-977).
 *
 * After an AI log (photo / voice) commits, the user's remaining budget
 * just changed — the highest-intent moment to answer Suppr's signature
 * question. This surfaces one quiet line built by the shared
 * `buildPostLogSuggestion` helper, e.g.:
 *
 *   "Logged. ~640 kcal left — dinner could be Chicken traybake."
 *
 * It renders the SAME string the web toast shows (microcopy parity), in
 * the same calm card treatment as `FirstLogAcknowledgment` (top-anchored,
 * auto-fade, no tap target — "calm reward" posture). The Pro accent damson
 * sparkle marks it as the coaching layer.
 *
 * Visibility lifecycle is host-owned: `commitAiLoggedItems` builds the
 * nudge (gated by `post_log_what_next_v1`), sets visible + the line, and
 * the auto-fade calls `onDismiss` to hide.
 *
 * Web parity: `src/app/components/NutritionTracker.tsx` surfaces the same
 * line as a sonner toast on AI commit.
 */
export interface PostLogSuggestionToastProps {
  visible: boolean;
  /** The full calm line from `buildPostLogSuggestion().line`. */
  line: string | null;
  onDismiss: () => void;
  /** Auto-fade timeout in ms. Default 4000ms (longer than the first-log
   *  toast — there's a suggestion to read). Exposed for tests. */
  autoFadeMs?: number;
  /** Top-inset offset so the toast clears the status bar / notch. */
  topInset?: number;
}

const DEFAULT_AUTO_FADE_MS = 4000;

function PostLogSuggestionToastImpl(props: PostLogSuggestionToastProps) {
  const {
    visible,
    line,
    onDismiss,
    autoFadeMs = DEFAULT_AUTO_FADE_MS,
    topInset = Spacing.lg,
  } = props;
  const colors = useThemeColors();

  React.useEffect(() => {
    if (!visible || !line) return;
    const handle = setTimeout(() => {
      onDismiss();
    }, autoFadeMs);
    return () => clearTimeout(handle);
  }, [visible, line, autoFadeMs, onDismiss]);

  if (!visible || !line) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={line}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: topInset,
        left: Spacing.md,
        right: Spacing.md,
        zIndex: 1000,
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: Accent.winSoftStrong,
        shadowColor: ShadowColor.cast,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
        <View
        style={{
          width: 28,
          height: 28,
          borderRadius: Radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Accent.winSoft,
        }}
      >
        <Sparkles size={14} color={Accent.win} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...Type.body, color: colors.text }}>{line}</Text>
      </View>
    </View>
  );
}

export const PostLogSuggestionToast = memo(PostLogSuggestionToastImpl);

export default PostLogSuggestionToast;
