/**
 * DrOutageBanner (web) — disaster-recovery kill-switch banner.
 *
 * Pins:
 *   1. Default-OFF — nothing renders when `dr-full-outage-banner` is off
 *      (so it can't leak into the normal app).
 *   2. Flag ON, no payload → safe default copy renders in an alert.
 *   3. Flag ON, payload { title, body } → PostHog-driven copy renders
 *      (so the message is editable without a deploy).
 *
 * Mobile parity: apps/mobile/tests/unit/drOutageBanner.test.tsx.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { DrOutageBanner } from "../../src/app/components/ops/DrOutageBanner";
import {
  isFeatureEnabled,
  getFeatureFlagPayload,
} from "../../src/lib/analytics/track.ts";

void React;

vi.mock("posthog-js", () => ({
  default: { onFeatureFlags: vi.fn(() => () => {}) },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  isFeatureEnabled: vi.fn(() => false),
  getFeatureFlagPayload: vi.fn(() => null),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;
const payloadFn = getFeatureFlagPayload as unknown as ReturnType<typeof vi.fn>;

describe("DrOutageBanner (web)", () => {
  beforeEach(() => {
    flagFn.mockReset();
    payloadFn.mockReset();
    payloadFn.mockReturnValue(null);
  });

  it("renders nothing when the kill-switch flag is off", () => {
    flagFn.mockReturnValue(false);
    render(<DrOutageBanner />);
    expect(screen.queryByTestId("dr-outage-banner")).toBeNull();
  });

  it("renders the safe default copy when the flag is on and no payload is set", () => {
    flagFn.mockReturnValue(true);
    render(<DrOutageBanner />);
    const banner = screen.getByTestId("dr-outage-banner");
    expect(banner).toBeTruthy();
    expect(banner.getAttribute("role")).toBe("alert");
    expect(banner.textContent).toContain("status.suppr.club");
  });

  it("renders PostHog payload copy (title + body) when provided", () => {
    flagFn.mockReturnValue(true);
    payloadFn.mockReturnValue({
      title: "Restoring data",
      body: "Back online within the hour.",
    });
    render(<DrOutageBanner />);
    const banner = screen.getByTestId("dr-outage-banner");
    expect(banner.textContent).toContain("Restoring data");
    expect(banner.textContent).toContain("Back online within the hour.");
  });

  it("accepts a plain-string payload as the body", () => {
    flagFn.mockReturnValue(true);
    payloadFn.mockReturnValue("Custom incident message");
    render(<DrOutageBanner />);
    expect(screen.getByTestId("dr-outage-banner").textContent).toContain(
      "Custom incident message",
    );
  });
});
