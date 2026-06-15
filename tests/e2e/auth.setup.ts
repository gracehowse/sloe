import { test as setup } from "@playwright/test";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { hasE2ECredentials, loginWithTestUser } from "./utils/auth";
import { QA_AUTH_HOSTS } from "./utils/authHosts";

setup.describe.configure({ retries: 2 });

const FRESH_MS = 30 * 60 * 1000;

setup("authenticate E2E user (127.0.0.1 + localhost)", async ({ browser }) => {
  setup.skip(!hasE2ECredentials(), "E2E_EMAIL and E2E_PASSWORD required");

  for (const { origin, file } of QA_AUTH_HOSTS) {
    if (existsSync(file)) {
      const ageMs = Date.now() - statSync(file).mtimeMs;
      if (ageMs < FRESH_MS) continue;
    }

    const context = await browser.newContext({ baseURL: origin });
    const page = await context.newPage();
    try {
      await loginWithTestUser(page);
      mkdirSync(dirname(file), { recursive: true });
      await context.storageState({ path: file });
    } finally {
      await context.close();
    }
  }
});
