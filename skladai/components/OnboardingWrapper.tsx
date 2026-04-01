"use client";

import { useState, useEffect } from "react";
import OnboardingLogin from "./OnboardingLogin";

export default function OnboardingWrapper() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("onboardingCompleted");
    if (!done) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <OnboardingLogin
      onSkip={() => {
        localStorage.setItem("onboardingCompleted", "true");
        setShow(false);
      }}
    />
  );
}
