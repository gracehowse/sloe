/**
 * Local `expo run:ios` / Xcode builds invoke sentry-cli during the bundle step. Without
 * SENTRY_ORG + auth token, the build fails with exit 65. EAS Build sets those in CI.
 *
 * This writes ios/.xcode.env.local so Xcode exports SENTRY_DISABLE_AUTO_UPLOAD=true
 * unless we're on EAS (then uploads can run when secrets are present).
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withSentryDisableUploadLocalXcode(config) {
  if (process.env.EAS_BUILD === "true") {
    return config;
  }
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const envPath = path.join(iosRoot, ".xcode.env.local");
      const line = "export SENTRY_DISABLE_AUTO_UPLOAD=true\n";
      let text = "";
      try {
        text = fs.readFileSync(envPath, "utf8");
      } catch {
        /* file may not exist yet */
      }
      if (!text.includes("SENTRY_DISABLE_AUTO_UPLOAD")) {
        const sep = text.length > 0 && !text.endsWith("\n") ? "\n" : "";
        fs.mkdirSync(iosRoot, { recursive: true });
        fs.writeFileSync(envPath, `${text}${sep}${line}`, "utf8");
      }
      return cfg;
    },
  ]);
}

module.exports = withSentryDisableUploadLocalXcode;
