import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

// Monotonic counter so each realtime subscription gets a UNIQUE channel
// topic. Without this, a Strict-Mode / Fast-Refresh remount (or a
// Today-tab focus race — TodayHeaderBar remounts each time the Today tab
// regains focus) whose cleanup calls the async, un-awaited
// `supabase.removeChannel` can leave a same-topic channel still
// subscribed; the remount's `supabase.channel(<same topic>)` then
// returns that already-subscribed channel and the following `.on()`
// throws "cannot add postgres_changes callbacks ... after subscribe()",
// tripping the root ErrorBoundary (ENG-1473). Same class of bug as
// ENG-794 (app/(tabs)/notifications.tsx) — this fix mirrors that
// proven pattern exactly.
let notifCountRealtimeSeq = 0;

export function useUnreadNotificationsCount(userId: string | null): number {
  const [unread, setUnread] = useState(0);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const [appRes, pubRes] = await Promise.all([
        supabase
          .from("app_notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("read_at", null),
        supabase
          .from("creator_publish_notifications")
          .select("recipe_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("read_at", null),
      ]);
      if (cancelled) return;
      const appCount = appRes.count ?? 0;
      const pubCount = pubRes.count ?? 0;
      setUnread(appCount + pubCount);
    };

    void refresh();

    const refreshSoon = () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        void refresh();
      }, 350);
    };

    const channel = supabase
      .channel(`mobile:notif-count:${userId}:${(notifCountRealtimeSeq += 1)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_notifications", filter: `user_id=eq.${userId}` },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creator_publish_notifications", filter: `user_id=eq.${userId}` },
        refreshSoon,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return useMemo(() => Math.max(0, unread), [unread]);
}

