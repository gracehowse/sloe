import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * Fail if axe reports serious or critical violations (common QA proxy for broken/confusing UI).
 */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();

  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length > 0) {
    const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("\n");
    throw new Error(`Serious/critical accessibility violations:\n${summary}`);
  }
}
