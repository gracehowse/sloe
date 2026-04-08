import { defineConfig, devices } from "@playwright/test";

const useMidsceneReporter = Boolean(process.env.MIDSCENE_MODEL_API_KEY?.trim());

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: useMidsceneReporter ? 120_000 : 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: useMidsceneReporter
    ? [["list"], ["@midscene/web/playwright-reporter", { type: "merged" }]]
    : [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
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
