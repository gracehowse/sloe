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
