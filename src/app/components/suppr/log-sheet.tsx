"use client";

import { looksLikeMealDescription } from "../../../lib/nutrition/parseMealDescription.ts";
import { LogSheetBarcodeFreePromise } from "./log-sheet-barcode-free-promise.tsx";
import { LogSheetDescribeFlow } from "./log-sheet-describe-flow.tsx";
import {
  LogHubQuickActions,
  type LogHubQuickActionsProps,
} from "./log-hub-quick-actions.tsx";

/**
 * LogSheet — canonical log-entry sheet (web), search-first.
 *
 * Production design spec — 2026-04-27 Surface B (post-2026-04-28
 * search-first refactor — see `docs/ux/teardown-2026-04-28-daily-loop.md`
 * Next-10 #12, then 2026-04-30 nested-modal teardown — see customer-lens
 * note in `src/app/components/food-search/FoodSearchPanel.tsx`).
 *
 * Pre-2026-04-28 structure: a 6-pill horizontal tab strip (Search /
 * Scan / Recent / Saved / Voice / Photo) where each tab rendered a
 * different content area.
 *
 * 2026-04-28 refactor: search became the canonical primary input as a
 * tap-to-open `button`. The "tap" handler closed LogSheet and opened
 * a separate `<FoodSearch>` dialog whose first job was rendering an
 * `<Input type="text" />`. Two modals stacked.
 *
 * 2026-04-30 refactor (CURRENT, web parity with mobile commit
 * `1968953`): the search row is now a real `<Input>`. The user opens
 * LogSheet and starts typing IMMEDIATELY. Results render INLINE within
 * the same sheet via a mounted `<FoodSearchPanel>` (the same panel
 * `<FoodSearch>` mounts in its dialog variant). No nested modal, no
 * second animation, no learning step.
 *
 * Wiring fallback: if a host wires the legacy `search.onOpen` but not
 * `search.onSelect`, the search row stays as a tap-to-open `button`
 * and the host's `onOpen` callback fires (preserves the old contract
 * for any sheet that hasn't been migrated yet). Once `search.onSelect`
 * is wired, the sheet flips to inline mode.
 *
 * Right-edge input modes (scan / voice / photo) are unchanged — they
 * still tap-to-open the dedicated modals. Recent + Saved render below
 * the search row WHEN the query is empty; once the user starts typing
 * the panel takes over the content area and Recent/Saved are hidden.
 *
 * Pro gating: voice + photo are Pro-only on free + base tiers. The
 * host passes `locked: true` to surface a small lock badge on those
 * icons; the icon's `onTap` is still called so the host can route
 * to the AI paywall sheet instead of the real flow.
 *
 * Mobile mirror: `apps/mobile/components/today/LogSheet.tsx`.
 */

import * as React from "react";
import {
  BookmarkCheck,
  Clock,
  History,
  Plus,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";

import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "../ui/utils";
import { SupprButton } from "./suppr-button";
import { FoodFallbackThumb } from "./food-fallback-thumb";
import { type SourceDotSource } from "../ui/source-dot";
import { LoggedConfirmation } from "./log-sheet-confirmation";
import { FatSecretBadge } from "../ui/FatSecretBadge";
import { TrustChip } from "../ui/trust-chip";
import { Input } from "../ui/input";
import {
  FoodSearchPanel,
  type FoodSearchSelection as InlineSelectedFood,
  type SupabaseLike as InlineSupabaseLike,
} from "../food-search/FoodSearchPanel";
import type { FavoriteSearchItem as InlineFavoriteSearchItem } from "@/lib/nutrition/favoriteFoodsSearch";
import type { MacroConsumed, MacroTargets } from "@/lib/nutrition/remainingMacros";
import { isPremiumMotionV1Enabled } from "@/lib/preferences/premiumMotionWeb";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { sheetTransition } from "@/lib/motion";
import { InputModeRow } from "./log-sheet-input-mode-row";

/** Re-exported for hosts that want the inline-search payload type. */
export type LogSheetInlineSelectedFood = InlineSelectedFood;

/**
 * Legacy tab-id type retained for backwards compat with deep test
 * references. Post-2026-04-28 the LogSheet does not render a tab
 * strip; the only "tabs" are the Recent / Saved pill toggle below
 * the search row. The type union stays so any host or test still
 * passing `initialTab` compiles cleanly — the prop is ignored.
 */
export type LogSheetTab =
  | "search"
  | "barcode"
  | "recent"
  | "saved"
  | "voice"
  | "photo";

export interface LogSheetSearchResult {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  thumbnail?: string;
}

export interface LogSheetSavedMeal {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
}

/**
 * Library tab row (TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8` +
 * "no way to add from library here", 2026-05-01) -- mirrors the mobile
 * `LogSheetLibraryRecipe` shape so the host can pass the same payload
 * to either platform's LogSheet.
 *
 * Surfaces the user's saved recipes inline in the LogSheet so a one-tap
 * log no longer requires routing through Recipes -> Library -> Detail
 * -> Log. Distinct from `LogSheetSavedMeal` (which represents a "saved
 * combo of foods") -- Library rows are recipe-level entries with a
 * canonical meal-type tag and per-portion kcal.
 */
export interface LogSheetLibraryRecipe {
  id: string;
  title: string;
  /** Per-portion kcal (recipe.calories / recipe.servings, rounded). */
  kcalPerPortion: number;
  /** Optional thumbnail URL -- falls back to a coloured placeholder. */
  thumbnail?: string | null;
  /** Optional meal-type tag (Breakfast / Lunch / Dinner / Snacks).
   *  Resolved from `recipes.meal_type` via the canonical
   *  `journalSlotFromMealTypes` helper at the host. Surfaced as a
   *  small pill on the row so the user knows which slot the one-tap
   *  log will land in. */
  mealTag?: "Breakfast" | "Lunch" | "Dinner" | "Snacks" | null;
}

export interface LogSheetRecentEntry {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  bucket: "today" | "week";
}

/** ENG-928 — go-to row in the empty Log sheet. */
export interface LogSheetGoToEntry {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  count: number;
}

export interface LogSheetBarcodeManualEntry {
  productName: string;
  brand?: string;
  source?: SourceDotSource;
}

export interface LogSheetTabState {
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
  permissionDenied?: boolean;
  showFirstRunTip?: boolean;
}

export interface LogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ignored post-2026-04-28 — kept for backwards compat only. */
  initialTab?: LogSheetTab;
  initialQuery?: string; // ENG-1450 — pre-fills inline search on open (`?openLogQuery=`)
  /** Search foods.
   *
   *  INLINE MODE (preferred, 2026-04-30):
   *    Wire `onSelect` (and budget context if you want fit-this-in).
   *    The search row renders as a real `<Input>` with `autoFocus`,
   *    and as the user types, results render inline within the same
   *    sheet via `<FoodSearchPanel>`. When the user confirms a portion,
   *    `onSelect` fires with the canonical `FoodSearchSelection`
   *    payload — same shape the dialog `<FoodSearch>` emits.
   *
   *  LEGACY TAP-TO-OPEN MODE (kept for hosts that haven't migrated):
   *    Wire `onOpen` only. The search row renders as a tap-to-open
   *    `button` that calls `onOpen` — host is responsible for closing
   *    the LogSheet and opening its own `<FoodSearch>` dialog.
   *
   *  When neither is wired the search row renders but is non-interactive
   *  (host has opted out of search entirely). */
  search?: {
    /** Inline mode — fired when the user picks a portion + quantity. */
    onSelect?: (result: LogSheetInlineSelectedFood) => void;
    /** Inline mode — daily targets for fit-this-in projection. */
    macroTargets?: MacroTargets;
    /** Inline mode — today's running totals for fit-this-in projection. */
    macroConsumed?: MacroConsumed;
    /** Inline mode — Supabase client + userId for custom foods. */
    supabase?: InlineSupabaseLike;
    userId?: string | null;
    /** ENG-772 — journal day for food-search preview time picker. */
    logDateKey?: string;
    /** Inline mode — the user's logging history, newest-first (from
     *  `computeRecentMeals`). Powers the history-first "Past logged" group
     *  that ranks matching past logs above database results (ENG-1033).
     *  When omitted, the group doesn't render. */
    recentFoods?: Array<{
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
      count?: number;
      imageUrl?: string | null;
    }>;
    /** Favourites-in-search (teardown #1, ENG-1041) — the user's starred
     *  foods, surfaced as a "Favourites" group above "Past logged". Threaded
     *  straight through to `<FoodSearchPanel>`. When omitted, none surface. */
    favoriteFoods?: InlineFavoriteSearchItem[];
    /** Star/unstar handler — host owns the optimistic write + revert. */
    onToggleFavorite?: (food: {
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
      favoriteId?: string;
    }) => void;
    /** Keys of favourite toggles in flight (no double-submit). */
    favoritePendingKeys?: Set<string>;
    /** Legacy mode — tap-to-open the host's separate FoodSearch dialog. */
    onOpen?: () => void;
    /** @deprecated */ query?: string;
    /** @deprecated */ onQueryChange?: (q: string) => void;
    /** @deprecated */ results?: LogSheetSearchResult[];
    /** @deprecated */ onAdd?: (result: LogSheetSearchResult) => void;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /** Scan barcode. Click the scan icon → host opens
   *  BarcodeScannerModal. When host injects `manualEntry` (after a
   *  scan resolves to a 0-kcal product), the LogSheet replaces its
   *  default content with the manual-entry recovery form. */
  barcode?: {
    onOpen?: () => void;
    locked?: boolean;
    manualEntry?: LogSheetBarcodeManualEntry | null;
    onConfirmManual?: (
      payload: LogSheetBarcodeManualEntry & {
        portionGrams: number;
        kcal: number;
        protein: number;
        carbs: number;
        fat: number;
      },
    ) => void;
    /** @deprecated */ cameraSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  recent?: {
    entries: LogSheetRecentEntry[];
    onPick: (entry: LogSheetRecentEntry) => void;
    state?: LogSheetTabState;
  };
  saved?: {
    meals: LogSheetSavedMeal[];
    onPick: (meal: LogSheetSavedMeal) => void;
    /** ENG-776 — open the host's save-usual-meal flow. */
    onCreateSavedMeal?: () => void;
    state?: LogSheetTabState;
  };
  /** Library tab -- user's saved recipes, surfaced inline so one-tap
   *  logging no longer requires routing through Recipes -> Library ->
   *  Detail. Sourced from TestFlight Build 40 feedback
   *  `AECfotBlQgwfgxYHr4dDaM8` ("No way to add recipes saved to
   *  library from here") + sibling reports, 2026-05-01. Mirror of the
   *  mobile `library` prop on the same primitive.
   *
   *  Browse-tab order is Recent / Library / Saved meals -- Recent
   *  remains the most-frequent default (eat-again loop); Library
   *  sits next so the saved-recipe path is discoverable but doesn't
   *  steal first-tap from the eat-again user.
   *
   *  When `library` is undefined the tab is hidden entirely. When
   *  `library` is provided with an empty list, the empty state with
   *  a "Browse recipes" CTA renders. */
  library?: {
    recipes: LogSheetLibraryRecipe[];
    onPick: (recipe: LogSheetLibraryRecipe) => void;
    /** Empty-state CTA -- typically routes to /recipes. When
     *  undefined, the empty state hides the button. */
    onBrowseRecipes?: () => void;
    state?: LogSheetTabState;
  };
  /** Voice log. Click the mic icon → host closes LogSheet and opens
   *  VoiceLogDialog (or the AI paywall for free / base tiers). */
  voice?: {
    onStart?: () => void;
    locked?: boolean;
    /** @deprecated */ micSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /** Photo log. Click the camera icon → host closes LogSheet and
   *  opens PhotoLogDialog (or the AI paywall for free / base). */
  photo?: {
    onCapture?: () => void;
    locked?: boolean;
    /** @deprecated */ shutterSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /**
   * ENG-1252 — when true, render a one-line discoverability tooltip
   * ("AI logging — available with Pro.") under the LOCKED Voice / Snap
   * chip in `InputModeRow`. The host owns the gate (flag
   * `logsheet_ai_method_tooltip` ON × free tier × first ~3 sessions) via
   * `@/lib/today/aiMethodTooltip`; the sheet stays tier-agnostic and only
   * renders the bubble under chips it's already showing as locked.
   * Undefined / false → no tooltip (byte-identical to before). Mirror of
   * the mobile `aiMethodTooltipVisible`. */
  aiMethodTooltipVisible?: boolean;
  /** "Or add manually →" footer link. Host typically wires this to
   *  open the manual quick-add form. When undefined the footer is
   *  hidden. */
  onAddManually?: () => void;
  /** Whether to render the desktop-modal layout instead of the mobile
   *  drawer. When undefined, falls back to the bottom-sheet
   *  default. */
  desktop?: boolean;
  /** "Copy yesterday" quick-log shortcut (ENG-709). When provided,
   *  a row appears above the browse tabs. `onTap` fires when the user
   *  clicks it; host shows confirmation dialog + performs the copy. */
  copyYesterday?: { count: number; onTap: () => void } | null;
  /** ENG-1247 — LogHub quick-action row (Log usual / Copy yesterday /
   *  Duplicate day) rendered above the browse tabs, replacing the
   *  standalone `copyYesterday` row. When provided, the row renders ONLY
   *  the actions whose handlers are present (no dead buttons) and the
   *  standalone copy-yesterday row is suppressed. The host flag-gates which
   *  prop it threads: `loghub_quick_actions_v1` ON → `quickActions`; OFF →
   *  `copyYesterday`. Presentation-only — reuses existing commit paths.
   *  Mirror of the mobile `LogSheet` `quickActions` prop. Shape:
   *  {@link LogHubQuickActionsProps}. */
  quickActions?: LogHubQuickActionsProps | null;
  /** ENG-928 — slot-aware go-to foods above browse tabs (empty query). */
  goTos?: {
    entries: LogSheetGoToEntry[];
    onPick: (entry: LogSheetGoToEntry) => void;
  };
  /** ENG-973 — show "Barcode scan is free — always" under the search row. */
  showBarcodeFreePromise?: boolean;
  /** ENG-972 — inline natural-language describe + parse inside the sheet. */
  describe?: {
    locked?: boolean;
    onParse: (text: string) => Promise<import("../../../lib/nutrition/parseMealDescription.ts").ParseMealDescriptionResult>;
    onCommit: (items: import("../../../lib/nutrition/aiLogging.ts").AiLoggedItem[]) => void;
    onPaywall?: () => void;
  };
  /** Log-time meal-slot selector (ENG-773). When provided, a 4-segment
   *  Breakfast/Lunch/Dinner/Snacks control renders under the header so
   *  the user can see AND choose which meal the item lands in, instead
   *  of it being a hidden clock-inferred guess. `current` is the active
   *  slot (host seeds it from time-of-day); `onChange` updates the
   *  host's active slot, which every commit path already reads. Mirror
   *  of the mobile `LogSheet` `slot` prop. */
  slot?: {
    current: string;
    options: readonly string[];
    onChange: (slot: string) => void;
  };
  /** S13 logged-confirmation (Figma 202:2). Presentation-only success
   *  state shown AFTER the host has committed a log. The host owns all
   *  logging + persistence; this is purely the confirming surface. When
   *  set, the sheet content is replaced by a calm "Logged" confirmation
   *  card (item title, estimated kcal, slot) with a primary "Done" and
   *  an optional "Undo". When `null`/undefined the sheet shows its normal
   *  search-first composition. Mirror of the mobile `LogSheet`
   *  `confirmation` prop. */
  confirmation?: {
    /** What was logged — e.g. the food/meal title. */
    title: string;
    /** Kcal of the logged item — `formatQualifiedKcal` renders verified
     *  unqualified, unverified/absent with the `~` qualifier. */
    kcal: number;
    /** ENG-1484 — kcal verification state, feeding the `~` trust qualifier
     *  (`formatQualifiedKcal`, ENG-1417) behind `kcal_trust_qualifier_v1`.
     *  Absent = unverified = honest "~" (ENG-1417 safe default); hosts
     *  adopt path-by-path — see ENG-1502. */
    kcalIsVerified?: boolean;
    /** Slot it landed in (Breakfast / Lunch / Dinner / Snacks). */
    slot?: string;
    /** Provenance dot for the logged item. */
    source?: SourceDotSource;
    /** Dismiss the confirmation (host closes the sheet / resets state). */
    onDone: () => void;
    /** Optional undo — host reverses the just-committed log. Hidden when
     *  undefined. */
    onUndo?: () => void;
  } | null;
}

type BrowseTab = "gotos" | "recent" | "library" | "saved";

export function LogSheet({
  open,
  onOpenChange,
  search,
  barcode,
  recent,
  saved,
  library,
  voice,
  photo,
  aiMethodTooltipVisible = false,
  onAddManually,
  desktop,
  copyYesterday,
  quickActions,
  slot,
  confirmation,
  goTos,
  showBarcodeFreePromise = false,
  describe,
  initialQuery,
}: LogSheetProps) {
  const [browseTab, setBrowseTab] = React.useState<BrowseTab>("recent");
  React.useEffect(() => {
    if (!open) setBrowseTab("recent");
    else if (goTos && goTos.entries.length > 0) setBrowseTab("gotos");
  }, [open, goTos]);

  const inManualEntryMode = !!barcode?.manualEntry;
  const inConfirmationMode = !!confirmation;
  const premiumMotion = isPremiumMotionV1Enabled();

  // ENG-821 parity gap #19 — the sheet shadow was a hardcoded light-only
  // literal (`0 -8px 32px rgba(0,0,0,0.12)`) that under-renders the sheet in
  // dark mode (mobile's `Elevation.sheet` reads the `--elev-sheet` token whose
  // dark variant is alpha 0.5, not 0.12). Under `design_system_elevation` we
  // read the canonical token instead — a no-op in light (byte-identical value)
  // and the correct deeper shadow in dark. The hardcoded literal stays alive in
  // the flag-OFF else, consistent with the sibling dialog gating (CLAUDE.md
  // feature-flag non-negotiable).
  const elevated = isFeatureEnabled("design_system_elevation");
  // ENG-1303 — v3 sheet header copy. OFF → the legacy "Log a meal" (kill switch).
  const sheetTitle = isFeatureEnabled("sloe_v3_log") ? "Add to today" : "Log a meal";
  const sheetShadowCls = elevated
    ? "shadow-[var(--elev-sheet)]"
    : "shadow-[0_-8px_32px_rgba(0,0,0,0.12)]";

  // ENG-812 parity gap #21 — the redesign_motion element→sheet open morph. The
  // shared web analog (`sheetTransition(open)` from src/lib/motion.ts) springs
  // the panel up with the one product spring (SPRING_EASE) and fades the
  // backdrop, matching mobile's `useSheetMorph` on TodayEditMealModal /
  // SavedMealPortionSheet. When ON, the spring drives the entry so the vaul
  // slide must NOT also animate (double-motion jank) — same rule mobile applies
  // via `animationType="none"`. When OFF, the existing premiumMotion slide stays
  // the live path (feature-flag non-negotiable).
  //
  // Scope: the translateY morph only models the BOTTOM-SHEET layout (panel
  // rises from off-screen). In `desktop` mode the panel is a centred modal
  // positioned via `md:-translate-x-1/2 md:-translate-y-1/2`, so an inline
  // translateY would fight that centring — mirroring mobile (which is
  // bottom-sheet-only), the morph is bottom-sheet-only and desktop keeps its
  // existing entry.
  const motionEnabled = isFeatureEnabled("redesign_motion") && !desktop;
  const morph = sheetTransition(open);

  return (
    <DrawerPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      shouldScaleBackground
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay
          data-slot="log-sheet-overlay"
          className={cn(
            !motionEnabled && "data-[state=open]:animate-in data-[state=closed]:animate-out",
            !motionEnabled && "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-md",
          )}
          style={
            motionEnabled
              ? { opacity: morph.backdropOpacity, transition: morph.backdropTransition }
              : undefined
          }
        />
        <DrawerPrimitive.Content
          data-slot="log-sheet-content"
          aria-label="Log a meal"
          aria-describedby={undefined}
          className={cn(
            // Sloe DS — cream page surface, 24px top radius (the Sloe
            // sheet corner, `--radius-card-lg`), hairline top border.
            "fixed z-50 flex flex-col bg-background",
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-[24px] border-t border-border",
            desktop
              ? "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:h-[640px] md:w-[480px] md:max-h-[640px] md:rounded-[24px] md:border"
              : "",
            sheetShadowCls,
            !motionEnabled && premiumMotion
              ? "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              : "",
          )}
          style={
            motionEnabled
              ? { transform: morph.transform, transition: morph.transition }
              : undefined
          }
        >
          {/* Drag handle (mobile) — drops on desktop. */}
          <div
            aria-hidden
            className={cn(
              "mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted",
              desktop ? "md:hidden" : "",
            )}
          />

          {/* Header — Sloe DS: Newsreader serif title in brand plum
              (`text-foreground-brand`), the same editorial-heading
              grammar as the Today section headers. */}
          <div
            data-slot="log-sheet-header"
            className="flex items-center justify-between px-4 pb-3 pt-3"
          >
            <DrawerPrimitive.Title className="font-[family-name:var(--font-headline)] text-[22px] font-medium tracking-tight text-foreground-brand">
              {sheetTitle}
            </DrawerPrimitive.Title>
            <DrawerPrimitive.Close
              aria-label="Close log sheet"
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full",
                "text-muted-foreground hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              )}
            >
              <X className="h-5 w-5" aria-hidden />
            </DrawerPrimitive.Close>
          </div>

          {/* ENG-773 — log-time meal-slot selector. Mirrors the mobile
              LogSheet `slot` row: the slot the item will land in is
              visible + tappable here, not a hidden clock guess. §7 option-chip
              grammar (web parity 2026-06-12, ENG-1022): `rounded-full`, the
              soft tint IS the selection signal — `bg-primary-soft` fill +
              `border-primary-soft` (no accent ring), `text-foreground` label
              (primary text on the tint is only ~3.34:1 and would fail WCAG AA
              for this 13px label; foreground clears it). Was `rounded-lg`
              + a solid `border-primary` ring. Mirror of the mobile
              `slotPill` (§7, `Radius.full`, `primarySoft` border + fill). */}
          {slot && !inConfirmationMode ? (
            <div
              role="radiogroup"
              aria-label="Meal to log to"
              data-slot="log-sheet-slot-row"
              className="flex gap-2 border-b border-border px-4 py-2.5"
            >
              {slot.options.map((s) => {
                const active = slot.current === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`log-sheet-slot-${s.toLowerCase()}`}
                    onClick={() => slot.onChange(s)}
                    className={cn(
                      "flex-1 rounded-full border px-2 py-1.5 text-[13px] font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                      active
                        ? "border-primary-soft bg-primary-soft text-foreground"
                        : "border-border text-foreground-secondary hover:border-primary/30",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          ) : null}

          {inConfirmationMode ? (
            <LoggedConfirmation confirmation={confirmation!} />
          ) : inManualEntryMode ? (
            <BarcodeManualEntry
              entry={barcode!.manualEntry!}
              onConfirm={barcode?.onConfirmManual}
            />
          ) : (
            <DefaultComposition
              open={open}
              search={search}
              barcode={barcode}
              recent={recent}
              saved={saved}
              library={library}
              voice={voice}
              photo={photo}
              aiMethodTooltipVisible={aiMethodTooltipVisible}
              browseTab={browseTab}
              onBrowseTabChange={setBrowseTab}
              onAddManually={onAddManually}
              copyYesterday={copyYesterday}
              quickActions={quickActions}
              goTos={goTos}
              showBarcodeFreePromise={showBarcodeFreePromise}
              describe={describe}
              initialQuery={initialQuery}
            />
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/* -------------------------- Logged confirmation (S13) -------------------------- */
// Extracted to `log-sheet-confirmation.tsx` (ENG-1484, screen-budget ratchet).

/* -------------------------- Default composition -------------------------- */

function DefaultComposition({
  open,
  search,
  barcode,
  recent,
  saved,
  library,
  voice,
  photo,
  aiMethodTooltipVisible,
  browseTab,
  onBrowseTabChange,
  onAddManually,
  copyYesterday,
  quickActions,
  goTos,
  showBarcodeFreePromise,
  describe,
  initialQuery,
}: {
  open: boolean;
  search: LogSheetProps["search"];
  barcode: LogSheetProps["barcode"];
  recent: LogSheetProps["recent"];
  saved: LogSheetProps["saved"];
  library: LogSheetProps["library"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  aiMethodTooltipVisible?: boolean;
  browseTab: BrowseTab;
  onBrowseTabChange: (tab: BrowseTab) => void;
  onAddManually?: () => void;
  copyYesterday?: LogSheetProps["copyYesterday"];
  quickActions?: LogSheetProps["quickActions"];
  goTos?: LogSheetProps["goTos"];
  showBarcodeFreePromise?: boolean;
  describe?: LogSheetProps["describe"];
  initialQuery?: string;
}) {
  const [describeReviewActive, setDescribeReviewActive] = React.useState(false);
  const [describeSeedText, setDescribeSeedText] = React.useState<string | null>(null);
  // ENG-1303 — the Describe method tile expands the inline describe flow. A
  // monotonically-bumped signal (not seed text) so the flow opens EMPTY; the
  // handler paywalls a locked describe exactly as the collapsed entry does.
  const [describeExpandSignal, setDescribeExpandSignal] = React.useState(0);
  const onDescribe = React.useCallback(() => {
    if (describe?.locked) return void describe.onPaywall?.();
    setDescribeExpandSignal((n) => n + 1);
  }, [describe]);
  const showRecent = !!recent;
  const showSaved = !!saved;
  const showLibrary = !!library;
  const showGoTos = !!(goTos && goTos.entries.length > 0);
  // Show the multi-tab toggle whenever 2+ browse sources are wired.
  // ENG-905 (Figma K2): Go-tos is a first-class browse tab when the host
  // threads slot-frequency entries.
  const visibleTabs = React.useMemo<BrowseTab[]>(() => {
    const tabs: BrowseTab[] = [];
    if (showGoTos) tabs.push("gotos");
    if (showRecent) tabs.push("recent");
    if (showLibrary) tabs.push("library");
    if (showSaved) tabs.push("saved");
    return tabs;
  }, [showGoTos, showRecent, showLibrary, showSaved]);
  const showBrowseToggle = visibleTabs.length >= 2;
  const activeTab: BrowseTab = visibleTabs.includes(browseTab)
    ? browseTab
    : (visibleTabs[0] ?? "recent");
  const labelFor = (id: BrowseTab) =>
    id === "gotos"
      ? "Favourites"
      : id === "recent"
        ? "Recent"
        : id === "library"
          ? "My recipes"
          : "Saved meals";

  // Inline-search mode is active when the host wired `search.onSelect`.
  // In that case the search row is a real `<Input>` and results render
  // via `<FoodSearchPanel>` within this same sheet. Without `onSelect`
  // we fall back to the legacy tap-to-open path that routes to a
  // separate `<FoodSearch>` dialog (preserves any host that hasn't
  // migrated yet — e.g. test harnesses calling `LogSheet` with only
  // `onOpen`).
  const inlineMode = !!search?.onSelect;

  // Controlled query; resets on open to `initialQuery` (ENG-1450) or empty.
  const [query, setQuery] = React.useState(initialQuery ?? "");
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setDescribeReviewActive(false);
      setDescribeSeedText(null);
    } else if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [open, initialQuery]);

  return (
    <>
      {!describeReviewActive ? (
        <>
      {/* Search row — primary input. Right-edge icons (scan / voice /
          photo) ride along when the host wires the corresponding
          callbacks. In inline mode the row is a real `<Input>` (focused
          on first appearance); in legacy tap-to-open mode it's a
          `<button>` that fires `search.onOpen`. */}
      <div className="px-3 pt-3">
        {inlineMode ? (
          <div
            data-testid="log-sheet-search-row"
            className={cn(
              "relative flex h-12 w-full items-center gap-2.5 rounded-full border border-border bg-card pl-4 pr-3",
              "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary",
            )}
          >
            <Search
              aria-hidden
              width={18}
              height={18}
              className="text-muted-foreground shrink-0"
            />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods or scan"
              aria-label="Search foods"
              data-testid="log-sheet-search-input"
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                "h-9 flex-1 min-w-0 border-0 bg-transparent px-0 shadow-none",
                "focus-visible:ring-0 focus-visible:border-0",
                "placeholder:text-muted-foreground",
              )}
            />
            {barcode?.onOpen ? (
              <button
                type="button"
                aria-label="Scan barcode"
                onClick={() => barcode.onOpen?.()}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
              >
                <ScanBarcode width={18} height={18} aria-hidden />
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => search?.onOpen?.()}
            aria-label="Search foods"
            className={cn(
              "relative flex h-12 w-full items-center gap-2.5 rounded-full border border-border bg-card pl-4 pr-3 text-left text-[13px] text-muted-foreground",
              "hover:bg-card/80 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <Search
              aria-hidden
              width={18}
              height={18}
              className="text-muted-foreground"
            />
            <span className="flex-1 truncate">Search foods or scan</span>
            {barcode?.onOpen ? (
              <ScanBarcode width={18} height={18} className="shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
          </button>
        )}
        <InputModeRow
          barcode={barcode}
          voice={voice}
          photo={photo}
          describe={describe ? { locked: describe.locked } : undefined}
          aiMethodTooltipVisible={aiMethodTooltipVisible}
          onQuickAdd={onAddManually}
          onDescribe={describe ? onDescribe : undefined}
        />
      </div>

      {showBarcodeFreePromise && barcode?.onOpen ? (
        <LogSheetBarcodeFreePromise onOpen={() => barcode.onOpen?.()} />
      ) : null}
        </>
      ) : null}

      {describe ? (
        <LogSheetDescribeFlow
          sheetOpen={open}
          locked={describe.locked}
          seedText={describeSeedText}
          onSeedConsumed={() => setDescribeSeedText(null)}
          expandSignal={describeExpandSignal}
          onParse={describe.onParse}
          onCommit={describe.onCommit}
          onPaywall={describe.onPaywall}
          onReviewActiveChange={setDescribeReviewActive}
          inputHidden={!describeReviewActive && query.trim().length > 0}
        />
      ) : null}

      {!describeReviewActive ? (
      <div className="flex min-h-0 flex-1 flex-col">
      {/* Inline search results — only mounted when the user has actually
          started typing. Empty query keeps the existing Recent / Saved
          browse content visible so the sheet doesn't look "blank" on
          open. */}
      {inlineMode && query.trim().length > 0 ? (
        <div className="flex flex-1 min-h-0 flex-col pt-2">
          {describe && looksLikeMealDescription(query) ? (
            <button
              type="button"
              data-testid="log-sheet-describe-from-search"
              className="mx-3 mb-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-left text-[13px] font-semibold text-primary-solid hover:bg-primary/15"
              onClick={() => {
                setDescribeSeedText(query.trim());
                setQuery("");
              }}
            >
              Parse as meal description
            </button>
          ) : null}
          <FoodSearchPanel
            query={query}
            macroTargets={search?.macroTargets}
            macroConsumed={search?.macroConsumed}
            supabase={search?.supabase}
            userId={search?.userId}
            logDateKey={search?.logDateKey}
            recentFoods={search?.recentFoods}
            favoriteFoods={search?.favoriteFoods}
            onToggleFavorite={search?.onToggleFavorite}
            favoritePendingKeys={search?.favoritePendingKeys}
            mode="compact"
            onSelect={(result) => {
              search?.onSelect?.(result);
              setQuery("");
            }}
          />
        </div>
      ) : (
        <>
          {quickActions ? (
            <LogHubQuickActions quickActions={quickActions} />
          ) : copyYesterday && copyYesterday.count > 0 ? (
            <button
              type="button"
              data-testid="copy-yesterday-row"
              onClick={copyYesterday.onTap}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-sm hover:bg-muted/60 transition-colors"
              aria-label={`Copy yesterday's ${copyYesterday.count === 1 ? "1 meal" : `${copyYesterday.count} meals`} to today`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-primary"
                aria-hidden="true"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              <span className="flex-1 text-left font-medium text-foreground">
                Copy yesterday&apos;s meals
              </span>
              <span className="text-muted-foreground">
                {copyYesterday.count === 1 ? "1 meal" : `${copyYesterday.count} meals`}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-muted-foreground/60"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          ) : null}

          {/* Browse pill toggle — Go-tos / Recent / Library / Saved. Hidden
              when only one source is available; the available one
              renders directly.
              2026-05-01 (journey-architect P1): all pills carry equal
              weight (font / active-state / hit area) and the Saved
              pill carries a small dot indicator when the user has 3+
              saved meals to nudge first-time users to the tab they
              don't know exists yet. Mobile parity in
              `apps/mobile/components/today/LogSheet.tsx`. */}
          {showBrowseToggle ? (
            <div
              role="tablist"
              aria-label="Browse meals"
              className="mx-3 mt-5 flex gap-6 border-b border-border"
            >
              {visibleTabs.map((id) => {
                const active = activeTab === id;
                const savedCount = saved?.meals?.length ?? 0;
                const showSavedDot = id === "saved" && savedCount >= 3;
                const baseLabel = labelFor(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={
                      showSavedDot ? `${baseLabel} — ${savedCount} saved` : baseLabel
                    }
                    data-testid={
                      id === "gotos"
                        ? "log-sheet-tab-gotos"
                        : id === "recent"
                          ? "log-sheet-tab-recent"
                          : id === "library"
                            ? "log-sheet-tab-library"
                            : "log-sheet-tab-saved"
                    }
                    onClick={() => onBrowseTabChange(id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 pb-3 text-sm transition-colors -mb-px border-b-2",
                      active
                        ? "border-foreground font-semibold text-foreground"
                        : "border-transparent font-normal text-muted-foreground hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    )}
                  >
                    {baseLabel}
                    {showSavedDot ? (
                      <span
                        data-testid="log-sheet-tab-saved-dot"
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-primary"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Browse content */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 pt-3">
            {showGoTos && activeTab === "gotos" ? (
              <GoToList goTos={goTos!} embedded />
            ) : null}
            {showRecent && activeTab === "recent" ? (
              <RecentList recent={recent!} />
            ) : null}
            {showLibrary && activeTab === "library" ? (
              <LibraryList library={library!} />
            ) : null}
            {showSaved && activeTab === "saved" ? (
              <SavedList saved={saved!} />
            ) : null}
            {!showGoTos && !showRecent && !showSaved && !showLibrary ? (
              <p className="py-12 text-center text-[11px] text-muted-foreground">
                Search above for foods, or scan / speak / snap a photo.
              </p>
            ) : null}
          </div>

          {search?.macroTargets && search?.macroConsumed ? (
            <LogSheetDailyProgress
              macroTargets={search.macroTargets}
              macroConsumed={search.macroConsumed}
            />
          ) : null}
        </>
      )}
      </div>
      ) : null}
    </>
  );
}

/* -------------------------- Go-to foods (ENG-928) -------------------------- */

function GoToList({
  goTos,
  embedded = false,
}: {
  goTos: NonNullable<LogSheetProps["goTos"]>;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? undefined : "px-3 pt-3"} data-testid="log-sheet-go-tos">
      {embedded ? null : (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Go-tos for this meal
        </p>
      )}
      {goTos.entries.map((entry) => (
        <BrowseRow
          key={entry.id}
          title={entry.title}
          kcal={entry.kcal}
          source={entry.source}
          onPick={() => goTos.onPick(entry)}
        />
      ))}
    </div>
  );
}

/* -------------------------- Daily progress footer (Figma 336:2) -------------------------- */

function LogSheetDailyProgress({
  macroTargets,
  macroConsumed,
}: {
  macroTargets: MacroTargets;
  macroConsumed: MacroConsumed;
}) {
  const kcalTarget = Math.round(macroTargets.calories);
  const kcalConsumed = Math.round(macroConsumed.calories);
  // ENG-1453: the kcal figure carries state colour like its P/C/F siblings —
  // over-budget amber past target, neutral otherwise (mirrors mobile + dial).
  const kcalOver = kcalTarget > 0 && kcalConsumed > kcalTarget;
  return (
    <div
      data-testid="log-sheet-daily-progress"
      className="mx-3 mt-3 flex items-center justify-between border-t border-border pt-4"
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Daily progress
        </p>
        <p className={cn("font-[family-name:var(--font-headline)] text-xl", kcalOver ? "text-over-budget-fg" : "text-foreground")}>
          {kcalConsumed}{" "}
          <span className="text-sm font-[family-name:var(--font-body)] text-muted-foreground">
            / {kcalTarget} kcal
          </span>
        </p>
      </div>
      <div className="flex gap-4 text-center">
        {(
          [
            ["P", macroConsumed.protein, "text-macro-protein"],
            ["C", macroConsumed.carbs, "text-macro-carbs"],
            ["F", macroConsumed.fat, "text-macro-fat"],
          ] as const
        ).map(([letter, grams, colorClass]) => (
          <div key={letter}>
            <p className={cn("font-[family-name:var(--font-headline)] text-[15px] tabular-nums", colorClass)}>
              {Math.round(grams)}g
            </p>
            <p className="text-[10px] text-muted-foreground">{letter}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------- Recent list -------------------------- */

function RecentList({ recent }: { recent: NonNullable<LogSheetProps["recent"]> }) {
  const { entries, onPick, state } = recent;
  const today = entries.filter((e) => e.bucket === "today");
  const week = entries.filter((e) => e.bucket === "week");

  if (state?.loading) return <SkeletonList />;

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Clock width={28} height={28} className="mx-auto text-muted-foreground" aria-hidden />
        <p className="mt-2 text-[13px] font-semibold text-foreground">
          Your recent foods will appear here
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Log something once and it&rsquo;ll show up next time.
        </p>
      </div>
    );
  }

  return (
    <div>
      {today.length > 0 ? (
        <section>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Today&rsquo;s recents
          </h3>
          {today.map((e) => (
            <BrowseRow
              key={e.id}
              title={e.title}
              kcal={e.kcal}
              source={e.source}
              onPick={() => onPick(e)}
            />
          ))}
        </section>
      ) : null}
      {week.length > 0 ? (
        <section className="mt-4">
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Earlier this week
          </h3>
          {week.map((e) => (
            <BrowseRow
              key={e.id}
              title={e.title}
              kcal={e.kcal}
              source={e.source}
              onPick={() => onPick(e)}
            />
          ))}
        </section>
      ) : null}
      {entries.some((e) => e.source === "fatsecret") ? (
        <FatSecretBadge variant="text" className="mt-2 ml-1" />
      ) : null}
    </div>
  );
}

/* -------------------------- Saved list -------------------------- */

function SavedList({ saved }: { saved: NonNullable<LogSheetProps["saved"]> }) {
  const { meals, onPick, onCreateSavedMeal, state } = saved;

  if (state?.loading) return <SkeletonList />;

  if (meals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <History width={28} height={28} className="mx-auto text-muted-foreground" aria-hidden />
        <p className="mt-2 text-[13px] font-semibold text-foreground">No saved meals yet</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Save a meal you eat often to log it in one tap.
        </p>
        {onCreateSavedMeal ? (
          <SupprButton
            variant="ghost"
            onClick={onCreateSavedMeal}
            aria-label="Save a usual meal"
            label="Save a usual meal"
            className="mt-3"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {meals.map((m) => (
        <BrowseRow
          key={m.id}
          title={m.title}
          kcal={m.kcal}
          source={m.source}
          onPick={() => onPick(m)}
        />
      ))}
      {onCreateSavedMeal ? (
        <SupprButton
          variant="ghost"
          onClick={onCreateSavedMeal}
          aria-label="Save another usual meal"
          label="Save another usual meal"
          className="mt-2"
        />
      ) : null}
    </div>
  );
}

/* -------------------------- Library list -------------------------- */

function LibraryList({ library }: { library: NonNullable<LogSheetProps["library"]> }) {
  const { recipes, onPick, onBrowseRecipes, state } = library;

  if (state?.loading) return <SkeletonList />;

  if (recipes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <BookmarkCheck width={28} height={28} className="mx-auto text-muted-foreground" aria-hidden />
        <p className="mt-2 text-[13px] font-semibold text-foreground">No saved recipes yet</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Save recipes from the Recipes tab to see them here. We&rsquo;ll show your most-cooked recipes first.
        </p>
        {onBrowseRecipes ? (
          // Button system (2026-06-12): the empty-state "Browse recipes" is a
          // SECONDARY action → ghost SupprButton (transparent, plum label),
          // replacing the old off-white bg-secondary fill. Mirror of mobile
          // `LibraryList`.
          <SupprButton
            variant="ghost"
            onClick={onBrowseRecipes}
            aria-label="Browse recipes"
            label="Browse recipes"
            className="mt-3"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {recipes.map((r) => (
        <LibraryRow key={r.id} recipe={r} onPick={() => onPick(r)} />
      ))}
    </div>
  );
}

/* -------------------------- Library row -------------------------- */

function LibraryRow({
  recipe,
  onPick,
}: {
  recipe: LogSheetLibraryRecipe;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Log ${recipe.title}`}
      className={cn(
        "flex w-full items-center rounded-md py-2 px-1 text-left",
        "hover:bg-muted/50 active:bg-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      <FoodFallbackThumb title={recipe.title} imageUrl={recipe.thumbnail} />
      <div className="ml-2 flex-1 min-w-0">
        <p className="truncate text-[13px] text-foreground">{recipe.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {recipe.kcalPerPortion} kcal
          </span>
          {recipe.mealTag ? (
            <span className="rounded border border-border bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
              {recipe.mealTag}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

/* -------------------------- Browse row -------------------------- */

function BrowseRow({
  title,
  kcal,
  source,
  onPick,
  subtitle,
}: {
  title: string;
  kcal: number;
  source: SourceDotSource;
  onPick: () => void;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <FoodFallbackThumb title={title} className="size-11 shrink-0 rounded-xl border border-border" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight text-foreground">{title}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {subtitle ?? `${kcal} kcal`}
        </p>
      </div>
      <button
        type="button"
        onClick={onPick}
        aria-label={`Log ${title}`}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-macro-carbs",
          "hover:bg-card/80 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        <Plus width={16} height={16} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

/* -------------------------- Skeleton -------------------------- */

function SkeletonList() {
  return (
    <div role="status" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center py-2">
          <div className="size-9 rounded-md bg-muted" aria-hidden />
          <div className="ml-2 flex-1 space-y-1.5">
            <div className="h-2.5 w-2/3 rounded bg-muted" aria-hidden />
            <div className="h-2 w-1/3 rounded bg-muted" aria-hidden />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------- Barcode manual entry -------------------------- */

function BarcodeManualEntry({
  entry,
  onConfirm,
}: {
  entry: LogSheetBarcodeManualEntry;
  onConfirm?: NonNullable<NonNullable<LogSheetProps["barcode"]>["onConfirmManual"]>;
}) {
  const [portion, setPortion] = React.useState("100");
  const [kcal, setKcal] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      <div className="rounded-md border bg-card p-3 space-y-1.5">
        <p className="text-[13px] font-bold text-foreground">{entry.productName}</p>
        {entry.brand ? (
          <p className="text-[11px] text-muted-foreground">{entry.brand}</p>
        ) : null}
        <TrustChip variant="manual" />
      </div>

      <p className="text-[11px] text-muted-foreground">
        No nutrition data — enter manually. We&rsquo;ll save this so the next scan
        finds it.
      </p>

      <div className="flex items-center justify-between gap-2">
        <label className="text-[13px] text-muted-foreground" htmlFor="bme-portion">
          Portion (g)
        </label>
        <input
          id="bme-portion"
          aria-label="Portion in grams"
          type="text"
          inputMode="decimal"
          value={portion}
          onChange={(e) => setPortion(e.target.value)}
          className="h-9 w-24 rounded-md border bg-card px-2 text-right tabular-nums text-foreground"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-[13px] text-muted-foreground" htmlFor="bme-kcal">
          kcal
        </label>
        <input
          id="bme-kcal"
          aria-label="Kilocalories"
          type="text"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className="h-9 w-24 rounded-md border bg-card px-2 text-right tabular-nums text-foreground"
        />
      </div>
      <div className="flex gap-2">
        {(
          [
            { id: "bme-protein", label: "Protein (g)", aria: "Protein grams", value: protein, set: setProtein },
            { id: "bme-carbs", label: "Carbs (g)", aria: "Carbs grams", value: carbs, set: setCarbs },
            { id: "bme-fat", label: "Fat (g)", aria: "Fat grams", value: fat, set: setFat },
          ] as const
        ).map((row) => (
          <div key={row.id} className="flex-1">
            <label className="block text-[11px] text-muted-foreground mb-1" htmlFor={row.id}>
              {row.label}
            </label>
            <input
              id={row.id}
              aria-label={row.aria}
              type="text"
              inputMode="decimal"
              value={row.value}
              onChange={(e) => row.set(e.target.value)}
              className="h-9 w-full rounded-md border bg-card px-2 text-right tabular-nums text-foreground"
            />
          </div>
        ))}
      </div>

      {/* Button system (2026-06-12,
          docs/decisions/2026-06-12-button-system-solid-primary.md): the
          manual-entry commit is the sheet's single primary action → SOLID-plum
          SupprButton primary. Mirror of mobile LogSheet `BarcodeManualEntry`. */}
      <SupprButton
        variant="primary"
        aria-label="Log it"
        label="Log it"
        className="w-full"
        onClick={() => {
          if (!onConfirm) return;
          onConfirm({
            ...entry,
            portionGrams: Number(portion) || 100,
            kcal: Number(kcal) || 0,
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
          });
        }}
      />
    </div>
  );
}
