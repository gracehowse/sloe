import { Platform, Share } from "react-native";
import type Svg from "react-native-svg";

/**
 * shareRecapPng (ENG-1225 #4) — rasterise the rendered WeeklyRecapCard `<Svg>`
 * to a PNG and hand it to the iOS share sheet. Mirrors the web Save/Share
 * (`recapSvgToPngBlob` → download / navigator.share) with no extra native dep:
 * `react-native-svg`'s `toDataURL()` gives base64 PNG, `expo-file-system` writes
 * it to a cache file, and RN's built-in `Share.share({ url })` opens the sheet
 * (the same path `exportEverything.ts` uses — no `expo-sharing` needed).
 */
export type RecapShareResult =
  | { ok: true; fileUri: string }
  | { ok: false; reason: "unsupported" | "rasterise_failed" | "filesystem_unavailable" | "write_failed" | "share_failed"; message: string };

/** SVG ref shape — `toDataURL(cb)` is the react-native-svg `Svg` instance API. */
type SvgWithDataUrl = InstanceType<typeof Svg> & {
  toDataURL?: (cb: (base64: string) => void, options?: object) => void;
};

function rasterise(node: SvgWithDataUrl): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof node.toDataURL !== "function") {
      resolve(null);
      return;
    }
    try {
      // react-native-svg returns the raw base64 PNG (no data: prefix).
      node.toDataURL((base64) => resolve(base64 || null));
    } catch {
      resolve(null);
    }
  });
}

export async function shareRecapPng(
  svgNode: SvgWithDataUrl | null,
): Promise<RecapShareResult> {
  if (Platform.OS !== "ios") {
    return { ok: false, reason: "unsupported", message: "Sharing is available on iOS." };
  }
  if (!svgNode) {
    return { ok: false, reason: "rasterise_failed", message: "The recap card isn't ready yet." };
  }

  const base64 = await rasterise(svgNode);
  if (!base64) {
    return { ok: false, reason: "rasterise_failed", message: "We couldn't render your recap image." };
  }

  // expo-file-system v19 moved the string-write helpers (`cacheDirectory`,
  // `writeAsStringAsync`) to the `/legacy` submodule; the root module is the new
  // Paths/File API. Probe legacy first, fall back to the root for forward-compat.

  let fsMod: any;
  try {

    fsMod = require("expo-file-system/legacy");
  } catch {
    /* legacy submodule unavailable — try the root module below */
  }
  if (typeof fsMod?.writeAsStringAsync !== "function") {
    try {

      fsMod = require("expo-file-system");
    } catch {
      return { ok: false, reason: "filesystem_unavailable", message: "We couldn't access local storage." };
    }
  }
  const cacheDir: unknown =
    fsMod?.cacheDirectory ?? fsMod?.default?.cacheDirectory ?? fsMod?.documentDirectory ?? fsMod?.default?.documentDirectory;
  const writeAsStringAsync: unknown =
    fsMod?.writeAsStringAsync ?? fsMod?.default?.writeAsStringAsync;
  if (typeof cacheDir !== "string" || !cacheDir || typeof writeAsStringAsync !== "function") {
    return { ok: false, reason: "filesystem_unavailable", message: "We couldn't access local storage." };
  }

  const fileUri = `${cacheDir.replace(/\/$/, "")}/sloe-weekly-recap.png`;
  try {
    await (writeAsStringAsync as (uri: string, body: string, opts?: { encoding?: string }) => Promise<void>)(
      fileUri,
      base64,
      { encoding: "base64" },
    );
  } catch (e) {
    return {
      ok: false,
      reason: "write_failed",
      message: e instanceof Error ? `Couldn't save the image: ${e.message}` : "Couldn't save the recap image.",
    };
  }

  try {
    await Share.share({ url: fileUri });
  } catch (e) {
    return {
      ok: false,
      reason: "share_failed",
      message: e instanceof Error ? e.message : "Couldn't open the share sheet.",
    };
  }
  return { ok: true, fileUri };
}
