import Constants from "expo-constants";

type Extra = {
  supprWebUrl?: string;
  supprApiUrl?: string;
  /** @deprecated Use supprWebUrl / supprApiUrl in app.json */
  platemateWebUrl?: string;
  platemateApiUrl?: string;
};

/** Base URL for web app (privacy, terms). Prefer `supprWebUrl`; else API host. */
export function getSupprWebBase(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;
  const web = (extra.supprWebUrl ?? extra.platemateWebUrl)?.trim();
  if (web) return web.replace(/\/$/, "");
  const api = (extra.supprApiUrl ?? extra.platemateApiUrl)?.trim();
  if (api) return api.replace(/\/$/, "");
  return "";
}

/** @deprecated Use getSupprWebBase */
export const getPlatemateWebBase = getSupprWebBase;
