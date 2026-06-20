/**
 * Structural pin — F-2 daily target snapshot adoption.
 *
 * Context: TestFlight build 10 feedback `AEyOuUJrB4l` (2026-04-19). When
 * a user changed `activity_level` / `plan_pace` / `goal`, past days'
 * "% of goal" percentages recalculated against the *new* target so days
 * the user had hit the goal started reading as over-budget. Fix is to
 * snapshot the current target on the first write of each local day
 * (`snapshotDailyTargetIfMissing`) and to render past-day percentages
 * against the snapshot (`getDailyTargets`).
 *
 * This test pins the shared helpers to every surface that must use
 * them, so a future refactor can't silently reintroduce the bug by
 * computing a past-day percentage from the current profile target.
 *
 * Write-side callers (must call `snapshotDailyTargetIfMissing`):
 *   - Web: `src/context/appData/useNutritionJournalState.ts`
 *   - Mobile: `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`,
 *     `apps/mobile/app/(tabs)/barcode.tsx`,
 *     `apps/mobile/app/(tabs)/planner.tsx`,
 *     `apps/mobile/app/recipe/[id].tsx`
 *
 * Read-side callers (must call `getDailyTargets` for past-day rows):
 *   - Mobile: `apps/mobile/app/(tabs)/progress.tsx`,
 *     `apps/mobile/app/progress-metric.tsx`
 *   - Web: `src/app/components/ProgressDashboard.tsx`,
 *     `src/app/components/ProgressMetricDetail.tsx`
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WRITE_HELPER_PATH = resolve(
  __dirname,
  "../../src/lib/nutrition/dailyTargetSnapshot.ts",
);
const READ_HELPER_PATH = resolve(
  __dirname,
  "../../src/lib/nutrition/dailyTargetRead.ts",
);
const MIGRATION_PATH = resolve(
  __dirname,
  "../../supabase/migrations/20260425120000_daily_targets.sql",
);

const WEB_JOURNAL_STATE = resolve(
  __dirname,
  "../../src/context/appData/useNutritionJournalState.ts",
);
const MOBILE_TODAY = resolve(__dirname, "../../apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
const MOBILE_BARCODE = resolve(__dirname, "../../apps/mobile/app/(tabs)/barcode.tsx");
const MOBILE_PLANNER = resolve(__dirname, "../../apps/mobile/app/(tabs)/planner.tsx");
const MOBILE_RECIPE = resolve(__dirname, "../../apps/mobile/app/recipe/[id].tsx");

const MOBILE_PROGRESS = resolve(__dirname, "../../apps/mobile/app/(tabs)/progress.tsx");
const MOBILE_PROGRESS_METRIC = resolve(
  __dirname,
  "../../apps/mobile/app/progress-metric.tsx",
);
const WEB_PROGRESS = resolve(
  __dirname,
  "../../src/app/components/ProgressDashboard.tsx",
);
const WEB_PROGRESS_METRIC = resolve(
  __dirname,
  "../../src/app/components/ProgressMetricDetail.tsx",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("daily target snapshot — helpers exist", () => {
  it("write helper exports snapshotDailyTargetIfMissing", () => {
    const src = read(WRITE_HELPER_PATH);
    expect(src).toMatch(/export async function snapshotDailyTargetIfMissing/);
  });

  it("read helper exports getDailyTargets and resolveDisplayTarget", () => {
    const src = read(READ_HELPER_PATH);
    expect(src).toMatch(/export async function getDailyTargets/);
    expect(src).toMatch(/export function resolveDisplayTarget/);
  });

  it("migration creates the daily_targets table with a (user_id, date_key) PK", () => {
    const src = read(MIGRATION_PATH);
    expect(src).toMatch(/create table if not exists public\.daily_targets/);
    expect(src).toMatch(/primary key \(user_id, date_key\)/);
    // RLS policies are load-bearing: without them every user could
    // read every other user's targets via the relational client.
    expect(src).toMatch(/enable row level security/);
    expect(src).toMatch(/Users can read own daily targets/);
    expect(src).toMatch(/Users can insert own daily targets/);
  });
});

describe("daily target snapshot — write-side callers", () => {
  it("web nutrition journal state calls the snapshot helper", () => {
    const src = read(WEB_JOURNAL_STATE);
    expect(src).toMatch(/import \{ snapshotDailyTargetIfMissing \}/);
    expect(src).toMatch(/snapshotDailyTargetIfMissing\(/);
  });

  it("mobile Today tab calls the snapshot helper on the nutrition_entries sync path", () => {
    const src = read(MOBILE_TODAY);
    expect(src).toMatch(/snapshotDailyTargetIfMissing/);
  });

  it("mobile barcode tab calls the snapshot helper after a successful log", () => {
    const src = read(MOBILE_BARCODE);
    expect(src).toMatch(/snapshotDailyTargetIfMissing/);
  });

  it("mobile planner tab calls the snapshot helper after a successful log", () => {
    const src = read(MOBILE_PLANNER);
    expect(src).toMatch(/snapshotDailyTargetIfMissing/);
  });

  it("mobile recipe detail calls the snapshot helper after 'Log to today'", () => {
    const src = read(MOBILE_RECIPE);
    expect(src).toMatch(/snapshotDailyTargetIfMissing/);
  });
});

describe("daily target snapshot — read-side callers", () => {
  it("mobile Progress tab imports and uses getDailyTargets", () => {
    const src = read(MOBILE_PROGRESS);
    expect(src).toMatch(/import \{[^}]*getDailyTargets[^}]*\} from/);
    expect(src).toMatch(/getDailyTargets\(/);
  });

  it("mobile per-metric breakdown uses getDailyTargets for past-day % of goal", () => {
    const src = read(MOBILE_PROGRESS_METRIC);
    expect(src).toMatch(/import \{[^}]*getDailyTargets[^}]*\} from/);
    expect(src).toMatch(/getDailyTargets\(/);
  });

  it("web ProgressDashboard imports and uses getDailyTargets", () => {
    const src = read(WEB_PROGRESS);
    expect(src).toMatch(/import \{[^}]*getDailyTargets[^}]*\} from/);
    expect(src).toMatch(/getDailyTargets\(/);
  });

  it("web ProgressMetricDetail imports and uses getDailyTargets", () => {
    const src = read(WEB_PROGRESS_METRIC);
    expect(src).toMatch(/import \{[^}]*getDailyTargets[^}]*\} from/);
    expect(src).toMatch(/getDailyTargets\(/);
  });

  it("web per-day % of goal cannot reintroduce `d.calories / targets.calories`", () => {
    // The bug-shaped pattern — a past-day percentage computed against
    // `targets.calories` (the current profile target) rather than
    // `d.targetCalories` (the day's frozen snapshot). This test FAILS
    // if someone reintroduces it.
    const src = read(WEB_PROGRESS_METRIC);
    // Allow references to `targets.calories` elsewhere (subtitle etc.)
    // but the per-row calculation must use `d.targetCalories`.
    expect(src).toMatch(/d\.targetCalories/);
    expect(src).not.toMatch(/d\.calories \/ targets\.calories\) \* 100/);
  });

  it("mobile per-day % of goal cannot reintroduce `d.calories / targets.calories`", () => {
    const src = read(MOBILE_PROGRESS_METRIC);
    expect(src).toMatch(/d\.targetCalories/);
    expect(src).not.toMatch(/d\.calories \/ targets\.calories\) \* 100/);
  });
});
