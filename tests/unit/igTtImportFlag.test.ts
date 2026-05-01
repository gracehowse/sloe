/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isIgTtImportEnabled } from "@/lib/featureFlags/igTtImport";

describe("isIgTtImportEnabled", () => {
  beforeEach(() => {
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when the env var is unset", () => {
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "");
    expect(isIgTtImportEnabled()).toBe(false);
  });

  it("returns false for any value other than the literal string 'true'", () => {
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "1");
    expect(isIgTtImportEnabled()).toBe(false);
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "TRUE");
    expect(isIgTtImportEnabled()).toBe(false);
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "yes");
    expect(isIgTtImportEnabled()).toBe(false);
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "on");
    expect(isIgTtImportEnabled()).toBe(false);
  });

  it("returns true only when the env var is the literal string 'true'", () => {
    vi.stubEnv("IG_TT_IMPORT_ENABLED", "true");
    expect(isIgTtImportEnabled()).toBe(true);
  });
});
