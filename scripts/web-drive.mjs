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
 * (http://127.0.0.1:3000) — or any URL via WEB_DRIVE_BASE_URL.
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
 *   node scripts/web-drive.mjs shot   <route> [--out FILE] [--auth] [--auth-state FILE] [--vp desktop|mobile|WxH] [--full] [--flags a,b] [--dark]
 *   node scripts/web-drive.mjs dom    <route> [--auth] [--auth-state FILE] [--vp ...] [--sel CSS]
 *   node scripts/web-drive.mjs snap   <route> [--auth] [--auth-state FILE] [--vp ...]          # accessibility tree (ARIA snapshot)
 *   node scripts/web-drive.mjs text   <route> [--auth] [--auth-state FILE] [--sel CSS]         # visible text content
 *   node scripts/web-drive.mjs eval   <route> "<js returning JSON>" [--auth] [--auth-state FILE] [--vp ...]
 *   node scripts/web-drive.mjs flow   <route> [steps...] [--auth] [--out FILE] [--vp ...]
 *        steps: click:"Selector"  fill:"Selector"="value"  wait:ms  goto:/path  shot:FILE
 *
 * Flags:
 *   --auth          load signed-in storage state so authed surfaces (Today /
 *                   Activity / Plan) render instead of /login. Host-specific:
 *                   127.0.0.1 uses tests/e2e/.auth/user.json; localhost uses
 *                   tests/e2e/.auth/user-localhost.json.
 *   --auth-state    explicit storage-state JSON (persona runs, visual account,
 *                   or another host). Implies --auth.
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

const BASE_URL = (process.env.WEB_DRIVE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const AUTH_STATE_BY_HOST = {
  "127.0.0.1": "tests/e2e/.auth/user.json",
  localhost: "tests/e2e/.auth/user-localhost.json",
};
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
    else if (a === "--auth-state") {
      opts.auth = true;
      opts.authState = argv[++i];
    }
    else if (a === "--flags") opts.flags = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--ls") {
      const raw = argv[++i] ?? "";
      const eq = raw.indexOf("=");
      if (eq > 0) {
        opts.ls = opts.ls ?? {};
        opts.ls[raw.slice(0, eq)] = raw.slice(eq + 1);
      }
    }
    else positional.push(a);
  }
  return { positional, opts };
}

function authStateForBaseUrl() {
  try {
    const host = new URL(BASE_URL).hostname;
    return path.resolve(AUTH_STATE_BY_HOST[host] ?? AUTH_STATE_BY_HOST["127.0.0.1"]);
  } catch {
    return path.resolve(AUTH_STATE_BY_HOST["127.0.0.1"]);
  }
}

function resolveAuthState(opts) {
  if (opts.authState) return path.resolve(opts.authState);
  return authStateForBaseUrl();
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
    // GET, not HEAD: this Next.js dev server never responds to HEAD (hangs
    // indefinitely rather than erroring), and first-hit Turbopack compiles
    // can legitimately take tens of seconds — a short timeout here reads as
    // "server down" when it's just slow.
    const res = await fetch(BASE_URL, { method: "GET", signal: AbortSignal.timeout(45000) });
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

/** Seed localStorage prefs before load (e.g. `--ls suppr.prefs.macro_display=rings`). */
async function seedLocalStorage(page, ls) {
  if (!ls || !Object.keys(ls).length) return;
  await page.addInitScript((entries) => {
    try {
      for (const k of Object.keys(entries)) window.localStorage.setItem(k, entries[k]);
    } catch {
      /* storage unavailable — ignore */
    }
  }, ls);
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

/** Dismiss cookie banner + one-shot overlays before capture (tests/e2e/utils/visual.ts#dismissVisualOverlays).
 *  The generic-dialog patterns are anchored (`^…$`) on purpose: an earlier
 *  bare `continue` token matched real navigation/auth CTAs ("Continue with
 *  email", pricing "Continue to checkout"), so this helper would click them
 *  and either dismiss the email auth modal or navigate a public screenshot
 *  (e.g. /pricing) off to /login. Only exact dismissal labels are matched now.
 *
 *  Every pattern is scoped to its genuine overlay container, not matched
 *  page-wide — an earlier page-wide `getByRole("button", { name: /^close$/i })`
 *  also matched the /login screen's dismiss X (app/login/ui.tsx, aria-label
 *  "Close"), whose onClose hard-navigates to "/". That self-dismissed every
 *  /login and /signin capture to the marketing landing (false P0, 2026-07-01
 *  sweep). Scoping rules out page furniture that merely shares a label with
 *  a real overlay. */
async function dismissOverlays(page) {
  const scopes = [
    { container: '[data-testid="cookie-consent-banner"]', rx: /accept all/i },
    { container: '[data-testid="first-run-checklist"]', rx: /dismiss checklist/i },
    // Radix Dialog/AlertDialog content renders role="dialog" / "alertdialog" —
    // the only DOM contexts where a bare "Keep going" / "Got it" / "Close" is
    // a genuine one-shot overlay dismissal rather than page content or nav.
    { container: '[role="dialog"], [role="alertdialog"]', rx: /^(keep going|got it|close)$/i },
  ];
  for (const { container, rx } of scopes) {
    const btn = page.locator(container).getByRole("button", { name: rx }).first();
    // `isVisible({ timeout })` doesn't wait (Playwright's own types mark
    // that option deprecated/ignored) — `waitFor({ state: "visible" })` is
    // the primitive that genuinely retries. `goto()` above already settles
    // (networkidle + fonts + 900ms), so this rarely pays the full timeout,
    // but only `waitFor` actually guarantees that (see the identical fix in
    // tests/e2e/utils/visual.ts#dismissVisualOverlays, 2026-07-21).
    const hasBtn = await btn
      .waitFor({ state: "visible", timeout: 1200 })
      .then(() => true)
      .catch(() => false);
    if (hasBtn) {
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(300);
    }
  }
}

async function withPage(opts, fn) {
  await assertDevServerUp();
  const authState = resolveAuthState(opts);
  if (opts.auth && !existsSync(authState)) {
    die(
      1,
      `--auth requested but no storage state at ${authState}.\n` +
        `  Generate host-scoped state:  E2E_EMAIL=... E2E_PASSWORD=... npx playwright test auth.setup.ts --project=setup\n` +
        `  Persona state: pass --auth-state path/to/persona-storage.json if using a custom file.`,
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
    ...(opts.auth ? { storageState: authState } : {}),
  });
  const page = await ctx.newPage();
  if (!opts.keepChrome) await hideDevChrome(page);
  await forceFlagsOn(page, opts.flags);
  await seedLocalStorage(page, opts.ls);
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
    // Generous timeouts: a route's first hit after a dev-server restart can
    // cost tens of seconds compiling under Turbopack, independent of the
    // page's own runtime cost.
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
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
      } else if (verb === "scroll") {
        // Center a selector in its scroll container — the only way to capture
        // below-fold content on pages that scroll inside a fixed-height inner
        // region (e.g. recipe detail) rather than the document body, and to
        // pull content out from under a sticky footer before an element shot.
        await page.locator(stripQuotes(rest)).first().evaluate((el) =>
          el.scrollIntoView({ block: "center", inline: "center" }),
        );
        await page.waitForTimeout(400);
      } else {
        die(2, `Unknown flow step "${step}". Verbs: click fill wait goto shot scroll.`);
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
