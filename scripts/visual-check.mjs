/**
 * Quick visual check — used during the 2026-05-21 polish pass to
 * verify mobile-web (390) and desktop (1440) renders aren't
 * regressing across the key product surfaces. Writes JPEGs under
 * `screenshots/visual-audit/`.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.resolve("screenshots/visual-audit");
await fs.mkdir(OUT_DIR, { recursive: true });

const ROUTES = [
  { name: "today", url: "http://localhost:3000/today" },
  { name: "progress", url: "http://localhost:3000/progress" },
  { name: "discover", url: "http://localhost:3000/discover" },
  { name: "plan", url: "http://localhost:3000/plan" },
  { name: "shopping", url: "http://localhost:3000/shopping" },
  { name: "settings", url: "http://localhost:3000/settings" },
  { name: "login", url: "http://localhost:3000/login" },
  { name: "signup", url: "http://localhost:3000/signup" },
  { name: "landing", url: "http://localhost:3000/" },
  { name: "pricing", url: "http://localhost:3000/pricing" },
  { name: "not-found", url: "http://localhost:3000/this-page-does-not-exist" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    try {
      await page.goto(route.url, { waitUntil: "networkidle", timeout: 20000 });
    } catch {
      try {
        await page.goto(route.url, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch (err) {
        console.warn(`nav fail: ${route.url} (${vp.name})`, err.message);
        continue;
      }
    }
    await page.waitForTimeout(1200);
    const file = path.join(OUT_DIR, `${route.name}-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`captured ${file}`);
  }
  await ctx.close();
}

await browser.close();
console.log("done");
