import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useRouter } from "expo-router";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { supabase } from "@/lib/supabase";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { partitionNotificationsByDay } from "@suppr/shared/notifications/notificationDisplay";

// Monotonic counter so each realtime subscription gets a UNIQUE channel topic.
// Without this, a Strict-Mode / Fast-Refresh remount (whose cleanup calls the
// async, un-awaited supabase.removeChannel) can leave a same-topic channel
// still subscribed; the remount's supabase.channel(<same topic>) then returns
// that already-subscribed channel and the following .on() throws
// "cannot add postgres_changes callbacks ... after subscribe()". (ENG-794)
let notifRealtimeSeq = 0;

type AppNotifRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  recipe_id: string | null;
  created_at: string;
  read_at: string | null;
};

type PublishNotifRow = {
  recipe_id: string;
  created_at: string;
  read_at: string | null;
};

type InboxItem = {
  id: string;
  kind: string;
  title: string;
  body?: string;
  recipeId?: string;
  createdAt: string;
  readAt: string | null;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarClearance(); // ENG-1247 — pad scroll to clear frosted (absolute) tab bar.
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for toggles + CTAs.
  const accent = useAccent();

  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);

  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: Spacing.xl, gap: Spacing.md },
        header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: Spacing.dense },
        // headers census 2026-06-10 — tab-level title ink → navPrimary (was
        // the lone tab title in `colors.text`).
        title: { ...Type.title, color: colors.navPrimary },
        sub: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
        center: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl, gap: Spacing.dense },
        err: { color: Accent.destructive, textAlign: "center", fontSize: 15 },
        retry: { marginTop: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.dense, borderRadius: Radius.md, borderWidth: 1, borderColor: accent.primary + "80" },
        retryText: { color: accent.primary, fontWeight: "700", fontSize: 15 },
        btn: { backgroundColor: colors.card, paddingHorizontal: Spacing.dense, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border },
        btnDisabled: { opacity: 0.4 },
        btnText: { color: colors.text, fontSize: 13, fontWeight: "600" },
        empty: { padding: Spacing.xl, borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.card, gap: 8, marginTop: Spacing.md },
        emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
        // Sloe v3 (ENG-1247): overline section label + ONE flush divided card
        // per group; each row is a `<NotificationRow>`.
        overline: { ...Type.label, color: colors.textTertiary, marginTop: Spacing.md, marginBottom: Spacing.xs, marginHorizontal: 2 },
        groupCard: { backgroundColor: colors.card, borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden" },
        rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
      }),
    [colors, accent],
  );

  const loadInbox = useCallback(async () => {
    if (!userId) return;
    setError(null);

    const [appRes, pubRes] = await Promise.all([
      supabase
        .from("app_notifications")
        .select("id, kind, title, body, recipe_id, created_at, read_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("creator_publish_notifications")
        .select("recipe_id, created_at, read_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const appRows = (!appRes.error ? appRes.data : []) as AppNotifRow[];
    const pubRows = (!pubRes.error ? pubRes.data : []) as PublishNotifRow[];

    if (appRes.error && pubRes.error) {
      setError("Couldn't load notifications right now.");
      setItems([]);
      return;
    }

    const recipeIds = [...new Set(pubRows.map((r) => r.recipe_id))];
    const titleById: Record<string, string> = {};
    if (recipeIds.length > 0) {
      const { data: recs } = await supabase.from("recipes").select("id, title").in("id", recipeIds);
      for (const row of recs ?? []) {
        const t = (row as { id: string; title: string | null }).title?.trim();
        if (t) titleById[(row as { id: string }).id] = t;
      }
    }

    const fromApp: InboxItem[] = appRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      ...(r.body ? { body: r.body } : {}),
      ...(r.recipe_id ? { recipeId: r.recipe_id } : {}),
      createdAt: r.created_at,
      readAt: r.read_at,
    }));

    const fromPub: InboxItem[] = pubRows.map((r) => ({
      id: `publish:${r.recipe_id}`,
      kind: "followed_recipe_published",
      title: titleById[r.recipe_id]?.trim() ? titleById[r.recipe_id]! : "New recipe",
      body: "New from someone you follow",
      recipeId: r.recipe_id,
      createdAt: r.created_at,
      readAt: r.read_at,
    }));

    const merged = [...fromApp, ...fromPub]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, 80);

    setItems(merged);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // try/finally so loading flips false even if loadInbox throws —
      // see app/(tabs)/_layout.tsx for the same pattern + rationale.
      try {
        await loadInbox();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, loadInbox]);

  useEffect(() => {
    if (!userId) return;

    const refreshSoon = () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        void loadInbox();
      }, 350);
    };

    const channel = supabase
      .channel(`mobile:notif:${userId}:${(notifRealtimeSeq += 1)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_notifications", filter: `user_id=eq.${userId}` },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "creator_publish_notifications",
          filter: `user_id=eq.${userId}`,
        },
        refreshSoon,
      )
      .subscribe();

    return () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, loadInbox]);

  // Debug audit 2026-05-04 (code-quality #12): pull-to-refresh left
  // the spinner stuck if `loadInbox` rejected. Now wrapped so the
  // ring always stops.
  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await loadInbox();
    } finally {
      setRefreshing(false);
    }
  }, [userId, loadInbox]);

  // Debug audit 2026-05-04 (code-quality #13): markAllRead optimistic
  // update had no rollback. Both supabase update calls failing left
  // the UI ahead of the server; on next focus the unread items
  // returned, looking like the action didn't take. Now: snapshot the
  // pre-mark items, restore on failure.
  async function markAllRead() {
    if (!userId || markingAllRead) return;
    const now = new Date().toISOString();
    const prev = items;
    setMarkingAllRead(true);
    setItems((cur) => cur.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    try {
      const [appRes, creatorRes] = await Promise.all([
        supabase.from("app_notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null),
        supabase
          .from("creator_publish_notifications")
          .update({ read_at: now })
          .eq("user_id", userId)
          .is("read_at", null),
      ]);
      if (appRes.error || creatorRes.error) {
        setItems(prev);
        const msg = appRes.error?.message ?? creatorRes.error?.message ?? "Try again.";
        console.error("[markAllRead] persist failed:", msg);
        Alert.alert("Couldn't mark all read", msg);
      }
    } catch (err) {
      setItems(prev);
      console.error("[markAllRead] threw:", err instanceof Error ? err.message : err);
      Alert.alert("Couldn't mark all read", "Try again.");
    } finally {
      setMarkingAllRead(false);
    }
  }

  const markOneRead = useCallback(
    async (n: InboxItem) => {
      if (!userId || n.readAt) return;
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: now } : x)));
      if (n.kind === "followed_recipe_published" && n.recipeId) {
        await supabase
          .from("creator_publish_notifications")
          .update({ read_at: now })
          .eq("user_id", userId)
          .eq("recipe_id", n.recipeId);
        return;
      }
      await supabase.from("app_notifications").update({ read_at: now }).eq("user_id", userId).eq("id", n.id);
    },
    [userId],
  );

  const onNotificationPress = useCallback(
    async (n: InboxItem) => {
      if (!userId) return;
      if (!n.readAt) await markOneRead(n);
      if (n.recipeId) {
        router.push(`/recipe/${n.recipeId}`);
      }
    },
    [userId, router, markOneRead],
  );

  // Sloe v3 (ENG-1247): split into Today / Earlier by local calendar day —
  // each non-empty group renders as ONE flush divided card.
  const { today, earlier } = useMemo(() => partitionNotificationsByDay(items), [items]);

  const renderGroup = useCallback(
    (label: string, group: InboxItem[]) => {
      if (group.length === 0) return null;
      return (
        <View key={label}>
          <Text style={styles.overline}>{label}</Text>
          <View style={styles.groupCard}>
            {group.map((n, i) => (
              <View key={n.id} style={i > 0 ? styles.rowDivider : undefined}>
                <NotificationRow
                  item={n}
                  onPress={() => void onNotificationPress(n)}
                  colors={colors}
                  accent={accent}
                />
              </View>
            ))}
          </View>
        </View>
      );
    },
    [onNotificationPress, styles, colors, accent],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.sub}>
            {unreadCount > 0 ? `${unreadCount} unread` : "No unread notifications"}
          </Text>
        </View>
        <Pressable
          onPress={() => void markAllRead()}
          disabled={markingAllRead || items.length === 0 || unreadCount === 0}
          style={[
            styles.btn,
            (markingAllRead || items.length === 0 || unreadCount === 0) && styles.btnDisabled,
          ]}
          accessibilityState={{ disabled: markingAllRead || items.length === 0 || unreadCount === 0, busy: markingAllRead }}
        >
          {markingAllRead ? (
            <ActivityIndicator size="small" color={accent.primary} />
          ) : (
            <Text style={styles.btnText}>Mark all read</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={accent.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
          <Pressable onPress={() => void loadInbox()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={accent.primary}
            />
          }
        >
          {items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.sub}>
                {"Notifications about recipes you follow and weekly reports will appear here."}
              </Text>
            </View>
          ) : (
            <>
              {renderGroup("Today", today)}
              {renderGroup("Earlier", earlier)}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
