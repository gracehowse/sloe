import PostHog from "posthog-react-native";
import Constants from "expo-constants";
import type { AnalyticsEventName } from "../../../src/lib/analytics/events";

const POSTHOG_KEY =
  Constants.expoConfig?.extra?.posthogKey ??
  process.env.EXPO_PUBLIC_POSTHOG_KEY ??
  "";
const POSTHOG_HOST =
  Constants.expoConfig?.extra?.posthogHost ??
  process.env.EXPO_PUBLIC_POSTHOG_HOST ??
  "https://us.i.posthog.com";

let client: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  if (client) return client;
  if (!POSTHOG_KEY) return null;

  client = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
  });

  return client;
}

type CaptureProps = NonNullable<Parameters<PostHog["capture"]>[1]>;

export function track(
  event: AnalyticsEventName,
  props?: Record<string, unknown>,
): void {
  getPostHogClient()?.capture(event, props as CaptureProps);
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  getPostHogClient()?.identify(userId, traits as CaptureProps);
}

export function reset(): void {
  getPostHogClient()?.reset();
}
