/**
 * Vitest shim for `expo-image-picker`.
 *
 * CreateCustomFoodSheet (scan-label OCR, 2026-06-11) imports this at module
 * load; the real package pulls `expo-modules-core` native bindings that fail
 * under vitest's vmThreads pool. Tests that need scenario-specific behaviour
 * should `vi.doMock("expo-image-picker", ...)`.
 */
export const MediaTypeOptions = { Images: "Images" };

export async function requestCameraPermissionsAsync() {
  return { granted: true, status: "granted" as const };
}

export async function launchCameraAsync() {
  return { canceled: true as const, assets: null };
}

const exports = {
  MediaTypeOptions,
  requestCameraPermissionsAsync,
  launchCameraAsync,
};

export default exports;
