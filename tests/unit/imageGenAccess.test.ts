import { describe, expect, it } from "vitest";

import {
  IMAGE_GEN_ABUSE_GUARD_DAILY,
  imageGenAbuseGuardDailyLimit,
  isRegenerateImageGenRequest,
  requiresProForImageGen,
} from "@/lib/recipes/imageGenAccess";

describe("imageGenAccess (ENG-865)", () => {
  it("treats remove as never regenerate", () => {
    expect(isRegenerateImageGenRequest({ image_source: "ai_generated" }, { remove: true })).toBe(false);
    expect(requiresProForImageGen("free", { image_source: "ai_generated" }, { remove: true })).toBe(false);
  });

  it("treats explicit regenerate and existing ai_generated heroes as regenerate", () => {
    expect(isRegenerateImageGenRequest({ image_source: null }, { regenerate: true })).toBe(true);
    expect(isRegenerateImageGenRequest({ image_source: "ai_generated" }, {})).toBe(true);
    expect(isRegenerateImageGenRequest({ image_source: "user_upload" }, {})).toBe(false);
  });

  it("allows free first base gen but gates regenerate on Pro", () => {
    expect(requiresProForImageGen("free", { image_source: null }, {})).toBe(false);
    expect(requiresProForImageGen("free", { image_source: "user_upload" }, {})).toBe(false);
    expect(requiresProForImageGen("free", { image_source: "ai_generated" }, {})).toBe(true);
    expect(requiresProForImageGen("free", { image_source: null }, { regenerate: true })).toBe(true);
    expect(requiresProForImageGen("pro", { image_source: "ai_generated" }, { regenerate: true })).toBe(false);
    expect(requiresProForImageGen("base", { image_source: "ai_generated" }, {})).toBe(true);
  });

  it("defaults abuse guard to 25/day", () => {
    expect(IMAGE_GEN_ABUSE_GUARD_DAILY).toBe(25);
    expect(imageGenAbuseGuardDailyLimit()).toBe(25);
  });
});
