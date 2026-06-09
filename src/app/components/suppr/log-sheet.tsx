"use client";

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
  Camera,
  Check,
  ChevronRight,
  Clock,
  History,
  Lock,
  Mic,
  PencilLine,
  ScanBarcode,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";

import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "../ui/utils";
import { SourceDot, type SourceDotSource } from "../ui/source-dot";
import { FatSecretBadge } from "../ui/FatSecretBadge";
import { TrustChip } from "../ui/trust-chip";
import { Input } from "../ui/input";
import {
  FoodSearchPanel,
  type FoodSearchSelection as InlineSelectedFood,
  type SupabaseLike as InlineSupabaseLike,
} from "../food-search/FoodSearchPanel";
import type { MacroConsumed, MacroTargets } from "@/lib/nutrition/remainingMacros";
import { isPremiumMotionV1Enabled } from "@/lib/preferences/premiumMotionWeb";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { sheetTransition } from "@/lib/motion";

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
    /** Estimated kcal of the logged item (always "estimated" copy). */
    kcal: number;
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

type BrowseTab = "recent" | "library" | "saved";

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
  onAddManually,
  desktop,
  copyYesterday,
  slot,
  confirmation,
}: LogSheetProps) {
  const [browseTab, setBrowseTab] = React.useState<BrowseTab>("recent");
  React.useEffect(() => {
    if (!open) setBrowseTab("recent");
  }, [open]);

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
            className="flex items-center justify-between border-b border-border px-4 pb-3 pt-3"
          >
            <DrawerPrimitive.Title className="font-[family-name:var(--font-headline)] text-[22px] font-medium tracking-tight text-foreground-brand">
              Log a meal
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
              visible + tappable here, not a hidden clock guess. Selected
              state uses the canonical soft-tint + primary-border language
              (NOT solid primary) so the `text-foreground` label clears
              WCAG AA — primary text on the tint is only ~3.34:1. */}
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
                      "flex-1 rounded-lg border px-2 py-1.5 text-[13px] font-semibold transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30",
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
              browseTab={browseTab}
              onBrowseTabChange={setBrowseTab}
              onAddManually={onAddManually}
              copyYesterday={copyYesterday}
            />
          )}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/* -------------------------- Logged confirmation (S13) -------------------------- */

/**
 * S13 logged-confirmation (Figma 202:2) — the calm success state shown
 * after a log commits. Presentation-only: the host has already persisted
 * the log; this surface just confirms it and offers Done / Undo. Trust
 * posture: nutrition is always "estimated" (never an absolute claim).
 */
function LoggedConfirmation({
  confirmation,
}: {
  confirmation: NonNullable<LogSheetProps["confirmation"]>;
}) {
  const { title, kcal, slot, source, onDone, onUndo } = confirmation;
  return (
    <div
      data-slot="log-sheet-confirmation"
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center px-5 pb-6 pt-8 text-center"
    >
      {/* Success mark — Sloe sage success tint, calm not loud. */}
      <div className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
        <Check className="size-8" strokeWidth={2.5} aria-hidden />
      </div>

      <h2 className="mt-4 font-[family-name:var(--font-headline)] text-[22px] font-medium tracking-tight text-foreground-brand">
        Logged{slot ? ` to ${slot}` : ""}
      </h2>

      {/* Logged-item card — cream slab, 16px corner, soft lift. */}
      <div className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-[var(--elev-card-soft)]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{title}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {source ? <SourceDot source={source} size={6} /> : null}
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Est. {kcal} kcal
            </span>
          </div>
        </div>
      </div>

      {/* Actions — primary Done + optional quiet Undo. Sloe treatment
          system (2026-06-08): the primary inline CTA is AUBERGINE
          OUTLINE (transparent fill + 1.5px primary-solid border +
          primary-solid label), not a filled slab. Mirror of mobile
          `LogSheet`. */}
      <div className="mt-6 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={onDone}
          aria-label="Done"
          className={cn(
            "h-11 w-full rounded-xl border-[1.5px] border-primary-solid bg-transparent text-[13px] font-bold text-primary-solid",
            "hover:bg-primary/5 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          )}
        >
          Done
        </button>
        {onUndo ? (
          <button
            type="button"
            onClick={onUndo}
            aria-label="Undo log"
            className={cn(
              "h-11 w-full rounded-xl text-[13px] font-semibold text-muted-foreground",
              "hover:bg-muted/50 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            Undo
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
  browseTab,
  onBrowseTabChange,
  onAddManually,
  copyYesterday,
}: {
  open: boolean;
  search: LogSheetProps["search"];
  barcode: LogSheetProps["barcode"];
  recent: LogSheetProps["recent"];
  saved: LogSheetProps["saved"];
  library: LogSheetProps["library"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  browseTab: BrowseTab;
  onBrowseTabChange: (tab: BrowseTab) => void;
  onAddManually?: () => void;
  copyYesterday?: LogSheetProps["copyYesterday"];
}) {
  const showRecent = !!recent;
  const showSaved = !!saved;
  const showLibrary = !!library;
  // Show the multi-tab toggle whenever 2+ browse sources are wired.
  // With Library added (2026-05-01), order is Recent / Library / Saved.
  const visibleTabs = React.useMemo<BrowseTab[]>(() => {
    const tabs: BrowseTab[] = [];
    if (showRecent) tabs.push("recent");
    if (showLibrary) tabs.push("library");
    if (showSaved) tabs.push("saved");
    return tabs;
  }, [showRecent, showLibrary, showSaved]);
  const showBrowseToggle = visibleTabs.length >= 2;
  const activeTab: BrowseTab = visibleTabs.includes(browseTab)
    ? browseTab
    : (visibleTabs[0] ?? "recent");
  const labelFor = (id: BrowseTab) =>
    id === "recent" ? "Recent" : id === "library" ? "Library" : "Saved meals";

  // Inline-search mode is active when the host wired `search.onSelect`.
  // In that case the search row is a real `<Input>` and results render
  // via `<FoodSearchPanel>` within this same sheet. Without `onSelect`
  // we fall back to the legacy tap-to-open path that routes to a
  // separate `<FoodSearch>` dialog (preserves any host that hasn't
  // migrated yet — e.g. test harnesses calling `LogSheet` with only
  // `onOpen`).
  const inlineMode = !!search?.onSelect;

  // Local query state — owned by LogSheet so the input is controlled
  // and `<FoodSearchPanel>` reacts in lock-step. Reset every time the
  // sheet opens so a returning user lands on an empty input, not the
  // previous query.
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
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
              // Sloe DS — cream search slab, pill-soft 14px corner.
              "relative flex h-12 w-full items-center gap-2 rounded-xl bg-muted pl-3 pr-1",
              "focus-within:outline-none focus-within:ring-2 focus-within:ring-primary",
            )}
          >
            <Search
              aria-hidden
              width={16}
              height={16}
              className="text-muted-foreground shrink-0"
            />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods, brands, or recipes"
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
            <RightEdgeIcons barcode={barcode} voice={voice} photo={photo} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => search?.onOpen?.()}
            aria-label="Search foods"
            className={cn(
              // Sloe DS — cream search slab, pill-soft 14px corner.
              "relative flex h-12 w-full items-center gap-2 rounded-xl bg-muted pl-3 pr-1 text-left text-[13px] text-muted-foreground",
              "hover:bg-muted/80 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <Search
              aria-hidden
              width={16}
              height={16}
              className="text-muted-foreground"
            />
            <span className="flex-1 truncate">Search foods, brands, or recipes</span>
            <RightEdgeIcons barcode={barcode} voice={voice} photo={photo} />
          </button>
        )}
      </div>

      {/* Inline search results — only mounted when the user has actually
          started typing. Empty query keeps the existing Recent / Saved
          browse content visible so the sheet doesn't look "blank" on
          open. */}
      {inlineMode && query.trim().length > 0 ? (
        <div className="flex flex-1 min-h-0 flex-col pt-2">
          <FoodSearchPanel
            query={query}
            macroTargets={search?.macroTargets}
            macroConsumed={search?.macroConsumed}
            supabase={search?.supabase}
            userId={search?.userId}
            mode="compact"
            onSelect={(result) => {
              search?.onSelect?.(result);
              // After a successful pick the user has logged something —
              // clear the input so the sheet returns to Recent / Saved
              // view (the host typically also closes the sheet via its
              // own `onSelect` handler).
              setQuery("");
            }}
          />
        </div>
      ) : (
        <>
          {/* Copy yesterday shortcut (ENG-709) — above the browse tabs. */}
          {copyYesterday && copyYesterday.count > 0 && (
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
          )}
          {/* Browse pill toggle — Recent / Library / Saved. Hidden
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
              className="mx-3 mt-3 flex rounded-xl bg-muted p-0.5"
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
                      id === "recent"
                        ? "log-sheet-tab-recent"
                        : id === "library"
                          ? "log-sheet-tab-library"
                          : "log-sheet-tab-saved"
                    }
                    onClick={() => onBrowseTabChange(id)}
                    className={cn(
                      "flex-1 rounded-md py-2 text-[13px] font-semibold transition-colors",
                      // Sloe treatment system (2026-06-08): segmented
                      // control active segment = white lift + primary-solid
                      // label; inactive = muted on the warm-grey rail.
                      active
                        ? "bg-background text-primary-solid shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      {baseLabel}
                      {showSavedDot ? (
                        <span
                          data-testid="log-sheet-tab-saved-dot"
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                        />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Browse content */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 pt-3">
            {showRecent && activeTab === "recent" ? (
              <RecentList recent={recent!} />
            ) : null}
            {showLibrary && activeTab === "library" ? (
              <LibraryList library={library!} />
            ) : null}
            {showSaved && activeTab === "saved" ? (
              <SavedList saved={saved!} />
            ) : null}
            {!showRecent && !showSaved && !showLibrary ? (
              <p className="py-12 text-center text-[11px] text-muted-foreground">
                Search above for foods, or scan / speak / snap a photo.
              </p>
            ) : null}
          </div>

          {/* Footer: "Or add manually" — escape hatch for users who want
              to type macros directly. Host wires this to the manual
              quick-add form. Hidden in inline-search mode (the panel
              owns the bottom of the sheet). */}
          {onAddManually ? (
            <button
              type="button"
              onClick={onAddManually}
              aria-label="Or add manually"
              className={cn(
                "flex w-full items-center gap-2 border-t px-4 py-3 text-left text-[13px] text-muted-foreground",
                "hover:bg-muted/40 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )}
            >
              <PencilLine width={16} height={16} aria-hidden />
              <span className="flex-1">Or add manually</span>
              <ChevronRight width={16} height={16} aria-hidden />
            </button>
          ) : null}
        </>
      )}
    </>
  );
}

/* -------------------------- Right-edge icons -------------------------- */

function RightEdgeIcons({
  barcode,
  voice,
  photo,
}: {
  barcode: LogSheetProps["barcode"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
}) {
  // Render the icons in the documented order: Scan → Voice → Photo
  // (matches the prior tab order to preserve user muscle memory).
  // Each icon only renders when the host wires its callback — no
  // callback, no icon (host opted out).
  const icons: Array<{
    key: "scan" | "voice" | "photo";
    label: string;
    Icon: LucideIcon;
    onClick?: () => void;
    locked: boolean;
  }> = [
    {
      key: "scan",
      label: "Scan barcode",
      Icon: ScanBarcode,
      onClick: barcode?.onOpen,
      locked: barcode?.locked ?? false,
    },
    {
      key: "voice",
      label: "Voice log",
      Icon: Mic,
      onClick: voice?.onStart,
      locked: voice?.locked ?? false,
    },
    {
      key: "photo",
      label: "Photo log",
      Icon: Camera,
      onClick: photo?.onCapture,
      locked: photo?.locked ?? false,
    },
  ];
  return (
    <span className="flex items-center gap-0.5">
      {icons.map(({ key, label, Icon, onClick, locked }) =>
        onClick ? (
          <span
            key={key}
            role="button"
            tabIndex={0}
            aria-label={locked ? `${label} (Pro)` : label}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }}
            className={cn(
              "relative grid h-9 w-9 cursor-pointer place-items-center rounded-md",
              "text-foreground/60 hover:text-foreground hover:bg-foreground/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
          >
            <Icon width={16} height={16} aria-hidden />
            {locked ? (
              // Sloe DS — Pro gate badge in damson (`--accent-win`), the
              // canonical Pro / achievement accent, distinct from the clay
              // primary CTA. A small lock on the icon's top-right corner.
              <span
                className="absolute right-0.5 top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: "var(--accent-win)" }}
              >
                <Lock width={7} height={7} aria-hidden />
              </span>
            ) : null}
          </span>
        ) : null,
      )}
    </span>
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
  const { meals, onPick, state } = saved;

  if (state?.loading) return <SkeletonList />;

  if (meals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <History width={28} height={28} className="mx-auto text-muted-foreground" aria-hidden />
        <p className="mt-2 text-[13px] font-semibold text-foreground">No saved meals yet</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Save a meal you eat often to log it in one tap.
        </p>
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
          // Sloe treatment system (2026-06-08): "Browse" is a SECONDARY
          // action → off-white fill (bg-secondary #F6F5F2) + ink label,
          // no accent. Mirror of mobile `LibraryList`.
          <button
            type="button"
            onClick={onBrowseRecipes}
            aria-label="Browse recipes"
            className={cn(
              "mt-3 h-10 rounded-xl bg-secondary px-5 text-[13px] font-bold text-foreground",
              "hover:bg-secondary/80 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            )}
          >
            Browse recipes
          </button>
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
      {recipe.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.thumbnail}
          alt=""
          aria-hidden
          className="size-9 rounded-md bg-muted object-cover shrink-0"
        />
      ) : (
        <div className="size-9 rounded-md bg-muted shrink-0" aria-hidden />
      )}
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
}: {
  title: string;
  kcal: number;
  source: SourceDotSource;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Log ${title}`}
      className={cn(
        "flex w-full items-center rounded-md py-2 px-1 text-left",
        "hover:bg-muted/50 active:bg-muted transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      )}
    >
      <div className="size-9 rounded-md bg-muted shrink-0" aria-hidden />
      <div className="ml-2 flex-1 min-w-0">
        <p className="truncate text-[13px] text-foreground">{title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <SourceDot source={source} size={6} />
          <span className="text-[11px] tabular-nums text-muted-foreground">{kcal} kcal</span>
        </div>
      </div>
    </button>
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

      <button
        type="button"
        aria-label="Log it"
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
        // Sloe treatment system (2026-06-08): primary inline CTA →
        // aubergine outline (transparent fill + 1.5px primary-solid border
        // + primary-solid label), not a filled slab. Mirror of mobile
        // LogSheet `BarcodeManualEntry`.
        className={cn(
          "h-11 w-full rounded-xl border-[1.5px] border-primary-solid bg-transparent text-[13px] font-bold text-primary-solid",
          "hover:bg-primary/5 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        )}
      >
        Log it
      </button>
    </div>
  );
}
