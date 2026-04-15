import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { supabase } from "../lib/supabase/browserClient.ts";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type AppNotification,
  type NotificationPrefs,
} from "../types/notifications.ts";
import { newId } from "./appData/persistence.ts";
import { useAuthSession } from "./AuthSessionContext.tsx";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface NotificationContextValue {
  notificationsInbox: AppNotification[];
  notificationsUnreadCount: number;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: Dispatch<SetStateAction<NotificationPrefs>>;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "readAt">) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NotificationProvider({
  children,
  initialInbox,
  initialPrefs,
}: {
  children: ReactNode;
  initialInbox?: AppNotification[];
  initialPrefs?: NotificationPrefs;
}) {
  const { authedUserId } = useAuthSession();
  const refreshDebounceRef = useRef<number | null>(null);

  const [notificationsInbox, setNotificationsInbox] = useState<AppNotification[]>(
    () => initialInbox ?? [],
  );
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(
    () => initialPrefs ?? { ...DEFAULT_NOTIFICATION_PREFS },
  );

  const notificationsUnreadCount = useMemo(
    () => notificationsInbox.filter((n) => !n.readAt).length,
    [notificationsInbox],
  );

  // ------- Callbacks -------

  const pushNotification = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt" | "readAt">) => {
      setNotificationsInbox((prev) => {
        const next: AppNotification = {
          id: newId("notif"),
          createdAt: new Date().toISOString(),
          readAt: null,
          ...n,
        };
        return [next, ...prev].slice(0, 50);
      });

      if (!authedUserId) return;
      supabase
        .from("app_notifications")
        .insert({
          user_id: authedUserId,
          kind: n.kind,
          title: n.title,
          body: n.body ?? null,
          recipe_id: n.recipeId ?? null,
        })
        .then(({ error }) => {
          if (error && process.env.NODE_ENV === "development") {
            console.warn("app_notifications insert:", error.message);
          }
        });
    },
    [authedUserId],
  );

  const markNotificationRead = useCallback(
    (notificationId: string) => {
      setNotificationsInbox((prev) =>
        prev.map((n) =>
          n.id === notificationId && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );

      if (!authedUserId) return;
      const notif = notificationsInbox.find((n) => n.id === notificationId);
      if (!notif || notif.readAt) return;
      const now = new Date().toISOString();
      if (notif.kind === "followed_recipe_published" && notif.recipeId) {
        supabase
          .from("creator_publish_notifications")
          .update({ read_at: now })
          .eq("user_id", authedUserId)
          .eq("recipe_id", notif.recipeId)
          .then(({ error }) => {
            if (error && process.env.NODE_ENV === "development") {
              console.warn("creator_publish_notifications update:", error.message);
            }
          });
        return;
      }
      supabase
        .from("app_notifications")
        .update({ read_at: now })
        .eq("user_id", authedUserId)
        .eq("id", notificationId)
        .then(({ error }) => {
          if (error && process.env.NODE_ENV === "development") {
            console.warn("app_notifications update:", error.message);
          }
        });
    },
    [authedUserId, notificationsInbox],
  );

  const markAllNotificationsRead = useCallback(() => {
    const now = new Date().toISOString();
    setNotificationsInbox((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));

    if (!authedUserId) return;
    supabase
      .from("creator_publish_notifications")
      .update({ read_at: now })
      .eq("user_id", authedUserId)
      .is("read_at", null)
      .then(() => {});
    supabase
      .from("app_notifications")
      .update({ read_at: now })
      .eq("user_id", authedUserId)
      .is("read_at", null)
      .then(() => {});
  }, [authedUserId]);

  const clearNotifications = useCallback(() => {
    setNotificationsInbox([]);
    if (!authedUserId) return;
    const now = new Date().toISOString();
    supabase
      .from("creator_publish_notifications")
      .update({ read_at: now })
      .eq("user_id", authedUserId)
      .is("read_at", null)
      .then(() => {});
    supabase.from("app_notifications").delete().eq("user_id", authedUserId).then(() => {});
  }, [authedUserId]);

  // ------- Effects -------

  // Load notification prefs from profile (backend) when signed in.
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("notification_prefs, notifications_seeded")
      .eq("id", authedUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (process.env.NODE_ENV === "development") console.warn("profiles.notification_prefs:", error.message);
          return;
        }
        const prefs = (data as any)?.notification_prefs;
        if (prefs && typeof prefs === "object") {
          setNotificationPrefs((prev) => ({ ...prev, ...(prefs as Partial<NotificationPrefs>) }));
        }

        const seeded = Boolean((data as any)?.notifications_seeded);
        if (!seeded) {
          supabase
            .from("app_notifications")
            .insert({
              user_id: authedUserId,
              kind: "welcome",
              title: "Welcome to Suppr",
              body: "You'll see updates here when your plan is ready and when creators you follow publish new recipes.",
              recipe_id: null,
            })
            .then(() => {
              supabase
                .from("profiles")
                .update({ notifications_seeded: true })
                .eq("id", authedUserId)
                .then(() => {});
            });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  // Persist notification prefs to backend when they change.
  useEffect(() => {
    if (!authedUserId) return;
    supabase
      .from("profiles")
      .update({ notification_prefs: notificationPrefs as any })
      .eq("id", authedUserId)
      .then(({ error }) => {
        if (error && process.env.NODE_ENV === "development") {
          console.warn("profiles.notification_prefs update:", error.message);
        }
      });
  }, [authedUserId, notificationPrefs]);

  // Load backend notifications and merge into inbox.
  const refreshNotificationsInbox = useCallback(async () => {
    if (!authedUserId) return;
    const [publishRes, appRes] = await Promise.all([
      supabase
        .from("creator_publish_notifications")
        .select("recipe_id, created_at, read_at, recipes(title)")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("app_notifications")
        .select("id, kind, title, body, recipe_id, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const publishRows = (publishRes.data ?? []) as any[];
    const appRows = (appRes.data ?? []) as any[];

    const publishNotifs: AppNotification[] = publishRows
      .map((r) => {
        const rec = r.recipes;
        const one = Array.isArray(rec) ? rec[0] ?? null : rec;
        const title = typeof one?.title === "string" && one.title.trim() ? one.title.trim() : "New recipe";
        return {
          id: `publish:${String(r.recipe_id)}`,
          kind: "followed_recipe_published",
          createdAt: String(r.created_at),
          readAt: r.read_at ? String(r.read_at) : null,
          title,
          body: "New from someone you follow",
          recipeId: String(r.recipe_id),
        } satisfies AppNotification;
      })
      .filter(Boolean);

    const appNotifs: AppNotification[] = appRows
      .map((r) => ({
        id: String(r.id),
        kind: String(r.kind) as AppNotification["kind"],
        createdAt: String(r.created_at),
        readAt: r.read_at ? String(r.read_at) : null,
        title: String(r.title ?? "Update"),
        ...(typeof r.body === "string" && r.body.trim() ? { body: r.body } : {}),
        ...(r.recipe_id ? { recipeId: String(r.recipe_id) } : {}),
      }))
      .filter(Boolean);

    const merged = [...appNotifs, ...publishNotifs]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, 50);

    setNotificationsInbox(merged);
  }, [authedUserId]);

  useEffect(() => {
    if (!authedUserId) return;
    void refreshNotificationsInbox();
  }, [authedUserId, refreshNotificationsInbox]);

  // Realtime: keep inbox fresh without polling.
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    const refreshSoon = () => {
      if (cancelled) return;
      if (refreshDebounceRef.current) window.clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = window.setTimeout(() => {
        void refreshNotificationsInbox();
      }, 350);
    };

    const channel = supabase
      .channel(`notif:${authedUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_notifications",
          filter: `user_id=eq.${authedUserId}`,
        },
        refreshSoon,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "creator_publish_notifications",
          filter: `user_id=eq.${authedUserId}`,
        },
        refreshSoon,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshDebounceRef.current) window.clearTimeout(refreshDebounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [authedUserId, refreshNotificationsInbox]);

  // ------- Value -------

  const value = useMemo(
    (): NotificationContextValue => ({
      notificationsInbox,
      notificationsUnreadCount,
      notificationPrefs,
      setNotificationPrefs,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      addNotification: pushNotification,
    }),
    [
      notificationsInbox,
      notificationsUnreadCount,
      notificationPrefs,
      setNotificationPrefs,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      pushNotification,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
