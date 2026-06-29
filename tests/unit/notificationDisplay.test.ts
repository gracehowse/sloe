import { describe, it, expect } from "vitest";
import {
  notificationDisplay,
  partitionNotificationsByDay,
} from "../../src/lib/notifications/notificationDisplay";

describe("notificationDisplay (ENG-1247 — v3 notification plate tone/icon)", () => {
  it("maps known kinds to their tone + icon", () => {
    expect(notificationDisplay("followed_recipe_published")).toEqual({ tone: "brand", icon: "recipe" });
    expect(notificationDisplay("recipe_published")).toEqual({ tone: "brand", icon: "recipe" });
    expect(notificationDisplay("meal_plan_ready")).toEqual({ tone: "neutral", icon: "plan" });
    expect(notificationDisplay("weekly_recap")).toEqual({ tone: "good", icon: "recap" });
    expect(notificationDisplay("digest")).toEqual({ tone: "good", icon: "recap" });
    expect(notificationDisplay("streak")).toEqual({ tone: "brand", icon: "streak" });
    expect(notificationDisplay("achievement")).toEqual({ tone: "brand", icon: "streak" });
    expect(notificationDisplay("welcome")).toEqual({ tone: "good", icon: "welcome" });
    expect(notificationDisplay("reminder")).toEqual({ tone: "neutral", icon: "reminder" });
  });

  it("falls back to neutral/default for unknown or empty kinds (never guesses a celebratory tone)", () => {
    expect(notificationDisplay("totally_unknown")).toEqual({ tone: "neutral", icon: "default" });
    expect(notificationDisplay("")).toEqual({ tone: "neutral", icon: "default" });
  });
});

describe("partitionNotificationsByDay", () => {
  // Local-time literals (no trailing Z) so the calendar-day comparison is
  // deterministic regardless of the test runner's timezone.
  const now = new Date("2026-06-27T12:00:00");

  it("splits items into today vs earlier by local calendar day, preserving order", () => {
    const items = [
      { id: "a", createdAt: "2026-06-27T09:00:00" },
      { id: "b", createdAt: "2026-06-26T23:30:00" },
      { id: "c", createdAt: "2026-06-27T00:15:00" },
      { id: "d", createdAt: "2026-06-20T08:00:00" },
    ];
    const { today, earlier } = partitionNotificationsByDay(items, now);
    expect(today.map((i) => i.id)).toEqual(["a", "c"]);
    expect(earlier.map((i) => i.id)).toEqual(["b", "d"]);
  });

  it("returns empty buckets cleanly", () => {
    expect(partitionNotificationsByDay([], now)).toEqual({ today: [], earlier: [] });
  });
});
