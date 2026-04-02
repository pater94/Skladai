"use client";

import { useState, useEffect } from "react";
import OnboardingLogin from "./OnboardingLogin";
import { createClient } from "@/lib/supabase";

export default function OnboardingWrapper() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("onboardingCompleted");
    if (done) return;

    // Check if user just came back from OAuth redirect
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // User is logged in (came back from Apple sign in)
        localStorage.setItem("onboardingCompleted", "true");
        window.scrollTo(0, 0);
      } else {
        setShow(true);
      }
    });
  }, []);

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
