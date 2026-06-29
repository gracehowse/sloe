/**
 * `expo-blur` shim (ENG-1247 frosted tab bar) — the real package ships
 * `build/BlurView.js` with JSX inside a node_modules `.js` file, which vite's
 * import-analysis rejects, and the native backdrop-blur module isn't present
 * under vitest anyway. The frosted `<SupprTabBar>` BlurView is a purely-visual
 * container, so we re-export the RN host-shim `View` as a passthrough. Unknown
 * expo-blur props (intensity, tint, blurReductionFactor, experimentalBlurMethod)
 * are harmlessly ignored by the host element; `style` + `children` render
 * exactly as they do in the real bar, so layout/routing assertions still hold.
 */
import { View } from "react-native";

export const BlurView = View;

export default { BlurView };
