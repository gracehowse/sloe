import type { ConfigPlugin } from "expo/config-plugins";
import { withDangerousMod } from "expo/config-plugins";
import fs from "node:fs";
import path from "node:path";

/**
 * Xcode "Run Script" phases (Hermes, ReactNativeDependencies, etc.) run with a minimal
 * PATH, so `command -v node` in `.xcode.env` is often empty. Write `NODE_BINARY` to
 * `.xcode.env.local` using the Node that executed prebuild (always valid on that Mac).
 */
export const withXcodeNodeBinary: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;
      const localPath = path.join(iosDir, ".xcode.env.local");
      const nodeBinary = process.execPath;

      const prev = fs.existsSync(localPath) ? fs.readFileSync(localPath, "utf8") : "";
      const kept = prev
        .split("\n")
        .filter((line) => {
          const t = line.trim();
          return t.length > 0 && !t.startsWith("export NODE_BINARY=");
        })
        .join("\n");

      const next = [
        kept,
        `# Auto-generated: Node path for Xcode script phases (withXcodeNodeBinary)`,
        `export NODE_BINARY="${nodeBinary}"`,
      ]
        .filter(Boolean)
        .join("\n");

      fs.writeFileSync(localPath, `${next}\n`, "utf8");
      return cfg;
    },
  ]);
