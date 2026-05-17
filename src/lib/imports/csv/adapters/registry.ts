import { canonHeader } from "../csvPrimitives";
import type { CsvImportAdapter } from "../types";
import { mfpAdapter } from "./mfp";

/**
 * Registered adapters in detection order. MFP is first today because
 * it's the only one shipped — when Lose It / Cronometer / MacroFactor
 * etc. land, the registration order matters less since the detectors
 * are designed to be mutually exclusive. If two ever overlap, the
 * order here decides — keep the most-distinctive detector first.
 *
 * Adding a new adapter:
 *   1. Drop a file under `adapters/<source>.ts` exporting a
 *      {@link CsvImportAdapter} constant.
 *   2. Import + push it into this array.
 *   3. Add a test fixture under
 *      `tests/fixtures/import-csv/<source>-sample.csv` and a row in
 *      `tests/unit/csvImportFramework.test.ts` to lock the detection
 *      + parse contract.
 *   4. Optionally surface the new adapter's `displayName` in the
 *      import UI's source picker — but the auto-detect path means
 *      you don't have to.
 */
export const REGISTERED_ADAPTERS: readonly CsvImportAdapter[] = [
  mfpAdapter,
];

/**
 * Best-effort adapter detection from a CSV's header row. Returns the
 * first registered adapter whose `detect` says yes, or `null` when no
 * adapter recognises the format.
 *
 * Callers that want to force a specific adapter (e.g. when the user
 * picked one explicitly in the UI) should look it up by `source` from
 * `REGISTERED_ADAPTERS` directly instead of going through detection.
 */
export function detectAdapter(
  rawHeaders: readonly string[],
): CsvImportAdapter | null {
  const canonical = rawHeaders.map((h) => canonHeader(h));
  for (const adapter of REGISTERED_ADAPTERS) {
    try {
      if (adapter.detect(canonical, rawHeaders.slice())) {
        return adapter;
      }
    } catch {
      // A broken detector should not poison the rest of the chain.
      // Fall through and try the next adapter.
    }
  }
  return null;
}

/** Look up a registered adapter by its stable `source` identifier.
 *  Returns `null` for unknown sources. */
export function getAdapterBySource(source: string): CsvImportAdapter | null {
  return REGISTERED_ADAPTERS.find((a) => a.source === source) ?? null;
}
