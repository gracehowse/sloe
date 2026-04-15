"use client";

import { useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";

export function NotificationsBell({
  onOpenRecipe,
  onOpenAll,
}: {
  onOpenRecipe: (recipeId: string) => void;
  onOpenAll?: () => void;
}) {
  const {
    notificationsInbox,
    notificationsUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppData();
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => notificationsInbox.slice(0, 20), [notificationsInbox]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl border border-border/80 text-muted-foreground hover:bg-muted/60"
        aria-label="Notifications"
      >
        <Icons.notification className="w-5 h-5" />
        {notificationsUnreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-white text-[10px] font-bold leading-[1.1rem] text-center">
            {notificationsUnreadCount > 9 ? "9+" : notificationsUnreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-[60]" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[70] w-[min(100vw-2rem,22rem)] rounded-2xl border border-border bg-card shadow-xl max-h-[min(70vh,24rem)] overflow-y-auto">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-muted-foreground hover:underline"
                  onClick={() => markAllNotificationsRead()}
                >
                  Mark all read
                </button>
                {onOpenAll ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => {
                      setOpen(false);
                      onOpenAll();
                    }}
                  >
                    View all
                  </button>
                ) : null}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="py-1">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm hover:bg-muted/60 flex flex-col gap-0.5"
                      onClick={() => {
                        markNotificationRead(r.id);
                        if (r.recipeId) onOpenRecipe(r.recipeId);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium text-foreground line-clamp-2">{r.title}</span>
                      {r.body ? <span className="text-xs text-muted-foreground line-clamp-2">{r.body}</span> : null}
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {!r.readAt ? " · Unread" : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
