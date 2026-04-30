/**
 * NotificationsBell modal-dismissibility test (audit 2026-04-30).
 *
 * Protects the Escape-key wiring on the bell popover. Mobile already
 * shipped equivalent dismissibility on its bell; web previously had
 * backdrop-only close. This test fails if the ESC handler regresses.
 *
 * `useAppData` is mocked so this doesn't need the full provider.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

void React;

type MockAppData = {
  notificationsInbox: Array<{
    id: string;
    title: string;
    body?: string;
    recipeId?: string;
    createdAt: string;
    readAt?: string | null;
  }>;
  notificationsUnreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
};

const appDataState: { current: MockAppData } = {
  current: {
    notificationsInbox: [],
    notificationsUnreadCount: 0,
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

import { NotificationsBell } from "../../src/app/components/NotificationsBell";

describe("NotificationsBell dismissibility (audit 2026-04-30)", () => {
  it("closes the popover when Escape is pressed", () => {
    appDataState.current = {
      notificationsInbox: [
        {
          id: "n1",
          title: "Test alert",
          createdAt: new Date("2026-04-30T10:00:00Z").toISOString(),
        },
      ],
      notificationsUnreadCount: 1,
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    };

    render(<NotificationsBell onOpenRecipe={vi.fn()} />);

    // Open the popover.
    fireEvent.click(screen.getByLabelText("Notifications"));
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Test alert")).toBeInTheDocument();

    // Press Escape — popover should close.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
    expect(screen.queryByText("Test alert")).not.toBeInTheDocument();
  });

  it("does not register Escape handler when popover is closed", () => {
    appDataState.current = {
      notificationsInbox: [],
      notificationsUnreadCount: 0,
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    };

    render(<NotificationsBell onOpenRecipe={vi.fn()} />);

    // Popover starts closed; Escape is a no-op (no error, nothing renders).
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });
});
