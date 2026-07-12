/**
 * Net energy headline + state chip (Bevel-style) for Sloe TD1 energy balance.
 * SSOT: `docs/prototypes/stitch-sloe/energy-balance.html`,
 * `docs/prototypes/stitch-sloe/_buildenergy.mjs`.
 *
 * Subline copy reads the same ±60 kcal band as `netEnergyChipState`, not binary net sign.
 */

import { netEnergyOverBudgetLine } from "./coachOverBudgetStage";

export type NetEnergyChipState = "deficit" | "surplus" | "maintenance";

const CHIP_THRESHOLD_KCAL = 60;

export function netEnergyChipState(netKcal: number): NetEnergyChipState {
  if (netKcal > CHIP_THRESHOLD_KCAL) return "deficit";
  if (netKcal < -CHIP_THRESHOLD_KCAL) return "surplus";
  return "maintenance";
}

export const NET_ENERGY_CHIP_LABEL: Record<NetEnergyChipState, string> = {
  deficit: "Deficit",
  surplus: "Surplus",
  maintenance: "Maintenance",
};

/**
 * ENG-1506 — the ±60-band STATE word collides with the MAINTENANCE (TDEE)
 * quantity tile rendered one inch below it on the same card ("0 kcal
 * maintenance" above "MAINTENANCE 1,778"). Behind `energy_numbers_v1` the
 * balanced band's PRESENTATION strings become "Balanced" / "kcal balanced";
 * the `NetEnergyChipState` union key stays `"maintenance"` internally
 * (strings only — no state churn). Hosts own the flag read and pass
 * `balancedWording` so this module stays a pure function (same pattern as
 * `stagedNeutralSurplusFraming` below).
 */
export function netEnergyChipLabel(
  state: NetEnergyChipState,
  opts?: { balancedWording?: boolean },
): string {
  if (opts?.balancedWording && state === "maintenance") return "Balanced";
  return NET_ENERGY_CHIP_LABEL[state];
}

/**
 * ENG-1506 — headline presentation state for the net-energy hero. "empty"
 * = no burn AND no food for the day, where an affirming giant "0 kcal
 * maintenance" is a lie of presentation; hosts render an em-dash + the
 * `NET_ENERGY_EMPTY_*` copy instead (behind `energy_numbers_v1`).
 */
export type NetEnergyHeadlineState = "empty" | "value";

export function netEnergyHeadlineState(
  burnKcal: number,
  eatenKcal: number,
): NetEnergyHeadlineState {
  return burnKcal === 0 && eatenKcal === 0 ? "empty" : "value";
}

export const NET_ENERGY_EMPTY_HEADLINE = "—";
export const NET_ENERGY_EMPTY_SUBLINE =
  "No activity or meals logged yet today";

/**
 * Headline + slider-marker accent (sage / clay / plum). These are FILL hues —
 * correct for the 52px net headline (large text, 3:1 bar) and the marker ring
 * (graphical, 3:1). Do NOT use for the small white-on-fill state chip: white on
 * clay #C8794E is only 3.33:1 (AA-normal needs 4.5:1). The chip reads its own
 * AA-safe `NET_ENERGY_CHIP_BG` below instead.
 */
export const NET_ENERGY_STATE_COLOR = {
  deficit: "#5E7C5A",
  surplus: "#C8794E",
  maintenance: "#3B2A4D",
} as const;

/**
 * Chip background for the small uppercase WHITE state-chip label (needs ≥4.5:1).
 * Only the SURPLUS chip actually fails as the base hue, so only it is darkened —
 * deficit + maintenance match `NET_ENERGY_STATE_COLOR` exactly (= the Figma
 * `energy-balance.html` chip == its headline):
 *   deficit  sage  #5E7C5A → white 4.66:1  (Figma value; passes — unchanged)
 *   surplus  clay-solid #A0552E → white 5.48:1  (base clay #C8794E was 3.33:1)
 *   maintenance plum   #3B2A4D → white 12.9:1  (already deep — unchanged)
 * The headline + marker keep `NET_ENERGY_STATE_COLOR`; for surplus the headline
 * stays vivid clay #C8794E (large text, 3:1 OK) while only the chip deepens.
 */
export const NET_ENERGY_CHIP_BG = {
  deficit: "#5E7C5A",
  surplus: "#A0552E",
  maintenance: "#3B2A4D",
} as const;

export function netEnergyKcalUnit(
  state: NetEnergyChipState,
  opts?: { balancedWording?: boolean },
): string {
  // ENG-1506 — see `netEnergyChipLabel`: the balanced band stops borrowing
  // the word "maintenance" from the TDEE tile below it.
  if (opts?.balancedWording && state === "maintenance") return "kcal balanced";
  return `kcal ${state}`;
}

/** Slider knob position along deficit ↔ maintenance ↔ surplus bar. */
export function netEnergyMarkerFraction(
  netKcal: number,
  maintenanceKcal: number | null,
  consumedCalories: number,
  isDeficit: boolean,
): number {
  if (maintenanceKcal != null && maintenanceKcal > 0) {
    // State-anchored bands (ENG-878; SSOT `_buildenergy.mjs#markerPctForNet`):
    // the marker is positioned by the SAME `CHIP_THRESHOLD_KCAL` the chip reads,
    // so it can NEVER disagree with the Deficit/Maintenance/Surplus chip.
    //   maintenance (|net| ≤ threshold) → 50% (centre)
    //   deficit  (net >  threshold)     → left third  42% → 8%   (deepening)
    //   surplus  (net < -threshold)     → right third 58% → 92%  (deepening)
    // `intensity` = distance past the threshold as a fraction of one
    // maintenance-worth of kcal, clamped to keep a clear deficit/surplus inside
    // its third (never ambiguously mid-bar). Supersedes the old
    // `0.5 - net/(maintenance*2)`, which barely moved off centre and could land
    // in a third that visually contradicted the chip.
    if (Math.abs(netKcal) <= CHIP_THRESHOLD_KCAL) return 0.5;
    const span = Math.max(maintenanceKcal, 1);
    const intensity = Math.min(1, (Math.abs(netKcal) - CHIP_THRESHOLD_KCAL) / span);
    return netKcal > CHIP_THRESHOLD_KCAL
      ? Math.round(42 - intensity * 34) / 100
      : Math.round(58 + intensity * 34) / 100;
  }
  if (consumedCalories === 0) return 0.31;
  return isDeficit ? 0.25 : 0.75;
}

export function netEnergySubline(args: {
  burnedKcal: number;
  eatenKcal: number;
  isToday: boolean;
  netKcal: number;
  /**
   * ENG-1454 — behind `coaching_stages_v1`: while in surplus ("You've
   * eaten more than you've burned"), swap the second-person accusation
   * for the neutral, auditable "Net energy today: +{n} kcal" framing (the
   * operands render beneath via the existing Burned/Eaten stat tiles —
   * this sentence never restates them). Only the surplus branch changes;
   * deficit/maintenance keep their existing calm phrasing unconditionally
   * — they were never the tonal-whiplash complaint in ENG-1454. Callers
   * pass `true` only when the flag resolves ON; the host owns the
   * `isFeatureEnabled("coaching_stages_v1")` check so this module stays a
   * pure function with no analytics import.
   */
  stagedNeutralSurplusFraming?: boolean;
  /**
   * ENG-1506 — behind `energy_numbers_v1`: the balanced band's subline stops
   * calling the STATE "maintenance" (the word the TDEE tile below the
   * headline already uses for a different quantity). Host owns the flag
   * read, mirroring `stagedNeutralSurplusFraming`.
   */
  balancedWording?: boolean;
}): string {
  const { burnedKcal, eatenKcal, isToday, netKcal, stagedNeutralSurplusFraming } = args;
  if (eatenKcal === 0) {
    const tail = isToday ? "yet" : "for this day";
    return `${burnedKcal.toLocaleString()} kcal burned so far · no food logged ${tail}.`;
  }
  const state = netEnergyChipState(netKcal);
  if (state === "maintenance") {
    if (args.balancedWording) {
      return `You're within ${CHIP_THRESHOLD_KCAL} kcal of even — burn and intake are balanced${isToday ? " today" : ""}.`;
    }
    return `You're within ${CHIP_THRESHOLD_KCAL} kcal of maintenance — burn and intake are balanced${isToday ? " today" : ""}.`;
  }
  if (state === "deficit") {
    return `You've burned ${Math.abs(netKcal).toLocaleString()} more than you've eaten${isToday ? " today" : ""}.`;
  }
  if (stagedNeutralSurplusFraming) {
    return netEnergyOverBudgetLine(Math.abs(netKcal));
  }
  return `You've eaten ${Math.abs(netKcal).toLocaleString()} more than you've burned${isToday ? " today" : ""}.`;
}
