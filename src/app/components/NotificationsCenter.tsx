"use client";

import { Icons } from "./ui/icons";
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
      {/* ENG-803: below sm (<640px, incl. 390px mobile-web) the title and
          the action cluster stack vertically so the H1 never collides
          with "Mark all read" / "Clear". At sm+ the original side-by-side
          row is preserved, so desktop layout is unchanged. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
              <Icons.notification className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-foreground">Notifications</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {notificationsUnreadCount > 0 ? `${notificationsUnreadCount} unread` : "All caught up"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-border/70 bg-card/70 hover:bg-muted/60 text-foreground text-sm font-semibold inline-flex items-center gap-2"
            onClick={() => markAllNotificationsRead()}
            disabled={notificationsInbox.length === 0 || notificationsUnreadCount === 0}
          >
            <Icons.check className="w-4 h-4" />
            Mark all read
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-border/70 bg-card/70 hover:bg-muted/60 text-foreground text-sm font-semibold inline-flex items-center gap-2"
            onClick={() => clearNotifications()}
            disabled={notificationsInbox.length === 0}
          >
            <Icons.delete className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Flat-card surfaces (2026-06-12, Withings grammar): resting inbox card
          sits flat — `shadow-lg` lift retired. */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {notificationsInbox.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Icons.notification className="w-7 h-7 text-primary" />
            </div>
            <p className="text-foreground font-semibold mb-1">All caught up</p>
            <p className="text-sm text-muted-foreground">
              When creators you follow publish recipes or your meal plan is ready, you'll see it here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {notificationsInbox.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="w-full text-left px-6 py-4 hover:bg-muted/60 transition-colors"
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (n.recipeId) onOpenRecipe(n.recipeId);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground line-clamp-2">{n.title}</p>
                      {n.body ? (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(n.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {!n.readAt ? (
                      <span className="mt-1 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
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

