#!/usr/bin/env node
/**
 * Loads repo-root `.env.local` + `apps/mobile/.env` into the Maestro child env (shell `&&` does not
 * keep vars set only inside a prior Node process). Preflight: disk, credentials, Metro `/status`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** This file lives in `apps/mobile/scripts/` → three `..` reach repo root (not two: that lands on `apps/`). */
const mobileRoot = join(__dirname, "..");
const repoRootEnvLocal = join(__dirname, "..", "..", "..", ".env.local");
const mobileEnv = join(__dirname, "..", ".env");

function parseEnvFile(absPath) {
  const out = {};
  if (!existsSync(absPath)) return out;
  const raw = readFileSync(absPath, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let key = t.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function warnDisk() {
  if (process.platform === "win32") return;
  const r = spawnSync("df", ["-k", mobileRoot], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) return;
  const lines = r.stdout.trim().split("\n");
  const data = lines[1]?.split(/\s+/);
  if (!data || data.length < 4) return;
  const availKb = Number(data[data.length - 3]);
  if (!Number.isFinite(availKb)) return;
  const availMb = availKb / 1024;
  if (availMb < 512) {
    console.warn(
      `[maestro-e2e] Low disk (~${Math.round(availMb)} MiB free near apps/mobile). Prebuild/Metro may hit ENOSPC — free disk space.`,
    );
  }
}

function metroStatusUrl(expoDevServerUrl) {
  const raw = expoDevServerUrl ?? "exp://127.0.0.1:8081";
  const m = String(raw).match(/:(\d+)/);
  const port = m?.[1] ?? "8081";
  return `http://127.0.0.1:${port}/status`;
}

function buildChildEnv() {
  const fromRoot = parseEnvFile(repoRootEnvLocal);
  const fromMobile = parseEnvFile(mobileEnv);
  return {
    ...process.env,
    ...fromRoot,
    ...fromMobile,
    MAESTRO_DRIVER_STARTUP_TIMEOUT:
      process.env.MAESTRO_DRIVER_STARTUP_TIMEOUT ?? fromRoot.MAESTRO_DRIVER_STARTUP_TIMEOUT ?? "180000",
  };
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Metro can take 15–40s after `expo start` on a cold cache or large monorepo graph.
 * Maestro only needs `/status` on the host (simulator reaches Metro via the host loopback).
 */
async function assertMetroUp(env) {
  const expoUrl = env.EXPO_DEV_SERVER_URL ?? "exp://127.0.0.1:8081";
  const statusUrl = metroStatusUrl(expoUrl);
  const perAttemptMs = 8000;
  const attempts = 15;
  const pauseMs = 2000;

  let lastDetail = "";

  for (let i = 1; i <= attempts; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), perAttemptMs);
    try {
      const res = await fetch(statusUrl, { signal: ac.signal });
      const text = await res.text();
      if (res.ok && text.includes("packager-status:running")) {
        if (i > 1) {
          console.log(`[maestro-e2e] Metro became ready after ${i} attempt(s) (~${((i - 1) * pauseMs) / 1000}s wait).`);
        }
        return;
      }
      lastDetail = `HTTP ${res.status} body=${JSON.stringify(text.slice(0, 200))}`;
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(t);
    }

    if (i < attempts) {
      console.warn(`[maestro-e2e] Metro not ready yet (${i}/${attempts}): ${lastDetail}`);
      await sleep(pauseMs);
    }
  }

  console.error(
    `[maestro-e2e] Metro never became ready at ${statusUrl}.`,
    `\nLast error: ${lastDetail}`,
    "\n\nFix checklist:",
    "\n  1. Start Metro from this app (not repo root bare `expo`):",
    "\n       cd apps/mobile && npx expo start",
    "\n     or from repo root:  npm run mobile:dev",
    "\n  2. Port in EXPO_DEV_SERVER_URL must match Metro (default exp://127.0.0.1:8081).",
    "\n  3. If 8081 is stuck:  lsof -i :8081   then kill the old node, or  npx expo start --port 8082",
    "\n     and export EXPO_DEV_SERVER_URL=exp://127.0.0.1:8082",
    "\n  4. Stale graph:  npm run start:clear --prefix apps/mobile",
  );
  process.exit(1);
}

warnDisk();

/**
 * Lock the iOS Simulator status bar to a deterministic state before
 * Maestro runs. Without this, the clock + battery + signal bars
 * change between runs and produce false-positive screenshot diffs
 * (audit 2026-04-29 papercut investigation: tour-19-nutrition-sources
 * failed with 4% diff that was 100% the clock advancing). 9:41 is
 * Apple's marketing convention; full battery + WiFi 100% give a
 * stable chrome row across captures.
 *
 * `xcrun simctl status_bar booted override` is iOS-only and a no-op
 * if no simulator is booted (we tolerate the exit code; this is best-
 * effort polish, not a hard requirement).
 */
function lockSimulatorStatusBar() {
  if (process.platform !== "darwin") return;
  spawnSync(
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
}

lockSimulatorStatusBar();

const childEnv = buildChildEnv();

if (!childEnv.E2E_EMAIL?.trim() || !childEnv.E2E_PASSWORD) {
  console.error(
    "[maestro-e2e] Missing E2E_EMAIL or E2E_PASSWORD.",
    `\nAdd them to ${repoRootEnvLocal} (repo root) or ${mobileEnv}, then re-run.`,
    "\nShell exports still work if you prefer not to use files.",
  );
  process.exit(1);
}

await assertMetroUp(childEnv);

const expoUrl = childEnv.EXPO_DEV_SERVER_URL ?? "exp://127.0.0.1:8081";
/** Extra Maestro CLI args after `--` (forwarded before `.maestro/`). `--continuous` only works for a *single* flow file, not the whole suite. */
const dash = process.argv.indexOf("--");
const forwarded = dash >= 0 ? process.argv.slice(dash + 1) : [];

console.log(
  "[maestro-e2e] Metro OK — running Maestro.",
  forwarded.length ? `(flags: ${forwarded.join(" ")})` : "(one full pass; flows in .maestro/config.yaml)",
);

const r = spawnSync(
  "maestro",
  [
    "test",
    ...forwarded,
    ".maestro/",
    "-e",
    `EXPO_DEV_SERVER_URL=${expoUrl}`,
    "-e",
    `E2E_EMAIL=${childEnv.E2E_EMAIL}`,
    "-e",
    `E2E_PASSWORD=${childEnv.E2E_PASSWORD}`,
  ],
  { cwd: mobileRoot, env: childEnv, stdio: "inherit" },
);

const code = r.status ?? 1;
if (code !== 0 && r.error) {
  console.error("[maestro-e2e] Failed to spawn `maestro`:", r.error.message);
  process.exit(1);
}
process.exit(code);
