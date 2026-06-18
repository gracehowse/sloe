import type { Browser, Page } from "@playwright/test";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

export const AUTH_STATE_FRESH_MS = 30 * 60 * 1000;

type RefreshAuthStateInput = {
  browser: Browser;
  origin: string;
  file: string;
  login: (page: Page) => Promise<void>;
  freshMs?: number;
};

export async function refreshAuthState({
  browser,
  origin,
  file,
  login,
  freshMs = AUTH_STATE_FRESH_MS,
}: RefreshAuthStateInput): Promise<void> {
  if (existsSync(file)) {
    const ageMs = Date.now() - statSync(file).mtimeMs;
    if (ageMs < freshMs) return;
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
