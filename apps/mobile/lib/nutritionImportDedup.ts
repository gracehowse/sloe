/** Why a HealthKit dietary-energy sample was skipped during import. */
export type HealthImportSkipReason = "tombstone" | "existing_hk_id" | "legacy_fingerprint";

export type HealthImportSkipDecision =
  | { skip: false }
  | { skip: true; reason: HealthImportSkipReason };

/**
 * Pure dedup / tombstone gate for `syncNutritionFromHealthImpl`.
 * Extracted for unit tests (ENG-879).
 */
export function evaluateHealthImportSkip(input: {
  sampleId: string | null | undefined;
  existingHkIds: ReadonlySet<string>;
  tombstoneIds: ReadonlySet<string>;
  dedupKey: string;
  legacyFingerprintSet: ReadonlySet<string>;
}): HealthImportSkipDecision {
  const { sampleId, existingHkIds, tombstoneIds, dedupKey, legacyFingerprintSet } = input;

  if (sampleId) {
    if (tombstoneIds.has(sampleId)) {
      return { skip: true, reason: "tombstone" };
    }
    if (existingHkIds.has(sampleId)) {
      return { skip: true, reason: "existing_hk_id" };
    }
    return { skip: false };
  }

  if (legacyFingerprintSet.has(dedupKey)) {
    return { skip: true, reason: "legacy_fingerprint" };
  }
  return { skip: false };
}
