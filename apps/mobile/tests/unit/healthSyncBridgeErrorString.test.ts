import { describe, expect, it } from "vitest";
import { stringifyBridgeUnknown } from "@/lib/healthSyncBridgeString";

describe("stringifyBridgeUnknown (HealthKit RCT errors)", () => {
  it("stringifies plain object NSError shape instead of [object Object]", () => {
    const err = { message: "Authorization failed", code: 5, domain: "com.apple.healthkit" };
    expect(stringifyBridgeUnknown(err)).toContain("Authorization failed");
    expect(stringifyBridgeUnknown(err)).not.toContain("[object Object]");
  });

  it("passes through strings", () => {
    expect(stringifyBridgeUnknown("user cancelled")).toBe("user cancelled");
  });

  it("uses Error.message when normal", () => {
    expect(stringifyBridgeUnknown(new Error("init failed"))).toBe("init failed");
  });

  it("JSON-falls back for empty object", () => {
    expect(stringifyBridgeUnknown({})).toBe("{}");
  });
});
