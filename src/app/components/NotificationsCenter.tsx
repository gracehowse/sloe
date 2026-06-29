"use client";

import { Icons } from "./ui/icons";
import { useAppData } from "../../context/AppDataContext.tsx";
import {
  notificationDisplay,
  partitionNotificationsByDay,
  type NotificationIconKey,
  type NotificationTone,
} from "../../lib/notifications/notificationDisplay";

/** v3 `.notif-ic` icon key → centralised Icons glyph (parity with the mobile
 *  lucide map in `apps/mobile/components/notifications/NotificationRow.tsx`). */
const ICON_BY_KEY: Record<NotificationIconKey, (typeof Icons)[keyof typeof Icons]> = {
  recipe: Icons.recipe,
  plan: Icons.plan,
  recap: Icons.check,
  streak: Icons.streak,
  welcome: Icons.sparkles,
  reminder: Icons.notification,
  default: Icons.notification,
};

/** Tone → toned-plate classes (v3 `.notif-ic.is-brand/good/neutral`). */
const PLATE_BY_TONE: Record<NotificationTone, string> = {
  brand: "bg-primary/10 text-primary",
  good: "bg-[var(--success-soft)] text-[var(--success)]",
  neutral: "bg-muted text-muted-foreground",
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

type InboxNotification = {
  id: string;
  title: string;
  body?: string | null;
  recipeId?: string | null;
  createdAt: string;
  readAt?: string | null;
  kind?: string;
};

export function NotificationsCenter({ onOpenRecipe }: { onOpenRecipe: (recipeId: string) => void }) {
  const {
    notificationsInbox,
    notificationsUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useAppData();

  const inbox = notificationsInbox as InboxNotification[];
  const { today, earlier } = partitionNotificationsByDay(inbox);

  const Row = (n: InboxNotification) => {
    const { tone, icon } = notificationDisplay(n.kind ?? "");
    const Glyph = ICON_BY_KEY[icon];
    return (
      <li key={n.id}>
        <button
          type="button"
          className="w-full text-left px-4 py-3.5 hover:bg-muted/60 transition-colors flex items-start gap-3"
          onClick={() => {
            markNotificationRead(n.id);
            if (n.recipeId) onOpenRecipe(n.recipeId);
          }}
        >
          {/* 38px toned icon plate (v3 .notif-ic) */}
          <span
            className={`w-[38px] h-[38px] rounded-xl flex items-center justify-center shrink-0 ${PLATE_BY_TONE[tone]}`}
          >
            <Glyph className="w-[18px] h-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground line-clamp-2">{n.title}</span>
            {n.body ? (
              <span className="block text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</span>
            ) : null}
            <span className="block text-xs text-muted-foreground mt-1">{formatStamp(n.createdAt)}</span>
          </span>
          {!n.readAt ? (
            <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Unread" />
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* ENG-803: below sm the title + action cluster stack vertically so the
          H1 never collides with the buttons. At sm+ the side-by-side row is
          preserved, so desktop layout is unchanged. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary rounded-xl shadow-lg shadow-primary/20">
              <Icons.notification className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-headline text-foreground">Notifications</h1>
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
            disabled={inbox.length === 0 || notificationsUnreadCount === 0}
          >
            <Icons.check className="w-4 h-4" />
            Mark all read
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl border border-border/70 bg-card/70 hover:bg-muted/60 text-foreground text-sm font-semibold inline-flex items-center gap-2"
            onClick={() => clearNotifications()}
            disabled={inbox.length === 0}
          >
            <Icons.delete className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {inbox.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Icons.notification className="w-7 h-7 text-primary" />
            </div>
            <p className="text-foreground font-semibold mb-1">All caught up</p>
            <p className="text-sm text-muted-foreground">
              When creators you follow publish recipes or your meal plan is ready, you'll see it here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {([
            ["Today", today],
            ["Earlier", earlier],
          ] as const).map(([label, group]) =>
            group.length === 0 ? null : (
              <div key={label}>
                {/* v3 overline group header */}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  {label}
                </p>
                {/* Flat-card surface (2026-06-12 Withings grammar); flush divided rows. */}
                <ul className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/70">
                  {group.map((n) => Row(n))}
                </ul>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
