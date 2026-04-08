import { test as base } from "@playwright/test";
import type { PlayWrightAiFixtureType } from "@midscene/web/playwright";
import { PlaywrightAiFixture } from "@midscene/web/playwright";

/**
 * Playwright test extended with Midscene AI helpers (`aiAct`, `aiAssert`, …).
 * Use only in `tests/e2e/ai/**`; keep deterministic tests on the base `test` import.
 */
export const test = base.extend<PlayWrightAiFixtureType>(PlaywrightAiFixture({ waitForNetworkIdleTimeout: 3000 }));

export { expect } from "@playwright/test";
