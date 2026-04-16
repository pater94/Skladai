"use client";

import { Component, ReactNode, ErrorInfo } from "react";

interface Props {
  /** Human-readable name for log context — e.g. "AgentFAB". */
  name?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Last-line-of-defense error boundary.
 *
 * Wrap any non-critical component that sits inside the root layout with this
 * boundary. If the child throws during render, we swallow the error, log a
 * warning, persist the error details to sessionStorage for later retrieval,
 * and render a tiny visible badge so we can tell from a screenshot WHICH
 * boundary caught something — instead of just quietly rendering null and
 * leaving us to guess.
 *
 * Must stay a class component — React's error-boundary contract requires
 * componentDidCatch / getDerivedStateFromError on a class.
 */
export default class SafeBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "unknown" };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const name = this.props.name || "anon";
    const tag = `[SafeBoundary:${name}]`;
    console.warn(tag, "swallowed error:", error, info.componentStack);
    // Persist the last crash per boundary so the diag banner (and future
    // tooling) can surface it without needing a Mac + remote inspector.
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `__sb_err_${name}`,
          JSON.stringify({
            at: Date.now(),
            message: error?.message || "unknown",
            stack: (error?.stack || "").slice(0, 4000),
            componentStack: (info.componentStack || "").slice(0, 2000),
          }),
        );
      }
    } catch {
      // sessionStorage can throw in private-browsing modes — ignore.
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    // Tiny visible badge so a screenshot tells us which boundary fired.
    // Positioned absolutely so it doesn't affect surrounding layout and
    // capped to one line. Tap to dismiss.
    const name = this.props.name || "?";
    return (
      <div
        onClick={(e) => {
          e.currentTarget.style.display = "none";
        }}
        style={{
          position: "fixed",
          top: "env(safe-area-inset-top, 0px)",
          left: 4,
          zIndex: 99999,
          padding: "2px 8px",
          background: "rgba(239,68,68,0.9)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 800,
          borderRadius: 4,
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "-apple-system, monospace",
          pointerEvents: "auto",
        }}
        title={this.state.message}
      >
        ⚠️ {name}: {this.state.message.slice(0, 80)}
      </div>
    );
  }
}
