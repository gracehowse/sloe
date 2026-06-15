#!/usr/bin/env bash
# Merge ios-simulator + playwright MCP into ~/.cursor/mcp.json (keeps existing servers).
# Run after: pipx install fb-idb, brew install idb-companion
# See docs/testing/agent-eyes-and-hands.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.local/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"

CURSOR_MCP="${HOME}/.cursor/mcp.json"
AGENT_SCREENSHOTS="${ROOT}/apps/mobile/screenshots/agent"
IDB_PATH="$(command -v idb || true)"

mkdir -p "$AGENT_SCREENSHOTS"

if [[ -z "$IDB_PATH" ]]; then
  echo "idb not on PATH. Install: pipx install fb-idb --python /opt/homebrew/bin/python3.12" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node required for npx MCP servers" >&2
  exit 1
fi

export SUPPR_ROOT="$ROOT"
export SUPPR_IDB_PATH="$IDB_PATH"
export SUPPR_AGENT_SCREENSHOTS="$AGENT_SCREENSHOTS"

ENV_LOCAL="${ROOT}/.env.local"
if [[ -f "$ENV_LOCAL" ]]; then
  LINEAR_API_KEY="$(grep -E '^LINEAR_API_KEY=' "$ENV_LOCAL" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  export LINEAR_API_KEY
fi

node <<'NODE'
const fs = require("fs");
const path = require("path");

const cursorPath = path.join(process.env.HOME, ".cursor/mcp.json");
const root = process.env.SUPPR_ROOT;
const idbPath = process.env.SUPPR_IDB_PATH;
const outDir = process.env.SUPPR_AGENT_SCREENSHOTS;

let cfg = { mcpServers: {} };
if (fs.existsSync(cursorPath)) {
  cfg = JSON.parse(fs.readFileSync(cursorPath, "utf8"));
}
cfg.mcpServers = cfg.mcpServers || {};

cfg.mcpServers["ios-simulator"] = {
  command: "npx",
  args: ["-y", "ios-simulator-mcp"],
  env: {
    PATH: [
      path.join(process.env.HOME, ".local/bin"),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
    ].join(":"),
    IOS_SIMULATOR_MCP_IDB_PATH: idbPath,
    IOS_SIMULATOR_MCP_DEFAULT_OUTPUT_DIR: outDir,
  },
};

cfg.mcpServers.playwright = {
  command: "npx",
  args: ["-y", "@playwright/mcp@latest"],
};

// Official Mobbin MCP (remote HTTP + browser OAuth). Requires Mobbin Pro/Team.
// https://docs.mobbin.com/mcp/clients/cursor
cfg.mcpServers.Mobbin = {
  type: "http",
  url: "https://api.mobbin.com/mcp",
  headers: {},
};

const linearKey = process.env.LINEAR_API_KEY?.trim();
if (linearKey) {
  cfg.mcpServers.linear = {
    url: "https://mcp.linear.app/mcp",
    headers: { Authorization: `Bearer ${linearKey}` },
  };
}

fs.mkdirSync(path.dirname(cursorPath), { recursive: true });
fs.writeFileSync(cursorPath, JSON.stringify(cfg, null, 2) + "\n");
console.log("Updated", cursorPath);
console.log("  + ios-simulator (idb:", idbPath + ")");
console.log("  + playwright");
console.log("  + Mobbin (https://api.mobbin.com/mcp — Connect in Cursor MCP settings)");
if (linearKey) {
  console.log("  + linear (https://mcp.linear.app/mcp — API key from .env.local)");
} else {
  console.log("  (skip linear — add LINEAR_API_KEY to .env.local to enable)");
}
console.log("Restart Cursor, then enable servers in MCP settings; click Connect on Mobbin to sign in.");
NODE
