"use client";

import { useState, useEffect } from "react";
import OnboardingLogin from "./OnboardingLogin";
import { createClient } from "@/lib/supabase";
import { pullFromCloud } from "@/lib/sync";

const COOKIE_KEY = "skladai_onboarded";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const exp = new Date();
  exp.setTime(exp.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${exp.toUTCString()};path=/;SameSite=Lax`;
}

function isOnboarded(): boolean {
  try {
    if (localStorage.getItem("onboardingCompleted")) return true;
  } catch {}
  if (getCookie(COOKIE_KEY) === "1") return true;
  return false;
}

function markOnboarded() {
  try { localStorage.setItem("onboardingCompleted", "true"); } catch {}
  setCookie(COOKIE_KEY, "1", 365);
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
      const onboarded = isOnboarded();

      // Try to get current session (from storage)
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
        markOnboarded();
        if (cancelled) return;
        setState("hidden");
        window.dispatchEvent(new Event("cloud-sync-done"));
        window.scrollTo(0, 0);
        return;
      }

      // No session
      if (onboarded) {
        // Returning user — session got wiped (WKWebView storage). Don't reset their data,
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
          if (session && state !== "hidden") {
            // Session restored — hide onboarding
            markOnboarded();
            setState("hidden");
            window.dispatchEvent(new Event("cloud-sync-done"));
          }
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // Also listen for auth state changes (OAuth callback completes)
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
