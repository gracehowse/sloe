/**
 * Progress-tab weight-chart wiring helpers.
 *
 * Re-export only — the logic lives in `src/lib/progress/progressRangeChart.ts`
 * so the web ProgressDashboard and the mobile Progress weight card map the
 * range picker to the canonical `WeightChart` range and tone the "this week"
 * delta with the SAME tested functions. No mobile-specific logic.
 */

export * from "@suppr/shared/progress/progressRangeChart";
