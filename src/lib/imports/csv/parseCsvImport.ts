import { normaliseInput, splitCsvLine } from "./csvPrimitives";
import { parseCsvWithAdapter } from "./runCsvImport";
import { detectAdapter, getAdapterBySource } from "./adapters/registry";
import type { CsvImportResult } from "./types";

/**
 * Top-level entry point for the pluggable CSV-import framework.
 *
 * Auto-detects the adapter from the file's header row when `source`
 * is unspecified, then runs the generic parser. If detection fails
 * (no adapter recognises the headers), returns an empty-rows result
 * with `source: "unknown"` and a `["unknown_source"]` warning so the
 * caller can surface a "we couldn't recognise this export" message
 * without crashing.
 *
 * When `source` IS specified (the user picked one explicitly), we
 * skip detection and use that adapter unconditionally. If the source
 * doesn't match any registered adapter, returns `["unknown_source"]`
 * so the UI can recover.
 */
export function parseCsvImport(
  input: string,
  source?: string,
): CsvImportResult {
  // Explicit source path.
  if (source) {
    const adapter = getAdapterBySource(source);
    if (!adapter) {
      return { source, rows: [], warnings: ["unknown_source"] };
    }
    return parseCsvWithAdapter(input, adapter);
  }

  // Auto-detect path: extract the header row, sniff, dispatch.
  const text = normaliseInput(input);
  if (!text.trim()) {
    return { source: "unknown", rows: [], warnings: ["empty_file"] };
  }
  const lines = text.split("\n");
  let rawHeaders: string[] | null = null;
  for (const line of lines) {
    const split = splitCsvLine(line);
    if (split) {
      rawHeaders = split.map((c) => c.trim());
      break;
    }
  }
  if (!rawHeaders) {
    return { source: "unknown", rows: [], warnings: ["no_header"] };
  }
  const adapter = detectAdapter(rawHeaders);
  if (!adapter) {
    return { source: "unknown", rows: [], warnings: ["unknown_source"] };
  }
  return parseCsvWithAdapter(input, adapter);
}
