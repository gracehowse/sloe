"use client";

import * as React from "react";

import {
  buildPickerOptions,
  evaluatePortionScalePlausibility,
  portionPlausibilityWarning,
  formatPortion,
  roundAmount,
  stateToGrams,
  stepperStep,
  switchUnit,
  unitLabel,
  type MacrosPer100gPanel,
  type PortionState,
  type PortionUnit,
  type ProductInput,
  type QuickChip,
} from "../../../lib/nutrition/portionPicker";

/**
 * Web PortionPicker — mirror of `apps/mobile/components/PortionPicker.tsx`.
 * Consumes the shared state model at `src/lib/nutrition/portionPicker.ts`
 * so the math + unit derivation never drift across platforms.
 *
 * See `docs/decisions/2026-05-13-portion-picker-and-macro-display.md`
 * for rationale.
 */
export interface PortionPickerWebProps {
  product: ProductInput;
  value: PortionState;
  onChange: (next: PortionState) => void;
  options?: ReturnType<typeof buildPickerOptions>;
  rememberedGrams?: number | null;
  /** Hide the quick-chip row (e.g. on cramped sheets). Mirrors the mobile picker. */
  hideQuickChips?: boolean;
  /** When set, scale + run post-scale plausibility and surface a warning. */
  macrosPer100g?: MacrosPer100gPanel | null;
  /** OFF reconcile flagged per-serving values masquerading as per-100 g. */
  basisCorrected?: boolean;
  className?: string;
}

export function PortionPickerWeb(props: PortionPickerWebProps) {
  const { product, value, onChange, className = "", hideQuickChips = false, macrosPer100g, basisCorrected = false } = props;
  const [unitOpen, setUnitOpen] = React.useState(false);

  const opts =
    props.options ?? buildPickerOptions(product, { rememberedGrams: props.rememberedGrams ?? null });
  const grams = stateToGrams(value);
  const step = stepperStep(value.unit);
  const scaleCheck =
    macrosPer100g != null
      ? evaluatePortionScalePlausibility(macrosPer100g, value, { basisCorrected })
      : null;
  const showPlausibilityWarning = scaleCheck != null && !scaleCheck.plausible && scaleCheck.grams > 0;

  const bump = (delta: number) => {
    const next = Math.max(0, value.amount + delta);
    onChange({ ...value, amount: next });
  };

  const onSelectUnit = (next: PortionUnit) => {
    setUnitOpen(false);
    onChange(switchUnit(value, next));
  };

  const onTapChip = (chip: QuickChip) => onChange(chip.state);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">Amount</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          ≈ {Math.round(grams).toLocaleString()} g
        </span>
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-border bg-muted/30 p-1.5">
        <button
          type="button"
          aria-label="Decrease amount"
          onClick={() => bump(-step)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground shadow-sm hover:bg-muted active:scale-95 transition"
        >
          <span className="text-xl font-bold leading-none">−</span>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center gap-1 relative">
          <span
            className="text-[22px] font-extrabold tabular-nums tracking-tight leading-none text-foreground"
            aria-label={`Amount: ${roundAmount(value.amount, value.unit)} ${unitLabel(value)}`}
          >
            {roundAmount(value.amount, value.unit)}
          </span>
          <button
            type="button"
            aria-label="Change unit"
            onClick={() => setUnitOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11.5px] font-bold text-primary hover:bg-primary/15 transition"
          >
            {unitLabel(value)}
            <span className="text-[10px] opacity-70" aria-hidden>
              ▾
            </span>
          </button>
          {unitOpen ? (
            <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 w-[220px] rounded-xl border border-border bg-card p-1.5 shadow-lg">
              {opts.units.map((u, i) => {
                const active = unitsEqual(u, value.unit);
                return (
                  <button
                    key={`${u.kind}-${i}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectUnit(u)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                      active
                        ? "bg-primary/15 text-primary font-bold"
                        : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span>{unitDisplayLabel(u)}</span>
                    <span className={`text-[11.5px] tabular-nums ${active ? "opacity-70" : "text-muted-foreground"}`}>
                      {unitMeta(u)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Increase amount"
          onClick={() => bump(step)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground shadow-sm hover:bg-muted active:scale-95 transition"
        >
          <span className="text-xl font-bold leading-none">+</span>
        </button>
      </div>

      {!hideQuickChips && opts.quickChips.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-2">Quick</div>
          <div className="flex gap-1.5 overflow-x-auto pr-4 [mask-image:linear-gradient(to_right,#000_0,#000_calc(100%-16px),transparent_100%)]">
            {opts.quickChips.map((chip, i) => {
              const active =
                Math.abs(stateToGrams(chip.state) - grams) < 0.5 &&
                chip.state.unit.kind === value.unit.kind &&
                (chip.state.unit.kind !== "count" ||
                  (value.unit.kind === "count" && chip.state.unit.singular === value.unit.singular));
              return (
                <button
                  key={`${chip.label}-${i}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onTapChip(chip)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition border ${
                    active
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : "border-border bg-card text-foreground hover:bg-muted/60"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showPlausibilityWarning && scaleCheck ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-[12.5px] leading-snug text-foreground"
        >
          {portionPlausibilityWarning(scaleCheck.scaled, scaleCheck.grams)}
        </p>
      ) : null}
    </div>
  );
}

function unitsEqual(a: PortionUnit, b: PortionUnit): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "count" && b.kind === "count") return a.singular === b.singular;
  return true;
}

function unitDisplayLabel(u: PortionUnit): string {
  switch (u.kind) {
    case "count":
      return u.singular;
    case "serving":
      return "serving";
    case "gram":
      return "gram";
    case "ounce":
      return "ounce";
  }
}

function unitMeta(u: PortionUnit): string {
  switch (u.kind) {
    case "count":
      return `${Math.round(u.gramsPerUnit)} g`;
    case "serving":
      return `${Math.round(u.gramsPerServing)} g`;
    case "gram":
      return "precise";
    case "ounce":
      return "28 g";
  }
}

export { formatPortion };
