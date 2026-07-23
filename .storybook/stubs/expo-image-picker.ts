/** Storybook stub — image picker no-ops on Chromatic. */
export const MediaTypeOptions = {
  Images: "Images",
  Videos: "Videos",
  All: "All",
} as const;

export async function requestCameraPermissionsAsync() {
  return { status: "denied", granted: false, canAskAgain: false, expires: "never" };
}

export async function requestMediaLibraryPermissionsAsync() {
  return { status: "denied", granted: false, canAskAgain: false, expires: "never" };
}

export async function launchImageLibraryAsync(_options?: unknown) {
  return { canceled: true, assets: null };
}

export async function launchCameraAsync(_options?: unknown) {
  return { canceled: true, assets: null };
}

export default {
  MediaTypeOptions,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
};
