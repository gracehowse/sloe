// @vitest-environment jsdom
/**
 * ENG-1473 — useUnreadNotificationsCount realtime subscription must not
 * crash on remount.
 *
 * Symptom (pre-fix): TodayHeaderBar mounts `useUnreadNotificationsCount`
 * on every Today-tab focus. A remount race (tab switch back to Today,
 * cold-boot mount race, Fast Refresh) could trip the root ErrorBoundary
 * with "cannot add postgres_changes callbacks for
 * realtime:mobile:notif-count:{userId} after subscribe()".
 *
 * Root cause: the realtime effect built its channel with a STATIC topic
 * (`mobile:notif-count:<userId>`). The cleanup calls
 * `supabase.removeChannel`, which is async and un-awaited — on a fast
 * remount the old same-topic channel was still subscribed, so the
 * remount's `supabase.channel(<same topic>)` returned that
 * already-subscribed instance and the following `.on()` threw.
 *
 * Fix (in lib/notifications.ts): a module-level monotonic counter is
 * appended to the topic so every subscription gets a UNIQUE channel
 * topic — the remount can never collide with the dangling channel. Same
 * pattern as the ENG-794 fix for app/(tabs)/notifications.tsx (see
 * notificationsRealtimeChannelTopic.test.tsx).
 *
 * What this test pins:
 *   1. Two consecutive mounts of the hook call `supabase.channel()` with
 *      DISTINCT topics (regression guard for the static-topic bug).
 *   2. Rapid mount -> unmount -> remount never throws, even when the
 *      first channel is still "live" (removeChannel hasn't drained yet)
 *      — the exact race from the ticket.
 *   3. Each mounted channel is torn down via `removeChannel` on unmount.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

void React;

// ── Realtime channel harness (mirrors notificationsRealtimeChannelTopic.test.tsx) ──
type ChannelState = "open" | "subscribed";
const channelTopics: string[] = [];
const liveTopics = new Set<string>();
const removedTopics: string[] = [];
const removeChannelCalls: { topic: string }[] = [];

function makeChannel(topic: string) {
  let state: ChannelState = "open";
  const channel = {
    topic,
    on(_event: string, _filter: unknown, _cb: unknown) {
      // Real supabase-js rejects adding postgres_changes listeners once
      // the channel has been subscribed. A fresh-topic channel is
      // always "open" here; a reused already-subscribed topic would be
      // "subscribed" and throw — that's the bug we're guarding against.
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

function channelFactory(topic: string) {
  channelTopics.push(topic);
  // Mirror supabase-js: a repeated topic returns the SAME
  // (already-subscribed) channel instance rather than a fresh one. With
  // the fix's unique topics this branch is never hit; without it, the
  // returned channel is in "subscribed" state and `.on()` throws.
  if (liveTopics.has(topic)) {
    return makeAlreadySubscribed(topic);
  }
  return makeChannel(topic);
}

function removeChannelImpl(ch: { topic: string }) {
  removeChannelCalls.push(ch);
  removedTopics.push(ch.topic);
  liveTopics.delete(ch.topic);
  return Promise.resolve("ok");
}

function emptyQuery() {
  const q: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order", "limit"];
  for (const m of methods) q[m] = vi.fn(() => q);
  (q as { then: unknown }).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ count: 0, error: null }).then(onFulfilled);
  return q;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => emptyQuery()),
    channel: vi.fn((topic: string) => channelFactory(topic)),
    removeChannel: vi.fn((ch: { topic: string }) => removeChannelImpl(ch)),
  },
}));

import { useUnreadNotificationsCount } from "../../lib/notifications";

function Probe({ userId }: { userId: string | null }) {
  const unread = useUnreadNotificationsCount(userId);
  return <Text testID="unread-count">{unread}</Text>;
}

beforeEach(() => {
  channelTopics.length = 0;
  liveTopics.clear();
  removedTopics.length = 0;
  removeChannelCalls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useUnreadNotificationsCount — realtime channel topic uniqueness (ENG-1473)", () => {
  it("subscribes a realtime channel on mount and tears it down on unmount", () => {
    const { unmount } = render(<Probe userId="user-eng1473" />);
    expect(channelTopics.length).toBe(1);
    expect(channelTopics[0]).toContain("user-eng1473");

    unmount();
    expect(removeChannelCalls.length).toBe(1);
    expect(removedTopics).toEqual([channelTopics[0]]);
  });

  it("uses a DISTINCT channel topic on a remount (no static-topic collision)", () => {
    const first = render(<Probe userId="user-eng1473" />);
    const firstTopic = channelTopics[0];
    first.unmount();

    const second = render(<Probe userId="user-eng1473" />);
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

  it("does not throw / trip the error boundary on rapid mount -> unmount -> remount", () => {
    // Mount but DELAY teardown: keep the first channel "live" (its topic
    // stays in liveTopics) while we mount a second instance. This is the
    // exact race the ticket describes — an un-awaited removeChannel that
    // hasn't run yet when TodayHeaderBar remounts. With unique topics
    // the second channel never collides, so `.on()` never throws.
    const first = render(<Probe userId="user-eng1473" />);
    liveTopics.add(channelTopics[0]);

    expect(() => {
      const second = render(<Probe userId="user-eng1473" />);
      second.unmount();
    }).not.toThrow();

    first.unmount();
  });

  it("survives several rapid mount/unmount cycles with no throw (stress form of the ticket's regression test)", () => {
    for (let i = 0; i < 5; i += 1) {
      // Simulate the dangling-channel race on every cycle.
      if (channelTopics.length > 0) {
        liveTopics.add(channelTopics[channelTopics.length - 1]);
      }
      expect(() => {
        const { unmount } = render(<Probe userId="user-eng1473" />);
        unmount();
      }).not.toThrow();
    }
    // 5 distinct topics, no collisions.
    expect(new Set(channelTopics).size).toBe(channelTopics.length);
  });

  it("does not open a channel when userId is null", () => {
    const { unmount } = render(<Probe userId={null} />);
    expect(channelTopics.length).toBe(0);
    unmount();
  });
});
