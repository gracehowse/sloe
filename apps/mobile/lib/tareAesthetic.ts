/**
 * Tare aesthetic v1 — mobile flag + preview-override + palette hook.
 *
 * Mobile mirror of `app/tare-aesthetic-gate.tsx` (web). Resolution
 * order on `useTareEnabled()` (first match wins):
 *
 *   1. AsyncStorage `suppr.tare-preview`  — set by the Settings toggle
 *      (or a deep link). Persists per-device.
 *   2. EXPO_PUBLIC_FLAG_FORCE_TARE_AESTHETIC_V1  — dev/E2E env override
 *      (already supported by `isFeatureEnabled()` in lib/analytics.ts).
 *   3. PostHog feature flag `tare-aesthetic-v1`  — canonical roll
 *      mechanism. Default off.
 *
 * Web parity:
 *   - Web uses URL param `?tare=on/off/clear` + localStorage; mobile
 *     has no URL surface, so the AsyncStorage value is set by a
 *     Settings toggle (or programmatically from a deep-link handler).
 *   - The Settings toggle is the equivalent of typing `?tare=on` in
 *     a browser address bar — fast local preview, per-device, doesn't
 *     follow the account into another build.
 *   - The PostHog flag stays the canonical truth for everyone else.
 *
 * Architecture (mirrors `useMacroDisplayStyle.ts`):
 *   - In-process pub/sub keeps every live hook instance in sync. Flip
 *     in Settings → Today re-renders because the hook is subscribed.
 *   - On first mount the hook reads AsyncStorage async. There's a
 *     one-render window where the default (no preview, defer to flag)
 *     renders before the override kicks in. Acceptable for a dev
 *     preview surface; the user explicitly enables it, so the flash
 *     is part of the toggle UX.
 *
 * Consumer pattern:
 *
 *   import { useTarePalette } from "@/lib/tareAesthetic";
 *
 *   function MyComponent() {
 *     const palette = useTarePalette();  // null when off / TarePalette when on
 *     const fg = palette?.fg ?? Accent.text;  // graceful fallback
 *     …
 *   }
 *
 * `useTarePalette()` returns null when the gate is off so consumers
 * fall back to the legacy `Accent` / `MacroColors` constants. This
 * lets us migrate consumers component-by-component instead of doing
 * a single big refactor.
 */

import { useColorScheme } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isFeatureEnabled } from "./analytics";
import { Accent, MacroColors } from "../constants/theme";
import {
  getTarePalette,
  type TareMode,
  type TarePalette,
} from "../constants/tareTokens";

/** AsyncStorage key — mirrors the web localStorage key. */
export const TARE_PREVIEW_KEY = "suppr.tare-preview";

/** PostHog flag key — mirrors the web flag. */
export const TARE_FLAG_KEY = "tare-aesthetic-v1";

/** Override states. `null` means "no override; defer to the flag". */
export type TarePreview = "on" | "off" | null;

/**
 * Validate a raw AsyncStorage string against the canonical preview
 * type. Anything else returns null (clears the override).
 */
function parsePreview(raw: string | null | undefined): TarePreview {
  if (raw === "on" || raw === "off") return raw;
  return null;
}

/** In-process pub/sub. Keeps every live hook instance in sync when
 * the Settings toggle flips the preview. */
const subscribers = new Set<(next: TarePreview) => void>();

/**
 * Read the persisted preview state. Async — `null` on storage error
 * or absent key. Use this from one-off code paths (deep-link handlers
 * etc.); inside React components, use `useTareEnabled()` /
 * `useTarePalette()` instead so re-renders track flips.
 */
export async function readTarePreview(): Promise<TarePreview> {
  try {
    const raw = await AsyncStorage.getItem(TARE_PREVIEW_KEY);
    return parsePreview(raw);
  } catch {
    return null;
  }
}

/**
 * Persist a new preview state. `null` removes the key (so the PostHog
 * flag takes over again). Notifies every live hook subscriber so the
 * UI re-renders immediately — notification fires SYNCHRONOUSLY before
 * the AsyncStorage write starts so any subscriber sees the new value
 * on the same tick the setter is called. The persistence is
 * best-effort async (matches the `useMacroDisplayStyle` pattern: the
 * Settings toggle's responsiveness mustn't wait on disk I/O).
 */
export async function writeTarePreview(next: TarePreview): Promise<void> {
  // Notify synchronously first — every live hook instance re-renders
  // immediately, even before AsyncStorage finishes.
  subscribers.forEach((notify) => notify(next));
  try {
    if (next === null) {
      await AsyncStorage.removeItem(TARE_PREVIEW_KEY);
    } else {
      await AsyncStorage.setItem(TARE_PREVIEW_KEY, next);
    }
  } catch {
    /* storage denied — preview lives in memory only this session */
  }
}

/**
 * Hook the Settings toggle uses. Returns `[preview, setPreview]`
 * where preview is the AsyncStorage-backed override (null when none).
 * Settings flow:
 *
 *   const [preview, setPreview] = useTarePreview();
 *   <Switch value={preview === "on"} onValueChange={(v) => setPreview(v ? "on" : null)} />
 *
 * Setting `null` instead of `"off"` removes the override entirely so
 * the flag decides again. Setting `"off"` would force-disable even
 * when the flag is on — useful for opt-out, less so for "use the
 * default".
 */
export function useTarePreview(): readonly [
  TarePreview,
  (next: TarePreview) => void,
] {
  const [preview, setPreviewState] = useState<TarePreview>(null);

  useEffect(() => {
    let cancelled = false;
    void readTarePreview()
      .then((val) => {
        if (!cancelled) setPreviewState(val);
      })
      .catch(() => {
        /* storage denied — keep null */
      });
    subscribers.add(setPreviewState);
    return () => {
      cancelled = true;
      subscribers.delete(setPreviewState);
    };
  }, []);

  const setPreview = useCallback((next: TarePreview) => {
    setPreviewState(next);
    void writeTarePreview(next);
  }, []);

  return [preview, setPreview] as const;
}

/**
 * Resolve the active gate state. Returns true when the Tare aesthetic
 * should render (preview override OR PostHog flag); false otherwise.
 *
 * Consumers usually don't call this directly — they call
 * `useTarePalette()` which combines this with the colour-scheme
 * lookup. But the boolean is useful for non-styled branches (e.g.
 * "if Tare is enabled, also opt into Newsreader for this Text").
 */
export function useTareEnabled(): boolean {
  const [preview] = useTarePreview();
  // Resolution: preview override wins; otherwise defer to the flag.
  if (preview === "on") return true;
  if (preview === "off") return false;
  return isFeatureEnabled(TARE_FLAG_KEY);
}

/**
 * Return the active Tare palette when the gate is on, `null` when off.
 *
 * Mode resolves from the system `useColorScheme()` (light / dark);
 * callers don't have to pass it. If a screen needs to force a mode
 * (e.g. Cook Mode always-dark) use `getTarePalette(mode)` directly
 * from the constants module instead.
 *
 * Returning `null` (instead of a fallback palette) is deliberate: it
 * lets consumers do an explicit `palette?.fg ?? Accent.text` fallback
 * and migrate to Tare component-by-component instead of one big
 * refactor.
 */
export function useTarePalette(): TarePalette | null {
  const enabled = useTareEnabled();
  const scheme = useColorScheme();
  if (!enabled) return null;
  const mode: TareMode = scheme === "dark" ? "dark" : "light";
  return getTarePalette(mode);
}

/**
 * Return the active macro colour map, Tare-aware. Same shape as the
 * legacy `MacroColors` static object — consumers swap `MacroColors.x`
 * for `macroColors.x` and get the right value automatically based on
 * the Tare gate state.
 *
 * Why a separate hook: 18+ files used `MacroColors.protein` etc as
 * inline static references. The class-of-bug fix is to route them all
 * through one Tare-aware lookup so flipping the gate updates every
 * surface together. Each component does:
 *
 *   const macroColors = useMacroColors();
 *   ... color: macroColors.protein
 *
 * Tare-off path returns the legacy `MacroColors` values verbatim; the
 * fallback chain matches each consumer's prior inline default
 * (e.g. fiber falls back through `MacroColors.fiber ?? Accent.success`
 * because some legacy code paths used that ?? expression).
 */
export function useMacroColors(): {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
  water: string;
} {
  const tare = useTarePalette();
  return useMemo(
    () => ({
      calories: tare?.macroCalories ?? MacroColors.calories,
      protein: tare?.macroProtein ?? MacroColors.protein,
      carbs: tare?.macroCarbs ?? MacroColors.carbs,
      fat: tare?.macroFat ?? MacroColors.fat,
      fiber: tare?.macroFiber ?? MacroColors.fiber ?? Accent.success,
      // Not in the Tare palette yet — keep legacy mapping.
      sugar: MacroColors.sugar,
      sodium: MacroColors.sodium,
      water: tare?.macroWater ?? MacroColors.water ?? Accent.info,
    }),
    [tare],
  );
}

// Re-export the palette types for ergonomics.
export type { TarePalette, TareMode } from "../constants/tareTokens";
