import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  journeyAuthedTestMatch,
  visualAuthedTestMatch,
} from "./playwright/projectPatterns";
import { hasVisualGoldenCredentials } from "./tests/e2e/utils/auth";
import { authFileForBaseUrl, visualAuthFileForBaseUrl } from "./tests/e2e/utils/authHosts";

/** Load `.env.local` for E2E_EMAIL / E2E_PASSWORD (preflight runs in a separate process). */
function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const authFile = authFileForBaseUrl(baseURL);
const visualAuthFile = visualAuthFileForBaseUrl(baseURL);
const hasE2ECredentials = Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim());

/** Public chromium never runs journey or visual authed specs — each has its own project. */
const chromiumIgnore = [...journeyAuthedTestMatch, ...visualAuthedTestMatch];

const useMidsceneReporter = Boolean(process.env.MIDSCENE_MODEL_API_KEY?.trim());
const isCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
/** GitHub Actions starts `next start` on PLAYWRIGHT_BASE_URL (see ci.yml); do not spawn a second server. */
const startWebServerLocally =
  !process.env.CI &&
  !process.env.PLAYWRIGHT_SKIP_WEB_SERVER &&
  !process.env.GITHUB_ACTIONS;
/** Set PLAYWRIGHT_FORCE_FRESH_SERVER=1 to ignore a stale listener on baseURL (preflight should catch zombies first). */
const reuseExistingDevServer =
  startWebServerLocally && process.env.PLAYWRIGHT_FORCE_FRESH_SERVER?.trim() !== "1";

/** CI: GitHub annotations + HTML report for failed-run debugging; Midscene keeps merged reporter. */
const reporters = useMidsceneReporter
  ? [
      ["list"],
      ["@midscene/web/playwright-reporter", { type: "merged" }],
      ...(isCi ? ([["github"]] as const) : []),
    ]
  : isCi
    ? ([
        ["github"],
        ["html", { open: "never" as const }],
        ["list"],
      ] as const)
    : [["list"]];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: useMidsceneReporter ? 120_000 : 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{arg}{ext}",
  retries: process.env.CI ? 2 : 0,
  forbidOnly: isCi,
  fullyParallel: isCi,
  workers: isCi ? undefined : 1,
  reporter: [...reporters],
  /** Local runs: auto-start `next dev` when nothing is listening on `baseURL`. CI uses `ci.yml` + `next start` instead. */
  webServer: startWebServerLocally
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: reuseExistingDevServer,
        timeout: 180_000,
        stdout: "pipe",
        stderr: "pipe",
      }
    : undefined,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    /** Turbopack cold compiles on heavy routes (e.g. /whats-new) can exceed 30s locally. */
    navigationTimeout: isCi ? 30_000 : 60_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: chromiumIgnore,
      use: { ...devices["Desktop Chrome"] },
    },
    ...(hasE2ECredentials
      ? [
          {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
          },
          {
            name: "chromium-authed",
            testMatch: journeyAuthedTestMatch,
            dependencies: ["setup"],
            use: {
              ...devices["Desktop Chrome"],
              storageState: authFile,
            },
          },
        ]
      : []),
    ...(hasVisualGoldenCredentials()
      ? [
          {
            name: "setup-visual",
            testMatch: /auth\.visual-setup\.ts/,
          },
          {
            name: "chromium-visual",
            testMatch: visualAuthedTestMatch,
            dependencies: ["setup-visual"],
            use: {
              ...devices["Desktop Chrome"],
              storageState: visualAuthFile,
            },
          },
        ]
      : []),
  ],
});
