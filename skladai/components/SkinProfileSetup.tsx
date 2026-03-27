"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SkinProfile {
  skin_type: "dry" | "oily" | "combination" | "normal" | "unknown";
  sensitivity: "sensitive" | "normal" | "resistant";
  skin_age: "under25" | "25-35" | "35-45" | "over45";
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
  { value: "over45", label: "45+", desc: "dojrzała" },
];

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
  "Nic z powyższych",
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
    if (p === "Nic z powyższych") {
      setSkinProblems((prev) => (prev.includes(p) ? [] : [p]));
      return;
    }
    setSkinProblems((prev) => {
      const filtered = prev.filter((x) => x !== "Nic z powyższych");
      return filtered.includes(p) ? filtered.filter((x) => x !== p) : [...filtered, p];
    });
  };

  const toggleHairProblem = (p: string) => {
    setHairProblems((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
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
      skin_problems: skinProblems.filter((p) => p !== "Nic z powyższych"),
      ...(hairType ? { hair_type: hairType } : {}),
      ...(hairProblems.length > 0 ? { hair_problems: hairProblems } : {}),
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
        className={`w-full text-left p-3.5 rounded-[16px] transition-all duration-200 border ${
          active
            ? "bg-gradient-to-r from-purple-600/20 to-fuchsia-600/20 border-purple-500/50"
            : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.07]"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-semibold text-[14px] ${active ? "text-white" : "text-white/70"}`}>
              {label}
            </p>
            {desc && (
              <p className={`text-[11px] mt-0.5 ${active ? "text-purple-300/70" : "text-white/30"}`}>
                {desc}
              </p>
            )}
          </div>
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              active ? "border-purple-400 bg-purple-500" : "border-white/20 bg-transparent"
            }`}
          >
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
  }: {
    label: string;
    checked: boolean;
    onToggle: () => void;
  }) {
    return (
      <button
        onClick={onToggle}
        className={`w-full text-left p-3.5 rounded-[16px] transition-all duration-200 border ${
          checked
            ? "bg-gradient-to-r from-purple-600/20 to-fuchsia-600/20 border-purple-500/50"
            : "bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.07]"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className={`font-semibold text-[13px] ${checked ? "text-white" : "text-white/70"}`}>
            {label}
          </p>
          <div
            className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-all ${
              checked ? "border-purple-400 bg-purple-500" : "border-white/20 bg-transparent"
            }`}
          >
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
      className={`fixed inset-0 z-[100] flex items-end justify-center transition-all duration-300 ${
        visible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <div
        className={`w-full max-w-md rounded-t-[28px] overflow-hidden transition-transform duration-400 ease-out ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ background: "#0D0B0E", maxHeight: "88dvh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex-shrink-0">
          {/* Drag handle */}
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[22px] font-black text-white tracking-tight">
                {STEP_TITLES[step]}
              </h2>
              <p className="text-white/35 text-[12px] mt-0.5">
                Krok {step + 1} z 3{step === 2 && " (opcjonalne)"}
              </p>
            </div>
            <button
              onClick={onSkip}
              className="text-white/40 text-[13px] font-semibold hover:text-white/60 transition-colors px-3 py-1.5"
            >
              Pomiń
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i < step
                    ? "flex-1 bg-purple-500"
                    : i === step
                    ? "flex-[2] bg-gradient-to-r from-purple-500 to-fuchsia-500"
                    : "flex-1 bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content — scrollable, takes remaining space */}
        <div className="px-5 pb-5 overflow-y-auto flex-1 min-h-0">
          {/* STEP 0: Skin type */}
          {step === 0 && (
            <div className="space-y-5 pt-2">
              {/* Skin type */}
              <div>
                <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                  Typ skóry
                </label>
                <div className="space-y-2 mt-2">
                  {SKIN_TYPES.map((t) => (
                    <RadioCard
                      key={t.value}
                      value={t.value}
                      selected={skinType}
                      onSelect={setSkinType}
                      label={t.label}
                    />
                  ))}
                </div>
              </div>

              {/* Sensitivity */}
              <div>
                <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                  Wrażliwość
                </label>
                <div className="space-y-2 mt-2">
                  {SENSITIVITY.map((s) => (
                    <RadioCard
                      key={s.value}
                      value={s.value}
                      selected={sensitivity}
                      onSelect={setSensitivity}
                      label={s.label}
                    />
                  ))}
                </div>
              </div>

              {/* Skin age */}
              <div>
                <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                  Wiek skóry
                </label>
                <div className="space-y-2 mt-2">
                  {SKIN_AGE.map((a) => (
                    <RadioCard
                      key={a.value}
                      value={a.value}
                      selected={skinAge}
                      onSelect={setSkinAge}
                      label={a.label}
                      desc={a.desc}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Skin problems */}
          {step === 1 && (
            <div className="space-y-2 pt-2">
              <p className="text-[12px] text-white/30 mb-3">
                Wybierz wszystkie, które Cię dotyczą
              </p>
              {SKIN_PROBLEMS.map((p) => (
                <CheckCard
                  key={p}
                  label={p}
                  checked={skinProblems.includes(p)}
                  onToggle={() => toggleSkinProblem(p)}
                />
              ))}
            </div>
          )}

          {/* STEP 2: Hair */}
          {step === 2 && (
            <div className="space-y-5 pt-2">
              <p className="text-[12px] text-white/30 -mt-1">
                Możesz pominąć ten krok
              </p>

              {/* Hair type */}
              <div>
                <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                  Typ włosów
                </label>
                <div className="space-y-2 mt-2">
                  {HAIR_TYPES.map((t) => (
                    <RadioCard
                      key={t.value}
                      value={t.value}
                      selected={hairType}
                      onSelect={setHairType}
                      label={t.label}
                    />
                  ))}
                </div>
              </div>

              {/* Hair problems */}
              <div>
                <label className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">
                  Problemy z włosami
                </label>
                <div className="space-y-2 mt-2">
                  {HAIR_PROBLEMS.map((p) => (
                    <CheckCard
                      key={p}
                      label={p}
                      checked={hairProblems.includes(p)}
                      onToggle={() => toggleHairProblem(p)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons — always visible, safe area padding */}
        <div className="px-5 pt-3 flex-shrink-0" style={{ background: "#0D0B0E", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-shrink-0 w-12 h-12 rounded-[14px] bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/50 hover:bg-white/[0.1] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed && step < 2}
              className={`flex-1 h-12 rounded-[14px] font-bold text-[15px] text-white transition-all ${canProceed || step === 2 ? "active:scale-[0.98]" : "opacity-40"}`}
              style={{
                background: canProceed || step === 2
                  ? "linear-gradient(135deg, #9333EA 0%, #C026D3 50%, #DB2777 100%)"
                  : "#333",
              }}
            >
              {step < 2 ? "Dalej" : "Zapisz"}
            </button>
          </div>
          <p className="text-[10px] text-white/20 text-center mt-3">
            Dane zapisane lokalnie na Twoim urządzeniu
          </p>
        </div>
      </div>
    </div>
  );
}
