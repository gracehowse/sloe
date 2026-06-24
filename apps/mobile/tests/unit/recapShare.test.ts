// @vitest-environment node

/**
 * shareRecapPng (ENG-1225 #4) — guard branches of the mobile recap share path.
 *
 * This pins the pure decision branches that gate the share: off-iOS → unsupported,
 * and the rasterise guard (null node / empty toDataURL → rasterise_failed). The
 * downstream native glue (expo-file-system `require` → write → RN `Share.share`)
 * is intentionally NOT unit-tested here: it depends on a dynamic
 * `require("expo-file-system/legacy")` that vitest does not intercept (the real
 * native module resolves instead), and on the iOS Share sheet — both are
 * exercised on-device, not in node. So this is the unit-testable surface; it is
 * NOT a deferred gap.
 *
 * (Previously `weeklyRecapCard.test.tsx` claimed the whole share path was
 * "covered by recapShare separately" — that claim is corrected there to match
 * this scope.)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const platformState = { os: "ios" as string };

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformState.os;
    },
  },
  Share: { share: () => Promise.resolve() },
}));

import { shareRecapPng } from "../../lib/recapShare";

const okNode = () => ({ toDataURL: (cb: (b: string) => void) => cb("BASE64PNGDATA") });

beforeEach(() => {
  platformState.os = "ios";
});

describe("shareRecapPng — guard branches", () => {
  it("is unsupported off iOS", async () => {
    platformState.os = "android";
    const r = await shareRecapPng(okNode() as never);
    expect(r).toEqual({
      ok: false,
      reason: "unsupported",
      message: expect.any(String),
    });
  });

  it("rasterise_failed when the svg node is null", async () => {
    const r = await shareRecapPng(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("rasterise_failed");
  });

  it("rasterise_failed when toDataURL yields an empty string", async () => {
    const r = await shareRecapPng({
      toDataURL: (cb: (b: string) => void) => cb(""),
    } as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("rasterise_failed");
  });
});
