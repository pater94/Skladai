"use client";

import { useState, useEffect } from "react";
import OnboardingLogin from "./OnboardingLogin";
import { createClient } from "@/lib/supabase";
import { pullFromCloud } from "@/lib/sync";

export default function OnboardingWrapper() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("onboardingCompleted");
    if (done) return;

    // Check if user just came back from OAuth redirect
    const supabase = createClient();

    // Use getSession first (synchronous from storage), then getUser (validates with server)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        console.log("[Onboarding] Session found, restoring cloud data...");
        // User is logged in (came back from OAuth redirect)
        // Wait for session to be fully established
        try {
          // Validate the session with the server
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            console.log("[Onboarding] User validated:", user.id);
            // Restore cloud data FIRST, then mark onboarding done
            const restored = await pullFromCloud();
            console.log("[Onboarding] Pull result:", restored);
          }
        } catch (e) {
          console.warn("[Onboarding] Cloud restore failed:", e);
        }

        localStorage.setItem("onboardingCompleted", "true");
        window.dispatchEvent(new Event("cloud-sync-done"));
        window.scrollTo(0, 0);
      } else {
        setShow(true);
      }
    });
  }, []);

  // Hide bottom nav & let onboarding fill full screen
  useEffect(() => {
    if (show) {
      document.body.classList.add("onboarding-active");
    } else {
      document.body.classList.remove("onboarding-active");
    }
    return () => document.body.classList.remove("onboarding-active");
  }, [show]);

  if (!show) return null;

  return (
    <OnboardingLogin
      onSkip={() => {
        localStorage.setItem("onboardingCompleted", "true");
        setShow(false);
        window.scrollTo(0, 0);
      }}
    />
  );
}
