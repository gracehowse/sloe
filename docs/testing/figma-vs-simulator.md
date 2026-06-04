# Figma ↔ iOS Simulator visual diff (agents)

Compare **Figma** frame `01 · Today` (file `B3UdOFup7ITersgNuoXh0l`) against the **booted simulator** without manual screenshot drag-and-drop.

**Figma file:** https://www.figma.com/design/B3UdOFup7ITersgNuoXh0l/

## Prerequisites

| Tool | Check |
|------|--------|
| **ios-simulator MCP** | Green in Cursor MCP; `npm run agent:verify-tools` |
| **Figma MCP** | **Figma plugin** enabled + signed in (see below) — server name may appear as `plugin-figma-figma` after auth |
| Metro | `npm run mobile:dev` when testing live data |
| Dev client | `npm run mobile:ios:simulator` after native changes |

## Enable Figma MCP in Cursor

1. **Cursor → Settings → MCP**
2. Enable **Figma** (official plugin). Complete sign-in when prompted.
3. **Restart Cursor**
4. Agent may need to run auth once (`mcp_auth` on `plugin-figma-figma`) — approve in browser if asked
5. Confirm Figma appears in the **available MCP servers** list (not only `user-ios-simulator`)

Until Figma MCP is connected, agents fall back to `docs/prototypes/stitch-sloe/today.html` with **lower confidence** on spacing/tokens.

## Agent workflow

1. **Figma** — Open page **Sloe · Screens** → section **Core app** → frame **01 · Today** (or child states S1–S6).
2. **Simulator** — `get_booted_sim_id` → `launch_app` `com.supprclub.supprapp` (`terminate_running: true` after layout/font changes) → `xcrun simctl openurl <udid> suppr:///(tabs)` → `screenshot` to `apps/mobile/screenshots/agent/figma-compare-today.png`.
3. **Read both** — Build table: *Element | Figma | Sim | P0/P1/P2*.
4. Cross-check `docs/ux/redesign/today-ios-dossier.md` for known ring/header gaps.

## Prompt template

```
Compare Figma file B3UdOFup7ITersgNuoXh0l frame "01 · Today" to the booted iOS simulator on Today.
Use Figma MCP + ios-simulator MCP. Return a discrepancy table with severity.
```

## HTML fallback

`docs/prototypes/stitch-sloe/today.html` — Stitch export; useful when Figma MCP is offline.

## Related

- `sitemap.md`
- `docs/testing/agent-eyes-and-hands.md`
- `docs/ux/redesign/migration-coverage.md`
