"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SkinProfile {
  skin_type: "dry" | "oily" | "combination" | "normal" | "unknown";
  sensitivity: "sensitive" | "normal" | "resistant";
  skin_age: "under25" | "25-35" | "35-45" | "45-54" | "55-64" | "65+";
  skin_problems: string[];
  hair_type?: "straight" | "wavy" | "curly" | "afro";
  hair_problems?: string[];
}

const STORAGE_KEY = "skladai_skin_profile";

// ── Helper functions ───────────────────────────────────────────────────────

export function getSkinProfile(): SkinProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SkinProfile) : null;
  } catch {
    return null;
  }
}

export function saveSkinProfile(profile: SkinProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function hasSkinProfile(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// ── Option data ────────────────────────────────────────────────────────────

const SKIN_TYPES: { value: SkinProfile["skin_type"]; label: string }[] = [
  { value: "dry", label: "Sucha" },
  { value: "oily", label: "Tłusta" },
  { value: "combination", label: "Mieszana" },
  { value: "normal", label: "Normalna" },
  { value: "unknown", label: "Nie wiem" },
];

const SENSITIVITY: { value: SkinProfile["sensitivity"]; label: string }[] = [
  { value: "sensitive", label: "Wrażliwa" },
  { value: "normal", label: "Normalna" },
  { value: "resistant", label: "Odporna" },
];

const SKIN_AGE: { value: SkinProfile["skin_age"]; label: string; desc: string }[] = [
  { value: "under25", label: "<25", desc: "młoda" },
  { value: "25-35", label: "25-35", desc: "anti-aging start" },
  { value: "35-45", label: "35-45", desc: "aktywny anti-aging" },
  { value: "45-54", label: "45-54", desc: "dojrzała" },
  { value: "55-64", label: "55-64", desc: "regeneracja" },
  { value: "65+", label: "65+", desc: "ochrona i odżywienie" },
];

// Sentinel string used in BOTH skin & hair problem lists to mean
// "user has no problems in this category". Selecting it clears all
// other selections, and selecting any real problem clears it.
const NO_PROBLEMS = "Brak problemów";

const SKIN_PROBLEMS = [
  "Trądzik/wypryski",
  "Przebarwienia/plamy",
  "Zmarszczki",
  "Rozszerzone pory",
  "Zaczerwienienia/naczynka",
  "Suchość/łuszczenie",
  "Nadmierne przetłuszczanie",
  "Cienie pod oczami",
  "Atopowe zapalenie skóry",
  "Łuszczyca",
  NO_PROBLEMS,
];

const HAIR_TYPES: { value: NonNullable<SkinProfile["hair_type"]>; label: string }[] = [
  { value: "straight", label: "Proste" },
  { value: "wavy", label: "Falowane" },
  { value: "curly", label: "Kręcone" },
  { value: "afro", label: "Kręcone afro" },
];

const HAIR_PROBLEMS = [
  "Przetłuszczanie",
  "Suche końcówki",
  "Wypadanie",
  "Łupież",
  "Farbowane",
  "Brak objętości",
  NO_PROBLEMS,
];

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  onComplete: (profile: SkinProfile) => void;
  onSkip: () => void;
}

export default function SkinProfileSetup({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  // Step 1
  const [skinType, setSkinType] = useState<SkinProfile["skin_type"]>("normal");
  const [sensitivity, setSensitivity] = useState<SkinProfile["sensitivity"]>("normal");
  const [skinAge, setSkinAge] = useState<SkinProfile["skin_age"]>("25-35");

  // Step 2
  const [skinProblems, setSkinProblems] = useState<string[]>([]);

  // Step 3
  const [hairType, setHairType] = useState<SkinProfile["hair_type"] | undefined>(undefined);
  const [hairProblems, setHairProblems] = useState<string[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const toggleSkinProblem = (p: string) => {
    if (p === NO_PROBLEMS) {
      setSkinProblems((prev) => (prev.includes(p) ? [] : [p]));
      return;
    }
    setSkinProblems((prev) => {
      const filtered = prev.filter((x) => x !== NO_PROBLEMS);
      return filtered.includes(p) ? filtered.filter((x) => x !== p) : [...filtered, p];
    });
  };

  const toggleHairProblem = (p: string) => {
    if (p === NO_PROBLEMS) {
      setHairProblems((prev) => (prev.includes(p) ? [] : [p]));
      return;
    }
    setHairProblems((prev) => {
      const filtered = prev.filter((x) => x !== NO_PROBLEMS);
      return filtered.includes(p) ? filtered.filter((x) => x !== p) : [...filtered, p];
    });
  };

  // Step 0 always has defaults so it's always valid
  // Step 1 needs at least one problem selected (or "Nic z powyższych")
  // Step 2 is optional
  const canProceed = step === 0
    ? true
    : step === 1
    ? skinProblems.length > 0
    : true;

  const handleNext = () => {
    if (!canProceed && step < 2) return;
    if (step < 2) setStep(step + 1);
    else handleSave();
  };

  const handleSave = () => {
    const profile: SkinProfile = {
      skin_type: skinType,
      sensitivity,
      skin_age: skinAge,
      skin_problems: skinProblems.filter((p) => p !== NO_PROBLEMS),
      ...(hairType ? { hair_type: hairType } : {}),
      ...(hairProblems.filter((p) => p !== NO_PROBLEMS).length > 0
        ? { hair_problems: hairProblems.filter((p) => p !== NO_PROBLEMS) }
        : {}),
    };
    saveSkinProfile(profile);
    onComplete(profile);
  };

  const STEP_TITLES = ["Typ skóry", "Problemy skórne", "Włosy"];

  // ── Shared sub-components ────────────────────────────────────────────────

  function RadioCard<T extends string>({
    value,
    selected,
    onSelect,
    label,
    desc,
  }: {
    value: T;
    selected: T | undefined;
    onSelect: (v: T) => void;
    label: string;
    desc?: string;
  }) {
    const active = selected === value;
    return (
      <button
        onClick={() => onSelect(value)}
        style={{
          width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 16, cursor: "pointer", transition: "all 0.2s",
          background: active ? "rgba(192,132,252,0.1)" : "rgba(255,255,255,0.04)",
          border: active ? "1.5px solid #C084FC" : "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, color: active ? "#fff" : "rgba(255,255,255,0.7)", margin: 0 }}>{label}</p>
            {desc && <p style={{ fontSize: 11, marginTop: 2, color: active ? "rgba(192,132,252,0.7)" : "rgba(255,255,255,0.55)", margin: 0 }}>{desc}</p>}
          </div>
          <div style={{
            width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
            border: active ? "2px solid #C084FC" : "2px solid rgba(255,255,255,0.15)",
            background: active ? "#9333EA" : "transparent",
          }}>
            {active && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      </button>
    );
  }

  function CheckCard({
    label,
    checked,
    onToggle,
    muted = false,
  }: {
    label: string;
    checked: boolean;
    onToggle: () => void;
    /** Slightly de-emphasized look for "no problems" sentinel options. */
    muted?: boolean;
  }) {
    return (
      <button
        onClick={onToggle}
        style={{
          width: "100%", textAlign: "left", padding: "14px 16px", borderRadius: 16, cursor: "pointer", transition: "all 0.2s",
          background: checked
            ? "rgba(192,132,252,0.1)"
            : muted ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
          border: checked
            ? "1.5px solid #C084FC"
            : muted ? "1px dashed rgba(255,255,255,0.10)" : "1px solid rgba(255,255,255,0.06)",
          marginTop: muted ? 4 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{
            fontWeight: 600, fontSize: 13,
            color: checked ? "#fff" : muted ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.7)",
            fontStyle: muted && !checked ? "italic" : "normal",
            margin: 0,
          }}>{label}</p>
          <div style={{
            width: 20, height: 20, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
            border: checked ? "2px solid #C084FC" : "2px solid rgba(255,255,255,0.15)",
            background: checked ? "#9333EA" : "transparent",
          }}>
            {checked && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      </button>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 150,
        background: "#0a0e0c",
        display: "flex", flexDirection: "column",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    >
      {/* Progress bar — full width */}
      <div style={{ padding: "0 20px", paddingTop: "max(16px, env(safe-area-inset-top, 16px))", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: i === step ? 2 : 1,
                height: 4, borderRadius: 2,
                transition: "all 0.5s ease",
                background: i < step
                  ? "#C084FC"
                  : i === step
                  ? "linear-gradient(90deg, #C084FC, #DB2777)"
                  : "rgba(255,255,255,0.08)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: "16px 22px 8px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>
              {STEP_TITLES[step]}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 2 }}>
              Krok {step + 1} z 3{step === 2 && " (opcjonalne)"}
            </p>
          </div>
          <button
            onClick={onSkip}
            style={{ padding: "6px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Pomiń
          </button>
        </div>
      </div>

      {/* Content — scrollable */}
      <div data-scrollable="true" style={{ flex: 1, overflowY: "auto", padding: "8px 22px 16px", minHeight: 0 }}>
        {/* STEP 0: Skin type */}
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Typ skóry
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {SKIN_TYPES.map((t) => (
                  <RadioCard key={t.value} value={t.value} selected={skinType} onSelect={setSkinType} label={t.label} />
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Wrażliwość
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {SENSITIVITY.map((s) => (
                  <RadioCard key={s.value} value={s.value} selected={sensitivity} onSelect={setSensitivity} label={s.label} />
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Wiek skóry
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {SKIN_AGE.map((a) => (
                  <RadioCard key={a.value} value={a.value} selected={skinAge} onSelect={setSkinAge} label={a.label} desc={a.desc} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: Skin problems */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>
              Wybierz wszystkie, które Cię dotyczą
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SKIN_PROBLEMS.map((p) => (
                <CheckCard key={p} label={p} checked={skinProblems.includes(p)} onToggle={() => toggleSkinProblem(p)} muted={p === NO_PROBLEMS} />
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Hair */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              Możesz pominąć ten krok
            </p>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Typ włosów
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {HAIR_TYPES.map((t) => (
                  <RadioCard key={t.value} value={t.value} selected={hairType} onSelect={setHairType} label={t.label} />
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Problemy z włosami
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {HAIR_PROBLEMS.map((p) => (
                  <CheckCard key={p} label={p} checked={hairProblems.includes(p)} onToggle={() => toggleHairProblem(p)} muted={p === NO_PROBLEMS} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer — fixed at bottom, always visible */}
      <div style={{ padding: "12px 22px", paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))", flexShrink: 0, background: "#0a0e0c" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", cursor: "pointer", flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed && step < 2}
            style={{
              flex: 1, height: 48, borderRadius: 14, fontWeight: 700, fontSize: 15, color: "#fff", cursor: "pointer", border: "none", transition: "all 0.2s",
              background: canProceed || step === 2
                ? "linear-gradient(135deg, #9333EA 0%, #C026D3 50%, #DB2777 100%)"
                : "#333",
              opacity: canProceed || step === 2 ? 1 : 0.4,
            }}
          >
            {step < 2 ? "Dalej" : "Zapisz"}
          </button>
        </div>
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 10 }}>
          Dane zapisane lokalnie na Twoim urządzeniu
        </p>
      </div>
    </div>
  );
}
