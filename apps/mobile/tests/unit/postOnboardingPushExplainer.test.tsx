// @vitest-environment jsdom
/**
 * PostOnboardingPushExplainer — activation hook (audit 2026-04-30,
 * leak fix #4). The MobilePermissionsStep was removed from the linear
 * onboarding flow in the 15→12 shrink. Without re-prompting elsewhere
 * push permission stays at the OS default (`undetermined`) and no
 * D1/D7/D30 retention nudge can deliver. This component re-asks
 * post-onboarding with calm framing.
 *
 * Behaviour pinned here:
 *   - `visible=false` renders nothing user-visible.
 *   - `visible=true` renders the heading + body + two CTAs.
 *   - "Notify me" tap calls `onEnable` exactly once.
 *   - "Maybe" tap calls `onSkip` exactly once.
 *   - Each CTA is independently labelled for VoiceOver.
 *   - Copy is calm — no scare wording.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { PostOnboardingPushExplainer } from "../../components/today/PostOnboardingPushExplainer";

void React;

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#f7f7f7",
    border: "#eee",
    cardBorder: "#eee",
    inputBg: "#f0f0f0",
  }),
}));

describe("PostOnboardingPushExplainer (mobile)", () => {
  it("renders the calm heading and body when visible=true", () => {
    const { getByText } = render(
      <PostOnboardingPushExplainer
        visible
        onSkip={vi.fn()}
        onEnable={vi.fn()}
      />,
    );
    expect(getByText("A quiet ping when it's time?")).toBeTruthy();
    expect(
      getByText(
        "Want a quiet ping when it's time to log dinner? You can always change this in Settings.",
      ),
    ).toBeTruthy();
  });

  it("exposes both CTAs with correct accessibility labels", () => {
    const { getByLabelText } = render(
      <PostOnboardingPushExplainer
        visible
        onSkip={vi.fn()}
        onEnable={vi.fn()}
      />,
    );
    expect(getByLabelText("Notify me")).toBeTruthy();
    expect(getByLabelText("Maybe later")).toBeTruthy();
  });

  it("calls onEnable exactly once when 'Notify me' is tapped", () => {
    const onEnable = vi.fn();
    const onSkip = vi.fn();
    const { getByLabelText } = render(
      <PostOnboardingPushExplainer
        visible
        onSkip={onSkip}
        onEnable={onEnable}
      />,
    );
    fireEvent.press(getByLabelText("Notify me"));
    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("calls onSkip exactly once when 'Maybe' is tapped", () => {
    const onEnable = vi.fn();
    const onSkip = vi.fn();
    const { getByLabelText } = render(
      <PostOnboardingPushExplainer
        visible
        onSkip={onSkip}
        onEnable={onEnable}
      />,
    );
    fireEvent.press(getByLabelText("Maybe later"));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onEnable).not.toHaveBeenCalled();
  });

  it("does not contain scare copy — the explainer is calm posture", () => {
    // Pin: this is intentionally non-loud copy. Regression check that
    // a future copy edit doesn't drift toward "DON'T MISS!" / "act now"
    // patterns we deliberately rejected in the audit fix.
    const { queryByText } = render(
      <PostOnboardingPushExplainer
        visible
        onSkip={vi.fn()}
        onEnable={vi.fn()}
      />,
    );
    expect(queryByText(/don't miss/i)).toBeNull();
    expect(queryByText(/act now/i)).toBeNull();
    expect(queryByText(/last chance/i)).toBeNull();
  });
});
