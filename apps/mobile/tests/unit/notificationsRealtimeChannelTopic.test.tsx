// @vitest-environment jsdom
/**
 * ENG-794 — NotificationsScreen realtime subscription must not crash on
 * remount.
 *
 * Symptom (pre-fix): a Strict-Mode / Fast-Refresh remount of the
 * Notifications tab threw
 *   "cannot add postgres_changes callbacks ... after subscribe()"
 * and tripped the error boundary, leaving the tab blank.
 *
 * Root cause: the realtime effect built its channel with a STATIC topic
 * (`mobile:notif:<userId>`). The cleanup calls `supabase.removeChannel`,
 * which is async and un-awaited — on a fast remount the old same-topic
 * channel was still subscribed, so the remount's
 * `supabase.channel(<same topic>)` returned that already-subscribed
 * instance and the following `.on()` threw.
 *
 * Fix (in app/(tabs)/notifications.tsx): a module-level monotonic
 * counter is appended to the topic so every subscription gets a UNIQUE
 * channel topic — the remount can never collide with the dangling
 * channel.
 *
 * What this test pins:
 *   1. Two consecutive mounts of NotificationsScreen call
 *      `supabase.channel()` with DISTINCT topics (regression guard for
 *      the static-topic bug).
 *   2. The `.on(...).on(...).subscribe()` chain never throws on the
 *      second mount — i.e. a remount does not crash. We model the
 *      pre-fix failure by having a mock channel throw from `.on()` if it
 *      is reused (same topic twice); with unique topics that never
 *      fires.
 *   3. Each mounted channel is torn down via `removeChannel` on unmount.
 *
 * Test shape mirrors `weeklyRecapScreen.test.tsx` (full-screen render
 * with mocked supabase / auth / theme / expo-router / safe-area).
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";
// vi.mock calls below are hoisted above this import by Vitest, so the
// supabase / auth / theme mocks are in place before the screen module
// is evaluated.
import NotificationsScreen from "../../app/(tabs)/notifications";

void React;

// ── Realtime channel harness ────────────────────────────────────────
// Records every topic passed to supabase.channel(). A channel that is
// asked to subscribe a topic that is ALREADY subscribed (the pre-fix
// collision) throws from `.on()`, exactly like the real supabase-js
// "cannot add postgres_changes callbacks after subscribe()" error.
type ChannelState = "open" | "subscribed";
const channelTopics: string[] = [];
const liveTopics = new Set<string>();
const removedTopics: string[] = [];

function makeChannel(topic: string) {
  let state: ChannelState = "open";
  const channel = {
    topic,
    on(_event: string, _filter: unknown, _cb: unknown) {
      // Real supabase-js rejects adding postgres_changes listeners once
      // the channel has been subscribed. A fresh-topic channel is always
      // "open" here; a reused already-subscribed topic would be
      // "subscribed" and throw — that's the bug we are guarding against.
      if (state === "subscribed") {
        throw new Error(
          "tried to subscribe multiple times. 'subscribe' can only be called a single time per channel instance",
        );
      }
      return channel;
    },
    subscribe() {
      state = "subscribed";
      liveTopics.add(topic);
      return channel;
    },
  };
  return channel;
}

function channelFactory(topic: string) {
  channelTopics.push(topic);
  // Mirror supabase-js: a repeated topic returns the SAME (already
  // subscribed) channel instance rather than a fresh one. With the
  // fix's unique topics this branch is never hit; without it, the
  // returned channel is in "subscribed" state and `.on()` throws.
  if (liveTopics.has(topic)) {
    return makeAlreadySubscribed(topic);
  }
  return makeChannel(topic);
}

function makeAlreadySubscribed(topic: string) {
  const channel = {
    topic,
    on() {
      throw new Error(
        "cannot add postgres_changes callbacks after subscribe() has been called",
      );
    },
    subscribe() {
      return channel;
    },
  };
  return channel;
}

// ── supabase mock ───────────────────────────────────────────────────
// `from(...)` returns an awaitable empty result so loadInbox resolves
// cleanly. `channel(...)` routes through the harness above.
function emptyQuery() {
  const q: Record<string, unknown> = {};
  const methods = ["select", "eq", "order", "limit", "in", "update", "is"];
  for (const m of methods) q[m] = vi.fn(() => q);
  (q as { then: unknown }).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(onFulfilled);
  return q;
}

// removeChannel records every torn-down topic. Declared as a plain
// function (not a hoisted-unsafe const reference inside the factory) so
// the vi.mock factory can call it lazily without tripping the
// "cannot access before initialization" hoist error.
const removeChannelCalls: { topic: string }[] = [];
function removeChannelImpl(ch: { topic: string }) {
  removeChannelCalls.push(ch);
  removedTopics.push(ch.topic);
  liveTopics.delete(ch.topic);
  return Promise.resolve("ok");
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => emptyQuery()),
    channel: vi.fn((topic: string) => channelFactory(topic)),
    removeChannel: vi.fn((ch: { topic: string }) => removeChannelImpl(ch)),
  },
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "user-eng794" } } }),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    border: "#eee",
  }),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn(), navigate: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeEach(() => {
  channelTopics.length = 0;
  liveTopics.clear();
  removedTopics.length = 0;
  removeChannelCalls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("NotificationsScreen — realtime channel topic uniqueness (ENG-794)", () => {
  it("subscribes a realtime channel on mount and tears it down on unmount", () => {
    const { unmount } = render(<NotificationsScreen />);
    expect(channelTopics.length).toBe(1);
    expect(channelTopics[0]).toContain("user-eng794");

    unmount();
    // Cleanup must remove exactly the channel it created.
    expect(removeChannelCalls.length).toBe(1);
    expect(removedTopics).toEqual([channelTopics[0]]);
  });

  it("uses a DISTINCT channel topic on a remount (no static-topic collision)", () => {
    // First mount.
    const first = render(<NotificationsScreen />);
    const firstTopic = channelTopics[0];
    first.unmount();

    // Second mount — simulates a Fast-Refresh / Strict-Mode remount.
    const second = render(<NotificationsScreen />);
    const secondTopic = channelTopics[channelTopics.length - 1];
    second.unmount();

    expect(channelTopics.length).toBe(2);
    expect(firstTopic).toBeTruthy();
    expect(secondTopic).toBeTruthy();
    // The regression guard: the two topics MUST differ. Without the
    // monotonic counter they were identical and the second `.on()`
    // threw.
    expect(secondTopic).not.toBe(firstTopic);
  });

  it("does not throw / trip the error boundary when remounted before the old channel is removed", () => {
    // Mount but DELAY teardown: keep the first channel "live" (its topic
    // stays in liveTopics) while we mount a second screen. This is the
    // exact race the bug needs — an un-awaited removeChannel that hasn't
    // run yet. With unique topics the second channel never collides, so
    // `.on()` never throws and render succeeds.
    const first = render(<NotificationsScreen />);
    // Pretend removeChannel has not drained yet: re-add the first topic
    // to the live set so a same-topic reuse WOULD collide.
    liveTopics.add(channelTopics[0]);

    // Mounting again must not throw. (Pre-fix this threw the
    // "cannot add postgres_changes callbacks after subscribe()" error.)
    expect(() => {
      const second = render(<NotificationsScreen />);
      second.unmount();
    }).not.toThrow();

    first.unmount();
  });

  it("renders the Notifications header (screen mounts without an error boundary)", () => {
    const { getByText } = render(<NotificationsScreen />);
    // The title proves the component tree rendered rather than falling
    // through to a crash / error boundary.
    expect(getByText("Notifications")).toBeTruthy();
  });
});
