"use client";

import { Bell, Check, Trash2 } from "lucide-react";
import { useAppData } from "../../context/AppDataContext.tsx";

export function NotificationsCenter({ onOpenRecipe }: { onOpenRecipe: (recipeId: string) => void }) {
  const {
    notificationsInbox,
    notificationsUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useAppData();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-slate-900 dark:text-white">Notifications</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {notificationsUnreadCount > 0 ? `${notificationsUnreadCount} unread` : "All caught up"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2"
            onClick={() => markAllNotificationsRead()}
            disabled={notificationsInbox.length === 0 || notificationsUnreadCount === 0}
          >
            <Check className="w-4 h-4" />
            Mark all read
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2"
            onClick={() => clearNotifications()}
            disabled={notificationsInbox.length === 0}
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-lg overflow-hidden">
        {notificationsInbox.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/40 dark:to-indigo-950/40 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-7 h-7 text-violet-500 dark:text-violet-400" />
            </div>
            <p className="text-slate-900 dark:text-white font-semibold mb-1">All caught up</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              When creators you follow publish recipes or your meal plan is ready, you’ll see it here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {notificationsInbox.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="w-full text-left px-6 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (n.recipeId) onOpenRecipe(n.recipeId);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white line-clamp-2">{n.title}</p>
                      {n.body ? (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{n.body}</p>
                      ) : null}
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(n.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!n.readAt ? (
                      <span className="mt-1 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-200 text-xs font-bold">
                        Unread
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

