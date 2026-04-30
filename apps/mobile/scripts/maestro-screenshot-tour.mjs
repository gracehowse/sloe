#!/usr/bin/env node
/**
 * Wrapper for the dedicated screenshot tour flow.
 *
 * Locks the iOS Simulator status bar to a deterministic state
 * (Apple's marketing 9:41, full battery, full WiFi) BEFORE running
 * the tour so successive captures don't false-positive on the clock
 * advancing or the battery indicator changing. Without this, mostly-
 * static surfaces (Nutrition Sources, etc.) showed 4% pixel diffs
 * across runs that were 100% chrome — see audit
 * `docs/audits/2026-04-29-mobile-e2e-audit-findings.md`.
 *
 * Falls back to a regular `maestro test` invocation on non-darwin
 * hosts where simctl isn't available.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(__dirname, "..");
const tourFlow = ".maestro/00_screenshot_tour.yaml";

function lockSimulatorStatusBar() {
  if (process.platform !== "darwin") return;
  const r = spawnSync(
    "xcrun",
    [
      "simctl",
      "status_bar",
      "booted",
      "override",
      "--time",
      "9:41",
      "--dataNetwork",
      "wifi",
      "--wifiMode",
      "active",
      "--wifiBars",
      "3",
      "--cellularMode",
      "notSupported",
      "--batteryState",
      "charged",
      "--batteryLevel",
      "100",
    ],
    { stdio: "ignore" },
  );
  if (r.status === 0) {
    console.log("[screenshot-tour] Simulator status bar locked to 9:41 / charged / WiFi.");
  } else {
    console.warn(
      "[screenshot-tour] Could not lock simulator status bar — boot a simulator first?",
    );
  }
}

lockSimulatorStatusBar();

console.log(`[screenshot-tour] Running ${tourFlow}…`);
const r = spawnSync("maestro", ["test", tourFlow], {
  cwd: mobileRoot,
  stdio: "inherit",
});

const code = r.status ?? 1;
if (code !== 0 && r.error) {
  console.error("[screenshot-tour] Failed to spawn `maestro`:", r.error.message);
  process.exit(1);
}
process.exit(code);
