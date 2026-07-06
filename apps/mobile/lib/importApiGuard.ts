import { Alert } from "react-native";
import {
  IMPORT_ERROR_COPY,
  IMPORT_UNAVAILABLE_ALERT_TITLE,
} from "@suppr/shared/recipes/importErrorCopy";

/**
 * ENG-1456 — the ONE "API base is missing" guard for the mobile import
 * surfaces (plan-import, cookbook-import, create-recipe).
 *
 * Before this existed each surface alerted production users with our
 * env-var names ("Set supprApiUrl in app config or EXPO_PUBLIC_API_URL.").
 * The config detail is genuinely useful in a dev build, so `__DEV__`
 * keeps it; production gets the register copy
 * (`client_api_not_configured` in `importErrorCopy.ts`) in user
 * language. Centralised so the dev/prod gate can't drift per-surface.
 */

const DEV_TITLE = "API not configured";
const DEV_DETAIL = "Set supprApiUrl in app config or EXPO_PUBLIC_API_URL.";

/** Alert-style surface (plan-import, create-recipe). */
export function alertApiNotConfigured(devDetail: string = DEV_DETAIL): void {
  if (__DEV__) {
    Alert.alert(DEV_TITLE, devDetail);
  } else {
    Alert.alert(IMPORT_UNAVAILABLE_ALERT_TITLE, IMPORT_ERROR_COPY.client_api_not_configured);
  }
}

/** Inline-banner surface (cookbook-import's redesign path). */
export function apiNotConfiguredMessage(): string {
  return __DEV__
    ? `${DEV_TITLE} — ${DEV_DETAIL}`
    : IMPORT_ERROR_COPY.client_api_not_configured;
}
