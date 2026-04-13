import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";
import type { SupabaseClient } from "@supabase/supabase-js";

const API_KEY_IOS =
  Constants.expoConfig?.extra?.revenuecatAppleKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ??
  "";
const API_KEY_ANDROID =
  Constants.expoConfig?.extra?.revenuecatGoogleKey ??
  process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ??
  "";

let configured = false;

export function configurePurchases(userId?: string): void {
  if (configured) return;
  const key = Platform.OS === "ios" ? API_KEY_IOS : API_KEY_ANDROID;
  if (!key) return;

  Purchases.configure({
    apiKey: key,
    appUserID: userId ?? undefined,
  });
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  configured = true;
}

export async function getOfferings(): Promise<PurchasesPackage[]> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ success: boolean; customerInfo?: CustomerInfo }> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { success: true, customerInfo: result.customerInfo };
  } catch (e: unknown) {
    const err = e as { userCancelled?: boolean };
    if (err.userCancelled) return { success: false };
    throw e;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export function isProEntitled(info: CustomerInfo): boolean {
  return !!info.entitlements.active["pro"];
}

export function isBaseEntitled(info: CustomerInfo): boolean {
  return (
    !!info.entitlements.active["base"] || !!info.entitlements.active["pro"]
  );
}

export function resolvedTier(info: CustomerInfo): "free" | "base" | "pro" {
  if (info.entitlements.active["pro"]) return "pro";
  if (info.entitlements.active["base"]) return "base";
  return "free";
}

/**
 * Sync RevenueCat entitlement to Supabase `profiles.user_tier`.
 * Call after purchase, restore, or app launch.
 */
export async function syncTierToSupabase(
  info: CustomerInfo,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const tier = resolvedTier(info);
  const { error } = await supabase.from("profiles").update({ user_tier: tier }).eq("id", userId);
  if (error && __DEV__) {
    console.warn("[syncTierToSupabase]", error.message);
  }
}
