"use client";

import { useState, useEffect } from "react";
import OnboardingLogin from "./OnboardingLogin";
import { createClient } from "@/lib/supabase";
import { pullFromCloud } from "@/lib/sync";
import { nsGet, nsSet } from "@/lib/native-storage";

const ONBOARDED_KEY = "onboardingCompleted";

async function isOnboarded(): Promise<boolean> {
  // Check native storage (Preferences/UserDefaults on iOS) first
  const native = await nsGet(ONBOARDED_KEY);
  if (native) return true;
  // Fallback to localStorage (in case of older installs)
  try {
    if (localStorage.getItem(ONBOARDED_KEY)) return true;
  } catch {}
  return false;
}

async function markOnboarded() {
  await nsSet(ONBOARDED_KEY, "true");
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

    async function check() {
      const onboarded = await isOnboarded();

      // Try to get current session (from storage — native Preferences on iOS)
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Validate + restore cloud data
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            console.log("[Onboarding] User validated:", user.id);
            const restored = await pullFromCloud();
            console.log("[Onboarding] Pull result:", restored);
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
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Onboarding] Auth event:", event);
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

  return (
    <OnboardingLogin
      startSlide={state === "login" ? 2 : 0}
      onSkip={() => {
        markOnboarded();
        setState("hidden");
        window.scrollTo(0, 0);
      }}
    />
  );
}
