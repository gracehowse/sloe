import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fdcConfigFromEnv } from "@/lib/usda/fdcClient";

describe("fdcConfigFromEnv", () => {
  let prevKey: string | undefined;

  beforeEach(() => {
    prevKey = process.env.USDA_FDC_API_KEY;
  });

  afterEach(() => {
    if (prevKey === undefined) {
      delete process.env.USDA_FDC_API_KEY;
    } else {
      process.env.USDA_FDC_API_KEY = prevKey;
    }
  });

  it("returns the USDA FDC API key from env", () => {
    process.env.USDA_FDC_API_KEY = "test-fdc-key";
    expect(fdcConfigFromEnv()).toEqual({ apiKey: "test-fdc-key" });
  });

  it("throws when USDA_FDC_API_KEY is unset", () => {
    delete process.env.USDA_FDC_API_KEY;
    expect(() => fdcConfigFromEnv()).toThrow(/USDA_FDC_API_KEY/);
  });
});
