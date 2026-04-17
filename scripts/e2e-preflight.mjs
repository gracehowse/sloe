#!/usr/bin/env node
/**
 * Run before Playwright locally: disk sanity + optional reachability when
 * PLAYWRIGHT_SKIP_WEB_SERVER is set (you must start Next yourself).
 */
import { spawnSync } from "node:child_process";

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
