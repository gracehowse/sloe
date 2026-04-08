/**
 * Per-view fuzzy QA (Midscene): placeholder / “coming soon” style checks after real login.
 * Run nightly or pre-release: `npm run test:e2e:ai` with Midscene + E2E credentials.
 *
 * Requires: MIDSCENE_MODEL_API_KEY, MIDSCENE_MODEL_NAME, MIDSCENE_MODEL_FAMILY (and usually MIDSCENE_MODEL_BASE_URL).
 * Requires: E2E_EMAIL, E2E_PASSWORD (fully onboarded profile — see tests/e2e/utils/auth.ts).
 */
import { test } from "../fixtures/ai-test";
import { hasE2ECredentials, loginWithTestUser } from "../utils/auth";

const midsceneReady = Boolean(
  process.env.MIDSCENE_MODEL_API_KEY?.trim() &&
    process.env.MIDSCENE_MODEL_NAME?.trim() &&
    process.env.MIDSCENE_MODEL_FAMILY?.trim(),
);

/** In-app `view` values (see navigateToView in src/app/App.tsx). */
const APP_VIEWS = [
  "discover",
  "library",
  "planner",
  "tracker",
  "shopping",
  "settings",
  "profile",
  "upload",
] as const;

test.describe("AI: per-view placeholder / unfinished smoke", () => {
  test.skip(!midsceneReady, "Set MIDSCENE_MODEL_API_KEY, MIDSCENE_MODEL_NAME, MIDSCENE_MODEL_FAMILY (and usually MIDSCENE_MODEL_BASE_URL).");

  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD for authenticated AI journeys.");
  });

  test("each main ?view= surface shows real feature UI, not a whole-page stub", async ({ page, aiWaitFor, aiAssert }) => {
    await loginWithTestUser(page);

    for (const view of APP_VIEWS) {
      await test.step(`view=${view}`, async () => {
        await page.goto(`/?view=${view}`);
        await aiWaitFor("the main content area for this app section has finished loading", { timeoutMs: 30_000 });
        await aiAssert(
          "there is no obvious full-screen 'coming soon', 'under construction', or lorem ipsum placeholder as the primary content; the screen looks like a real app feature with normal controls or copy",
        );
      });
    }
  });
});
