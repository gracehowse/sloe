import { describe, expect, it } from "vitest";

import {
  IMPORT_SAVE_FIRST_FLAG,
  IMPORT_SAVE_FIRST_REVIEW_BANNER,
  IMPORT_SAVE_FIRST_UPDATE_CTA,
} from "../../src/lib/recipes/importSaveFirst";

describe("ENG-980 — import save-first SSOT", () => {
  it("uses a stable feature flag name", () => {
    expect(IMPORT_SAVE_FIRST_FLAG).toBe("import-save-first-v1");
  });

  it("surfaces library-first review copy", () => {
    expect(IMPORT_SAVE_FIRST_REVIEW_BANNER.label).toContain("library");
    expect(IMPORT_SAVE_FIRST_UPDATE_CTA).toBe("Update in library");
  });
});
