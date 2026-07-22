/**
 * ENG-1654 — Xcode 26.x Clang rejects fmt's consteval helpers (transitive via
 * Folly/RN). After `expo prebuild`, patch the generated Podfile's post_install
 * so the `fmt` pod defines `FMT_USE_CONSTEVAL=0`.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const FMT_PATCH = `
    # ENG-1654 — Xcode 26.x Clang rejects fmt consteval; disable for local builds.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |bc|
        defs = bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
        defs = ['$(inherited)'] if defs.nil?
        defs = [defs] unless defs.is_a?(Array)
        defs << 'FMT_USE_CONSTEVAL=0' unless defs.any? { |d| d.to_s.include?('FMT_USE_CONSTEVAL') }
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end
`;

function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      if (!fs.existsSync(podfilePath)) return cfg;
      let text = fs.readFileSync(podfilePath, "utf8");
      if (text.includes("FMT_USE_CONSTEVAL")) return cfg;
      if (!text.includes("post_install do |installer|")) return cfg;
      // Insert before the final `end` of the post_install block (last `end` of target).
      const marker = "      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end";
      if (text.includes(marker)) {
        text = text.replace(
          marker,
          `      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )${FMT_PATCH}  end`,
        );
      } else {
        // Fallback: append before the last `end` in the file.
        const lastEnd = text.lastIndexOf("\nend\n");
        if (lastEnd === -1) return cfg;
        text = `${text.slice(0, lastEnd)}\n${FMT_PATCH}${text.slice(lastEnd)}`;
      }
      fs.writeFileSync(podfilePath, text, "utf8");
      return cfg;
    },
  ]);
}

module.exports = withFmtConstevalFix;
