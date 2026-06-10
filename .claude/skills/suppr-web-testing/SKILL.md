---
name: suppr-web-testing
description: Drive and visually verify the Suppr web app (and mobile-web) using scripts/web-drive.mjs — the repo's Playwright-based CLI. Use whenever asked to test web or mobile-web, capture web screenshots, check web↔mobile parity, or read the rendered DOM / ARIA tree / computed styles of a web surface. The agent's eyes and hands for web.
---

# Suppr Web App Testing — eyes and hands

The web equivalent of the iOS sim loop. **Do not ask Grace to paste browser screenshots.** Drive + screenshot the running web app yourself with **`scripts/web-drive.mjs`** — a repo-native CLI over the Playwright the repo already ships (no MCP / new dependency). It is the web analogue of `idb`: launch, navigate, read the DOM/accessibility tree, screenshot to a file.

When asked to test web or mobile-web, or to check web/mobile parity:

1. **Serve**: `npm run dev` — app at `http://localhost:3000` (Next.js + Turbopack). Helper reads `WEB_DRIVE_BASE_URL` to target another host/port. (Browser is preinstalled; if `chromium.launch()` fails once, run `npx playwright install chromium`.)
2. **Launch / point**: every `web-drive` command spins up a fresh headless Chromium against the dev server and exits non-zero with an actionable message if nothing is listening.
3. **Navigate** — pass a route; for signed-in surfaces (Today / Activity / Plan) add **`--auth`** to load the committed session (`tests/e2e/.auth/user.json`) so you land on the app, not `/login`. Multi-step: `web-drive.mjs flow <route> click:".." fill:".."="v" wait:ms goto:/p shot:f.png`.
4. **Read state** — `web-drive.mjs snap <route>` prints the **ARIA accessibility tree** (the web `ui_describe_all`); `dom <route> [--sel CSS]` dumps HTML; `text <route> [--sel CSS]` dumps visible text; `eval <route> "<js>"` returns JSON for getComputedStyle / contrast checks.
5. **Screenshot** — `web-drive.mjs shot <route> [--out FILE] [--auth] [--vp desktop|mobile|WxH] [--full] [--dark] [--flags a,b]`. Default out: `screenshots/web-drive/<route>-<vp>.png`. Dev overlay is auto-hidden (matches what ships). **Read the PNG file** in the repo — never claim a visual pass from the accessibility text alone (SEE, don't just orchestrate).
6. **Report** — pass/fail per surface + screenshot path. For **parity**, capture mobile-web at **`--vp mobile`** (390×844) and compare against the iOS sim capture of the same surface; visible UI changes Grace makes on mobile must land on the equivalent web surface.

## web-drive commands (`scripts/web-drive.mjs`)

| Intent | Command |
|--------|---------|
| Screenshot a route | `node scripts/web-drive.mjs shot /today --auth --vp mobile` |
| Element-only shot | `node scripts/web-drive.mjs shot /pricing --sel "main" --out screenshots/web-drive/pricing.png` |
| Accessibility tree | `node scripts/web-drive.mjs snap /today --auth` |
| DOM / text dump | `node scripts/web-drive.mjs dom /pricing --sel "main"` · `… text /`|
| getComputedStyle etc. | `node scripts/web-drive.mjs eval / "JSON.stringify(getComputedStyle(document.body).backgroundColor)"` |
| Multi-step flow | `node scripts/web-drive.mjs flow /login fill:'you@domain.com'="x" wait:500 shot:after.png` |
| Force flags ON | add `--flags design-system-colours,redesign-motion` (client-side `__SUPPR_FORCE_FLAGS__`) |

`--vp` accepts `desktop` (1440×900), `mobile` (390×844), or `WxH`; `--dark` emulates dark mode; captures render at 2× for retina sharpness.

## Notes

- **Stale auth state** → `shot --auth` warns when it redirects to `/login`. Regenerate: `E2E_EMAIL=… E2E_PASSWORD=… npx playwright test auth.setup.ts --project=setup`.
- **Repo E2E remains `npm run test:e2e`** (the Playwright test runner + golden screenshots). `web-drive` is for **agent-driven interactive verification** during implementation — the screenshot specs in `tests/e2e/screenshots/` are the durable regression layer.
- **Fallback:** the `playwright` MCP (`@playwright/mcp`, listed in `.cursor/mcp.json`) drives the browser too when the CLI isn't an option, but prefer `web-drive.mjs` — it runs from any shell + CI and leaves files on disk to Read.
