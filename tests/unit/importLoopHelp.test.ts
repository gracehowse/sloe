/**
 * ENG-1597 — contextual help wiring + registry.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CONTEXTUAL_HELP_FLAG,
  CONTEXTUAL_HELP_REGISTRY,
} from "../../src/lib/help/contextualHelp.ts";

describe("ENG-1597 contextual help", () => {
  it("uses the umbrella flag name on both platforms", () => {
    expect(CONTEXTUAL_HELP_FLAG).toBe("contextual_help_v1");
  });

  it("ships a non-empty verify topic in the shared registry", () => {
    const topic = CONTEXTUAL_HELP_REGISTRY["verify.why_verify"];
    expect(topic.title.length).toBeGreaterThan(0);
    expect(topic.paragraphs.length).toBeGreaterThanOrEqual(3);
  });

  it("web verify modal + mobile verify screen mount ContextualHelpHint", () => {
    const web = readFileSync(
      resolve("src/app/components/suppr/recipe-verify-modal.tsx"),
      "utf8",
    );
    const mobile = readFileSync(resolve("apps/mobile/app/recipe/verify.tsx"), "utf8");
    expect(web).toContain("ContextualHelpHint");
    expect(web).toContain('topicId="verify.why_verify"');
    expect(mobile).toContain("ContextualHelpHint");
    expect(mobile).toContain('topicId="verify.why_verify"');
  });
});
