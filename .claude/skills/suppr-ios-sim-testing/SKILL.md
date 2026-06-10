---
name: suppr-ios-sim-testing
description: Drive and visually verify the Suppr iOS app in the simulator using the ios-simulator MCP server (with idb/simctl fallback). Use whenever asked to test, verify, QA, or capture a mobile/iOS UI change, confirm a screen renders correctly, check web↔mobile parity from the mobile side, or reproduce a TestFlight report on the simulator. The agent's eyes and hands for mobile.
---

# Suppr iOS Simulator Testing — eyes and hands

**Do not ask Grace to drag simulator screenshots into chat.** Use the **`ios-simulator` MCP server** (see `docs/testing/agent-eyes-and-hands.md` and `.cursor/mcp.json`). Prerequisite: `npm run agent:verify-tools` passes (IDB + companion).

When asked to test a feature or verify a mobile UI change:

1. **Metro running**: `npm run mobile:dev` or `npm run mobile:dev:maestro` (port 8081 for Maestro-aligned flows).
2. **Dev client on sim**: `npm run mobile:ios:simulator` if not installed or after native dependency changes.
3. **`get_booted_sim_id`** — confirm a booted simulator.
4. **`launch_app`** — `bundle_id: com.supprclub.supprapp`, `terminate_running: true` after module-level layout/font/ring changes (Fast Refresh is not enough).
5. **Navigate** — prefer **deep links** from `sitemap.md` (`simctl openurl` / MCP equivalents); then `ui_find_element`, `ui_tap`, `ui_swipe` (scroll is required for below-fold Today content).
6. **Verify** — `ui_describe_all` or `ui_find_element`; compare expected labels/states.
7. **See pixels** — `screenshot` or `ui_view`; **Read the image file** in the repo (`apps/mobile/screenshots/agent/`). Never claim a visual pass from accessibility text alone.
8. **Report** — pass/fail per surface + screenshot path.

## MCP tool names (`ios-simulator`)

| Intent | Tool |
|--------|------|
| Booted UDID | `get_booted_sim_id` |
| Launch Suppr | `launch_app` |
| Full a11y tree | `ui_describe_all` |
| Find by label | `ui_find_element` |
| Tap / swipe / type | `ui_tap`, `ui_swipe`, `ui_type` |
| Screenshot | `screenshot` or `ui_view` |

Shell fallback when MCP unavailable: `idb`, `xcrun simctl` — same semantics as `sitemap.md`.

## When something looks wrong

1. `ui_describe_all` — expected vs actual elements
2. Screenshot for Grace only if MCP cannot fix in-session
3. Propose a code fix; re-run steps 4–7 after rebuild/relaunch

## Suppr specifics

- **Bundle id:** `com.supprclub.supprapp`
- **Auth:** Apple Sign In (no email/password QA form)
- **Tabs:** Today / Plan / ＋(FAB) / Recipes / Progress — Settings via avatar, not a tab
- **Map:** `sitemap.md` (deep links + tabs)
- **idb PATH:** `~/.local/bin/idb` via pipx + Python 3.12 (`fb-idb` breaks on 3.14)
