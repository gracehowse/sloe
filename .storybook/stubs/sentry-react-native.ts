/** Storybook stub — Sentry RN SDK no-ops on Chromatic / vitest. */
export function init(_options?: unknown): void {}
export function captureException(_err: unknown, _hint?: unknown): string {
  return "storybook";
}
export function captureMessage(_msg: string, _level?: unknown): string {
  return "storybook";
}
export function setUser(_user: unknown): void {}
export function setTag(_key: string, _value: string): void {}
export function addBreadcrumb(_breadcrumb: unknown): void {}
export function withScope(callback: (scope: { setTag: () => void }) => void): void {
  callback({ setTag: () => undefined });
}

export const ReactNativeTracing = function ReactNativeTracing() {};
export const reactNativeTracingIntegration = () => ({ name: "ReactNativeTracing" });
export const mobileReplayIntegration = () => ({ name: "MobileReplay" });

export default {
  init,
  captureException,
  captureMessage,
  setUser,
  setTag,
  addBreadcrumb,
  withScope,
};
