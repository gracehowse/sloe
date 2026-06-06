# Agent eyes and hands (iOS Simulator + web)

Implements the workflow from [Give Claude Eyes and Hands on Your App](https://www.zerotopete.com/p/give-claude-eyes-and-hands-on-your) for Suppr: MCP bridges so Cursor agents can **see** and **tap** the simulator and browser instead of relying on dragged screenshots.

## Prerequisites (macOS)

- Xcode + iOS Simulator
- Homebrew
- Node.js (for `npx` MCP servers)
- ~15 minutes first-time setup

## 1. IDB (iOS Development Bridge)

`xcrun simctl` handles screenshots and URLs; **idb** adds tap, swipe, type, and accessibility tree reads.

### Install

```bash
brew tap facebook/fb
brew install idb-companion   # already on many dev machines

# CLI — use pipx + Python 3.12 (fb-idb breaks on Python 3.14)
brew install pipx python@3.12
pipx install fb-idb --python /opt/homebrew/bin/python3.12
```

Ensure `~/.local/bin` is on your `PATH` (pipx adds this). New terminals pick it up automatically.

### Verify

```bash
idb list-targets
# Expect at least one simulator; Booted = ready
```

From repo root:

```bash
npm run agent:verify-tools
npm run agent:setup-mcp   # merges ios-simulator + playwright + Mobbin into ~/.cursor/mcp.json
```

## 2. MCP servers (Cursor)

Committed in **`.cursor/mcp.json`** (project):

| Server | Package | Role |
|--------|---------|------|
| `ios-simulator` | `ios-simulator-mcp` | Tap, swipe, describe UI, screenshot, `launch_app` |
| `playwright` | `@playwright/mcp@latest` | Browse localhost, click, snapshot DOM |
| `Mobbin` | Official HTTP MCP | Search curated app screens/flows for benchmarks |

**Also merge into `~/.cursor/mcp.json`** if you use global MCP (Sentry, Supabase, etc.): copy blocks from `.cursor/mcp.json` into your user file, then **restart Cursor**.

In Cursor: open MCP settings (or run the MCP panel) and confirm servers are **enabled** with green status.

### Mobbin MCP (benchmarks — browser OAuth)

Committed in **`.cursor/mcp.json`** and merged by `npm run agent:setup-mcp` into `~/.cursor/mcp.json`:

```json
"Mobbin": {
  "type": "http",
  "url": "https://api.mobbin.com/mcp",
  "headers": {}
}
```

**One-time connect (you must do this in the IDE):**

1. **Restart Cursor** fully (`Cmd-Q`, reopen) after the config change.
2. **Settings → Tools & MCP** (or MCP panel).
3. Find **Mobbin** → click **Connect**.
4. Sign in with your **Mobbin Pro or Team** account in the browser window (MCP is not on free plans).
5. Confirm a **green** status dot.

Do **not** use legacy `npx mobbin-mcp` packages — use only `https://api.mobbin.com/mcp`. Docs: [Mobbin MCP for Cursor](https://docs.mobbin.com/mcp/clients/cursor).

Product refs already cite Mobbin URLs in `docs/ux/redesign/*.md` and `docs/ux/mobbin-refs/warm-coaching-direction.md`; with MCP connected, agents can search live instead of pasting static links only.

### Stitch MCP (optional — user config only)

Google Stitch exposes an MCP server for live project reads. **Never commit API keys** to the repo; do not put secrets in `.cursor/mcp.json` at the project root.

1. Create a Stitch API key in Google Stitch (account settings).
2. Add to **`~/.cursor/mcp.json`** (your user file, not the repo):

```json
{
  "mcpServers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_STITCH_API_KEY_HERE"
      }
    }
  }
}
```

Or use an env var the MCP client supports (preferred so the key is not in plain JSON on disk):

```json
{
  "mcpServers": {
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "Authorization": "Bearer ${GOOGLE_STITCH_API_KEY}"
      }
    }
  }
}
```

Set `GOOGLE_STITCH_API_KEY` in your shell profile or Cursor env — **not** in `.env` files that ship with git.

3. **Restart Cursor** after editing MCP config.

#### When to use which tool

| Need | Use |
|------|-----|
| Shipped UI on device, taps, scroll, pixels | **ios-simulator** MCP |
| Local web at `localhost:3000` | **playwright** MCP |
| Documented Sloe frames, screenshots by node ID | **Figma** MCP (`plugin-figma-figma`) — file `B3UdOFup7ITersgNuoXh0l` |
| Best-in-class UI patterns (MacroFactor, Lifesum, Oura, …) | **Mobbin** MCP — search screens/flows during design reviews |
| Committed static mock, Tailwind measurements, offline diff | **Stitch HTML** in `docs/prototypes/stitch-sloe/` (no MCP) |
| Stitch project not yet exported to repo | **Stitch** MCP (if configured) |

Pipeline map: `docs/ux/redesign/design-sources-stitch-figma.md`. Known Stitch ↔ Figma gaps: `docs/testing/figma-today-consistency-audit.md`.

### ios-simulator tools (common)

- `get_booted_sim_id` — which sim is running
- `launch_app` — `bundle_id: com.supprclub.supprapp`
- `ui_describe_all` / `ui_find_element` — accessibility tree
- `ui_tap`, `ui_swipe`, `ui_type` — interaction
- `screenshot`, `ui_view` — pixels for the agent
- `open_simulator` — show Simulator.app

Env (set in `.cursor/mcp.json`):

- `IOS_SIMULATOR_MCP_IDB_PATH` — absolute path to `idb`
- `IOS_SIMULATOR_MCP_DEFAULT_OUTPUT_DIR` — `apps/mobile/screenshots/agent`

## 3. Agent instructions

- **`.claude/CLAUDE.md`** — iOS + web testing loops (MCP-first)
- **`sitemap.md`** — deep links and tab map
- **`.cursor/rules/visual-check-web-and-mobile.mdc`** — require MCP/sim verification for UI work

## 4. Suppr-specific commands

| Step | Command |
|------|---------|
| Metro (simulator) | `npm run mobile:dev` → `http://127.0.0.1:8081` (no tunnel) |
| Metro (physical iPhone) | `npm run mobile:ios:device:tunnel:pinned` — tunnel URL; sim **cannot** use `exp.direct` reliably |
| Install / rebuild native dev client | `npm run mobile:ios:simulator` |
| Web dev | `npm run dev` → `http://localhost:3000` |
| Maestro (batch E2E) | `npm run mobile:test:e2e` (separate from MCP; still valuable) |
| Route screenshots (no Maestro) | `bash apps/mobile/scripts/capture-every-route.sh` |

### Mobile API host (`EXPO_PUBLIC_API_URL` — F-09)

Food search on device calls Next.js `/api/*` via [`getSupprApiBase()`](../../apps/mobile/lib/supprWeb.ts). Defaults:

| Target | `EXPO_PUBLIC_API_URL` | Notes |
|--------|----------------------|--------|
| iOS Simulator | `http://127.0.0.1:3000` | Set in `apps/mobile/.env.local` when testing **local** ranking/API changes |
| Physical iPhone | `https://<your-tunnel-or-lan>:3000` or deployed preview | `127.0.0.1` is unreachable from the phone; unset → `app.json` `supprApiUrl` (production) |
| CI / audit script | N/A (direct lib clients) | Live audit may **differ** from device UI if device hits prod |

```bash
# apps/mobile/.env.local — sim hitting local Next.js while ranking work is in flight
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000
```

Restart Metro after changing. ENG-877 native search golden pass should record which API host was used.

**Auth:** Apple Sign In on device/sim — no email/password test form. Use silent Maestro env (`E2E_*`) or an already-signed-in sim for authed flows.

**Cold relaunch:** After font/ring/layout constants change, MCP `launch_app` with `terminate_running: true` — Fast Refresh does not refresh `Dimensions`-derived layout.

## 5. Claude Code (optional)

If you use Anthropic Claude Code CLI:

```bash
claude mcp add ios-simulator npx ios-simulator-mcp
claude mcp add playwright npx @playwright/mcp@latest
```

Same IDB prerequisite.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `idb: command not found` | `export PATH="$HOME/.local/bin:$PATH"` or set `IOS_SIMULATOR_MCP_IDB_PATH` |
| idb asyncio error on Python 3.14 | Reinstall with pipx + Python 3.12 (see above) |
| MCP server red in Cursor | Restart Cursor; run `npm run agent:verify-tools` |
| Dev launcher instead of app | Start Metro on :8081; open dev client URL (see `capture-every-route.sh` header) |
| Simulator black screen / red box | Metro mode mismatch — sim needs `http://127.0.0.1:8081`, not tunnel `exp.direct` (F-08) |
| Maestro WDA hangs (iOS 26.x) | Prefer MCP + idb or `capture-every-route.sh` (documented 2026-05-31) |

## References

- [ios-simulator-mcp](https://github.com/joshuayoes/ios-simulator-mcp)
- [fbidb.io](https://fbidb.io/docs/installation/)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- Suppr Maestro: `apps/mobile/.maestro/README.md`
