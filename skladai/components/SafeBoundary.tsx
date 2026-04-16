"use client";

import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  /** Human-readable name for log context — e.g. "AgentFAB". */
  name?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last-line-of-defense error boundary.
 *
 * Wrap any non-critical component that sits inside the root layout with this
 * boundary. If the child throws during render, we swallow the error, log a
 * warning, and render nothing — so one faulty widget never blanks the whole
 * app (what used to happen when AgentFAB / useHealthData / etc. crashed in
 * layout.tsx and took OnboardingWrapper down with them).
 *
 * Must stay a class component — React's error-boundary contract requires
 * componentDidCatch / getDerivedStateFromError on a class.
 */
export default class SafeBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const tag = this.props.name ? `[SafeBoundary:${this.props.name}]` : "[SafeBoundary]";
    // Keep this to console.warn, not console.error — we don't want the
    // error-overlay to pop up in dev for a deliberately-swallowed error.
    console.warn(tag, "swallowed error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
