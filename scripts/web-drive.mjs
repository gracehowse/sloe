#!/usr/bin/env node
/**
 * web-drive.mjs — Playwright "eyes and hands" for the web app.
 *
 * The web equivalent of what `idb` gives us on the iOS sim: a small,
 * repeatable CLI to drive + screenshot the running Next.js app from any
 * shell, so an agent can SEE the web UI and verify web/mobile parity.
 *
 * Reuses the browser Playwright already ships in this repo (no new MCP /
 * dependency). Points at the dev server you start with `npm run dev`
 * (http://localhost:3000) — or any URL via WEB_DRIVE_BASE_URL.
 *
 * Why a script and not the Playwright MCP: the founder's reference
 * (zerotopete.com/.../give-claude-eyes-and-hands) sketches the MCP but
 * defers the web details, and project rules prefer one repo-native tool
 * over two (CLAUDE.md "prefer one tool over two" / "most correct"). This
 * runs from a terminal, in CI, and by Grace — and drops PNGs on disk that
 * `Read` can open. The MCP stays documented as a fallback.
 *
 * Usage (each command launches a fresh browser unless noted):
 *
 *   node scripts/web-drive.mjs shot   <route> [--out FILE] [--auth] [--vp desktop|mobile|WxH] [--full] [--flags a,b] [--dark]
 *   node scripts/web-drive.mjs dom    <route> [--auth] [--vp ...] [--sel CSS]
 *   node scripts/web-drive.mjs snap   <route> [--auth] [--vp ...]          # accessibility tree (ARIA snapshot)
 *   node scripts/web-drive.mjs text   <route> [--auth] [--sel CSS]         # visible text content
 *   node scripts/web-drive.mjs eval   <route> "<js returning JSON>" [--auth] [--vp ...]
 *   node scripts/web-drive.mjs flow   <route> [steps...] [--auth] [--out FILE] [--vp ...]
 *        steps: click:"Selector"  fill:"Selector"="value"  wait:ms  goto:/path  shot:FILE
 *
 * Flags:
 *   --auth          load committed signed-in storage state (tests/e2e/.auth/user.json)
 *                   so authed surfaces (Today / Activity / Plan) render instead of /login.
 *   --vp <v>        viewport: "desktop" (1440x900), "mobile" (390x844), or "WxH". Default desktop.
 *   --dark          emulate prefers-color-scheme: dark.
 *   --full          full-page screenshot (default: viewport only).
 *   --flags a,b     force PostHog feature flags ON client-side (uses the repo's __SUPPR_FORCE_FLAGS__ hook).
 *   --sel <css>     scope dom/text to a selector (or screenshot just that element for `shot`).
 *   --out <file>    output path for screenshots (default: screenshots/web-drive/<route>-<vp>.png).
 *   --keep-chrome   do NOT hide the Next.js dev overlay (default: hidden, like the visual specs).
 *
 * Examples:
 *   node scripts/web-drive.mjs shot / --out screenshots/web-drive/landing.png
 *   node scripts/web-drive.mjs shot /today --auth --vp mobile
 *   node scripts/web-drive.mjs dom /pricing --sel "main"
 *   node scripts/web-drive.mjs snap /today --auth
 *   node scripts/web-drive.mjs flow /login fill:'you@domain.com'="x" wait:500 shot:after.png
 *
 * Exit codes: 0 ok, 2 bad args, 3 dev server unreachable, 4 browser launch failed, 1 runtime error.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

const BASE_URL = (process.env.WEB_DRIVE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const AUTH_STATE = path.resolve("tests/e2e/.auth/user.json");
const DEFAULT_OUT_DIR = path.resolve("screenshots/web-drive");

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const positional = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--auth") opts.auth = true;
    else if (a === "--full") opts.full = true;
    else if (a === "--dark") opts.dark = true;
    else if (a === "--keep-chrome") opts.keepChrome = true;
    else if (a === "--vp") opts.vp = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--sel") opts.sel = argv[++i];
    else if (a === "--flags") opts.flags = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else positional.push(a);
  }
  return { positional, opts };
}

function resolveViewport(vp) {
  if (!vp) return VIEWPORTS.desktop;
  if (VIEWPORTS[vp]) return VIEWPORTS[vp];
  const m = /^(\d+)x(\d+)$/i.exec(vp);
  if (m) return { width: Number(m[1]), height: Number(m[2]) };
  die(2, `Unknown --vp "${vp}". Use desktop, mobile, or WxH (e.g. 1280x720).`);
}

function routeToUrl(route) {
  if (/^https?:\/\//i.test(route)) return route;
  return BASE_URL + (route.startsWith("/") ? route : `/${route}`);
}

function slug(route) {
  return (route.replace(/^https?:\/\/[^/]+/i, "") || "/")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "root";
}

async function assertDevServerUp() {
  try {
    const res = await fetch(BASE_URL, { method: "HEAD", signal: AbortSignal.timeout(4000) });
    // Any HTTP response (even 4xx) means a server is listening.
    void res;
  } catch {
    die(
      3,
      `Dev server not reachable at ${BASE_URL}.\n` +
        `  Start it first:  npm run dev   (Next.js on http://localhost:3000)\n` +
        `  Or point elsewhere:  WEB_DRIVE_BASE_URL=http://host:port node scripts/web-drive.mjs ...`,
    );
  }
}

/** Hide DEV-ONLY Next.js overlay/build chrome so captures match what ships. Mirrors tests/e2e/utils/visual.ts#hideDevChrome. */
async function hideDevChrome(page) {
  await page.addInitScript(() => {
    const STYLE_ID = "__web_drive_hide_dev_chrome__";
    const apply = () => {
      if (document.getElementById(STYLE_ID)) return;
      const s = document.createElement("style");
      s.id = STYLE_ID;
      s.textContent =
        "nextjs-portal,#__next-build-watcher,[data-nextjs-toast],[data-nextjs-dialog-overlay]{display:none !important}";
      document.head?.appendChild(s);
    };
    if (document.head) apply();
    else document.addEventListener("DOMContentLoaded", apply);
  });
}

/** Force PostHog flags ON client-side via the repo's __SUPPR_FORCE_FLAGS__ hook (tests/e2e/utils/visual.ts#forceFlagsOn). */
async function forceFlagsOn(page, flags) {
  if (!flags?.length) return;
  await page.addInitScript((flagList) => {
    const w = window;
    w.__SUPPR_FORCE_FLAGS__ = w.__SUPPR_FORCE_FLAGS__ ?? {};
    for (const f of flagList) w.__SUPPR_FORCE_FLAGS__[f] = true;
  }, flags);
}

/** Dismiss cookie banner + one-shot overlays before capture (tests/e2e/utils/visual.ts#dismissVisualOverlays). */
async function dismissOverlays(page) {
  for (const rx of [/accept all/i, /dismiss checklist/i, /keep going|continue|got it|close/i]) {
    const btn = page.getByRole("button", { name: rx }).first();
    if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }
}

async function withPage(opts, fn) {
  await assertDevServerUp();
  if (opts.auth && !existsSync(AUTH_STATE)) {
    die(
      1,
      `--auth requested but no storage state at ${AUTH_STATE}.\n` +
        `  Generate it:  E2E_EMAIL=... E2E_PASSWORD=... npx playwright test auth.setup.ts --project=setup`,
    );
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    die(
      4,
      `Failed to launch Chromium: ${err?.message ?? err}\n` +
        `  Install the browser once:  npx playwright install chromium`,
    );
  }
  const viewport = resolveViewport(opts.vp);
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: opts.dark ? "dark" : "light",
    ...(opts.auth ? { storageState: AUTH_STATE } : {}),
  });
  const page = await ctx.newPage();
  if (!opts.keepChrome) await hideDevChrome(page);
  await forceFlagsOn(page, opts.flags);
  try {
    return await fn(page, { viewport });
  } finally {
    await ctx.close();
    await browser.close();
  }
}

async function goto(page, route) {
  const url = routeToUrl(route);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 25_000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
  }
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(900); // let charts / client hydration settle
}

async function takeShot(page, outPath, { full, sel }) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  if (sel) {
    await page.locator(sel).first().screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath, fullPage: Boolean(full) });
  }
  return outPath;
}

// ── commands ────────────────────────────────────────────────────────────────

async function cmdShot(route, opts) {
  if (!route) die(2, "Usage: web-drive.mjs shot <route> [--out FILE] [--auth] [--vp ...]");
  const out = opts.out
    ? path.resolve(opts.out)
    : path.join(DEFAULT_OUT_DIR, `${slug(route)}-${opts.vp ?? "desktop"}${opts.auth ? "-authed" : ""}.png`);
  await withPage(opts, async (page) => {
    await goto(page, route);
    await dismissOverlays(page);
    const final = await takeShot(page, out, opts);
    const landedOnLogin = /\/login(\?|$)/.test(page.url());
    console.log(`captured ${final}`);
    console.log(`  url: ${page.url()}`);
    if (opts.auth && landedOnLogin) {
      console.error(
        "  WARNING: --auth but the page redirected to /login — the storage state is stale/expired.\n" +
          "  Regenerate: E2E_EMAIL=... E2E_PASSWORD=... npx playwright test auth.setup.ts --project=setup",
      );
    }
  });
}

async function cmdDom(route, opts) {
  if (!route) die(2, "Usage: web-drive.mjs dom <route> [--sel CSS] [--auth]");
  await withPage(opts, async (page) => {
    await goto(page, route);
    const html = opts.sel
      ? await page.locator(opts.sel).first().evaluate((el) => el.outerHTML)
      : await page.content();
    console.log(html);
  });
}

async function cmdSnap(route, opts) {
  if (!route) die(2, "Usage: web-drive.mjs snap <route> [--auth]");
  await withPage(opts, async (page) => {
    await goto(page, route);
    // ARIA accessibility tree — the web analogue of idb's ui_describe_all.
    const tree = await page.locator("body").ariaSnapshot();
    console.log(tree);
  });
}

async function cmdText(route, opts) {
  if (!route) die(2, "Usage: web-drive.mjs text <route> [--sel CSS] [--auth]");
  await withPage(opts, async (page) => {
    await goto(page, route);
    const txt = await (opts.sel ? page.locator(opts.sel).first() : page.locator("body")).innerText();
    console.log(txt);
  });
}

async function cmdEval(route, expr, opts) {
  if (!route || !expr) die(2, 'Usage: web-drive.mjs eval <route> "<js returning JSON>" [--auth]');
  await withPage(opts, async (page) => {
    await goto(page, route);
    const result = await page.evaluate((src) => {
      // eslint-disable-next-line no-eval
      const value = eval(src);
      return value;
    }, expr);
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  });
}

async function cmdFlow(route, steps, opts) {
  if (!route) die(2, "Usage: web-drive.mjs flow <route> [click:.. fill:..=.. wait:ms goto:/p shot:FILE]");
  await withPage(opts, async (page) => {
    await goto(page, route);
    await dismissOverlays(page);
    for (const step of steps) {
      const colon = step.indexOf(":");
      const verb = step.slice(0, colon);
      const rest = step.slice(colon + 1);
      if (verb === "click") {
        await page.locator(stripQuotes(rest)).first().click();
      } else if (verb === "fill") {
        const eq = rest.lastIndexOf("=");
        await page.locator(stripQuotes(rest.slice(0, eq))).first().fill(stripQuotes(rest.slice(eq + 1)));
      } else if (verb === "wait") {
        await page.waitForTimeout(Number(rest) || 0);
      } else if (verb === "goto") {
        await goto(page, rest);
        await dismissOverlays(page);
      } else if (verb === "shot") {
        const out = path.isAbsolute(rest) ? rest : path.join(DEFAULT_OUT_DIR, rest);
        console.log(`captured ${await takeShot(page, out, opts)}`);
      } else {
        die(2, `Unknown flow step "${step}". Verbs: click fill wait goto shot.`);
      }
    }
    // Always leave a final capture so the agent can SEE the end state.
    if (!steps.some((s) => s.startsWith("shot:"))) {
      const out = opts.out ? path.resolve(opts.out) : path.join(DEFAULT_OUT_DIR, `${slug(route)}-flow-end.png`);
      console.log(`captured ${await takeShot(page, out, opts)}`);
    }
    console.log(`  url: ${page.url()}`);
  });
}

function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// ── dispatch ──────────────────────────────────────────────────────────────

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { positional, opts } = parseArgs(rest);
  switch (cmd) {
    case "shot":
      return cmdShot(positional[0], opts);
    case "dom":
      return cmdDom(positional[0], opts);
    case "snap":
      return cmdSnap(positional[0], opts);
    case "text":
      return cmdText(positional[0], opts);
    case "eval":
      return cmdEval(positional[0], positional[1], opts);
    case "flow":
      return cmdFlow(positional[0], positional.slice(1), opts);
    default:
      die(
        2,
        "web-drive — Playwright eyes and hands for the web app.\n\n" +
          "Commands: shot | dom | snap | text | eval | flow\n" +
          "Run with no args to see this; see the file header for full flags/examples.\n\n" +
          "Quick start:\n" +
          "  npm run dev                                          # start the app (:3000)\n" +
          "  node scripts/web-drive.mjs shot / --out screenshots/web-drive/landing.png\n" +
          "  node scripts/web-drive.mjs shot /today --auth --vp mobile\n" +
          "  node scripts/web-drive.mjs snap /pricing\n",
      );
  }
}

main().catch((err) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
