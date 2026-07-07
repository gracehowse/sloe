"use client";

import * as React from "react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track, isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { type OffProductMacros } from "../../../lib/openFoodFacts/fetchProductByBarcode.ts";
import { scaleCaffeineAlcohol } from "../../../lib/nutrition/scaleCaffeineAlcoholForGrams.ts";
import { scaleMicrosForGrams } from "../../../lib/openFoodFacts/parseOffMicros.ts";
import { loadRecentFoods, pushRecentFood } from "../../../lib/nutrition/trackerLocalState.ts";
import { createCustomFood } from "../../../lib/nutrition/customFoodsClient";
import {
  submitFoodCorrection,
  type FoodCorrectionInput,
} from "../../../lib/foodCorrection/submitFoodCorrection";
import { COMPLETE_DAY_V3_COPY } from "../../../lib/completeDayV3";
import type { LoggedMeal } from "../../../types/recipe.ts";
import type { FoodLoggedSource } from "../../../lib/analytics/events.ts";
import { TodayBarcodeDialog, type TodayBarcodeConfirmPayload } from "./today-barcode-dialog";
import {
  CreateCustomFoodDialog,
  type CreateCustomFoodPayload,
} from "./create-custom-food-dialog";
import { ShareCommunityDialog } from "./ShareCommunityDialog";
import { BarcodeSavedAckDialog } from "./BarcodeSavedAckDialog";

export interface UseBarcodeLoggingArgs {
  authedUserId: string | null | undefined;
  mealSlot: string;
  onMealSlotChange: (slot: string) => void;
  timeLabel: string;
  addLoggedMeal: (
    meal: Omit<LoggedMeal, "id">,
    analyticsSource?: FoodLoggedSource,
    onPersisted?: (persisted: boolean, entryId: string) => void,
  ) => string;
  /** Barcode-not-found → soft handoff to the AI photo log (2026-04-30). */
  onOpenPhotoFallback: () => void;
}

/**
 * ENG-1360 (first extraction pass) — the barcode-scan → custom-food-save
 * fallback → community-share opt-in → saved-ack dialog cluster. Byte-for-byte
 * lift of the JSX + state that used to live inline in NutritionTracker: same
 * four dialogs, same handlers, same analytics, same order. No behavior
 * change — just relocated + returned as a rendered node so the host's JSX
 * and local state list both shrink.
 */
export function useBarcodeLogging({
  authedUserId,
  mealSlot,
  onMealSlotChange,
  timeLabel,
  addLoggedMeal,
  onOpenPhotoFallback,
}: UseBarcodeLoggingArgs) {
  const [barcodeOpen, setBarcodeOpen] = React.useState(false);
  const [barcodeValue, setBarcodeValue] = React.useState("");
  const [barcodeBusy, setBarcodeBusy] = React.useState(false);
  const [barcodePreview, setBarcodePreview] = React.useState<OffProductMacros | null>(null);
  /**
   * F-156 PR-2 (2026-05-10) — barcode-not-found → "Add as custom food"
   * handoff. Carries the scanned barcode forward to the
   * CreateCustomFoodDialog so the saved row's `barcode` column is
   * set; the next scan resolves successfully.
   */
  const [customFoodFromBarcode, setCustomFoodFromBarcode] = React.useState<string | null>(null);
  const [barcodeGramsStr, setBarcodeGramsStr] = React.useState("100");
  const barcodeGramsParsed = React.useMemo(() => {
    const n = Number.parseFloat(barcodeGramsStr.replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.min(10_000, Math.round(n * 10) / 10);
  }, [barcodeGramsStr]);
  const [barcodeTitleOverride, setBarcodeTitleOverride] = React.useState("");
  const [barcodeMacrosManual, setBarcodeMacrosManual] = React.useState(false);
  const [barcodeEditCal, setBarcodeEditCal] = React.useState("");
  const [barcodeEditPro, setBarcodeEditPro] = React.useState("");
  const [barcodeEditCarb, setBarcodeEditCarb] = React.useState("");
  const [barcodeEditFat, setBarcodeEditFat] = React.useState("");
  const [recentFoods, setRecentFoods] = React.useState<string[]>(() =>
    typeof window !== "undefined" ? loadRecentFoods() : [],
  );
  // ENG-1247 — community-contribution opt-in: set after a not-found barcode is
  // saved as a private custom food (when `barcode_community_contribution` is on)
  // to open the share dialog. null = closed.
  const [shareCommunityInput, setShareCommunityInput] = React.useState<FoodCorrectionInput | null>(
    null,
  );
  const [barcodeSavedAckName, setBarcodeSavedAckName] = React.useState<string | null>(null);

  const dialogs = (
    <>
      <TodayBarcodeDialog
        open={barcodeOpen}
        onOpenChange={(open) => {
          setBarcodeOpen(open);
          if (!open) {
            setBarcodePreview(null);
            setBarcodeGramsStr("100");
            setBarcodeValue("");
            setBarcodeTitleOverride("");
            setBarcodeMacrosManual(false);
            setBarcodeEditCal("");
            setBarcodeEditPro("");
            setBarcodeEditCarb("");
            setBarcodeEditFat("");
          }
        }}
        barcodeValue={barcodeValue}
        onBarcodeValueChange={setBarcodeValue}
        barcodeBusy={barcodeBusy}
        onBarcodeBusyChange={setBarcodeBusy}
        barcodePreview={barcodePreview}
        onBarcodePreviewChange={setBarcodePreview}
        barcodeGramsStr={barcodeGramsStr}
        onBarcodeGramsStrChange={setBarcodeGramsStr}
        barcodeGramsParsed={barcodeGramsParsed}
        barcodeTitleOverride={barcodeTitleOverride}
        onBarcodeTitleOverrideChange={setBarcodeTitleOverride}
        barcodeMacrosManual={barcodeMacrosManual}
        onBarcodeMacrosManualChange={setBarcodeMacrosManual}
        barcodeEditCal={barcodeEditCal}
        onBarcodeEditCalChange={setBarcodeEditCal}
        barcodeEditPro={barcodeEditPro}
        onBarcodeEditProChange={setBarcodeEditPro}
        barcodeEditCarb={barcodeEditCarb}
        onBarcodeEditCarbChange={setBarcodeEditCarb}
        barcodeEditFat={barcodeEditFat}
        onBarcodeEditFatChange={setBarcodeEditFat}
        mealSlot={mealSlot}
        onMealSlotChange={onMealSlotChange}
        recentFoods={recentFoods}
        onPickRecentFood={(n) => {
          addLoggedMeal(
            {
              name: "Snacks",
              recipeTitle: n,
              time: timeLabel,
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              source: "Manual",
            },
            "manual",
          );
          setBarcodeOpen(false);
        }}
        onConfirm={(payload: TodayBarcodeConfirmPayload) => {
          pushRecentFood(payload.titleForLog);
          setRecentFoods(loadRecentFoods());
          // F-13 (2026-04-19) — auto-track caffeine + alcohol from the
          // scanned product. OFF surfaces `caffeine_100g` for colas /
          // energy drinks and `alcohol_100g` for beer / wine / cider.
          // `scaleCaffeineAlcohol` handles nulls by returning 0, so a
          // non-stimulant product adds no micros.
          const { caffeineMg, alcoholG } = scaleCaffeineAlcohol({
            grams: payload.grams,
            caffeineMgPer100g: payload.product.caffeineMgPer100g ?? null,
            alcoholGPer100g: payload.product.alcoholGPer100g ?? null,
          });
          // F-79 — full OFF micro set scaled for `grams`, merged with
          // caffeine/alcohol overrides. Mirrors mobile barcode commit.
          const explicitMicros: Record<string, number> = {};
          if (caffeineMg > 0) explicitMicros.caffeineMg = caffeineMg;
          if (alcoholG > 0) explicitMicros.alcoholG = alcoholG;
          const micros = scaleMicrosForGrams(
            (payload.product as { microsPer100g?: Record<string, number> }).microsPer100g ?? {},
            payload.grams,
            explicitMicros,
          );
          addLoggedMeal(
            {
              name: mealSlot,
              recipeTitle: `${payload.titleForLog} (${payload.portion})`,
              time: timeLabel,
              calories: payload.calories,
              protein: payload.protein,
              carbs: payload.carbs,
              fat: payload.fat,
              source: payload.adjusted ? "Open Food Facts (adjusted)" : "Open Food Facts",
              ...(payload.fiberG != null && payload.fiberG > 0 ? { fiberG: payload.fiberG } : {}),
              ...(Object.keys(micros).length > 0 ? { micros } : {}),
            },
            "barcode",
          );
          setBarcodeOpen(false);
          toast.success("Logged from barcode");
          track(AnalyticsEvents.barcode_lookup, { ok: true, adjusted: payload.adjusted });
        }}
        onPhotoFallback={() => {
          // Audit 2026-04-30 (Lose It "Closer" parity, Fix 2) — when
          // the barcode lookup fails we offer a soft handoff to the
          // AI photo log. 2026-05-02: open for any tier; the in-dialog
          // quota line + 403 paywall handoff handle gating now.
          setBarcodeOpen(false);
          onOpenPhotoFallback();
        }}
        onAddAsCustomFood={(barcode) => {
          // F-156 PR-2 (2026-05-10) — barcode not found in OFF →
          // user opts to add it as a custom food. Close the barcode
          // dialog and open CreateCustomFoodDialog with the barcode
          // pre-filled so the saved row writes to user_custom_foods
          // with the correct code (next scan resolves successfully).
          setBarcodeOpen(false);
          setCustomFoodFromBarcode(barcode);
        }}
      />

      {/* F-156 PR-2 (2026-05-10) — CreateCustomFoodDialog host for the
          barcode-not-found path. Only mounts when the user arrived
          via the "Add as custom food" CTA. Saves to user_custom_foods;
          user can scan again to log. */}
      <CreateCustomFoodDialog
        open={customFoodFromBarcode != null}
        onOpenChange={(o) => {
          if (!o) setCustomFoodFromBarcode(null);
        }}
        initialBarcode={customFoodFromBarcode ?? undefined}
        onSave={async (payload: CreateCustomFoodPayload) => {
          if (!authedUserId) return;
          try {
            await createCustomFood(supabase, authedUserId, payload);
            try {
              track(AnalyticsEvents.custom_food_created, {
                hasBrand: Boolean(payload.brand),
                servingCount: payload.servings.length,
                fromBarcode: true,
              });
            } catch {
              /* analytics noop */
            }
            toast.success(
              isFeatureEnabled("eng1247_section_a_v1")
                ? COMPLETE_DAY_V3_COPY.savedTitle
                : "Custom food saved. Scan again to log it.",
            );
            // ENG-1247 — offer the community-contribution opt-in (flag-gated,
            // barcode only). The private custom food is already saved above; this
            // is the explicit, separate opt-in to ALSO share it to user_foods.
            if (isFeatureEnabled("barcode_community_contribution") && payload.barcode) {
              setShareCommunityInput({
                barcode: payload.barcode,
                name: payload.name,
                calories: payload.calories,
                protein: payload.protein,
                carbs: payload.carbs,
                fat: payload.fat,
                fiberG: payload.fiber,
                sugarG: payload.sugarG,
                sodiumMg: payload.sodiumMg,
                saturatedFatG: payload.saturatedFatG,
                servingSizeG: payload.baseGrams,
              });
            }
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Couldn't save custom food",
            );
          }
        }}
      />

      {/* ENG-1247 — community-contribution opt-in, opened after a not-found
          barcode is saved as a custom food (flag-gated). Writes to user_foods
          via the web submitFoodCorrection with the authed client + RLS. */}
      <ShareCommunityDialog
        input={shareCommunityInput}
        onShare={(input) => submitFoodCorrection(supabase, authedUserId ?? "", input)}
        onClose={() => {
          if (isFeatureEnabled("eng1247_section_a_v1") && shareCommunityInput?.name) {
            setBarcodeSavedAckName(shareCommunityInput.name);
          }
          setShareCommunityInput(null);
        }}
      />

      {isFeatureEnabled("eng1247_section_a_v1") && barcodeSavedAckName ? (
        <BarcodeSavedAckDialog
          open
          productName={barcodeSavedAckName}
          onLogNow={() => setBarcodeSavedAckName(null)}
        />
      ) : null}
    </>
  );

  return { dialogs, barcodeOpen, setBarcodeOpen };
}
