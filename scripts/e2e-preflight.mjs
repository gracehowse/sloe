#!/usr/bin/env node
/**
 * Run before Playwright locally: disk sanity + optional reachability when
 * PLAYWRIGHT_SKIP_WEB_SERVER is set (you must start Next yourself).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

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

async function requireServerUp() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(baseURL, { redirect: "follow", signal: ac.signal });
    if (!res.ok) {
      console.error(`[e2e-preflight] ${baseURL} responded with HTTP ${res.status}.`);
      process.exit(1);
    }
  } catch (e) {
    console.error(
      `[e2e-preflight] Cannot reach ${baseURL} with PLAYWRIGHT_SKIP_WEB_SERVER set.`,
      "\nStart the app first, e.g. `npm run dev` or `npm run start -- --port 3000`.",
    );
    process.exit(1);
  } finally {
    clearTimeout(t);
  }
}

warnDisk();

if (mustReachExistingServer) {
  await requireServerUp();
} else {
  console.log(
    `[e2e-preflight] Playwright will start or reuse dev server at ${baseURL} (set PLAYWRIGHT_SKIP_WEB_SERVER=1 if you start Next yourself).`,
  );
}
