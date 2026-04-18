/**
 * `expo-constants` shim — exposes an `expoConfig.extra` stub so any
 * module that reads the API base URL (e.g. `lib/verifyRecipe.ts`) can
 * import without a native bridge.
 */
const Constants = {
  expoConfig: {
    extra: {
      supprApiUrl: "",
    },
  },
  manifest: null,
  manifest2: null,
  platform: { ios: { model: "simulator" } },
};

export default Constants;
