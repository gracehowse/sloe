/**
 * Sloe v3 Notifications display mapping (ENG-1247) — shared web + mobile.
 *
 * The v3 `Notifications()` screen (Sloe-App.html L5478) renders each row with a
 * 38px TONED ICON PLATE (`.notif-ic.is-{tone}`) and groups items under `Today` /
 * `Earlier` overline sections. This module is the single source of truth for
 * (a) which tone + icon a notification `kind` gets, and (b) the day-partition —
 * so web (`NotificationsCenter.tsx`) and mobile (`(tabs)/notifications.tsx`)
 * can't drift. Each surface maps the platform-agnostic `icon` key to its own
 * icon component and the `tone` to its own token pair.
 */

/** Plate tone — `is-brand` (frost-mist/primary), `is-good` (success-soft/
 *  success), `is-neutral` (secondary/muted). */
export type NotificationTone = "brand" | "good" | "neutral";

/** Platform-agnostic icon key; each surface maps it to a concrete glyph. */
export type NotificationIconKey =
  | "recipe"
  | "plan"
  | "recap"
  | "streak"
  | "welcome"
  | "reminder"
  | "default";

export type NotificationDisplay = { tone: NotificationTone; icon: NotificationIconKey };

/**
 * Map a notification `kind` → v3 plate tone + icon key.
 *
 * Tone semantics: `brand` = an engaging suggestion / recipe highlight; `good` =
 * a positive milestone you earned; `neutral` = plain informational. Unknown
 * kinds fall back to neutral (never guess a celebratory tone for an unknown).
 */
export function notificationDisplay(kind: string): NotificationDisplay {
  switch (kind) {
    case "followed_recipe_published":
    case "recipe_published":
      return { tone: "brand", icon: "recipe" };
    case "meal_plan_ready":
    case "plan_ready":
      return { tone: "neutral", icon: "plan" };
    case "weekly_recap":
    case "digest":
      return { tone: "good", icon: "recap" };
    case "streak":
    case "achievement":
      return { tone: "brand", icon: "streak" };
    case "welcome":
      return { tone: "good", icon: "welcome" };
    case "nudge":
    case "reminder":
      return { tone: "neutral", icon: "reminder" };
    default:
      return { tone: "neutral", icon: "default" };
  }
}

/**
 * Split notifications into `today` vs `earlier` by LOCAL calendar day (v3 groups
 * the inbox under Today / Earlier overlines). `now` is injectable so tests stay
 * deterministic (CLAUDE.md: no bare `new Date()` in date-dependent fixtures).
 * Input is assumed already sorted newest-first; order is preserved within each
 * bucket.
 */
export function partitionNotificationsByDay<T extends { createdAt: string }>(
  items: readonly T[],
  now: Date = new Date(),
): { today: T[]; earlier: T[] } {
  const today: T[] = [];
  const earlier: T[] = [];
  const ny = now.getFullYear();
  const nm = now.getMonth();
  const nd = now.getDate();
  for (const it of items) {
    const c = new Date(it.createdAt);
    const isToday =
      c.getFullYear() === ny && c.getMonth() === nm && c.getDate() === nd;
    (isToday ? today : earlier).push(it);
  }
  return { today, earlier };
}
