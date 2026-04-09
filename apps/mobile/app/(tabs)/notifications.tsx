"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";

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
  recipes: { title: string } | { title: string }[] | null;
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

export default function NotificationsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);

  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);

  async function load() {
    if (!userId) return;
    setError(null);
    const [appRes, pubRes] = await Promise.all([
      supabase
        .from("app_notifications")
        .select("id, kind, title, body, recipe_id, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("creator_publish_notifications")
        .select("recipe_id, created_at, read_at, recipes(title)")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    if (appRes.error || pubRes.error) {
      setError("Couldn’t load notifications right now.");
      return;
    }

    const appRows = (appRes.data ?? []) as AppNotifRow[];
    const pubRows = (pubRes.data ?? []) as PublishNotifRow[];

    const fromApp: InboxItem[] = appRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      ...(r.body ? { body: r.body } : {}),
      ...(r.recipe_id ? { recipeId: r.recipe_id } : {}),
      createdAt: r.created_at,
      readAt: r.read_at,
    }));

    const fromPub: InboxItem[] = pubRows.map((r) => {
      const rec = r.recipes;
      const one = Array.isArray(rec) ? rec[0] ?? null : rec;
      const title = one?.title?.trim() ? one.title.trim() : "New recipe";
      return {
        id: `publish:${r.recipe_id}`,
        kind: "followed_recipe_published",
        title,
        body: "New from someone you follow",
        recipeId: r.recipe_id,
        createdAt: r.created_at,
        readAt: r.read_at,
      };
    });

    const merged = [...fromApp, ...fromPub]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, 50);

    setItems(merged);
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const refreshSoon = () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        void load();
      }, 350);
    };

    const channel = supabase
      .channel(`mobile:notif:${userId}`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function markAllRead() {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    await Promise.all([
      supabase.from("app_notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null),
      supabase
        .from("creator_publish_notifications")
        .update({ read_at: now })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);
  }

  async function markOneRead(n: InboxItem) {
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
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">Notifications</ThemedText>
          <ThemedText style={styles.sub}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => void markAllRead()}
          disabled={items.length === 0 || unreadCount === 0}
          style={[styles.btn, (items.length === 0 || unreadCount === 0) && styles.btnDisabled]}
        >
          <ThemedText style={styles.btnText}>Mark all read</ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={styles.err}>{error}</ThemedText>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <ThemedText type="defaultSemiBold">Try again</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {items.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText type="defaultSemiBold">No notifications yet</ThemedText>
              <ThemedText style={styles.sub}>When something important happens, you’ll see it here.</ThemedText>
            </View>
          ) : (
            items.map((n) => (
              <Pressable key={n.id} onPress={() => void markOneRead(n)} style={styles.card}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {!n.readAt ? <View style={styles.dot} /> : <View style={styles.dotSpacer} />}
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold">{n.title}</ThemedText>
                    {n.body ? <ThemedText style={styles.body}>{n.body}</ThemedText> : null}
                    <ThemedText style={styles.stamp}>{formatStamp(n.createdAt)}</ThemedText>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  sub: { opacity: 0.8, marginTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  err: { color: "#b91c1c" },
  retry: { marginTop: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1" },
  btn: { backgroundColor: "#0f172a", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff" },
  empty: { padding: 24, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 6 },
  card: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", marginTop: 10 },
  body: { opacity: 0.85, marginTop: 4 },
  stamp: { opacity: 0.7, marginTop: 8, fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 999, backgroundColor: "#7c3aed", marginTop: 6 },
  dotSpacer: { width: 10, height: 10, marginTop: 6 },
});

