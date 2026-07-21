/**
 * Today premium sprint — full state-matrix captures (ENG-575).
 *
 * Prerequisite:
 *   npx tsx scripts/e2e-seed-today-premium-matrix.ts
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
 *     npx playwright test tests/e2e/screenshots/today-premium-2026-05-19.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  hasE2ECredentials,
  hasSupabaseServiceRoleForSeed,
  loginWithTestUser,
} from "../utils/auth";

const canRunPremiumMatrix = hasE2ECredentials() && hasSupabaseServiceRoleForSeed();

const OUTPUT_DIR = join(
  process.cwd(),
  "docs/ux/captures/today-premium-2026-05-19",
);

mkdirSync(OUTPUT_DIR, { recursive: true });

/** Mirrors scripts/e2e-seed-today-premium-matrix.ts */
const OFFSETS = {
  empty: -14,
  oneMeal: -2,
  overBudget: -7,
  deficit: -6,
  eatAgainToday: 0,
} as const;

type MatrixState =
  | "empty-day"
  | "one-meal"
  | "active-fast"
  | "eat-again"
  | "deficit-insight"
  | "over-budget";

const STATE_OFFSET: Record<MatrixState, number> = {
  "empty-day": OFFSETS.empty,
  "one-meal": OFFSETS.oneMeal,
  "active-fast": OFFSETS.eatAgainToday,
  "eat-again": OFFSETS.eatAgainToday,
  "deficit-insight": OFFSETS.deficit,
  "over-budget": OFFSETS.overBudget,
};

function loadEnvLocal(): void {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function todayKeyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayDiff(fromKey: string, toKey: string): number {
  const a = parseKey(fromKey).getTime();
  const b = parseKey(toKey).getTime();
  return Math.round((b - a) / 86_400_000);
}

// `isVisible({ timeout })` doesn't wait — Playwright's own types mark that
// option deprecated/ignored ("returns immediately") — so a check called
// right after `page.goto(..., { waitUntil: "domcontentloaded" })` races
// hydration and silently no-ops before these one-shot overlays have
// mounted, leaking them into the capture instead of dismissing them
// (2026-07-21, same failure class as tests/e2e/utils/visual.ts's
// dismissVisualOverlays). `waitFor({ state: "visible" })` genuinely retries.
async function dismissChrome(page: Page): Promise<void> {
  const accept = page.getByRole("button", { name: /accept all/i });
  const hasAccept = await accept
    .waitFor({ state: "visible", timeout: 2500 })
    .then(() => true)
    .catch(() => false);
  if (hasAccept) {
    await accept.click();
  }
  // ENG-633 — suppress first-run completion toast noise on Today captures.
  await page.evaluate(() => {
    localStorage.setItem("suppr-checklist-toast-shown", "1");
  });
  const milestone = page.getByRole("dialog");
  const hasMilestone = await milestone
    .waitFor({ state: "visible", timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (hasMilestone) {
    const keep = milestone.getByRole("button", { name: /keep going/i });
    const hasKeep = await keep
      .waitFor({ state: "visible", timeout: 800 })
      .then(() => true)
      .catch(() => false);
    if (hasKeep) {
      await keep.click();
    } else {
      await milestone.getByRole("button", { name: /^close$/i }).click();
    }
    await expect(milestone).toBeHidden({ timeout: 5000 });
  }
}

async function goToToday(page: Page): Promise<void> {
  await page.goto("/today", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await dismissChrome(page);
  // Desktop Today uses a formatted date in `<h1>` (not the literal "Today"
  // string). Mobile-web calm nav still renders "Today" when viewing today.
  const ready = page
    .locator('input[type="date"]')
    .or(page.getByText(/^MEALS$/i))
    .or(page.locator("h1").filter({ hasText: /^Today$/i }));
  await expect(ready.first()).toBeVisible({ timeout: 30_000 });
}

function targetDateKey(offsetFromToday: number): string {
  const target = new Date();
  target.setDate(target.getDate() + offsetFromToday);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

async function navigateDayOffset(page: Page, offsetFromToday: number): Promise<void> {
  const today = todayKeyLocal();
  const targetKey = targetDateKey(offsetFromToday);
  if (dayDiff(today, targetKey) === 0) return;

  await dismissChrome(page);
  const dateInput = page.locator('input[type="date"]');
  await dateInput.fill(targetKey);
  await expect(dateInput).toHaveValue(targetKey, { timeout: 10_000 });
  await page.waitForTimeout(500);
}

async function captureState(
  page: Page,
  state: MatrixState,
  platform: "mobile-web" | "desktop",
  theme: "light" | "dark",
): Promise<void> {
  await goToToday(page);
  await navigateDayOffset(page, STATE_OFFSET[state]);
  if (state === "eat-again") {
    await page.evaluate(() => {
      localStorage.removeItem("suppr-eat-again-dismissed-v2");
      localStorage.removeItem("suppr-eat-again-dismissed");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await dismissChrome(page);
    await expect(
      page
        .locator('input[type="date"]')
        .or(page.getByText(/^MEALS$/i))
        .or(page.locator("h1").filter({ hasText: /^Today$/i }))
        .first(),
    ).toBeVisible({
      timeout: 30_000,
    });
    await navigateDayOffset(page, STATE_OFFSET[state]);
  }
  await dismissChrome(page);
  await page.waitForTimeout(1200);
  const path = join(OUTPUT_DIR, `${state}-${platform}-${theme}.png`);
  await page.screenshot({ path, fullPage: platform === "mobile-web" });
}

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("today premium matrix — mobile 390×844", () => {
  test.skip(
    !canRunPremiumMatrix,
    "E2E_EMAIL + E2E_PASSWORD + SUPABASE_SERVICE_ROLE_KEY required for premium matrix seed",
  );

  for (const theme of ["light", "dark"] as const) {
    test.describe(`${theme} mobile`, () => {
      test.use({
        viewport: { width: 390, height: 844 },
        colorScheme: theme,
      });

      test.beforeAll(() => {
        loadEnvLocal();
        execSync("npx tsx scripts/e2e-seed-today-premium-matrix.ts", {
          cwd: process.cwd(),
          stdio: "inherit",
          env: process.env,
        });
      });

      test.beforeEach(async ({ page }) => {
        await loginWithTestUser(page);
      });

      for (const state of [
        "empty-day",
        "one-meal",
        "deficit-insight",
        "over-budget",
        "eat-again",
      ] as const) {
        test(state, async ({ page }) => {
          test.setTimeout(120_000);
          await captureState(page, state, "mobile-web", theme);
        });
      }

      test("active-fast", async ({ page }) => {
        test.setTimeout(120_000);
        execSync(
          "npx tsx scripts/e2e-seed-today-premium-matrix.ts --activate-fast",
          { cwd: process.cwd(), stdio: "inherit", env: process.env },
        );
        await captureState(page, "active-fast", "mobile-web", theme);
        execSync("npx tsx scripts/e2e-seed-today-premium-matrix.ts", {
          cwd: process.cwd(),
          stdio: "inherit",
          env: process.env,
        });
      });
    });
  }
});

test.describe("today premium matrix — desktop 1440", () => {
  test.skip(
    !canRunPremiumMatrix,
    "E2E_EMAIL + E2E_PASSWORD + SUPABASE_SERVICE_ROLE_KEY required for premium matrix seed",
  );

  test.use({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });

  test.beforeAll(() => {
    loadEnvLocal();
    execSync("npx tsx scripts/e2e-seed-today-premium-matrix.ts", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  });

  test.beforeEach(async ({ page }) => {
    await loginWithTestUser(page);
  });

  for (const state of [
    "empty-day",
    "one-meal",
    "deficit-insight",
    "eat-again",
    "over-budget",
  ] as const) {
    test(`desktop light — ${state}`, async ({ page }) => {
      test.setTimeout(120_000);
      await captureState(page, state, "desktop", "light");
    });
  }

  test("desktop light — active-fast", async ({ page }) => {
    test.setTimeout(120_000);
    execSync("npx tsx scripts/e2e-seed-today-premium-matrix.ts --activate-fast", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
    await captureState(page, "active-fast", "desktop", "light");
    execSync("npx tsx scripts/e2e-seed-today-premium-matrix.ts", {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
  });
});
