import { defineConfig, devices } from "@playwright/test";

const useMidsceneReporter = Boolean(process.env.MIDSCENE_MODEL_API_KEY?.trim());
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
/** GitHub Actions starts `next start` on PLAYWRIGHT_BASE_URL (see ci.yml); do not spawn a second server. */
const startWebServerLocally =
  !process.env.CI &&
  !process.env.PLAYWRIGHT_SKIP_WEB_SERVER &&
  !process.env.GITHUB_ACTIONS;

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
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  forbidOnly: isCi,
  fullyParallel: true,
  reporter: [...reporters],
  /** Local runs: auto-start `next dev` when nothing is listening on `baseURL`. CI uses `ci.yml` + `next start` instead. */
  webServer: startWebServerLocally
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
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
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
