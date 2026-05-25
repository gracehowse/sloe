import { test as setup } from "@playwright/test";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { hasE2ECredentials, loginWithTestUser } from "./utils/auth";

const authFile = resolve(process.cwd(), "tests/e2e/.auth/user.json");

setup.describe.configure({ retries: 2 });

setup("authenticate E2E user", async ({ page }) => {
  setup.skip(!hasE2ECredentials(), "E2E_EMAIL and E2E_PASSWORD required");
  if (existsSync(authFile)) {
    const ageMs = Date.now() - statSync(authFile).mtimeMs;
    if (ageMs < 30 * 60 * 1000) return;
  }
  await loginWithTestUser(page);
  mkdirSync(dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
