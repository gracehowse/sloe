import Constants from "expo-constants";

type Extra = {
  supprWebUrl?: string;
  supprApiUrl?: string;
};

/** Base URL for web app (privacy, terms). */
export function getSupprWebBase(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const web = extra.supprWebUrl?.trim();
  if (web) return web.replace(/\/$/, "");
  const api = extra.supprApiUrl?.trim();
  if (api) return api.replace(/\/$/, "");
  return "";
}

/**
 * Base URL for Next.js API routes (`/api/...`) from app config / env.
 * Prefer `extra.supprApiUrl` so __DEV__ on a physical device still hits the
 * deployed API (localhost is unreachable from the phone).
 */
export function getSupprApiBase(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  // In dev, explicit env wins over app.json so the sim can hit local
  // Next.js while testing routes that aren't deployed yet.
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
    if (fromEnv) return fromEnv.replace(/\/$/, "");
  }
  const fromExtra = extra.supprApiUrl?.trim();
  if (fromExtra) return fromExtra.replace(/\/$/, "");
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof __DEV__ !== "undefined" && __DEV__) return "http://127.0.0.1:3000";
  return "";
}
