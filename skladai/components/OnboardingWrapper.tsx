"use client";

import { useState, useEffect } from "react";
import LoginScreen from "./LoginScreen";

export default function OnboardingWrapper() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("onboardingCompleted");
    if (!done) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <LoginScreen
      onSkip={() => {
        localStorage.setItem("onboardingCompleted", "true");
        setShow(false);
      }}
    />
  );
}
