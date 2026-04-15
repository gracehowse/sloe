/**
 * AI-driven checks (Midscene): natural language actions/assertions — closer to exploratory testing.
 *
 * Requires model env (OpenAI-compatible), e.g.:
 *   MIDSCENE_MODEL_BASE_URL=https://api.openai.com/v1
 *   MIDSCENE_MODEL_API_KEY=sk-...
 *   MIDSCENE_MODEL_NAME=gpt-4o
 *   MIDSCENE_MODEL_FAMILY=openai
 *
 * See https://midscenejs.com/model-strategy.html
 *
 * Run: npx playwright test tests/e2e/ai
 * These tests are skipped in CI unless the above are set.
 */
import { expect } from "@playwright/test";
import { test } from "../fixtures/ai-test";

const midsceneReady = Boolean(
  process.env.MIDSCENE_MODEL_API_KEY?.trim() &&
    process.env.MIDSCENE_MODEL_NAME?.trim() &&
    process.env.MIDSCENE_MODEL_FAMILY?.trim(),
);

test.describe("AI: Suppr (Midscene)", () => {
  test.skip(!midsceneReady, "Set MIDSCENE_MODEL_API_KEY, MIDSCENE_MODEL_NAME, MIDSCENE_MODEL_FAMILY (and usually MIDSCENE_MODEL_BASE_URL).");

  test("when I land on login, I can describe what I see in plain language", async ({
    page,
    aiWaitFor,
    aiAssert,
    aiBoolean,
  }) => {
    await page.goto("/login");
    await aiWaitFor("the page shows a form for email and password", { timeoutMs: 20_000 });
    await aiAssert("there is a way to sign in or create an account with email");
    const hasMagicLink = await aiBoolean("is there an option related to magic link or email link sign-in?");
    expect(typeof hasMagicLink).toBe("boolean");
  });

  test("when I open privacy, the page looks like a legal privacy document", async ({ page, aiWaitFor, aiAssert }) => {
    await page.goto("/privacy");
    await aiWaitFor("the privacy policy page has loaded", { timeoutMs: 20_000 });
    await aiAssert("this page is about privacy or data practices for an app or service");
  });
});
