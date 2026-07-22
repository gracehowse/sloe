/** Storybook stub — in-app browser no-ops on Chromatic. */
export const WebBrowserPresentationStyle = {
  FULL_SCREEN: "fullScreen",
  PAGE_SHEET: "pageSheet",
  FORM_SHEET: "formSheet",
  CURRENT_CONTEXT: "currentContext",
  OVER_FULL_SCREEN: "overFullScreen",
  OVER_CURRENT_CONTEXT: "overCurrentContext",
  POPOVER: "popover",
  AUTOMATIC: "automatic",
} as const;

export async function openBrowserAsync(_url: string, _options?: unknown): Promise<{ type: string }> {
  return { type: "cancel" };
}

export default { openBrowserAsync, WebBrowserPresentationStyle };
