import { test as setup } from "@playwright/test";
import { hasE2ECredentials, loginWithTestUser } from "./utils/auth";
import { qaAuthHosts } from "./utils/authHosts";
import { refreshAuthState } from "./utils/refreshAuthState";

setup.describe.configure({ retries: 2 });

setup("authenticate E2E users (127.0.0.1 + localhost)", async ({ browser }) => {
  setup.skip(!hasE2ECredentials(), "E2E_EMAIL and E2E_PASSWORD required");

  for (const { origin, file } of qaAuthHosts()) {
    await refreshAuthState({ browser, origin, file, login: loginWithTestUser });
  }
});
