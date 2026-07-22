/**
 * ENG-1642 — `/m/<token>` landing page (`MealShareLandingClient`) component
 * tests. Covers the piece with no pure-function unit-test equivalent: the
 * "Open in app" `suppr://meal-shared?token=…` handoff link, which only
 * renders for a mobile user agent, and the signed-in vs signed-out CTA
 * split. `mealShareLink.ts` / `mealShareClient.ts`'s own logic (serializer,
 * RPC client, localStorage helpers) is covered in their own test files —
 * this file only exercises what's unique to the page component.
 *
 * Why the "Open in app" link matters enough to pin: without it, the native
 * accept screen (`apps/mobile/app/meal-shared.tsx`) has NO entry point at
 * all — `buildMobileMealShareUrl` always shares an `https://` URL (no
 * universal links / associatedDomains yet, deliberately out of scope), so
 * this link is the only way a mobile visitor ever reaches the native
 * screen instead of the web accept flow.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

void React;

const getSessionMock = vi.fn();
const rpcMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: () => false,
}));

vi.mock("../../src/lib/supabase/browserClient", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: { getSession: (...args: unknown[]) => getSessionMock(...args) },
  },
}));

import { MealShareLandingClient } from "../../app/m/[token]/MealShareLandingClient";

const VALID_TOKEN = "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4";

function mockOkShare(overrides: Partial<Record<string, unknown>> = {}) {
  rpcMock.mockResolvedValue({
    data: {
      status: "ok",
      title: "Chicken salad",
      meal_slot: "Lunch",
      items: [{ recipe_title: "Chicken salad", calories: 420, protein: 38, carbs: 20, fat: 18 }],
      shared_by: "Grace",
      created_at: "2026-07-22T09:00:00Z",
      ...overrides,
    },
    error: null,
  });
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

describe("MealShareLandingClient — Open in app handoff (ENG-1642)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getSessionMock.mockReset();
    pushMock.mockReset();
    setUserAgent(DESKTOP_UA);
  });

  afterEach(() => {
    cleanup();
    setUserAgent(DESKTOP_UA);
  });

  it("does not render 'Open in app' on a desktop user agent", async () => {
    mockOkShare();
    getSessionMock.mockResolvedValue({ data: { session: null } });
    render(<MealShareLandingClient token={VALID_TOKEN} />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Chicken salad" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: /open in the sloe app/i })).not.toBeInTheDocument();
  });

  it("renders 'Open in app' linking to the suppr:// scheme on a mobile user agent", async () => {
    setUserAgent(IOS_UA);
    mockOkShare();
    getSessionMock.mockResolvedValue({ data: { session: null } });
    render(<MealShareLandingClient token={VALID_TOKEN} />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Chicken salad" })).toBeInTheDocument(),
    );
    const link = await screen.findByRole("link", { name: /open in the sloe app/i });
    expect(link.getAttribute("href")).toBe(`suppr://meal-shared?token=${VALID_TOKEN}`);
  });

  it("never renders 'Open in app' in the loading or error states, even on mobile", async () => {
    setUserAgent(IOS_UA);
    rpcMock.mockResolvedValue({ data: { status: "expired" }, error: null });
    getSessionMock.mockResolvedValue({ data: { session: null } });
    render(<MealShareLandingClient token={VALID_TOKEN} />);

    await waitFor(() =>
      expect(screen.getByText(/this link has expired/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("link", { name: /open in the sloe app/i })).not.toBeInTheDocument();
  });
});

describe("MealShareLandingClient — signed-in vs signed-out CTA split", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    getSessionMock.mockReset();
    pushMock.mockReset();
    setUserAgent(DESKTOP_UA);
  });

  afterEach(() => cleanup());

  it("signed in: shows the single 'Add to my log' CTA, no signup/login buttons", async () => {
    mockOkShare();
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    render(<MealShareLandingClient token={VALID_TOKEN} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add to my log/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /join sloe/i })).not.toBeInTheDocument();
  });

  it("signed out: shows sign-up + login CTAs, not 'Add to my log'", async () => {
    mockOkShare();
    getSessionMock.mockResolvedValue({ data: { session: null } });
    render(<MealShareLandingClient token={VALID_TOKEN} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /join sloe and add it/i })).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /i already have an account/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^add to my log$/i })).not.toBeInTheDocument();
  });
});
