// @vitest-environment jsdom
/**
 * TodayHeaderBar (ENG-1247) — the Today top header: wordmark + notifications
 * bell + avatar. The bell conforms the v3 prototype `.t-head` and closes the
 * web↔mobile parity gap (web had a bell, mobile didn't); the prototype's header
 * calendar is deliberately omitted (the week-strip owns it — Grace 2026-06-28).
 * Guards: the bell + avatar render and wire to the right destinations, and the
 * unread dot shows only when there are unread notifications.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

const { unread } = vi.hoisted(() => ({ unread: { value: 0 } }));
vi.mock("@/lib/notifications", () => ({
  useUnreadNotificationsCount: () => unread.value,
}));

import { TodayHeaderBar } from "../../components/today/TodayHeaderBar";

void React;

function renderBar(overrides?: Partial<React.ComponentProps<typeof TodayHeaderBar>>) {
  const onOpenSettings = vi.fn();
  const onOpenNotifications = vi.fn();
  const utils = render(
    <TodayHeaderBar
      userId="user-1"
      avatarInitial="G"
      onOpenSettings={onOpenSettings}
      onOpenNotifications={onOpenNotifications}
      {...overrides}
    />,
  );
  return { ...utils, onOpenSettings, onOpenNotifications };
}

describe("TodayHeaderBar", () => {
  it("renders the wordmark, bell, and avatar", () => {
    unread.value = 0;
    const { getByTestId } = renderBar();
    expect(getByTestId("today-wordmark")).toBeTruthy();
    expect(getByTestId("today-notifications-bell")).toBeTruthy();
  });

  it("bell press opens notifications; avatar press opens settings", () => {
    unread.value = 0;
    const { getByTestId, getByLabelText, onOpenSettings, onOpenNotifications } = renderBar();
    fireEvent.press(getByTestId("today-notifications-bell"));
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    fireEvent.press(getByLabelText("Open settings"));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows the unread dot only when there are unread notifications", () => {
    unread.value = 0;
    const a = renderBar();
    expect(a.queryByTestId("today-notifications-unread-dot")).toBeNull();
    expect(a.getByLabelText("Notifications")).toBeTruthy();

    unread.value = 3;
    const b = renderBar();
    expect(b.queryByTestId("today-notifications-unread-dot")).toBeTruthy();
    expect(b.getByLabelText("Notifications, 3 unread")).toBeTruthy();
  });
});
