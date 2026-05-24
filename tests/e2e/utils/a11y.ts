import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * Fail if axe reports serious or critical violations (common QA proxy for broken/confusing UI).
 * Skipped locally during `next dev` unless `PLAYWRIGHT_STRICT_A11Y=1` — dev overlay and
 * half-wired forms create noise; CI (`next start`) still enforces.
 */
export async function expectNoSeriousA11yViolations(page: Page): Promise<void> {
  const isCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
  if (!isCi && !process.env.PLAYWRIGHT_STRICT_A11Y?.trim()) {
    return;
  }
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();

  const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length > 0) {
    const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("\n");
    throw new Error(`Serious/critical accessibility violations:\n${summary}`);
  }
}
