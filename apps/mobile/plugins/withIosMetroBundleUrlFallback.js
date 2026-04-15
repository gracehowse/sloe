/**
 * DEBUG bundleURL() for physical devices:
 * 1) RCTBundleURLProvider (Metro /status when possible)
 * 2) RCT_jsLocation without re-probing only for non–private-LAN hosts (tunnel / public), so stale 192.168.x.x
 *    does not loop the same "Could not connect" after /status already failed.
 * 3) ip.txt only when RCT_jsLocation is empty (first install / cleared cache on same Wi‑Fi).
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs/promises");
const path = require("path");

const SNIPPET_MARKER = "shouldAvoidStaticBundleUrl(forPackagerHostPort";

const LEGACY_BLOCK = `  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }`;

const PATCHED_BLOCK = `  /// Metro \`/status\` already failed — rebuilding the same RFC1918 URL from UserDefaults repeats "Could not connect".
  /// Tunnel / public hostnames (e.g. ngrok) are still allowed without a second probe.
  private func shouldAvoidStaticBundleUrl(forPackagerHostPort hostPort: String) -> Bool {
    let trimmed = hostPort.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return true }
    let host: String
    if trimmed.hasPrefix("[") {
      if let end = trimmed.firstIndex(of: "]") {
        host = String(trimmed[trimmed.index(after: trimmed.startIndex)..<end])
      } else {
        return false
      }
    } else {
      let parts = trimmed.split(separator: ":", omittingEmptySubsequences: false)
      host = parts.isEmpty ? trimmed : String(parts[0])
    }
    let lower = host.lowercased()
    if lower == "localhost" || lower == "127.0.0.1" || lower == "::1" { return true }
    if lower.hasPrefix("192.168.") { return true }
    if lower.hasPrefix("10.") { return true }
    if lower.hasPrefix("172.") {
      let bits = lower.split(separator: ".")
      if bits.count >= 2, let second = Int(bits[1]), second >= 16 && second <= 31 { return true }
    }
    return false
  }

  override func bundleURL() -> URL? {
#if DEBUG
    let settings = RCTBundleURLProvider.sharedSettings()
    let bundleRoot = ".expo/.virtual-metro-entry"
    if let url = settings.jsBundleURL(forBundleRoot: bundleRoot) {
      return url
    }
    let cachedJs = (UserDefaults.standard.string(forKey: "RCT_jsLocation") ?? "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if !cachedJs.isEmpty && !shouldAvoidStaticBundleUrl(forPackagerHostPort: cachedJs) {
      return RCTBundleURLProvider.jsBundleURL(
        forBundleRoot: bundleRoot,
        packagerHost: cachedJs,
        enableDev: true,
        enableMinification: false,
        inlineSourceMap: false
      )
    }
    // ip.txt (LAN at Xcode build): only when nothing is cached in RCT_jsLocation — avoids re-forcing the same
    // 192.168.x.x after a stale UserDefaults entry was skipped above. Use Metro --tunnel + Dev Menu if LAN fails.
    if cachedJs.isEmpty,
       let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
       let raw = try? String(contentsOfFile: ipPath, encoding: .utf8) {
      let hostPort = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      if !hostPort.isEmpty {
        return RCTBundleURLProvider.jsBundleURL(
          forBundleRoot: bundleRoot,
          packagerHost: hostPort,
          enableDev: true,
          enableMinification: false,
          inlineSourceMap: false
        )
      }
    }
    return nil
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }`;

/** Previous version: always used RCT_jsLocation + ip.txt without skipping private LAN after failed probe. */
const OLD_PATCHED_STALE_LAN_LOOP = `  override func bundleURL() -> URL? {
#if DEBUG
    let settings = RCTBundleURLProvider.sharedSettings()
    let bundleRoot = ".expo/.virtual-metro-entry"
    if let url = settings.jsBundleURL(forBundleRoot: bundleRoot) {
      return url
    }
    // jsBundleURL can be nil when Metro's /status probe fails from the device, even if a packager
    // host is already known (Expo tunnel URL, prior Dev Menu entry). Build the URL without re-probing.
    if let hostPort = UserDefaults.standard.string(forKey: "RCT_jsLocation"),
       !hostPort.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      let trimmed = hostPort.trimmingCharacters(in: .whitespacesAndNewlines)
      return RCTBundleURLProvider.jsBundleURL(
        forBundleRoot: bundleRoot,
        packagerHost: trimmed,
        enableDev: true,
        enableMinification: false,
        inlineSourceMap: false
      )
    }
    // Last resort: LAN host written at native build (ip.txt). If 192.168.x.x fails, use Metro
    // --tunnel and set the URL from the Dev Menu or open the dev build from \`npx expo start\`.
    if let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
       let raw = try? String(contentsOfFile: ipPath, encoding: .utf8) {
      let hostPort = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      if !hostPort.isEmpty {
        return RCTBundleURLProvider.jsBundleURL(
          forBundleRoot: bundleRoot,
          packagerHost: hostPort,
          enableDev: true,
          enableMinification: false,
          inlineSourceMap: false
        )
      }
    }
    return nil
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }`;

/** Intermediary that returned nil after failed probe — caused "No script URL provided". */
const OLD_PATCHED_RETURN_NIL_ONLY = `  override func bundleURL() -> URL? {
#if DEBUG
    let settings = RCTBundleURLProvider.sharedSettings()
    if let url = settings.jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry") {
      return url
    }
    // Do not read bundled ip.txt here: it embeds the Mac's LAN IP at Xcode build time and forces
    // http://192.168.x.x even when the phone cannot reach that host (AP isolation, VPN, etc.).
    // Use Metro --tunnel, then Dev Menu → "Enter URL" / open from Expo CLI, or delete & reinstall after Metro is up.
    return nil
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }`;

/** Older template: ip.txt only, no RCT_jsLocation fallback. */
const OLD_PATCHED_WITH_IP = `  override func bundleURL() -> URL? {
#if DEBUG
    let settings = RCTBundleURLProvider.sharedSettings()
    if let url = settings.jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry") {
      return url
    }
    // Physical device: default jsBundleURL is nil when Metro /status cannot be reached from the phone
    // (AP isolation, Mac firewall, wrong saved jsLocation). ip.txt is written at native build time
    // (expo/scripts/react-native-xcode.sh). Build the dev URL without re-probing the packager.
    if let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
       let raw = try? String(contentsOfFile: ipPath, encoding: .utf8) {
      let hostPort = raw.trimmingCharacters(in: .whitespacesAndNewlines)
      if !hostPort.isEmpty {
        return RCTBundleURLProvider.jsBundleURL(
          forBundleRoot: ".expo/.virtual-metro-entry",
          packagerHost: hostPort,
          enableDev: true,
          enableMinification: false,
          inlineSourceMap: false
        )
      }
    }
    return nil
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }`;

function withIosMetroBundleUrlFallback(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const appDelegatePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Suppr",
        "AppDelegate.swift",
      );
      let contents = await fs.readFile(appDelegatePath, "utf8");
      if (contents.includes(SNIPPET_MARKER)) {
        return cfg;
      }
      if (contents.includes(OLD_PATCHED_STALE_LAN_LOOP)) {
        contents = contents.replace(OLD_PATCHED_STALE_LAN_LOOP, PATCHED_BLOCK);
        await fs.writeFile(appDelegatePath, contents);
        return cfg;
      }
      if (contents.includes(OLD_PATCHED_RETURN_NIL_ONLY)) {
        contents = contents.replace(OLD_PATCHED_RETURN_NIL_ONLY, PATCHED_BLOCK);
        await fs.writeFile(appDelegatePath, contents);
        return cfg;
      }
      if (contents.includes(OLD_PATCHED_WITH_IP)) {
        contents = contents.replace(OLD_PATCHED_WITH_IP, PATCHED_BLOCK);
        await fs.writeFile(appDelegatePath, contents);
        return cfg;
      }
      if (contents.includes(LEGACY_BLOCK)) {
        contents = contents.replace(LEGACY_BLOCK, PATCHED_BLOCK);
        await fs.writeFile(appDelegatePath, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = withIosMetroBundleUrlFallback;
