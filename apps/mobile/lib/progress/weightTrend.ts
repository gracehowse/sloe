/**
 * Weight trend computation — shared by WeightChart and the stat tile.
 *
 * 2026-05-06: file lifted to `src/lib/progress/weightTrend.ts` so web
 * `ProgressDashboard` uses the SAME bucket aggregation, calendar-day
 * MA, same-day dedup, smart bucket fallback, and iterative min/max
 * as the mobile chart. This file is a re-export only — no
 * mobile-specific logic.
 */

export * from "@suppr/shared/progress/weightTrend";
