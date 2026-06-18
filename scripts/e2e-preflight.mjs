#!/usr/bin/env node
/**
 * Run before Playwright locally: disk sanity, server health (zombie detection),
 * and optional route warm-up for slow Turbopack compiles.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  E2E_WARM_ROUTES,
  isPortListening,
  parseBaseUrl,
  probeHttpHealth,
  warmRoutes,
} from "./e2e-server-health.mjs";

/** Load root `.env.local` so E2E_EMAIL / E2E_PASSWORD are available without manual export. */
function loadEnvLocal() {
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

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
/** When set, Playwright will not start `next dev`; the app must already be listening on `baseURL`. */
const mustReachExistingServer = Boolean(process.env.PLAYWRIGHT_SKIP_WEB_SERVER?.trim());
const warmSlowRoutes = process.env.PLAYWRIGHT_WARM_ROUTES?.trim() !== "0";

function warnDisk() {
  if (process.platform === "win32") return;
  const r = spawnSync("df", ["-k", "."], { encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) return;
  const lines = r.stdout.trim().split("\n");
  const data = lines[1]?.split(/\s+/);
  if (!data || data.length < 4) return;
  const availKb = Number(data[data.length - 3]);
  if (!Number.isFinite(availKb)) return;
  const availMb = availKb / 1024;
  if (availMb < 512) {
    console.warn(
      `[e2e-preflight] Low disk space (~${Math.round(availMb)} MiB free on .). Expo/Next may fail with ENOSPC; free space before e2e.`,
    );
  }
}

function zombieHelp(port) {
  return [
    `[e2e-preflight] Port ${port} is listening but the app did not respond in time (zombie dev server).`,
    "Kill the stale process and start one clean server:",
    `  lsof -iTCP:${port} -sTCP:LISTEN`,
    `  kill <pid>   # then: npm run dev   OR   npm run build && npm run start -- --port ${port}`,
    "Or force Playwright to spawn a fresh server: PLAYWRIGHT_FORCE_FRESH_SERVER=1 npm run test:e2e",
  ].join("\n");
}

async function assertServerHealthy() {
  const { host, port } = parseBaseUrl(baseURL);
  const listening = await isPortListening(host, port);
  const health = await probeHttpHealth(baseURL);

  if (health.ok) {
    if (warmSlowRoutes) {
      await warmRoutes(baseURL, E2E_WARM_ROUTES);
    }
    return "healthy";
  }

  if (listening) {
    console.error(zombieHelp(port));
    process.exit(1);
  }

  if (mustReachExistingServer) {
    console.error(
      `[e2e-preflight] Cannot reach ${baseURL} with PLAYWRIGHT_SKIP_WEB_SERVER set.`,
      "\nStart the app first, e.g. `npm run dev` or `npm run start -- --port 3000`.",
    );
    process.exit(1);
  }

  return "down";
}

warnDisk();

const serverState = await assertServerHealthy();

if (serverState === "healthy") {
  console.log(`[e2e-preflight] ${baseURL} is healthy${warmSlowRoutes ? " (slow routes warmed)" : ""}.`);
} else {
  console.log(
    `[e2e-preflight] No server at ${baseURL} — Playwright will start one (or set PLAYWRIGHT_SKIP_WEB_SERVER=1 if you start Next yourself).`,
  );
}
