"use client";

import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
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
        className="relative p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {notificationsUnreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-[1.1rem] text-center">
            {notificationsUnreadCount > 9 ? "9+" : notificationsUnreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-[60]" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-[70] w-[min(100vw-2rem,22rem)] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl max-h-[min(70vh,24rem)] overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline"
                  onClick={() => markAllNotificationsRead()}
                >
                  Mark all read
                </button>
                {onOpenAll ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-violet-700 dark:text-violet-300 hover:underline"
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
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
            ) : (
              <ul className="py-1">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 flex flex-col gap-0.5"
                      onClick={() => {
                        markNotificationRead(r.id);
                        if (r.recipeId) onOpenRecipe(r.recipeId);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium text-slate-900 dark:text-white line-clamp-2">{r.title}</span>
                      {r.body ? <span className="text-xs text-slate-500 line-clamp-2">{r.body}</span> : null}
                      <span className="text-xs text-slate-500">
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
