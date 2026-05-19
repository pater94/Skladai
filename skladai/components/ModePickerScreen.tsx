"use client";

/**
 * ModePickerScreen — full-screen onboarding step pokazywany po Sign In
 * gdy user nie ma jeszcze wybranego trybu (profile.mode == null).
 *
 * Etap 1: zapisuje wybór, dispatchuje "user-mode-changed".
 * Etap 2+: konsekwencje (UI, bottom nav reorder, persona AI).
 *
 * Wizualnie 1:1 z mockupem (files6.zip skladai-mobile-mode-picker.html):
 *   - Ambient gradient orbs (mint top-left, cyan top-right, violet top)
 *   - Subtle 40px grid mask
 *   - Brand row (pulsing green dot + "Skład**AI**")
 *   - Progress steps (3, pierwszy aktywny mint gradient)
 *   - Title z gradient accent "Skład**AI**"
 *   - 3 karty trybów (z animated icon: bg pulse + orbital ring + float)
 *   - "Zobacz wszystko — wybiorę później" subtle skip
 *
 * Keyframes z app/globals.css (prefix `mode-`):
 *   modeAmbientShift, modeDotPulse, modeIconPulse, modeRingSpin, modeFloat
 */

import { MODES, type ModeDef } from "@/lib/modes";
import { setUserMode } from "@/lib/hooks/useUserMode";
import type { UserMode } from "@/lib/types";

interface Props {
  /**
   * Wywołane po wyborze trybu z arg `mode`. OnboardingWrapper decyduje
   * co dalej (Etap 2 Krok B/D/E):
   *   - fitness   → router.push(defaultTab) + setState('hidden')
   *   - health    → setState('health-conditions') [krok D]
   *   - cosmetics → setState('skin-type') [krok E]
   * Etap 2 Krok B przekazuje wybrany mode w callbacku — Etap 1
   * miał `() => void` bez args.
   */
  onComplete: (mode: UserMode) => void;
}

export default function ModePickerScreen({ onComplete }: Props) {
  const handleSelect = (mode: UserMode) => {
    setUserMode(mode, true);
    onComplete(mode);
  };

  const handleSkip = () => {
    // Pomiń: zapisujemy domyślny tryb (fitness), ale flag
    // explicitly_chosen=false sygnalizuje że to nie był świadomy wybór.
    setUserMode("fitness", false);
    onComplete("fitness");
  };

  return (
    <div
      data-testid="mode-picker-screen"
      style={{
        position: "fixed",
        inset: 0,
        background: "#050a08",
        zIndex: 1000,
        overflow: "auto",
      }}
    >
      {/* === AMBIENT BACKGROUND === */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-20%",
          right: "-20%",
          height: "70%",
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(110,231,167,0.16), transparent 50%)," +
            "radial-gradient(ellipse at 70% 30%, rgba(34,211,238,0.08), transparent 55%)," +
            "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.06), transparent 60%)",
          pointerEvents: "none",
          animation: "modeAmbientShift 20s ease-in-out infinite",
          zIndex: 0,
        }}
      />
      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* === SCREEN === */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          padding: "calc(50px + env(safe-area-inset-top, 0px)) 22px calc(24px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 5 }}>
          <div
            style={{
              width: 6,
              height: 6,
              background: "#6efcb4",
              borderRadius: "50%",
              boxShadow: "0 0 10px #6efcb4, 0 0 20px rgba(110,252,180,0.5)",
              animation: "modeDotPulse 2s ease-in-out infinite",
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "-0.5px" }}>
            Skład<span style={{ color: "#6efcb4" }}>AI</span>
          </div>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              width: 32,
              background: "linear-gradient(90deg, #4ade80, #6efcb4)",
              boxShadow: "0 0 8px rgba(110,252,180,0.5)",
              transition: "all 0.3s",
            }}
          />
          <div style={{ height: 3, borderRadius: 2, width: 12, background: "rgba(255,255,255,0.08)" }} />
          <div style={{ height: 3, borderRadius: 2, width: 12, background: "rgba(255,255,255,0.08)" }} />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.15,
            marginBottom: 6,
            color: "white",
            letterSpacing: "-0.8px",
          }}
        >
          Dostosuj{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #6efcb4 0%, #6ee7a7 50%, #22d3ee 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            SkładAI
          </span>
          <br />
          pod siebie
        </h1>
        <p style={{ fontSize: 12, color: "#888", textAlign: "center", marginBottom: 18, lineHeight: 1.4 }}>
          Wybierz tryb — dostosujemy apkę pod Twoje cele
        </p>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {MODES.map((m) => (
            <ModeCard key={m.id} mode={m} onClick={() => handleSelect(m.id)} />
          ))}
        </div>

        {/* Skip */}
        <button
          onClick={handleSkip}
          style={{
            marginTop: 14,
            padding: 10,
            textAlign: "center",
            color: "#555",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
            letterSpacing: 0.2,
            background: "transparent",
            border: "none",
            width: "100%",
          }}
        >
          <span
            style={{
              display: "block",
              width: 32,
              height: 1,
              background: "rgba(255,255,255,0.08)",
              margin: "0 auto 8px",
            }}
          />
          Zobacz wszystko — wybiorę później
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Single mode card. Animation params come from MODES catalog
// (ringSpeed, ringDir, floatDelay). Style 1:1 z mockupu.
// ────────────────────────────────────────────────────────────────────
function ModeCard({ mode, onClick }: { mode: ModeDef; onClick: () => void }) {
  const { color, colorRgb, label, desc, iconPaths, ringSpeed, ringDir, floatDelay } = mode;

  return (
    <button
      data-testid={`mode-card-${mode.id}`}
      onClick={onClick}
      style={{
        background: "linear-gradient(180deg, rgba(30,40,35,0.6), rgba(15,25,20,0.6))",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
        padding: "14px 16px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        width: "100%",
        color: "inherit",
        font: "inherit",
      }}
      onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
      onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)"; }}
      onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
    >
      {/* Glow background per mode */}
      <div
        style={{
          content: '""',
          position: "absolute",
          top: "-30%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 250,
          height: 250,
          background: `radial-gradient(circle, rgba(${colorRgb},0.22), transparent 65%)`,
          pointerEvents: "none",
          opacity: 0.7,
          transition: "opacity 0.3s",
        }}
      />

      {/* Icon wrap */}
      <div
        style={{
          position: "relative",
          width: 56,
          height: 56,
          margin: "0 auto 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        {/* Bg pulse */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(${colorRgb},0.2), rgba(${colorRgb},0.05) 60%, transparent)`,
            animation: "modeIconPulse 3s ease-in-out infinite",
          }}
        />
        {/* Orbital ring */}
        <div
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: `1px solid rgba(${colorRgb}, 0.25)`,
            borderTopColor: `rgba(${colorRgb}, 0.7)`,
            animation: `modeRingSpin ${ringSpeed}s linear infinite`,
            animationDirection: ringDir,
          }}
        />
        {/* SVG Icon */}
        <svg
          width="34"
          height="34"
          viewBox="0 0 32 32"
          style={{
            position: "relative",
            zIndex: 1,
            color: color,
            filter: `drop-shadow(0 2px 12px rgba(${colorRgb}, 0.5))`,
            animation: "modeFloat 4s ease-in-out infinite",
            animationDelay: `-${floatDelay}s`,
            stroke: color,
            fill: "none",
            strokeWidth: 1.5,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        >
          {iconPaths}
        </svg>
      </div>

      {/* Name + desc */}
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "white",
          marginBottom: 3,
          letterSpacing: "-0.3px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#aaa",
          lineHeight: 1.35,
          position: "relative",
          zIndex: 1,
          maxWidth: 280,
          margin: "0 auto",
        }}
      >
        {desc}
      </div>
    </button>
  );
}
