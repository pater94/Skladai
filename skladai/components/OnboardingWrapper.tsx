"use client";

import { useState, useEffect } from "react";
import OnboardingSlides from "./OnboardingSlides";

export default function OnboardingWrapper() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem("onboardingCompleted");
    if (!done) setShow(true);
  }, []);

  if (!show) return null;
  return <OnboardingSlides onComplete={() => setShow(false)} />;
}
