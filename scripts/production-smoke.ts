/**
 * Lightweight production / preview smoke checks (no Playwright).
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run smoke:production
 */
const base = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

const paths = ["/login", "/privacy", "/terms", "/reset-password"];

async function checkPlanImportRoutes(): Promise<{ ok: boolean; detail: string }> {
  for (const route of ["/api/plan-import/parse", "/api/plan-import/extract"]) {
    const url = `${base}${route}`;
    try {
      const res = await fetch(url, { method: "POST" });
      // Route exists when unauthenticated POST returns 401 (not 404).
      if (res.status === 404) {
        return { ok: false, detail: `${route} returned 404 — route not deployed` };
      }
      if (res.status !== 401) {
        return { ok: false, detail: `${route} returned ${res.status}, expected 401` };
      }
    } catch (e) {
      return {
        ok: false,
        detail: `${route}: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
  return { ok: true, detail: "parse + extract return 401 unauthenticated" };
}

async function check(path: string): Promise<{ path: string; ok: boolean; status: number; detail?: string }> {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    const ok = res.status >= 200 && res.status < 400;
    return { path, ok, status: res.status };
  } catch (e) {
    return {
      path,
      ok: false,
      status: 0,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  console.log(`Smoke: GET ${base} (+ paths)\n`);
  let failed = false;
  for (const p of paths) {
    const r = await check(p);
    const line = r.ok ? `OK` : `FAIL`;
    console.log(`  [${line}] ${p} → ${r.status}${r.detail ? ` (${r.detail})` : ""}`);
    if (!r.ok) failed = true;
  }
  const planImport = await checkPlanImportRoutes();
  const piLine = planImport.ok ? "OK" : "FAIL";
  console.log(`  [${piLine}] plan-import routes → ${planImport.detail}`);
  if (!planImport.ok) failed = true;
  if (failed) {
    console.error("\nsmoke:production: one or more checks failed.");
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main();
