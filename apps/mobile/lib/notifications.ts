import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

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
      .channel(`mobile:notif-count:${userId}`)
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

