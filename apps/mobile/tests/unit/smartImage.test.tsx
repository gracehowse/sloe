// @vitest-environment jsdom
/**
 * ENG-685 — SmartImage flag-gated wrapper.
 *
 * OFF (default): verbatim RN Image (resizeMode, no expo-image props) — the
 * kill switch with zero visual change. ON: expo-image with a 200ms fade,
 * memory-disk cache, and a recyclingKey to stop recycled rows flashing a
 * stale photo. Both paths drive the caller's onError → fallback.
 *
 * (The expo-image shim re-exports the RN host Image, so both paths resolve to
 * one Image type; the two paths are told apart by the forwarded props.)
 */
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import { Image } from "react-native";

// Drive the flag via a hoisted toggle (mirrors isFeatureDisabled.test.ts).
const flags = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (f: string) => flags.enabled && f === "expo_image_adoption_v1",
  isFeatureDisabled: () => false,
}));

import { SmartImage } from "../../components/ui/SmartImage";

void React;

beforeEach(() => {
  flags.enabled = false;
});

describe("SmartImage (ENG-685)", () => {
  it("flag OFF → verbatim RN Image (resizeMode, no expo-image props)", () => {
    flags.enabled = false;
    const { UNSAFE_getByType } = render(
      <SmartImage source={{ uri: "https://x/y.jpg" }} style={{ width: 10, height: 10 }} resizeMode="cover" />,
    );
    const img = UNSAFE_getByType(Image);
    expect(img.props.resizeMode).toBe("cover");
    expect(img.props.contentFit).toBeUndefined();
    expect(img.props.transition).toBeUndefined();
  });

  it("flag ON → expo-image with fade + memory-disk cache + recyclingKey", () => {
    flags.enabled = true;
    const { UNSAFE_getByType } = render(
      <SmartImage source={{ uri: "https://x/y.jpg" }} resizeMode="cover" recyclingKey="r1" />,
    );
    const img = UNSAFE_getByType(Image);
    expect(img.props.contentFit).toBe("cover");
    expect(img.props.transition).toBe(200);
    expect(img.props.cachePolicy).toBe("memory-disk");
    expect(img.props.recyclingKey).toBe("r1");
    expect(img.props.resizeMode).toBeUndefined();
  });

  it("flag ON → recyclingKey defaults to the source uri", () => {
    flags.enabled = true;
    const { UNSAFE_getByType } = render(<SmartImage source={{ uri: "https://x/z.jpg" }} />);
    expect(UNSAFE_getByType(Image).props.recyclingKey).toBe("https://x/z.jpg");
  });

  it("calls onError on load failure (drives the caller's fallback) in both paths", () => {
    for (const on of [false, true]) {
      flags.enabled = on;
      const onError = vi.fn();
      const { UNSAFE_getByType } = render(
        <SmartImage source={{ uri: "https://x/broken.jpg" }} onError={onError} />,
      );
      fireEvent(UNSAFE_getByType(Image), "error");
      expect(onError).toHaveBeenCalledTimes(1);
    }
  });
});
