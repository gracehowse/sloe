/**
 * DrOutageBanner — disaster-recovery kill-switch banner (mobile).
 *
 * Renders a top-of-app alert ONLY when the PostHog kill-switch flag
 * `dr-full-outage-banner` is ON. Default-OFF: nothing renders in the
 * normal case, so this is its own feature gate (CLAUDE.md flag rule).
 *
 * Copy is driven by the flag's PostHog payload ({ title?, body? } or a
 * plain string), so during an incident the message can change without an
 * app release — see docs/runbooks/disaster-recovery.md § S2 / S7 +
 * Pre-Phase-1 checklist row 7. Falls back to a safe default if empty.
 *
 * posthog-react-native loads flags asynchronously after init, so we
 * re-read on mount, on app-foreground, and on a 30s interval (acceptable
 * latency for a rare DR event — there's no view-update for a refresh).
 *
 * Web parity: src/app/components/ops/DrOutageBanner.tsx.
 */

import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isFeatureEnabled, getFeatureFlagPayload } from "@/lib/analytics";
import { Accent, Spacing } from "@/constants/theme";

const FLAG = "dr-full-outage-banner";
const DEFAULT_BODY =
  "Suppr is temporarily having issues. We're on it — updates at status.suppr.club.";

type OutagePayload = { title?: string; body?: string };

function readPayload(): OutagePayload {
  const p = getFeatureFlagPayload(FLAG);
  if (p && typeof p === "object") return p as OutagePayload;
  if (typeof p === "string") return { body: p };
  return {};
}

export function DrOutageBanner() {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const [payload, setPayload] = useState<OutagePayload>({});

  useEffect(() => {
    const sync = () => {
      setEnabled(isFeatureEnabled(FLAG));
      setPayload(readPayload());
    };
    sync();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    const id = setInterval(sync, 30_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  if (!enabled) return null;

  const { title, body } = payload;
  return (
    <View
      accessibilityRole="alert"
      testID="dr-outage-banner"
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 8,
        paddingHorizontal: Spacing.md,
        backgroundColor: Accent.destructive,
      }}
    >
      <Text
        style={{ color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" }}
      >
        {title ? `${title} ` : ""}
        {body || DEFAULT_BODY}
      </Text>
    </View>
  );
}

export default DrOutageBanner;
