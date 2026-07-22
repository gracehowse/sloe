import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
  TOTAL_STEPS,
  displayPosition,
  resolveNextStep,
  type OnboardingState,
} from "../../src/lib/onboarding/state";

/**
 * ENG-963 — "What's bringing you here?" (`why-now`) onboarding step wiring.
 *
 * Locks the customer-observable + structural behaviour of the new step,
 * which is gated behind the default-OFF `onboarding-why-now` flag:
 *
 *   1. Flag OFF (the live default) auto-skips `why-now` on BOTH forward and
 *      back navigation AND drops it from the displayed step count — so the
 *      live flow + counter are UNCHANGED (the change is mergeable headless).
 *   2. Flag ON inserts `why-now` immediately after `goal`, and counts it in
 *      the displayed total.
 *   3. The field round-trips: `whyNow` is part of `OnboardingState`, so it
 *      survives the provider's localStorage persistence (the same path every
 *      other answer uses) across a remount.
 *   4. The `onboarding-why-now` flag is registered DEFAULT-OFF on BOTH
 *      platforms (web + mobile `KNOWN_DEFAULT_OFF_FLAGS`) — a one-sided
 *      registration would render the step on one platform only.
 */

const baseState = (
  overrides: Partial<OnboardingState> = {},
): OnboardingState => ({
  ...DEFAULT_ONBOARDING_STATE,
  ...overrides,
});

describe("why-now — auto-skip when the flag is OFF (resolveNextStep)", () => {
  const GOAL = STEP_IDS.indexOf("goal");
  const SEX = STEP_IDS.indexOf("sex");

  it("places why-now immediately after goal in STEP_IDS", () => {
    expect(STEP_IDS.indexOf("why-now")).toBe(GOAL + 1);
    expect(STEP_IDS.indexOf("sex")).toBe(STEP_IDS.indexOf("why-now") + 1);
  });

  it("skips why-now when the flag is OFF (default) — goal jumps to sex", () => {
    // No whyNowEnabled → defaults to false → skip.
    const next = resolveNextStep(GOAL, +1, baseState());
    expect(STEP_IDS[next]).toBe("sex");
  });

  it("skips why-now when the flag is explicitly OFF", () => {
    const next = resolveNextStep(GOAL, +1, baseState(), {
      whyNowEnabled: false,
    });
    expect(STEP_IDS[next]).toBe("sex");
  });

  it("skips why-now on backward navigation too (sex → goal with flag OFF)", () => {
    const prev = resolveNextStep(SEX, -1, baseState(), {
      whyNowEnabled: false,
    });
    expect(STEP_IDS[prev]).toBe("goal");
  });

  it("lands on why-now when the flag is ON (goal → why-now)", () => {
    const next = resolveNextStep(GOAL, +1, baseState(), {
      whyNowEnabled: true,
    });
    expect(STEP_IDS[next]).toBe("why-now");
  });

  it("why-now Continue lands on sex when the flag is ON", () => {
    const whyNow = STEP_IDS.indexOf("why-now");
    const next = resolveNextStep(whyNow, +1, baseState(), {
      whyNowEnabled: true,
    });
    expect(STEP_IDS[next]).toBe("sex");
  });
});

describe("why-now — displayed step count (displayPosition)", () => {
  // app-choice is always counted now — its `onboarding-app-choice` flag
  // collapsed out 2026-07-22 (ENG-1651), so `displayPosition` no longer has
  // an `appChoiceEnabled` option to hold "ON" — leaving why-now as the only
  // conditionally-hidden step these assertions need to isolate.
  it("keeps the live step count UNCHANGED when the flag is OFF", () => {
    const { total } = displayPosition(0, {
      whyNowEnabled: false,
      conversionFunnelEnabled: false,
    });
    // why-now + conversion-funnel steps removed from the count → three fewer than raw.
    expect(total).toBe(TOTAL_STEPS - 3);
  });

  it("counts why-now in the total when the flag is ON", () => {
    const { total } = displayPosition(0, {
      whyNowEnabled: true,
      conversionFunnelEnabled: false,
    });
    // why-now visible; upgrade + first-log still hidden when conversion funnel OFF.
    expect(total).toBe(TOTAL_STEPS - 2);
  });

  it("does not shift goal's display index when why-now is hidden (it sits after goal)", () => {
    const goal = STEP_IDS.indexOf("goal");
    // app-choice always counted, so goal is the 3rd visible step regardless of why-now.
    const off = displayPosition(goal, { whyNowEnabled: false });
    const on = displayPosition(goal, { whyNowEnabled: true });
    expect(off.index).toBe(3);
    expect(on.index).toBe(3);
  });

  it("shifts sex's display index by one when why-now is shown vs hidden", () => {
    const sex = STEP_IDS.indexOf("sex");
    const hidden = displayPosition(sex, { whyNowEnabled: false });
    const shown = displayPosition(sex, { whyNowEnabled: true });
    // why-now sits between goal and sex, so showing it bumps sex up by one.
    expect(shown.index).toBe(hidden.index + 1);
  });
});

describe("why-now — persistence round-trips whyNow (web OnboardingProvider)", () => {
  // The provider persists OnboardingState to localStorage on every change
  // and rehydrates it on a fresh mount (no `initial` arg). `whyNow` is a
  // first-class state field, so it must survive the round-trip exactly like
  // every other answer (this is the "persists in persist.ts/state" guard —
  // whyNow is analytics + personalisation state, not a profiles column).
  let OnboardingProvider: typeof import("../../src/app/components/onboarding/context").OnboardingProvider;
  let useOnboarding: typeof import("../../src/app/components/onboarding/context").useOnboarding;

  beforeEach(async () => {
    vi.resetModules();
    // The provider reads the why-now + app-choice flags via isFeatureEnabled;
    // stub the analytics module so the flag reads are deterministic and the
    // PostHog client isn't touched under jsdom.
    vi.doMock("@/lib/analytics/track", () => ({
      isFeatureEnabled: () => false,
      track: vi.fn(),
    }));
    const mod = await import(
      "../../src/app/components/onboarding/context"
    );
    OnboardingProvider = mod.OnboardingProvider;
    useOnboarding = mod.useOnboarding;
    try {
      window.localStorage.clear();
    } catch {
      /* jsdom — non-fatal */
    }
  });

  afterEach(() => {
    vi.doUnmock("@/lib/analytics/track");
  });

  function WhyNowProbe() {
    const { state, set } = useOnboarding();
    return (
      <div>
        <div data-testid="why-now-value">{state.whyNow ?? "null"}</div>
        <button onClick={() => set({ whyNow: "feel-better" })}>set</button>
      </div>
    );
  }

  it("defaults whyNow to null", () => {
    render(
      <OnboardingProvider>
        <WhyNowProbe />
      </OnboardingProvider>,
    );
    expect(screen.getByTestId("why-now-value").textContent).toBe("null");
  });

  it("persists a picked whyNow to localStorage and rehydrates it on remount", () => {
    const first = render(
      <OnboardingProvider>
        <WhyNowProbe />
      </OnboardingProvider>,
    );
    act(() => {
      fireEvent.click(screen.getByText("set"));
    });
    expect(screen.getByTestId("why-now-value").textContent).toBe("feel-better");

    // The persisted blob carries the new field.
    const raw = window.localStorage.getItem("suppr.onboarding-v2.state");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).whyNow).toBe("feel-better");

    // Fresh mount (no `initial`) rehydrates from localStorage.
    first.unmount();
    render(
      <OnboardingProvider>
        <WhyNowProbe />
      </OnboardingProvider>,
    );
    expect(screen.getByTestId("why-now-value").textContent).toBe("feel-better");
  });
});

describe("onboarding-why-now flag registration (ENG-963, default-OFF parity)", () => {
  const ROOT = resolve(__dirname, "../..");
  const WEB_TRACK = readFileSync(
    resolve(ROOT, "src/lib/analytics/track.ts"),
    "utf8",
  );
  const MOBILE_ANALYTICS = readFileSync(
    resolve(ROOT, "apps/mobile/lib/analytics.ts"),
    "utf8",
  );

  function parseBlock(src: string, marker: string, close: string): Set<string> {
    const start = src.indexOf(marker);
    expect(start, `${marker} block`).toBeGreaterThanOrEqual(0);
    const end = src.indexOf(close, start);
    expect(end, `${marker} close`).toBeGreaterThan(start);
    const body = src.slice(start + marker.length, end);
    const flags = new Set<string>();
    for (const m of body.matchAll(/"([a-z0-9_-]+)"/g)) flags.add(m[1]);
    return flags;
  }
  const parseDefaultOn = (src: string) =>
    parseBlock(src, "REDESIGN_DEFAULT_ON = new Set<string>([", "]);");
  const parseDefaultOff = (src: string) =>
    parseBlock(src, "KNOWN_DEFAULT_OFF_FLAGS = [", "] as const;");

  it("is registered DEFAULT-OFF on BOTH platforms", () => {
    expect(
      parseDefaultOff(WEB_TRACK).has("onboarding-why-now"),
      "web KNOWN_DEFAULT_OFF_FLAGS",
    ).toBe(true);
    expect(
      parseDefaultOff(MOBILE_ANALYTICS).has("onboarding-why-now"),
      "mobile KNOWN_DEFAULT_OFF_FLAGS",
    ).toBe(true);
  });

  it("is NOT in either default-ON set (a flag belongs to exactly one default)", () => {
    expect(
      parseDefaultOn(WEB_TRACK).has("onboarding-why-now"),
      "web REDESIGN_DEFAULT_ON",
    ).toBe(false);
    expect(
      parseDefaultOn(MOBILE_ANALYTICS).has("onboarding-why-now"),
      "mobile REDESIGN_DEFAULT_ON",
    ).toBe(false);
  });

  it("the two default-OFF lists remain identical", () => {
    expect([...parseDefaultOff(WEB_TRACK)].sort()).toEqual(
      [...parseDefaultOff(MOBILE_ANALYTICS)].sort(),
    );
  });
});
