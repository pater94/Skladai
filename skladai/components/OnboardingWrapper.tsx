"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import OnboardingLogin from "./OnboardingLogin";
import { createClient } from "@/lib/supabase";
import { devLog } from "@/lib/dev-log";
import { identifyUser, resetUser } from "@/lib/revenuecat";
import { pullFromCloud } from "@/lib/sync";
import { nsGet, nsSet, nsSelfTest } from "@/lib/native-storage";
import { registerOAuthCallbackListener } from "@/lib/native-oauth";

const ONBOARDED_KEY = "onboardingCompleted";
const SESSION_BACKUP_KEY = "skladai_session_backup_v1";

/**
 * Routes that must ALWAYS render their own content, even for signed-out
 * visitors. Apple App Review, Google Play audit, and GDPR inspectors
 * open these URLs cold — no session, no onboarding — and the page has
 * to show the actual policy / support text, not an onboarding overlay.
 *
 * Listed here (and mirrored in BottomNav/AgentFAB `HIDDEN_PREFIXES`) so
 * the full-screen overlay never mounts on these paths at all.
 */
const PUBLIC_ROUTES = new Set([
  "/privacy",
  "/polityka-prywatnosci",
  "/support",
  "/kontakt",
  "/terms",
  "/regulamin",
  "/delete-account",
]);

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  // Exact match first (cheap) — then startsWith check so future nested
  // routes under a public prefix (e.g. /privacy/cookies) also qualify.
  if (PUBLIC_ROUTES.has(pathname)) return true;
  for (const r of PUBLIC_ROUTES) {
    if (pathname.startsWith(r + "/")) return true;
  }
  return false;
}

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

  // Public routes (privacy, support, delete-account, …) must render their
  // own content without ever seeing the onboarding overlay. Apple Review
  // will reject the submission if /privacy redirects / overlays instead
  // of showing the Privacy Policy.
  const pathname = usePathname();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    // Short-circuit on public routes — no Supabase session check, no
    // native storage reads, nothing. The page renders untouched.
    if (isPublic) return;

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
        // Disconnect user from RevenueCat on sign-out
        resetUser().catch(() => {});
      }

      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        markOnboarded();
        pullFromCloud().catch((e) => console.warn("[Onboarding] Pull on auth event failed:", e));
        // Link Supabase user to RevenueCat for premium entitlement tracking
        identifyUser(session.user.id).catch(() => {});
        setState("hidden");
        window.dispatchEvent(new Event("cloud-sync-done"));

        // FIRST-TIME HEALTH PROMPT — ask HealthKit / Health Connect once
        // per install. Fires the native 4-toggle dialog (Kroki, Kalorie,
        // Dystans, Sen) so the user doesn't have to manually navigate to
        // Profil → Połącz later. Gated on localStorage "healthKitAsked"
        // so re-logins don't spam the dialog. On iOS, subsequent
        // requestAuthorization calls are no-ops anyway (Apple privacy),
        // but on Android fresh installs / post-uninstall they would
        // fire the dialog again — the flag prevents that.
        if (event === "SIGNED_IN") {
          try {
            if (localStorage.getItem("healthKitAsked") !== "1") {
              // 500 ms delay lets the Login screen unmount + Dashboard
              // mount finish, so the native dialog lands on a stable UI
              // rather than mid-transition.
              setTimeout(async () => {
                try {
                  const { Capacitor } = await import("@capacitor/core");
                  if (!Capacitor.isNativePlatform()) return;
                  const { Health } = await import("@capgo/capacitor-health");
                  const availability = await Health.isAvailable();
                  if (!availability.available) return;
                  await Health.requestAuthorization({
                    read: ["steps", "calories", "distance", "sleep"],
                  });
                  localStorage.setItem("healthKitAsked", "1");
                } catch (err) {
                  console.warn("[Onboarding] Auto health prompt failed:", err);
                }
              }, 500);
            }
          } catch {
            // localStorage can throw in private-browsing modes; skip.
          }
        }
      } else if (event === "SIGNED_OUT") {
        // User tapped "Wyloguj się" in Profil. We need to resurface the
        // login UI so they can sign back in — without this, OnboardingWrapper
        // stays in "hidden" state forever and Profil has no "Zaloguj się"
        // entry point; only a fresh install brings the user back.
        //
        // Check the persisted onboarded flag: if the user has already been
        // through the tutorial slides once, show ONLY the login slide
        // (state = "login"). If for some reason the flag is gone, fall back
        // to the full onboarding so they aren't locked out.
        isOnboarded()
          .then((ob) => {
            if (cancelled) return;
            devLog("[Onboarding] SIGNED_OUT — surfacing", ob ? "login" : "full", "screen");
            setState(ob ? "login" : "full");
          })
          .catch(() => {
            if (cancelled) return;
            setState("login");
          });
      }
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      authListener.subscription.unsubscribe();
    };
    // Depend on isPublic only — all other refs inside are stable (createClient
    // returns a singleton-like client, registerOAuthCallbackListener is
    // idempotent). Re-running on isPublic flip tears down auth listeners
    // when the user navigates INTO a public route and re-arms them when
    // they navigate back out.
  }, [isPublic]);

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

  // Public route → never show the onboarding overlay. This is the
  // safety net; the effect already no-ops for public routes, but a stale
  // `state !== "hidden"` from a prior route would otherwise still render.
  if (isPublic) return null;
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
