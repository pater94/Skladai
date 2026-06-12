"use client";

/**
 * HealthConditionsScreen (Etap 2 Krok D) — pokazuje się PO mode picker
 * gdy user wybrał tryb "health". Pyta o:
 *
 *   1. Cukrzyca (single-select chip) → pisze do profile.health.diabetes
 *      (backward compat: pole istniało przed Etap 2)
 *   2. Schorzenia przewlekłe (multi-select) → pisze do
 *      profile.health.conditions (NOWE pole, Q2 decision)
 *   3. Alergie pokarmowe (multi-select) → pisze do
 *      profile.health.allergens (zostaje dla pokarmowych)
 *
 * Po complete → OnboardingWrapper.setState("hidden") + router.push do
 * defaultTab dla health mode = "/dashboard".
 *
 * Wizualnie cyan accent (kolor trybu health). Pełny ekran z 3 sekcjami
 * w jednym scrollu. Każda sekcja ma własny nagłówek + grid chipów.
 */

import { useState } from "react";
import { getProfile, saveProfile } from "@/lib/storage";

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

// Cukrzyca — single-select. Mapowanie na istniejący profile.health.diabetes.
const DIABETES_OPTIONS = [
  { id: "type1", label: "Cukrzyca typu 1", emoji: "🩸" },
  { id: "type2", label: "Cukrzyca typu 2", emoji: "🩸" },
  { id: "insulin_resistance", label: "Insulinooporność", emoji: "📈" }, // → conditions (nie diabetes)
] as const;

// Schorzenia przewlekłe — multi-select. → profile.health.conditions
const CONDITIONS = [
  { id: "celiac", label: "Celiakia", emoji: "🌾" },
  { id: "ibs", label: "IBS / Jelito drażliwe", emoji: "🌀" },
  { id: "reflux", label: "Refluks", emoji: "🔥" },
  { id: "hashimoto", label: "Hashimoto", emoji: "🦋" },
  { id: "pcos", label: "PCOS", emoji: "🌸" },
  { id: "gout", label: "Dna moczanowa", emoji: "💎" },
  { id: "lactose_intolerance", label: "Nietolerancja laktozy", emoji: "🥛" },
  { id: "fructose_intolerance", label: "Nietolerancja fruktozy", emoji: "🍎" },
] as const;

// Alergie POKARMOWE — multi-select. → profile.health.allergens
const ALLERGENS = [
  { id: "nuts", label: "Orzechy", emoji: "🥜" },
  { id: "fish", label: "Ryby", emoji: "🐟" },
  { id: "eggs", label: "Jaja", emoji: "🥚" },
  { id: "soy", label: "Soja", emoji: "🫘" },
  { id: "gluten", label: "Gluten", emoji: "🌾" },
  { id: "shellfish", label: "Skorupiaki", emoji: "🦐" },
  { id: "sesame", label: "Sezam", emoji: "🌱" },
  { id: "celery", label: "Seler", emoji: "🌿" },
] as const;

const ACCENT = "var(--c-cyan, #22d3ee)";
const ACCENT_RGB = "var(--c-cyan-rgb, 34,211,238)";

export default function HealthConditionsScreen({ onComplete, onSkip }: Props) {
  const [diabetes, setDiabetes] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Set<string>>(new Set());
  const [allergens, setAllergens] = useState<Set<string>>(new Set());

  /**
   * Curried toggle: zwraca `(id) => () => void` żeby pasowało do onClick.
   * Użycie: `onClick={toggleSet(setConditions)(opt.id)}` (currying daje
   * callback zamiast natychmiastowego call).
   */
  const toggleSet = (setter: typeof setConditions) => (id: string) => () => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    const profile = getProfile();
    if (!profile) {
      onSkip();
      return;
    }

    // Mapowanie diabetes: type1/type2 → diabetes field, insulin_resistance → conditions
    let diabetesValue: "type1" | "type2" | null = null;
    const conditionsList = Array.from(conditions);
    if (diabetes === "type1") diabetesValue = "type1";
    else if (diabetes === "type2") diabetesValue = "type2";
    else if (diabetes === "insulin_resistance") conditionsList.push("insulin_resistance");

    saveProfile({
      ...profile,
      health: {
        ...profile.health,
        diabetes: diabetesValue,
        conditions: conditionsList,
        allergens: Array.from(allergens),
      },
    });
    window.dispatchEvent(new Event("user-mode-changed"));
    onComplete();
  };

  const totalSelected = (diabetes ? 1 : 0) + conditions.size + allergens.size;

  return (
    <div
      data-testid="health-conditions-screen"
      // POPRAWKA hotfix: data-scrollable="true" wymagane bo app/layout.tsx
      // ma globalny touchmove preventDefault dla wszystkiego co NIE jest
      // w [data-scrollable] (anti-bounce na iOS). Bez tej flagi cały scroll
      // wewnątrz HealthConditionsScreen był blocked → ekran "przycinał się
      // i pływał we wszystkie strony" (Patryk feedback post-merge).
      data-scrollable="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "#050a08",
        zIndex: 1000,
        overflow: "auto",
        WebkitOverflowScrolling: "touch", // momentum scroll na iOS
        overscrollBehavior: "contain",    // brak scroll chaining do body
      }}
    >
      {/* Ambient cyan orbs */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-20%",
          right: "-20%",
          height: "70%",
          background:
            `radial-gradient(ellipse at 30% 20%, rgba(${ACCENT_RGB},0.16), transparent 50%),` +
            `radial-gradient(ellipse at 70% 30%, rgba(${ACCENT_RGB},0.08), transparent 55%)`,
          pointerEvents: "none",
          animation: "modeAmbientShift 20s ease-in-out infinite",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          padding: "calc(50px + env(safe-area-inset-top, 0px)) 22px calc(100px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Brand + steps */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 5 }}>
          <div
            style={{
              width: 6,
              height: 6,
              background: ACCENT,
              borderRadius: "50%",
              boxShadow: `0 0 10px ${ACCENT}, 0 0 20px rgba(${ACCENT_RGB},0.5)`,
              animation: "modeDotPulse 2s ease-in-out infinite",
            }}
          />
          <div style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "-0.5px" }}>
            Skład<span style={{ color: ACCENT }}>AI</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          <div style={{ height: 3, borderRadius: 2, width: 12, background: "rgba(var(--fg-rgb, 255,255,255),0.15)" }} />
          <div
            style={{
              height: 3,
              borderRadius: 2,
              width: 32,
              background: `linear-gradient(90deg, var(--c-cyan-2, #06b6d4), ${ACCENT})`,
              boxShadow: `0 0 8px rgba(${ACCENT_RGB},0.5)`,
            }}
          />
          <div style={{ height: 3, borderRadius: 2, width: 12, background: "rgba(var(--fg-rgb, 255,255,255),0.08)" }} />
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 6,
            color: "white",
            letterSpacing: "-0.5px",
          }}
        >
          Twoje schorzenia i alergie
        </h1>
        <p style={{ fontSize: 12, color: "#888", textAlign: "center", marginBottom: 24, lineHeight: 1.4 }}>
          Pomożemy Ci czytać etykiety pod kątem Twoich potrzeb
        </p>

        {/* === Sekcja 1: Cukrzyca (single-select) === */}
        <SectionHeader title="Cukrzyca" subtitle="Wybierz jedno (lub żadne)" />
        <ChipGrid>
          {DIABETES_OPTIONS.map((opt) => (
            <Chip
              key={opt.id}
              id={opt.id}
              emoji={opt.emoji}
              label={opt.label}
              active={diabetes === opt.id}
              onClick={() => setDiabetes(diabetes === opt.id ? null : opt.id)}
            />
          ))}
        </ChipGrid>

        {/* === Sekcja 2: Schorzenia przewlekłe (multi-select) === */}
        <SectionHeader title="Schorzenia przewlekłe" subtitle="Multi-select" />
        <ChipGrid>
          {CONDITIONS.map((opt) => (
            <Chip
              key={opt.id}
              id={opt.id}
              emoji={opt.emoji}
              label={opt.label}
              active={conditions.has(opt.id)}
              onClick={toggleSet(setConditions)(opt.id)}
            />
          ))}
        </ChipGrid>

        {/* === Sekcja 3: Alergie pokarmowe (multi-select) === */}
        <SectionHeader title="Alergie pokarmowe" subtitle="Multi-select" />
        <ChipGrid>
          {ALLERGENS.map((opt) => (
            <Chip
              key={opt.id}
              id={opt.id}
              emoji={opt.emoji}
              label={opt.label}
              active={allergens.has(opt.id)}
              onClick={toggleSet(setAllergens)(opt.id)}
            />
          ))}
        </ChipGrid>

        <div style={{ flex: 1 }} />

        {/* CTAs */}
        <button
          onClick={handleSave}
          style={{
            marginTop: 24,
            padding: "14px 18px",
            borderRadius: 16,
            background: `linear-gradient(135deg, var(--c-cyan-2, #06b6d4), ${ACCENT})`,
            color: "var(--bg, #0a0e0c)",
            fontWeight: 900,
            fontSize: 15,
            border: "none",
            cursor: "pointer",
            boxShadow: `0 6px 22px rgba(${ACCENT_RGB},0.28)`,
            letterSpacing: "-0.01em",
            width: "100%",
          }}
        >
          Zapisz ({totalSelected}) i kontynuuj
        </button>
        <button
          onClick={onSkip}
          style={{
            marginTop: 10,
            padding: 10,
            color: "#555",
            fontSize: 12,
            fontWeight: 500,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Pomiń — uzupełnię później
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Inline subkomponenty (NIE osobne pliki — per audyt konwencji
// inline w pliku ekranu)
// ────────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginTop: 20, marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: ACCENT,
          textTransform: "uppercase",
          letterSpacing: 1.2,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.45)" }}>{subtitle}</div>
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

function Chip({
  emoji,
  label,
  active,
  onClick,
  id,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onClick: () => void;
  id?: string;
}) {
  return (
    <button
      type="button"
      data-testid={id ? `health-chip-${id}` : undefined}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 14,
        background: active
          ? `linear-gradient(180deg, rgba(${ACCENT_RGB},0.12), rgba(${ACCENT_RGB},0.04))`
          : "rgba(var(--fg-rgb, 255,255,255),0.04)",
        border: active
          ? `1px solid rgba(${ACCENT_RGB},0.5)`
          : "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)",
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        font: "inherit",
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: active ? ACCENT : "rgba(var(--fg-rgb, 255,255,255),0.85)",
          lineHeight: 1.25,
          flex: 1,
        }}
      >
        {label}
      </span>
      {active && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: ACCENT,
            color: "var(--bg, #0a0e0c)",
            fontSize: 9,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✓
        </span>
      )}
    </button>
  );
}
