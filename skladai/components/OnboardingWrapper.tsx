"use client";

import { useState, useEffect } from "react";
import OnboardingLogin from "./OnboardingLogin";
import { createClient } from "@/lib/supabase";
import { devLog } from "@/lib/dev-log";
import { pullFromCloud } from "@/lib/sync";
import { nsGet, nsSet, nsSelfTest } from "@/lib/native-storage";
import { registerOAuthCallbackListener } from "@/lib/native-oauth";

const ONBOARDED_KEY = "onboardingCompleted";
const SESSION_BACKUP_KEY = "skladai_session_backup_v1";

async function isOnboarded(): Promise<boolean> {
  // Belt and suspenders: check Preferences (UserDefaults), localStorage, and cookie
  const native = await nsGet(ONBOARDED_KEY);
  if (native) {
    devLog("[Onboarding] Flag found in nsGet (Preferences/localStorage)");
    return true;
  }
  try {
    if (localStorage.getItem(ONBOARDED_KEY)) {
      devLog("[Onboarding] Flag found in localStorage (fallback)");
      return true;
    }
  } catch {}
  try {
    if (document.cookie.includes("skladai_onboarded=1")) {
      devLog("[Onboarding] Flag found in cookie (fallback)");
      return true;
    }
  } catch {}
  return false;
}

async function markOnboarded() {
  await nsSet(ONBOARDED_KEY, "true");
  // Also write a long-lived cookie as last-resort backup
  try {
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 1);
    document.cookie = `skladai_onboarded=1;expires=${exp.toUTCString()};path=/;SameSite=Lax`;
  } catch {}
  devLog("[Onboarding] Flag marked in all stores");
}

export default function OnboardingWrapper() {
  // 'checking' = initial state, do NOT flash UI
  // 'hidden'   = onboarding is done, render nothing
  // 'full'     = show full onboarding (new user)
  // 'login'    = show only login slide (returning user, session lost)
  const [state, setState] = useState<"checking" | "hidden" | "full" | "login">("checking");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // Register the native OAuth callback listener (Capacitor only).
    // Catches the com.skladai.app://oauth-callback URL fired after Apple/Google
    // sign-in and exchanges the code for a session in the main WebView.
    registerOAuthCallbackListener(supabase, () => {
      devLog("[Onboarding] Native OAuth callback success");
      markOnboarded();
      pullFromCloud().catch(() => {});
      setState("hidden");
      window.dispatchEvent(new Event("cloud-sync-done"));
    }).catch((e) => console.warn("[Onboarding] OAuth listener register failed:", e));

    async function check() {
      // Run native storage self-test (visible in Xcode console)
      const nsOk = await nsSelfTest();
      devLog("[Onboarding] Native storage self-test:", nsOk ? "PASS" : "FAIL/web");

      const onboarded = await isOnboarded();
      devLog("[Onboarding] Has onboarded flag:", onboarded);

      // STEP 1: Try Supabase's normal getSession (uses our storage adapter)
      let { data: { session } } = await supabase.auth.getSession();
      devLog("[Onboarding] getSession ->", session ? "EXISTS" : "EMPTY");

      // STEP 2: If no session but we have a manual backup in Preferences, restore it.
      // This is the bulletproof path: bypasses Supabase storage adapter entirely.
      if (!session) {
        const backup = await nsGet(SESSION_BACKUP_KEY);
        if (backup) {
          try {
            const parsed = JSON.parse(backup);
            if (parsed?.access_token && parsed?.refresh_token) {
              devLog("[Onboarding] Restoring session from manual backup...");
              const { data, error } = await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
              });
              if (error) {
                console.warn("[Onboarding] setSession from backup failed:", error.message);
              } else if (data.session) {
                session = data.session;
                devLog("[Onboarding] Session restored from backup ✅");
              }
            }
          } catch (e) {
            console.warn("[Onboarding] Backup parse failed:", e);
          }
        }
      }

      if (session) {
        // Validate + restore cloud data
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            devLog("[Onboarding] User validated:", user.id);
            const restored = await pullFromCloud();
            devLog("[Onboarding] Pull result:", restored);
          }
        } catch (e) {
          console.warn("[Onboarding] Cloud restore failed:", e);
        }
        await markOnboarded();
        if (cancelled) return;
        setState("hidden");
        window.dispatchEvent(new Event("cloud-sync-done"));
        window.scrollTo(0, 0);
        return;
      }

      // No session
      if (onboarded) {
        // Returning user — session got wiped. Don't reset their data,
        // just show a minimal login prompt so they can re-auth.
        if (cancelled) return;
        setState("login");
      } else {
        if (cancelled) return;
        setState("full");
      }
    }

    check();

    // Refresh session when app comes back from background (iOS Capacitor)
    const onVis = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            markOnboarded();
            setState((prev) => (prev === "hidden" ? prev : "hidden"));
            window.dispatchEvent(new Event("cloud-sync-done"));
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // Auth state listener — auto-hide onboarding when sign-in completes
    // and ALWAYS persist the full session JSON to Preferences as a manual backup.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      devLog("[Onboarding] Auth event:", event, "session:", session ? "yes" : "no");

      // Manual session backup — independent of Supabase storage adapter.
      // This is the bulletproof path: stores access_token + refresh_token in
      // iOS UserDefaults via @capacitor/preferences. UserDefaults survives
      // every WKWebView storage wipe.
      if (session) {
        const backup = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        };
        nsSet(SESSION_BACKUP_KEY, JSON.stringify(backup))
          .then(() => devLog("[Onboarding] Session backup saved"))
          .catch((e) => console.warn("[Onboarding] Session backup failed:", e));
      } else if (event === "SIGNED_OUT") {
        nsSet(SESSION_BACKUP_KEY, "").catch(() => {});
      }

      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        markOnboarded();
        pullFromCloud().catch((e) => console.warn("[Onboarding] Pull on auth event failed:", e));
        setState("hidden");
        window.dispatchEvent(new Event("cloud-sync-done"));
      }
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide bottom nav while any onboarding screen is visible
  useEffect(() => {
    const visible = state === "full" || state === "login";
    if (visible) {
      document.body.classList.add("onboarding-active");
    } else {
      document.body.classList.remove("onboarding-active");
    }
    return () => document.body.classList.remove("onboarding-active");
  }, [state]);

  if (state === "checking" || state === "hidden") return null;

  // ALWAYS start from slide 0, regardless of whether this is a brand new
  // user or a returning one whose session got wiped. Earlier we used
  // `state === "login" ? 2 : 0` to shortcut returning users straight to
  // the login screen, but that caused every shared link (Messenger /
  // WhatsApp in-app browser, Safari, Chrome, Capacitor WebView) to land
  // on slide 3 as soon as the onboardingCompleted flag existed anywhere
  // — Preferences, localStorage or cookie. The correct UX is: every
  // fresh entry to skladai.com starts from the first slide. Users can
  // swipe / tap the dots to reach the login.
  return (
    <OnboardingLogin
      startSlide={0}
      onSkip={() => {
        markOnboarded();
        setState("hidden");
        window.scrollTo(0, 0);
      }}
    />
  );
}
