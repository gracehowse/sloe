import { BatchInfo, Configuration, Eyes } from "@applitools/eyes-playwright";

export function hasApplitoolsApiKey(): boolean {
  return Boolean(process.env.APPLITOOLS_API_KEY?.trim());
}

/** Eyes client configured for Suppr web — requires `APPLITOOLS_API_KEY`. */
export function createEyes(testName: string): Eyes {
  const eyes = new Eyes();
  const configuration = new Configuration();
  configuration.setApiKey(process.env.APPLITOOLS_API_KEY!);
  configuration.setAppName("Suppr Web");
  configuration.setTestName(testName);
  configuration.setBatch(
    new BatchInfo({
      name: process.env.APPLITOOLS_BATCH_NAME ?? "Suppr Playwright",
      id: process.env.APPLITOOLS_BATCH_ID,
    }),
  );
  if (process.env.APPLITOOLS_SERVER_URL?.trim()) {
    configuration.setServerUrl(process.env.APPLITOOLS_SERVER_URL.trim());
  }
  eyes.setConfiguration(configuration);
  return eyes;
}
