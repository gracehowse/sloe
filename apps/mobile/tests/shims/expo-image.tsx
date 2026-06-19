/**
 * `expo-image` shim — the real package loads native (SDWebImage) bindings at
 * import time, which don't survive vitest's vmThreads pool. We re-export the
 * RN host-shim `Image` so `<SmartImage>` (ENG-685) and any component that
 * renders expo-image is mountable + queryable under @testing-library/react-native.
 * Unknown expo-image props (contentFit, transition, cachePolicy, recyclingKey,
 * placeholder) are harmlessly ignored by the host forwarder.
 */
import { Image as RNImage } from "react-native";

export const Image = RNImage;

export default { Image };
