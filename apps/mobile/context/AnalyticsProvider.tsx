import { PostHogProvider } from "posthog-react-native";
import type { ReactNode } from "react";
import { getPostHogClient } from "../lib/analytics";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const client = getPostHogClient();
  if (!client) return <>{children}</>;
  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}
