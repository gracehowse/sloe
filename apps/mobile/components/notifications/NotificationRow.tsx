import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Bell,
  BookOpen,
  Check,
  Flame,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing } from "@/constants/theme";
import type { ThemeColors } from "@/hooks/use-theme-colors";
import {
  notificationDisplay,
  type NotificationIconKey,
  type NotificationTone,
} from "@suppr/shared/notifications/notificationDisplay";

/** Notification item shape consumed by the row (subset of the screen's
 *  `InboxItem`). */
export type NotificationRowItem = {
  title: string;
  body?: string;
  createdAt: string;
  readAt: string | null;
  kind: string;
  recipeId?: string;
};

type AccentTokens = typeof Accent;

type NotificationRowProps = {
  item: NotificationRowItem;
  onPress: () => void;
  colors: ThemeColors;
  /** Secondary accent (Frost flag → damson, else clay) — owns the unread dot. */
  accent: AccentTokens;
};

/** Platform-agnostic icon key → lucide-react-native glyph (v3 `.notif-ic`). */
const ICON_BY_KEY: Record<NotificationIconKey, LucideIcon> = {
  recipe: Utensils,
  plan: BookOpen,
  recap: Check,
  streak: Flame,
  welcome: Sparkles,
  reminder: Bell,
  default: Bell,
};

/** Tone → toned-plate background + foreground tokens (v3 `.notif-ic.is-*`). */
function plateColors(
  tone: NotificationTone,
  colors: ThemeColors,
  accent: AccentTokens,
): { bg: string; fg: string } {
  switch (tone) {
    case "brand":
      return { bg: Accent.primarySoft, fg: accent.primary };
    case "good":
      return { bg: Accent.successSoft, fg: Accent.successSolid };
    case "neutral":
    default:
      return { bg: colors.border, fg: colors.textSecondary };
  }
}

/** Short month/day/hour/minute stamp — mirrors web `NotificationsCenter`. */
function formatStamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function NotificationRowImpl({ item, onPress, colors, accent }: NotificationRowProps) {
  const { tone, icon } = notificationDisplay(item.kind);
  const Glyph = ICON_BY_KEY[icon];
  const { bg, fg } = plateColors(tone, colors, accent);
  const unread = !item.readAt;

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={[styles.plate, { backgroundColor: bg }]}>
        <Glyph size={18} color={fg} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        {item.body ? (
          <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
        ) : null}
        <Text style={[styles.time, { color: colors.textTertiary }]}>
          {formatStamp(item.createdAt)}
        </Text>
      </View>
      {unread ? <View style={[styles.dot, { backgroundColor: accent.primary }]} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.dense,
    alignItems: "flex-start",
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  plate: {
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600" },
  body: { fontSize: 12.5, marginTop: 1 },
  time: { fontSize: 11, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: Radius.full, marginTop: 6 },
});

/** Memoized — the screen re-renders on every realtime/markRead state change;
 *  a row only changes when its item identity or callback changes. */
export const NotificationRow = memo(NotificationRowImpl);
