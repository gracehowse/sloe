import { test as setup } from "@playwright/test";
import { loginWithVisualGoldenUser, hasVisualGoldenCredentials } from "./utils/auth";
import { qaVisualAuthHosts } from "./utils/authHosts";
import { refreshAuthState } from "./utils/refreshAuthState";

setup.describe.configure({ retries: 2 });

setup("authenticate visual-golden users (127.0.0.1 + localhost)", async ({ browser }) => {
  setup.skip(!hasVisualGoldenCredentials(), "E2E_VISUAL_EMAIL and E2E_VISUAL_PASSWORD required");

  for (const { origin, file } of qaVisualAuthHosts()) {
    await refreshAuthState({ browser, origin, file, login: loginWithVisualGoldenUser });
  }
});
