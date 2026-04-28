"use client";

/**
 * LogSheet — canonical log entry sheet (web).
 *
 * Production design spec — 2026-04-27 Surface B.
 * Authority: D-2026-04-27-15 (one canonical log path).
 *
 * Six sub-tabs collapse the previous 8+ entry-point splay (Quick Add,
 * search, barcode, voice, photo, recipe-detail-log, planned-meal-log,
 * household, copy-meal, usual-meal) into one sheet. Tabs:
 *   1. Search foods   — search input + result rows with `+` per row
 *   2. Scan barcode   — full-bleed camera viewport
 *   3. Recent         — Today's recents + Earlier this week
 *   4. Saved meals    — list of templates
 *   5. Voice log      — 88×88 mic button (Pro-gated upstream)
 *   6. Photo log      — full-bleed shutter (Pro-gated upstream)
 *
 * The primitive is intentionally callback-driven: it does not own the
 * search index, the barcode scanner, or the voice/photo providers. The
 * caller (Today's composition root) injects per-tab handlers that
 * route into the existing flows. This keeps the LogSheet small,
 * testable, and unblocks the entry-point consolidation without
 * requiring a single-PR rewrite of the search / barcode / voice / photo
 * pipelines.
 *
 * Mobile mirror: `apps/mobile/components/today/LogSheet.tsx`.
 */

import * as React from "react";
import {
  Camera,
  Clock,
  History,
  Mic,
  ScanBarcode,
  Search,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";

import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "../ui/utils";
import { SourceDot, type SourceDotSource } from "../ui/source-dot";
import { TrustChip } from "../ui/trust-chip";

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
  /** Calories per shown portion. Numeric so callers can localise. */
  kcal: number;
  source: SourceDotSource;
  /** Optional thumbnail URL (36×36 in the row). */
  thumbnail?: string;
}

export interface LogSheetSavedMeal {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
}

export interface LogSheetRecentEntry {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  /** "today" → "Today's recents" group; "week" → "Earlier this week". */
  bucket: "today" | "week";
}

/**
 * Barcode-found-but-no-nutrition state. Rendering this in-tab is the
 * fix for journey-architect Top Broken Journey #5 (the barcode lookup
 * dead-end on 0-kcal products). Surfaces an editable portion + macros
 * form pre-populated at zero so the user can capture what's on the
 * physical pack without bouncing them out of the flow.
 */
export interface LogSheetBarcodeManualEntry {
  productName: string;
  /** When the product is unrecognised this is undefined; when found
   *  but missing nutrition, it carries whatever metadata we did get. */
  brand?: string;
  source?: SourceDotSource;
}

export interface LogSheetTabState {
  /** Whether this tab is in a loading state (skeletons render). */
  loading?: boolean;
  /** Whether this tab is in an error state (offline / API down). */
  error?: boolean;
  /** Whether this tab is offline (Search caches recents + saved). */
  offline?: boolean;
  /** Permission denied flag for camera/mic-bound tabs. */
  permissionDenied?: boolean;
  /** First-run tip card (Voice / Photo). Dismissable upstream. */
  showFirstRunTip?: boolean;
}

export interface LogSheetProps {
  /** Whether the sheet is open. */
  open: boolean;
  /** Called when the sheet should close (drag down, X, backdrop). */
  onOpenChange: (open: boolean) => void;
  /** Initial tab. Defaults to "search". */
  initialTab?: LogSheetTab;
  /** Search-foods state. */
  search?: {
    query: string;
    onQueryChange: (q: string) => void;
    results: LogSheetSearchResult[];
    onAdd: (result: LogSheetSearchResult) => void;
    state?: LogSheetTabState;
  };
  /** Scan-barcode state. */
  barcode?: {
    /** Slot for the camera viewport (caller renders `<BarcodeCameraView>`
     *  or a placeholder when permission is denied). */
    cameraSlot?: React.ReactNode;
    /** When a barcode resolves to a product with 0 kcal, the parent
     *  injects this so the LogSheet can render the manual-entry
     *  fallback inline (closes Top Broken Journey #5). */
    manualEntry?: LogSheetBarcodeManualEntry | null;
    /** Save-handler for the manual fallback. */
    onConfirmManual?: (
      payload: LogSheetBarcodeManualEntry & {
        portionGrams: number;
        kcal: number;
        protein: number;
        carbs: number;
        fat: number;
      },
    ) => void;
    state?: LogSheetTabState;
  };
  /** Recent state — separated into Today + Earlier-this-week groups. */
  recent?: {
    entries: LogSheetRecentEntry[];
    onPick: (entry: LogSheetRecentEntry) => void;
    state?: LogSheetTabState;
  };
  /** Saved-meals state. */
  saved?: {
    meals: LogSheetSavedMeal[];
    onPick: (meal: LogSheetSavedMeal) => void;
    state?: LogSheetTabState;
  };
  /** Voice-log state. */
  voice?: {
    /** Slot for the mic button — caller wires recording state. */
    micSlot?: React.ReactNode;
    state?: LogSheetTabState;
  };
  /** Photo-log state. */
  photo?: {
    /** Slot for the shutter / preview. */
    shutterSlot?: React.ReactNode;
    state?: LogSheetTabState;
  };
  /** Whether to render the desktop-modal layout instead of the mobile
   *  drawer. When undefined, falls back to a CSS media query. */
  desktop?: boolean;
}

type LucideIconCmp = typeof Search;

const TAB_CONFIG: ReadonlyArray<{
  id: LogSheetTab;
  label: string;
  icon: LucideIconCmp;
}> = [
  { id: "search", label: "Search foods", icon: Search },
  { id: "barcode", label: "Scan barcode", icon: ScanBarcode },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "saved", label: "Saved meals", icon: History },
  { id: "voice", label: "Voice log", icon: Mic },
  { id: "photo", label: "Photo log", icon: Camera },
];

export function LogSheet({
  open,
  onOpenChange,
  initialTab = "search",
  search,
  barcode,
  recent,
  saved,
  voice,
  photo,
  desktop,
}: LogSheetProps) {
  const [tab, setTab] = React.useState<LogSheetTab>(initialTab);

  // When the sheet closes, reset the active tab to the initial one for
  // the next open. Without this, returning to the sheet remembers the
  // last tab — which feels random rather than intentional, and breaks
  // the "two taps from cold" promise (D-2026-04-27-15) for the search
  // case.
  React.useEffect(() => {
    if (!open) setTab(initialTab);
  }, [open, initialTab]);

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
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-md",
          )}
        />
        <DrawerPrimitive.Content
          data-slot="log-sheet-content"
          aria-label="Log a meal"
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col bg-background",
            // Mobile-web: bottom drawer up to 92vh.
            "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-t",
            // Desktop: centred modal at 480×640.
            desktop
              ? "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:h-[640px] md:w-[480px] md:max-h-[640px] md:rounded-2xl md:border"
              : "",
            "shadow-[0_-8px_32px_rgba(0,0,0,0.12)]",
          )}
        >
          {/* Drag handle (mobile) — drops on desktop. */}
          <div
            aria-hidden
            className={cn(
              "mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-muted",
              desktop ? "md:hidden" : "",
            )}
          />

          {/* Header */}
          <div
            data-slot="log-sheet-header"
            className="flex items-center justify-between border-b px-4 pb-3 pt-3"
          >
            <DrawerPrimitive.Title className="text-[17px] font-bold tracking-tight">
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

          {/* Sub-tab pill bar */}
          <div
            data-slot="log-sheet-subtabs"
            role="tablist"
            aria-label="Log sheet sub-tabs"
            className="flex gap-1 overflow-x-auto px-3 pb-2 pt-2"
          >
            {TAB_CONFIG.map((entry) => {
              const Icon = entry.icon;
              const active = tab === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-state={active ? "active" : "inactive"}
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  )}
                >
                  <Icon width={14} height={14} aria-hidden />
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content area */}
          <div
            data-slot="log-sheet-content-area"
            className="flex-1 overflow-y-auto px-3 pb-6 pt-3"
          >
            {tab === "search" ? <SearchTab {...(search ?? { query: "", onQueryChange: () => {}, results: [], onAdd: () => {} })} /> : null}
            {tab === "barcode" ? <BarcodeTab {...(barcode ?? {})} /> : null}
            {tab === "recent" ? <RecentTab {...(recent ?? { entries: [], onPick: () => {} })} /> : null}
            {tab === "saved" ? <SavedTab {...(saved ?? { meals: [], onPick: () => {} })} /> : null}
            {tab === "voice" ? <VoiceTab {...(voice ?? {})} /> : null}
            {tab === "photo" ? <PhotoTab {...(photo ?? {})} /> : null}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

/* -------------------------- Search tab -------------------------- */

interface SearchTabProps {
  query: string;
  onQueryChange: (q: string) => void;
  results: LogSheetSearchResult[];
  onAdd: (result: LogSheetSearchResult) => void;
  state?: LogSheetTabState;
}

function SearchTab({ query, onQueryChange, results, onAdd, state }: SearchTabProps) {
  return (
    <div data-slot="log-sheet-tab-search" className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Search foods</span>
        <Search
          aria-hidden
          width={16}
          height={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search foods, brands, or recipes…"
          className={cn(
            "h-11 w-full rounded-lg bg-muted pl-9 pr-3 text-[14px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        />
      </label>

      {state?.offline ? (
        <p className="text-[12px] text-muted-foreground">You're offline. Searching cached foods only.</p>
      ) : null}

      {state?.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[12px] text-warning">
          <WifiOff width={14} height={14} aria-hidden />
          <span>Couldn't search. Try again →</span>
        </div>
      ) : null}

      {state?.loading ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              data-slot="log-sheet-skeleton-row"
              className="flex items-center gap-3 rounded-lg p-2"
            >
              <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!state?.loading && !state?.error && results.length === 0 && query.trim() ? (
        <div className="rounded-lg border border-dashed py-8 text-center">
          <Search aria-hidden width={32} height={32} className="mx-auto text-muted-foreground" />
          <p className="mt-2 text-[13px] font-semibold">No matches for "{query}"</p>
          <p className="text-[12px] text-muted-foreground">Try fewer words, or scan a barcode.</p>
        </div>
      ) : null}

      {!state?.loading && !state?.error && results.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
            >
              {r.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.thumbnail} alt="" className="h-9 w-9 rounded-md object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-md bg-muted" aria-hidden />
              )}
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-[14px] font-medium">{r.title}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <SourceDot source={r.source} size={6} />
                  <span className="tabular-nums">{r.kcal} kcal</span>
                </span>
              </div>
              <button
                type="button"
                aria-label={`Add ${r.title}`}
                onClick={() => onAdd(r)}
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full",
                  "bg-primary/10 text-primary hover:bg-primary/20",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                )}
              >
                <span aria-hidden className="text-lg leading-none">+</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------- Barcode tab -------------------------- */

interface BarcodeTabProps {
  cameraSlot?: React.ReactNode;
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
  state?: LogSheetTabState;
}

function BarcodeTab({ cameraSlot, manualEntry, onConfirmManual, state }: BarcodeTabProps) {
  if (state?.permissionDenied) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center">
        <ScanBarcode aria-hidden width={32} height={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 text-[13px] font-semibold">Camera access needed</p>
        <p className="text-[12px] text-muted-foreground">Grant camera access to scan barcodes.</p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              // No window.alert — open Settings is OS-level; we surface
              // a hint and rely on the OS prompt re-triggering on next
              // permission request.
              window.alert("Open Settings → Privacy → Camera and enable Suppr.");
            }
          }}
          className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
        >
          Open Settings
        </button>
      </div>
    );
  }

  if (manualEntry) {
    return <BarcodeManualEntry entry={manualEntry} onConfirm={onConfirmManual} />;
  }

  return (
    <div data-slot="log-sheet-tab-barcode" className="flex flex-col items-stretch gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
        {cameraSlot ?? (
          <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
            Camera viewport
          </div>
        )}
        {/* Corner brackets */}
        <span aria-hidden className="absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-white/80" />
        <span aria-hidden className="absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-white/80" />
        <span aria-hidden className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-white/80" />
        <span aria-hidden className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-white/80" />
      </div>
      <p className="text-center text-[12px] text-muted-foreground">
        Point at a barcode — we'll match it to USDA, OFF, or FatSecret.
      </p>
    </div>
  );
}

interface BarcodeManualEntryProps {
  entry: LogSheetBarcodeManualEntry;
  onConfirm?: (
    payload: LogSheetBarcodeManualEntry & {
      portionGrams: number;
      kcal: number;
      protein: number;
      carbs: number;
      fat: number;
    },
  ) => void;
}

function BarcodeManualEntry({ entry, onConfirm }: BarcodeManualEntryProps) {
  const [portion, setPortion] = React.useState("100");
  const [kcal, setKcal] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  return (
    <div data-slot="log-sheet-barcode-manual" className="flex flex-col gap-3">
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-[14px] font-semibold">{entry.productName}</p>
        {entry.brand ? <p className="text-[12px] text-muted-foreground">{entry.brand}</p> : null}
        <div className="mt-2">
          <TrustChip variant="manual" />
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground">
        No nutrition data — enter manually. We'll save this so the next scan finds it.
      </p>

      <label className="flex items-center justify-between gap-2 text-[13px]">
        <span className="text-muted-foreground">Portion (g)</span>
        <input
          aria-label="Portion in grams"
          inputMode="decimal"
          value={portion}
          onChange={(e) => setPortion(e.target.value)}
          className="h-9 w-24 rounded-md border bg-background px-2 text-right tabular-nums"
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-[13px]">
        <span className="text-muted-foreground">kcal</span>
        <input
          aria-label="Kilocalories"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className="h-9 w-24 rounded-md border bg-background px-2 text-right tabular-nums"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-muted-foreground">Protein (g)</span>
          <input
            aria-label="Protein grams"
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-right tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-muted-foreground">Carbs (g)</span>
          <input
            aria-label="Carbs grams"
            inputMode="decimal"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-right tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px]">
          <span className="text-muted-foreground">Fat (g)</span>
          <input
            aria-label="Fat grams"
            inputMode="decimal"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-right tabular-nums"
          />
        </label>
      </div>

      <button
        type="button"
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
        className={cn(
          "mt-2 inline-flex h-11 items-center justify-center rounded-lg",
          "bg-primary text-primary-foreground font-semibold text-[14px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        )}
      >
        Log it
      </button>
    </div>
  );
}

/* -------------------------- Recent tab -------------------------- */

interface RecentTabProps {
  entries: LogSheetRecentEntry[];
  onPick: (entry: LogSheetRecentEntry) => void;
  state?: LogSheetTabState;
}

function RecentTab({ entries, onPick, state }: RecentTabProps) {
  const today = entries.filter((e) => e.bucket === "today");
  const week = entries.filter((e) => e.bucket === "week");

  if (state?.loading) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg p-2">
            <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (entries.length === 0) {
    return (
      <div data-slot="log-sheet-recent-empty" className="rounded-lg border border-dashed py-8 text-center">
        <Clock aria-hidden width={32} height={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 text-[13px] font-semibold">Your recent foods will appear here</p>
        <p className="text-[12px] text-muted-foreground">Log something once and it'll show up next time.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {today.length > 0 ? (
        <div data-slot="log-sheet-recent-today">
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Today's recents
          </h3>
          <RecentList entries={today} onPick={onPick} />
        </div>
      ) : null}
      {week.length > 0 ? (
        <div data-slot="log-sheet-recent-week">
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Earlier this week
          </h3>
          <RecentList entries={week} onPick={onPick} />
        </div>
      ) : null}
    </div>
  );
}

function RecentList({
  entries,
  onPick,
}: {
  entries: LogSheetRecentEntry[];
  onPick: (entry: LogSheetRecentEntry) => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onPick(e)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="h-9 w-9 rounded-md bg-muted" aria-hidden />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-medium">{e.title}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <SourceDot source={e.source} size={6} />
                <span className="tabular-nums">{e.kcal} kcal</span>
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------- Saved tab -------------------------- */

interface SavedTabProps {
  meals: LogSheetSavedMeal[];
  onPick: (meal: LogSheetSavedMeal) => void;
  state?: LogSheetTabState;
}

function SavedTab({ meals, onPick, state }: SavedTabProps) {
  if (state?.loading) {
    return (
      <ul className="flex flex-col gap-2" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg p-2">
            <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
            <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    );
  }

  if (meals.length === 0) {
    return (
      <div data-slot="log-sheet-saved-empty" className="rounded-lg border border-dashed py-8 text-center">
        <History aria-hidden width={32} height={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 text-[13px] font-semibold">No saved meals yet</p>
        <p className="text-[12px] text-muted-foreground">Save a meal you eat often to log it in one tap.</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {meals.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => onPick(m)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="h-9 w-9 rounded-md bg-muted" aria-hidden />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-medium">{m.title}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <SourceDot source={m.source} size={6} />
                <span className="tabular-nums">{m.kcal} kcal</span>
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------- Voice tab -------------------------- */

interface VoiceTabProps {
  micSlot?: React.ReactNode;
  state?: LogSheetTabState;
}

function VoiceTab({ micSlot, state }: VoiceTabProps) {
  if (state?.permissionDenied) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center">
        <Mic aria-hidden width={32} height={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 text-[13px] font-semibold">Microphone access needed</p>
        <p className="text-[12px] text-muted-foreground">Grant mic access to use voice log.</p>
      </div>
    );
  }
  return (
    <div data-slot="log-sheet-tab-voice" className="flex flex-col items-center gap-4 py-6">
      {state?.showFirstRunTip ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-[12px] text-muted-foreground">
          <strong className="font-semibold">First time?</strong> Speak naturally — "a chicken caesar salad with extra dressing" works.
        </div>
      ) : null}
      {micSlot ?? (
        <button
          type="button"
          aria-label="Tap to start recording"
          className={cn(
            "h-22 w-22 grid place-items-center rounded-full bg-primary text-primary-foreground",
            "shadow-[0_4px_16px_rgba(76,108,224,0.4)]",
          )}
          style={{ width: 88, height: 88 }}
        >
          <Mic aria-hidden width={32} height={32} />
        </button>
      )}
      <p className="text-[12px] text-muted-foreground">Tap to start. We'll transcribe + match macros.</p>
    </div>
  );
}

/* -------------------------- Photo tab -------------------------- */

interface PhotoTabProps {
  shutterSlot?: React.ReactNode;
  state?: LogSheetTabState;
}

function PhotoTab({ shutterSlot, state }: PhotoTabProps) {
  if (state?.permissionDenied) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center">
        <Camera aria-hidden width={32} height={32} className="mx-auto text-muted-foreground" />
        <p className="mt-2 text-[13px] font-semibold">Camera access needed</p>
        <p className="text-[12px] text-muted-foreground">Grant camera access to use photo log.</p>
      </div>
    );
  }
  return (
    <div data-slot="log-sheet-tab-photo" className="flex flex-col items-center gap-3">
      {state?.showFirstRunTip ? (
        <div className="w-full rounded-lg border bg-muted/30 p-3 text-[12px] text-muted-foreground">
          <strong className="font-semibold">First time?</strong> One photo of your plate is enough — we'll estimate.
          <span className="ml-1 inline-flex items-center gap-1 text-amber-700">
            <Sparkles width={10} height={10} aria-hidden /> AI
          </span>
        </div>
      ) : null}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
        {shutterSlot ?? (
          <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
            Camera viewport
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Capture photo"
        className="grid h-16 w-16 place-items-center rounded-full border-4 border-primary bg-primary"
      >
        <span className="h-12 w-12 rounded-full bg-primary-foreground" aria-hidden />
      </button>
    </div>
  );
}

export default LogSheet;
