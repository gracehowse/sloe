/**
 * Lightweight production / preview smoke checks (no Playwright).
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run smoke:production
 */
const base = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";

const paths = ["/login", "/privacy", "/terms", "/reset-password"];

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
  if (failed) {
    console.error("\nsmoke:production: one or more checks failed.");
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main();
