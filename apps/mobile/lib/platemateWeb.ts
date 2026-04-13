import Constants from "expo-constants";

type Extra = { platemateApiUrl?: string; platemateWebUrl?: string };

/** Base URL for web app (privacy, terms). Prefer `platemateWebUrl`; else same host as API if only Next is deployed. */
export function getPlatemateWebBase(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const web = extra.platemateWebUrl?.trim();
  if (web) return web.replace(/\/$/, "");
  const api = extra.platemateApiUrl?.trim();
  if (api) return api.replace(/\/$/, "");
  return "";
}
