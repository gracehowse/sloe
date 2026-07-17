import { isFeatureEnabled } from "@/lib/analytics";

/**
 * ENG-1376 — Settings belongs to the root stack once the bottom-chrome
 * contract is enabled. Keep the hidden-tab route alive for flag rollback.
 */
export function settingsRoute(): "/settings" | "/(tabs)/settings-legacy" {
  return isFeatureEnabled("bottom_chrome_contract_v1")
    ? "/settings"
    : "/(tabs)/settings-legacy";
}
