/**
 * Native OAuth flow for Capacitor (iOS/Android).
 *
 * Why this exists:
 * In a Capacitor app loading from `server.url`, calling supabase.auth.signInWithOAuth()
 * navigates the WKWebView to appleid.apple.com / accounts.google.com. iOS forces these
 * OAuth pages to open in SFSafariViewController (a separate Safari browser inside the app).
 * The login completes in SFSafariViewController and the session ends up in its own
 * isolated cookie/storage container — the main WKWebView never sees it. The user is left
 * staring at SFSafariViewController (with the URL bar at the bottom) and when they next
 * open the app, the main WebView still has no session, so onboarding shows again.
 *
 * Fix:
 * 1. Generate the OAuth URL via Supabase with skipBrowserRedirect: true
 * 2. Open it via @capacitor/browser (in-app SFSafariViewController we control)
 * 3. Use a custom URL scheme (com.skladai.app://oauth-callback) as redirectTo
 * 4. iOS dismisses SFSafariViewController automatically when the custom scheme is hit
 * 5. @capacitor/app fires appUrlOpen with the callback URL containing the auth code
 * 6. We exchange the code for a session in the main WKWebView via supabase.auth.exchangeCodeForSession()
 *
 * IMPORTANT — Supabase Dashboard setup required:
 * Add `com.skladai.app://oauth-callback` to Authentication → URL Configuration → Redirect URLs
 */

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import type { SupabaseClient } from "@supabase/supabase-js";

export const NATIVE_OAUTH_REDIRECT = "com.skladai.app://oauth-callback";

export function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let listenerRegistered = false;

/**
 * Register the global app URL listener that catches the OAuth callback.
 * Call this ONCE at app startup (e.g. in OnboardingWrapper).
 */
export async function registerOAuthCallbackListener(
  supabase: SupabaseClient,
  onSuccess?: () => void
): Promise<void> {
  if (listenerRegistered) return;
  if (!isCapacitorNative()) return;
  listenerRegistered = true;

  console.log("[NativeOAuth] Registering app URL listener");

  await App.addListener("appUrlOpen", async (event) => {
    console.log("[NativeOAuth] appUrlOpen fired:", event.url);

    if (!event.url || !event.url.startsWith("com.skladai.app://")) {
      console.log("[NativeOAuth] Not an OAuth callback URL, ignoring");
      return;
    }

    // Close the in-app browser if still open
    try {
      await Browser.close();
    } catch {}

    // Parse code or token from URL
    try {
      const url = new URL(event.url);
      // PKCE flow uses ?code=...
      const code = url.searchParams.get("code");
      // Implicit flow uses #access_token=...
      const hash = event.url.split("#")[1];
      const hashParams = hash ? new URLSearchParams(hash) : null;
      const accessToken = hashParams?.get("access_token");
      const refreshToken = hashParams?.get("refresh_token");

      if (code) {
        console.log("[NativeOAuth] Exchanging code for session...");
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error("[NativeOAuth] exchangeCodeForSession failed:", error.message);
          return;
        }
        console.log("[NativeOAuth] Session set via code exchange ✅", data.session?.user?.id);
      } else if (accessToken && refreshToken) {
        console.log("[NativeOAuth] Setting session from hash tokens...");
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.error("[NativeOAuth] setSession failed:", error.message);
          return;
        }
        console.log("[NativeOAuth] Session set via implicit tokens ✅");
      } else {
        console.warn("[NativeOAuth] No code or tokens found in callback URL");
        return;
      }

      onSuccess?.();
    } catch (e) {
      console.error("[NativeOAuth] Callback handling failed:", e);
    }
  });
}

/**
 * Trigger an OAuth sign-in via the native flow.
 * Falls back to standard supabase.auth.signInWithOAuth on web.
 */
export async function signInWithProviderNative(
  supabase: SupabaseClient,
  provider: "apple" | "google"
): Promise<void> {
  if (!isCapacitorNative()) {
    // Web path — use Supabase default
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    return;
  }

  console.log(`[NativeOAuth] Starting ${provider} sign-in via Capacitor Browser...`);

  // Get the OAuth URL without auto-navigating the WebView
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_OAUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    console.error(`[NativeOAuth] signInWithOAuth failed:`, error?.message);
    throw error || new Error("No OAuth URL returned");
  }

  console.log(`[NativeOAuth] Opening OAuth URL in Capacitor Browser:`, data.url);

  // Open in in-app SFSafariViewController; iOS will auto-dismiss when redirect
  // hits the custom URL scheme registered in Info.plist
  await Browser.open({
    url: data.url,
    presentationStyle: "popover",
    windowName: "_self",
  });
}
