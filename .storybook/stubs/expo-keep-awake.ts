/** Storybook stub — keep-awake is a no-op on web Chromatic. */
export function useKeepAwake(_tag?: string) {
  return undefined;
}

export function activateKeepAwakeAsync(_tag?: string) {
  return Promise.resolve();
}

export function deactivateKeepAwake(_tag?: string) {
  return Promise.resolve();
}
