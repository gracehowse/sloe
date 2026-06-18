#!/usr/bin/env node
/**
 * Mirror CI Playwright gates locally: production build + `next start` on :3100,
 * then smoke E2E + public visual regression (same as ci.yml + visual-review.yml).
 *
 * Usage: npm run test:e2e:ci-parity
 */
import { spawn, spawnSync } from "node:child_process";
import { probeHttpHealth } from "./e2e-server-health.mjs";

const CI_PORT = process.env.PLAYWRIGHT_CI_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${CI_PORT}`;

function run(command, args, env = {}) {
  const label = [command, ...args].join(" ");
  console.log(`\n[e2e-ci-parity] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function stopServer(proc) {
  if (proc && !proc.killed) {
    proc.kill("SIGTERM");
  }
}

run("npm", ["run", "build"]);

console.log(`\n[e2e-ci-parity] Starting production server on ${baseURL}`);
const serverProc = spawn("npm", ["run", "start", "--", "--port", CI_PORT], {
  stdio: "ignore",
  env: process.env,
});

process.on("SIGINT", () => {
  stopServer(serverProc);
  process.exit(130);
});
process.on("exit", () => stopServer(serverProc));

const deadline = Date.now() + 120_000;
while (Date.now() < deadline) {
  const health = await probeHttpHealth(`${baseURL}/login`, 5000);
  if (health.ok) break;
  await new Promise((r) => setTimeout(r, 1000));
}
const ready = await probeHttpHealth(`${baseURL}/login`, 5000);
if (!ready.ok) {
  console.error(`[e2e-ci-parity] Server never became ready at ${baseURL}/login`);
  stopServer(serverProc);
  process.exit(1);
}

const playwrightEnv = {
  PLAYWRIGHT_SKIP_WEB_SERVER: "1",
  PLAYWRIGHT_BASE_URL: baseURL,
  PLAYWRIGHT_WARM_ROUTES: "0",
};

run("node", ["scripts/e2e-preflight.mjs"], playwrightEnv);
run("npm", ["run", "test:e2e"], playwrightEnv);
run("npm", ["run", "test:e2e:visual:public"], playwrightEnv);

stopServer(serverProc);
console.log("\n[e2e-ci-parity] ✅ Smoke E2E + public visual regression passed against production build.");
