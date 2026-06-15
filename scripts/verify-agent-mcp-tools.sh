#!/usr/bin/env bash
# Verify IDB + companion for ios-simulator-mcp / Cursor agent testing.
# See docs/testing/agent-eyes-and-hands.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/bin:${PATH}"

fail=0
ok() { echo "✓ $*"; }
bad() { echo "✗ $*"; fail=1; }

echo "=== Agent MCP prerequisites (Suppr) ==="

if command -v xcode-select >/dev/null 2>&1 && xcode-select -p >/dev/null 2>&1; then
  ok "Xcode: $(xcode-select -p)"
else
  bad "Xcode command line tools / Xcode.app not configured"
fi

if command -v idb_companion >/dev/null 2>&1 || brew list idb-companion >/dev/null 2>&1; then
  ok "idb-companion (Homebrew)"
else
  bad "idb-companion missing — brew tap facebook/fb && brew install idb-companion"
fi

if command -v idb >/dev/null 2>&1; then
  ok "idb CLI: $(command -v idb)"
  if idb list-targets 2>/dev/null | grep -q Booted; then
    ok "At least one booted simulator"
  else
    echo "  (no booted simulator — boot one in Simulator.app or: xcrun simctl boot <udid>)"
  fi
else
  bad "idb CLI missing — pipx install fb-idb --python /opt/homebrew/bin/python3.12"
fi

AGENT_DIR="${ROOT}/apps/mobile/screenshots/agent"
mkdir -p "$AGENT_DIR"
ok "Agent screenshot dir: $AGENT_DIR"

if command -v npx >/dev/null 2>&1; then
  ok "npx available (ios-simulator-mcp / @playwright/mcp via Cursor MCP)"
else
  bad "npx missing — install Node.js"
fi

CURSOR_MCP="${HOME}/.cursor/mcp.json"
if [[ -f "$CURSOR_MCP" ]]; then
  ok "Cursor MCP config: ~/.cursor/mcp.json"
else
  bad "Missing ~/.cursor/mcp.json — run: npm run agent:setup-mcp"
fi

ENV_LOCAL="${ROOT}/.env.local"
if [[ -f "$ENV_LOCAL" ]] && grep -qE '^LINEAR_API_KEY=' "$ENV_LOCAL"; then
  LINEAR_API_KEY="$(grep -E '^LINEAR_API_KEY=' "$ENV_LOCAL" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  linear_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST https://mcp.linear.app/mcp \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -H "Authorization: Bearer ${LINEAR_API_KEY}" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify","version":"1.0.0"}}}' 2>/dev/null || echo 000)"
  if [[ "$linear_code" == "200" ]]; then
    ok "Linear MCP reachable (API key auth)"
  else
    bad "Linear MCP HTTP ${linear_code} — check LINEAR_API_KEY in .env.local"
  fi
else
  echo "  (LINEAR_API_KEY not in .env.local — Linear MCP skipped)"
fi

if [[ -f "${ROOT}/sitemap.md" ]]; then
  ok "sitemap.md present"
else
  bad "Missing sitemap.md"
fi

echo ""
if [[ "$fail" -eq 0 ]]; then
  echo "All checks passed. Enable ios-simulator + playwright in Cursor MCP, then restart Cursor."
  exit 0
fi

echo "Fix failures above, then re-run: npm run agent:verify-tools"
exit 1
