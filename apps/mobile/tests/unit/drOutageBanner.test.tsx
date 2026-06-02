// @vitest-environment jsdom
/**
 * DrOutageBanner (mobile) — disaster-recovery kill-switch banner.
 *
 * Mobile mirror of web's DrOutageBanner. Pins:
 *   1. Default-OFF — nothing renders when `dr-full-outage-banner` is off.
 *   2. Flag ON, no payload → safe default copy in an alert.
 *   3. Flag ON, payload → PostHog-driven copy (editable without a release).
 *
 * Web parity: tests/unit/drOutageBanner.test.tsx.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react-native";

import { DrOutageBanner } from "../../components/ops/DrOutageBanner";
import { isFeatureEnabled, getFeatureFlagPayload } from "@/lib/analytics";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
  getFeatureFlagPayload: vi.fn(() => null),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;
const payloadFn = getFeatureFlagPayload as unknown as ReturnType<typeof vi.fn>;

describe("DrOutageBanner (mobile)", () => {
  beforeEach(() => {
    flagFn.mockReset();
    payloadFn.mockReset();
    payloadFn.mockReturnValue(null);
  });

  it("renders nothing when the kill-switch flag is off", () => {
    flagFn.mockReturnValue(false);
    const { queryByTestId } = render(<DrOutageBanner />);
    expect(queryByTestId("dr-outage-banner")).toBeNull();
  });

  it("renders the safe default copy when the flag is on", () => {
    flagFn.mockReturnValue(true);
    const { getByTestId } = render(<DrOutageBanner />);
    expect(getByTestId("dr-outage-banner")).toBeTruthy();
  });

  it("renders PostHog payload copy when provided", () => {
    flagFn.mockReturnValue(true);
    payloadFn.mockReturnValue({ title: "Restoring data", body: "Back soon." });
    const { getByText } = render(<DrOutageBanner />);
    expect(getByText(/Restoring data/)).toBeTruthy();
    expect(getByText(/Back soon\./)).toBeTruthy();
  });
});
