import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  IMPORT_VERIFY_HELP,
  IN_APP_HELP_IMPORT_FLAG,
} from "../../src/lib/help/importLoopHints.ts";

describe("ENG-1597 import-loop help", () => {
  it("ships a non-empty verify topic behind the documented flag name", () => {
    expect(IN_APP_HELP_IMPORT_FLAG).toBe("in_app_help_import_v1");
    expect(IMPORT_VERIFY_HELP.title.length).toBeGreaterThan(0);
    expect(IMPORT_VERIFY_HELP.bullets.length).toBeGreaterThanOrEqual(3);
  });

  it("web verify modal + mobile verify screen mount ContextualHelpHint", () => {
    const web = readFileSync(
      resolve("src/app/components/suppr/recipe-verify-modal.tsx"),
      "utf8",
    );
    const mobile = readFileSync(resolve("apps/mobile/app/recipe/verify.tsx"), "utf8");
    expect(web).toContain("ContextualHelpHint");
    expect(web).toContain("IMPORT_VERIFY_HELP");
    expect(mobile).toContain("ContextualHelpHint");
    expect(mobile).toContain("IMPORT_VERIFY_HELP");
  });
});
