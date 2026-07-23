/** Storybook stub — Constants for mobile stories. */
export const ExecutionEnvironment = {
  StoreClient: "storeClient",
  Bare: "bare",
  Standalone: "standalone",
} as const;

const Constants = {
  appOwnership: "expo",
  expoConfig: { extra: {} },
  executionEnvironment: ExecutionEnvironment.StoreClient,
  isDevice: false,
  sessionId: "storybook",
};

export default Constants;
