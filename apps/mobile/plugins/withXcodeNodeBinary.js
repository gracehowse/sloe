/**
 * Xcode "Run Script" phases run with a minimal PATH, so `command -v node` in the stock
 * `.xcode.env` is often empty → PhaseScriptExecution failures (Hermes, RN deps, EXConstants).
 * Must be plain `.js` so Expo's Xcode "Generate app.config" step can resolve the plugin
 * (`.ts` plugins fail with PluginError during that phase).
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const XCODE_ENV_TEMPLATE = `# Used when running script phases inside Xcode (Hermes, ReactNativeDependencies, bundler, etc.).
# Patched by withXcodeNodeBinary — Expo prebuild's default \`command -v node\` is often empty here.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if [ -z "$NODE_BINARY" ] || [ ! -x "$NODE_BINARY" ]; then
  if [ -x "/opt/homebrew/bin/node" ]; then
    export NODE_BINARY="/opt/homebrew/bin/node"
  elif [ -x "/usr/local/bin/node" ]; then
    export NODE_BINARY="/usr/local/bin/node"
  else
    export NODE_BINARY="$(command -v node || true)"
  fi
fi
`;

function withXcodeNodeBinary(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;
      const envPath = path.join(iosDir, ".xcode.env");
      const localPath = path.join(iosDir, ".xcode.env.local");
      const nodeBinary = process.execPath;

      fs.writeFileSync(envPath, `${XCODE_ENV_TEMPLATE}\n`, "utf8");

      const prev = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : "";
      const kept = prev
        .split("\n")
        .filter((line) => {
          const t = line.trim();
          return (
            t.length > 0 &&
            !t.startsWith("export NODE_BINARY=") &&
            !t.includes("withXcodeNodeBinary")
          );
        })
        .join("\n");

      const next = [
        kept,
        `# Auto-generated: exact Node used for prebuild (withXcodeNodeBinary)`,
        `export NODE_BINARY="${nodeBinary}"`,
      ]
        .filter(Boolean)
        .join("\n");

      fs.writeFileSync(localPath, `${next}\n`, "utf8");
      return cfg;
    },
  ]);
}

module.exports = withXcodeNodeBinary;
