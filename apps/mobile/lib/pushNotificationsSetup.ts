import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let configured = false;

/**
 * Registers default presentation behaviour for remote/local notifications.
 * Call once at app startup (native builds only; may no-op in environments without the module).
 */
export function configureNotificationPresentation(): void {
  if (configured) return;
  configured = true;
  if (Platform.OS === "web") return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === "android") {
    void Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}
