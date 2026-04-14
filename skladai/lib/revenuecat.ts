import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";

const API_KEYS = {
  ios: "appl_KJQeRcpUOFMfrUauBDIEbHxzLQS",
  android: "goog_VDoBzehHalrmqFOpBeZHUODuiQr",
};

export async function initRevenueCat() {
  if (!Capacitor.isNativePlatform()) return; // Skip on web

  const platform = Capacitor.getPlatform();
  const apiKey = platform === "ios" ? API_KEYS.ios : API_KEYS.android;

  await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
  await Purchases.configure({ apiKey });
}

export async function checkPremium(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active["SkładAI Pro"] !== undefined;
  } catch {
    return false;
  }
}

export async function getOfferings() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function purchasePackage(pkg: any) {
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo.entitlements.active["SkładAI Pro"] !== undefined;
}

export async function restorePurchases() {
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo.entitlements.active["SkładAI Pro"] !== undefined;
}

export async function identifyUser(supabaseUserId: string) {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.logIn({ appUserID: supabaseUserId });
}

export async function resetUser() {
  if (!Capacitor.isNativePlatform()) return;
  await Purchases.logOut();
}
