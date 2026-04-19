"use client";

/**
 * ActivityLevelPreview (web) — five tappable activity-level rows with a
 * live maintenance-kcal preview line beneath. Extracted 2026-04-19 for
 * build 10 fix E-2 (activity-level self-edit in Settings) so the
 * preview math lives in one place across onboarding + settings (+ any
 * future health-data confidence surfaces).
 *
 * The math is delegated to `calculateTDEE` / `activityLevelPreviewKcal`
 * from `src/lib/nutrition/tdee.ts` — this component never duplicates
 * multipliers or BMR formulae.
 *
 * Mobile parity: `apps/mobile/components/ActivityLevelPreview.tsx` has
 * the same prop shape and renders the equivalent UI with RN primitives.
 * A structural parity test pins both onboarding + settings consumers on
 * both platforms to import the shared component.
 */

import type {
  ActivityLevel,
  Sex,
} from "../../../lib/nutrition/tdee";
import {
  ACTIVITY_SHORT_LABELS,
  activityLevelPreviewKcal,
} from "../../../lib/nutrition/tdee";

export type ActivityLevelPreviewProps = {
  sex: Sex;
  /** Pass `null` / `undefined` when basics are missing — the component
   *  renders the quieter helper fallback. */
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  age: number | null | undefined;
  /** Currently-selected level (highlighted). */
  selected: ActivityLevel;
  onSelect: (level: ActivityLevel) => void;
  /** When true, renders the five options as a tappable list above the
   *  preview line (Settings picker layout). When false, caller renders
   *  its own option buttons and this component only emits the line
   *  (onboarding compact layout). Defaults to `true`. */
  renderOptions?: boolean;
  /** Optional extra className for the root container. */
  className?: string;
};

/** Short descriptions match the onboarding copy verbatim so the picker
 *  feels identical across surfaces. Sourced from `ACTIVITY_LABELS`
 *  (in `tdee.ts`) but simplified here to a flat map. */
const ACTIVITY_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: "Little to no exercise",
  light: "Light exercise 1–3 days/week",
  moderate: "Moderate exercise 3–5 days/week",
  active: "Hard exercise 6–7 days/week",
  very_active: "Very hard exercise or physical job",
};

const ORDER: readonly ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

export function ActivityLevelPreview({
  sex,
  weightKg,
  heightCm,
  age,
  selected,
  onSelect,
  renderOptions = true,
  className,
}: ActivityLevelPreviewProps) {
  const preview = activityLevelPreviewKcal(sex, weightKg, heightCm, age);

  return (
    <div className={className} data-testid="activity-level-preview">
      {renderOptions ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ORDER.map((lvl) => {
            const active = lvl === selected;
            const kcal = preview ? preview[lvl] : null;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => onSelect(lvl)}
                data-testid={`activity-level-option-${lvl}`}
                aria-pressed={active}
                className={`p-4 border-2 rounded-xl text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <p className="font-medium text-foreground">
                  {ACTIVITY_SHORT_LABELS[lvl]}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {ACTIVITY_DESCRIPTIONS[lvl]}
                </p>
                {kcal != null ? (
                  <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                    Maintenance ≈ {kcal.toLocaleString()} kcal
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {preview ? (
        <p
          data-testid="activity-level-preview-row"
          className="mt-3 text-xs text-muted-foreground tabular-nums"
        >
          {ORDER.map((lvl, i) => (
            <span key={lvl}>
              {i > 0 ? <span className="text-muted-foreground/60"> · </span> : null}
              <span
                className={
                  lvl === selected
                    ? "font-bold text-foreground"
                    : undefined
                }
              >
                {ACTIVITY_SHORT_LABELS[lvl]}: {preview[lvl].toLocaleString()} kcal
              </span>
            </span>
          ))}
        </p>
      ) : (
        <p
          data-testid="activity-level-preview-fallback"
          className="mt-3 text-xs text-muted-foreground"
        >
          Pick your activity level — we&apos;ll compute your maintenance calories once your basics are in.
        </p>
      )}
    </div>
  );
}

export default ActivityLevelPreview;
