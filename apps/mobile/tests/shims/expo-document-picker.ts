/**
 * Vitest shim for `expo-document-picker`.
 *
 * Real package loads native modules at import time; under vitest's
 * vmThreads pool that surfaces as a missing-native-binding error.
 *
 * Tests that need to assert behaviour around the picker should
 * `vi.doMock("expo-document-picker", ...)` to install scenario-specific
 * fakes (cancelled / asset / error). The default behaviour returned by
 * this shim is a cancellation so accidentally un-mocked tests don't
 * trigger an upload.
 */

export type DocumentPickerAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

export type DocumentPickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: DocumentPickerAsset[] };

export async function getDocumentAsync(): Promise<DocumentPickerResult> {
  return { canceled: true, assets: null };
}

const exports = { getDocumentAsync };
export default exports;
