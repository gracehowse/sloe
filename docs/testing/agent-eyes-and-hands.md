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
npm run agent:setup-mcp   # merges ios-simulator + playwright into ~/.cursor/mcp.json
```

## 2. MCP servers (Cursor)

Committed in **`.cursor/mcp.json`** (project):

| Server | Package | Role |
|--------|---------|------|
| `ios-simulator` | `ios-simulator-mcp` | Tap, swipe, describe UI, screenshot, `launch_app` |
| `playwright` | `@playwright/mcp@latest` | Browse localhost, click, snapshot DOM |

**Also merge into `~/.cursor/mcp.json`** if you use global MCP (Sentry, Supabase, etc.): copy the `ios-simulator` and `playwright` blocks from `.cursor/mcp.json` into your user file, then **restart Cursor**.

In Cursor: open MCP settings (or run the MCP panel) and confirm `ios-simulator` and `playwright` are **enabled** with green status.

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
| Metro | `npm run mobile:dev` or `npm run mobile:dev:maestro` |
| Install / rebuild native dev client | `npm run mobile:ios:simulator` |
| Web dev | `npm run dev` → `http://localhost:3000` |
| Maestro (batch E2E) | `npm run mobile:test:e2e` (separate from MCP; still valuable) |
| Route screenshots (no Maestro) | `bash apps/mobile/scripts/capture-every-route.sh` |

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
| Maestro WDA hangs (iOS 26.x) | Prefer MCP + idb or `capture-every-route.sh` (documented 2026-05-31) |

## References

- [ios-simulator-mcp](https://github.com/joshuayoes/ios-simulator-mcp)
- [fbidb.io](https://fbidb.io/docs/installation/)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- Suppr Maestro: `apps/mobile/.maestro/README.md`
