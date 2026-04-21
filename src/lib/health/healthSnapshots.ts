/**
 * health_snapshots read adapter.
 *
 * The web Apple Health card (`src/app/components/suppr/apple-health-card.tsx`)
 * has no HealthKit access. It reads whatever the iOS app last wrote to the
 * `health_snapshots` table and renders the four metrics (Steps / Active
 * energy / Resting burn / Weight) plus a "last synced" relative label.
 *
 * See `docs/design/apple-health-card.md` §7 for the sync contract and
 * `supabase/migrations/20260429100000_health_snapshots.sql` for the table
 * definition.
 *
 * Shape notes:
 *  - `null` metric values are semantic — they mean HealthKit did not
 *    return a sample for that bucket, not that the value is zero. The
 *    card renders them as em-dash rather than fabricating a zero.
 *  - A successful fetch that found no rows returns `null` (empty state —
 *    "no mobile device has ever synced"). That is a legitimate outcome,
 *    not an error.
 *  - A failed fetch throws so the caller can distinguish empty-never-
 *    synced from transient-error.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface HealthSnapshot {
  capturedAt: string;
  steps: number | null;
  activeEnergyKcal: number | null;
  restingBurnKcal: number | null;
  weightKg: number | null;
  source: string;
  deviceId: string | null;
}

interface RawHealthSnapshotRow {
  captured_at: string | null;
  steps: number | null;
  active_energy_kcal: number | null;
  resting_burn_kcal: number | null;
  weight_kg: number | string | null;
  source: string | null;
  device_id: string | null;
}

/** Read the most recent health snapshot for a user. Returns `null` when the
 *  iOS app has never written a row for this account (web's "empty — never
 *  synced" state). Throws on transport error so the card can show the
 *  error state rather than silently hiding. */
export async function getLatestHealthSnapshot(
  supabase: Pick<SupabaseClient, "from">,
  userId: string,
): Promise<HealthSnapshot | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("health_snapshots")
    .select("captured_at, steps, active_energy_kcal, resting_burn_kcal, weight_kg, source, device_id")
    .eq("user_id", userId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getLatestHealthSnapshot failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as RawHealthSnapshotRow;
  const weightRaw = row.weight_kg;
  const weightKg =
    weightRaw == null
      ? null
      : typeof weightRaw === "string"
        ? Number.parseFloat(weightRaw)
        : weightRaw;

  return {
    capturedAt: row.captured_at ?? new Date(0).toISOString(),
    steps: row.steps,
    activeEnergyKcal: row.active_energy_kcal,
    restingBurnKcal: row.resting_burn_kcal,
    weightKg: weightKg == null || !Number.isFinite(weightKg) ? null : weightKg,
    source: row.source ?? "healthkit",
    deviceId: row.device_id,
  };
}

/** Formats the "last synced" relative time used as a prefix on the
 *  footer methodology line when the data is > 24h old. */
export function formatHealthSnapshotSyncedAgo(
  capturedAtIso: string,
  now: Date = new Date(),
): string {
  const capturedMs = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(capturedMs)) return "recently";
  const diffMs = now.getTime() - capturedMs;
  if (diffMs < 0) return "just now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  if (day < 30) return `${Math.floor(day / 7)}w`;
  if (day < 365) return `${Math.floor(day / 30)}mo`;
  return `${Math.floor(day / 365)}y`;
}

/** True when the snapshot is older than 24h — drives the stale footer
 *  prefix per §5 of the design brief. */
export function isHealthSnapshotStale(
  capturedAtIso: string,
  now: Date = new Date(),
): boolean {
  const capturedMs = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(capturedMs)) return true;
  return now.getTime() - capturedMs > 24 * 3600 * 1000;
}
