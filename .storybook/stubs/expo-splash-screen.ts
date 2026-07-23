/** Storybook stub — splash screen no-ops on Chromatic. */
export async function preventAutoHideAsync(): Promise<boolean> {
  return true;
}

export async function hideAsync(): Promise<boolean> {
  return true;
}

export function setOptions(_options: unknown): void {}

export default { preventAutoHideAsync, hideAsync, setOptions };
