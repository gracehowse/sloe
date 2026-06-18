import { test as setup } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import {
  hasE2ECredentials,
  hasVisualGoldenCredentials,
  loginWithTestUser,
  loginWithVisualGoldenUser,
} from "./utils/auth";
import { QA_AUTH_HOSTS, QA_VISUAL_AUTH_HOSTS } from "./utils/authHosts";

setup.describe.configure({ retries: 2 });

const FRESH_MS = 30 * 60 * 1000;

setup("authenticate E2E users (127.0.0.1 + localhost)", async ({ browser }) => {
  setup.skip(
    !hasE2ECredentials() && !hasVisualGoldenCredentials(),
    "E2E or visual-golden credentials required",
  );

  if (hasE2ECredentials()) {
    for (const { origin, file } of QA_AUTH_HOSTS) {
      await refreshAuthState({ browser, origin, file, login: loginWithTestUser });
    }
  }

  if (hasVisualGoldenCredentials()) {
    for (const { origin, file } of QA_VISUAL_AUTH_HOSTS) {
      await refreshAuthState({ browser, origin, file, login: loginWithVisualGoldenUser });
    }
  }
});

type RefreshAuthStateInput = {
  browser: Browser;
  origin: string;
  file: string;
  login: (page: Page) => Promise<void>;
};

async function refreshAuthState({ browser, origin, file, login }: RefreshAuthStateInput): Promise<void> {
  if (existsSync(file)) {
    const ageMs = Date.now() - statSync(file).mtimeMs;
    if (ageMs < FRESH_MS) return;
  }

  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  try {
    await login(page);
    mkdirSync(dirname(file), { recursive: true });
    await context.storageState({ path: file });
  } finally {
    await context.close();
  }
}
