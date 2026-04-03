"use client";

import { useState } from "react";
import { UserProfile } from "@/lib/types";
import { saveProfile } from "@/lib/storage";
import {
  calculateBMR, calculateBMI, calculateTDEE, calculateTargetCalories, calculateDailyNorms,
  ACTIVITY_LEVELS, ActivityLevel, GOALS, Goal, COMMON_ALLERGENS, DIETS, Diet,
  DIABETES_TYPES, DiabetesType, TRIMESTERS, Trimester,
} from "@/lib/nutrition";

interface Props {
  onComplete: (profile: UserProfile) => void;
  onSkip: () => void;
  existingProfile?: UserProfile | null;
}

export default function ProfileSetup({ onComplete, onSkip, existingProfile }: Props) {
  const [step, setStep] = useState(0);

  // Step 1
  const [name, setName] = useState(existingProfile?.name || "");
  const [gender, setGender] = useState<"male" | "female">(existingProfile?.gender || "male");
  const [age, setAge] = useState(existingProfile?.age || 25);
  const [weight, setWeight] = useState(existingProfile?.weight_kg || 75);
  const [height, setHeight] = useState(existingProfile?.height_cm || 175);

  // Step 2
  const [activity, setActivity] = useState<ActivityLevel>(existingProfile?.activity || "moderate");

  // Step 3
  const [goal, setGoal] = useState<Goal>(existingProfile?.goal || "healthy");

  // Step 4
  const [diabetes, setDiabetes] = useState<DiabetesType | null>(existingProfile?.health?.diabetes || null);
  const [pregnancy, setPregnancy] = useState<Trimester | null>(existingProfile?.health?.pregnancy || null);
  const [allergens, setAllergens] = useState<string[]>(existingProfile?.health?.allergens || []);
  const [diet, setDiet] = useState<Diet>((existingProfile?.health?.diet as Diet) || "none");

  const toggleAllergen = (id: string) => {
    setAllergens((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const handleComplete = () => {
    const bmr = calculateBMR(gender, weight, height, age);
    const bmi = calculateBMI(weight, height);
    const tdee = calculateTDEE(bmr, activity);
    let targetCalories = calculateTargetCalories(tdee, goal);

    // Pregnancy extra calories
    if (pregnancy) {
      const extra = TRIMESTERS[pregnancy].extraCalories;
      targetCalories += extra;
    }

    const daily_norms = calculateDailyNorms(targetCalories, weight, goal);

    const profile: UserProfile = {
      name: name.trim() || undefined,
      gender, age, weight_kg: weight, height_cm: height, bmi,
      activity, goal,
      bmr, tdee, target_calories: targetCalories,
      health: { diabetes, pregnancy, allergens, diet },
      daily_norms,
      onboarding_complete: true,
      created_at: existingProfile?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveProfile(profile);
    onComplete(profile);
  };

  const steps = ["Dane", "Aktywność", "Cel", "Zdrowie"];

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0e0c" }}>
      {/* Header */}
      <div style={{ padding: "50px 20px 60px", background: "linear-gradient(180deg, rgba(110,252,180,0.12) 0%, rgba(110,252,180,0.02) 60%, transparent 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(110,252,180,0.06)", filter: "blur(60px)" }} />
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>Twój profil</h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 4 }}>Krok {step + 1} z 4</p>
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3, transition: "all 0.3s",
              width: i <= step ? 32 : 16,
              background: i <= step ? "#6efcb4" : "rgba(255,255,255,0.15)",
            }} />
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 448, margin: "0 auto", padding: "0 20px", marginTop: -40, paddingBottom: 40, position: "relative", zIndex: 20 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 24 }}>
          {/* STEP 0: Basic data */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Podstawowe dane</h2>

              {/* Name */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Imię (opcjonalne)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Twoje imię"
                  style={{ width: "100%", marginTop: 8, padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 14, color: "#fff", fontWeight: 600, outline: "none" }}
                />
              </div>

              {/* Gender */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Płeć</label>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      style={{
                        flex: 1, padding: 12, borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                        background: gender === g ? "rgba(110,252,180,0.15)" : "rgba(255,255,255,0.04)",
                        color: gender === g ? "#6efcb4" : "rgba(255,255,255,0.55)",
                        border: gender === g ? "1px solid rgba(110,252,180,0.25)" : "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {g === "male" ? "👨 Mężczyzna" : "👩 Kobieta"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Wiek: <span style={{ color: "#6efcb4" }}>{age} lat</span></label>
                <input type="range" min={14} max={90} value={age} onChange={(e) => setAge(+e.target.value)}
                  style={{ width: "100%", marginTop: 8 }} />
              </div>

              {/* Weight */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Waga: <span style={{ color: "#6efcb4" }}>{weight} kg</span></label>
                <input type="range" min={30} max={200} value={weight} onChange={(e) => setWeight(+e.target.value)}
                  style={{ width: "100%", marginTop: 8 }} />
              </div>

              {/* Height */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Wzrost: <span style={{ color: "#6efcb4" }}>{height} cm</span></label>
                <input type="range" min={120} max={220} value={height} onChange={(e) => setHeight(+e.target.value)}
                  style={{ width: "100%", marginTop: 8 }} />
              </div>

              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>🔒 Dane zapisane TYLKO lokalnie na Twoim telefonie. Nie wysyłamy na serwer.</p>
            </div>
          )}

          {/* STEP 1: Activity */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Poziom aktywności</h2>
              {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((key) => {
                const level = ACTIVITY_LEVELS[key];
                const sel = activity === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActivity(key)}
                    style={{
                      width: "100%", textAlign: "left", padding: 16, borderRadius: 16, cursor: "pointer", transition: "all 0.2s",
                      background: sel ? "rgba(110,252,180,0.12)" : "rgba(255,255,255,0.03)",
                      border: sel ? "1px solid rgba(110,252,180,0.2)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p style={{ fontWeight: 700, fontSize: 14, color: sel ? "#6efcb4" : "rgba(255,255,255,0.7)", margin: 0 }}>{level.label}</p>
                    <p style={{ fontSize: 12, marginTop: 2, color: sel ? "rgba(110,252,180,0.5)" : "rgba(255,255,255,0.55)", margin: 0 }}>{level.description}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 2: Goal */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Twój cel</h2>
              {(Object.keys(GOALS) as Goal[]).map((key) => {
                const g = GOALS[key];
                const icons: Record<string, string> = { maintain: "⚖️", lose: "🔥", gain: "💪", healthy: "🥗" };
                const sel = goal === key;
                return (
                  <button
                    key={key}
                    onClick={() => setGoal(key)}
                    style={{
                      width: "100%", textAlign: "left", padding: 16, borderRadius: 16, cursor: "pointer", transition: "all 0.2s",
                      background: sel ? "rgba(110,252,180,0.12)" : "rgba(255,255,255,0.03)",
                      border: sel ? "1px solid rgba(110,252,180,0.2)" : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p style={{ fontWeight: 700, fontSize: 14, color: sel ? "#6efcb4" : "rgba(255,255,255,0.7)", margin: 0 }}>{icons[key]} {g.label}</p>
                    {g.modifier !== 0 && (
                      <p style={{ fontSize: 12, marginTop: 2, color: sel ? "rgba(110,252,180,0.5)" : "rgba(255,255,255,0.3)", margin: 0 }}>
                        {g.modifier > 0 ? `+${g.modifier}` : g.modifier} kcal/dzień
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 3: Health */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>Profil zdrowotny</h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>Opcjonalne — pomaga dopasować analizę</p>
              </div>

              {/* Diabetes */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>🩸 Cukrzyca</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setDiabetes(null)}
                    style={{
                      flex: 1, padding: 10, borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: !diabetes ? "rgba(110,252,180,0.15)" : "rgba(255,255,255,0.04)",
                      color: !diabetes ? "#6efcb4" : "rgba(255,255,255,0.55)",
                      border: !diabetes ? "1px solid rgba(110,252,180,0.25)" : "1px solid rgba(255,255,255,0.06)",
                    }}>
                    Brak
                  </button>
                  {(Object.keys(DIABETES_TYPES) as DiabetesType[]).map((key) => {
                    const sel = diabetes === key;
                    return (
                      <button key={key} onClick={() => setDiabetes(key)}
                        style={{
                          flex: 1, padding: 10, borderRadius: 12, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          background: sel ? "rgba(110,252,180,0.15)" : "rgba(255,255,255,0.04)",
                          color: sel ? "#6efcb4" : "rgba(255,255,255,0.55)",
                          border: sel ? "1px solid rgba(110,252,180,0.25)" : "1px solid rgba(255,255,255,0.06)",
                        }}>
                        {DIABETES_TYPES[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pregnancy & Breastfeeding */}
              {gender === "female" && (
                <div style={{ borderRadius: 16, padding: 16, background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>🤰</span>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "rgba(244,114,182,0.8)", margin: 0 }}>Ciąża i karmienie</p>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 12, lineHeight: "16px" }}>
                    Niektóre składniki w żywności i kosmetykach mogą być szkodliwe w ciąży lub przy karmieniu piersią. Dzięki tej informacji AI będzie Cię ostrzegać.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={() => setPregnancy(null)}
                      style={{
                        padding: 10, borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: !pregnancy ? "rgba(244,114,182,0.15)" : "rgba(255,255,255,0.04)",
                        color: !pregnancy ? "rgba(244,114,182,0.8)" : "rgba(255,255,255,0.55)",
                        border: !pregnancy ? "1px solid rgba(244,114,182,0.25)" : "1px solid rgba(255,255,255,0.06)",
                      }}>
                      Nie dotyczy
                    </button>
                    {(Object.keys(TRIMESTERS) as Trimester[]).map((key) => {
                      const sel = pregnancy === key;
                      return (
                        <button key={key} onClick={() => setPregnancy(key)}
                          style={{
                            padding: 10, borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer",
                            background: sel ? "rgba(244,114,182,0.15)" : "rgba(255,255,255,0.04)",
                            color: sel ? "rgba(244,114,182,0.8)" : "rgba(255,255,255,0.55)",
                            border: sel ? "1px solid rgba(244,114,182,0.25)" : "1px solid rgba(255,255,255,0.06)",
                          }}>
                          {TRIMESTERS[key].label}
                        </button>
                      );
                    })}
                    <button onClick={() => setPregnancy("planuje" as Trimester)}
                      style={{
                        padding: 10, borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        background: pregnancy === "planuje" ? "rgba(244,114,182,0.15)" : "rgba(255,255,255,0.04)",
                        color: pregnancy === "planuje" ? "rgba(244,114,182,0.8)" : "rgba(255,255,255,0.55)",
                        border: pregnancy === "planuje" ? "1px solid rgba(244,114,182,0.25)" : "1px solid rgba(255,255,255,0.06)",
                      }}>
                      Planuję ciążę
                    </button>
                  </div>
                </div>
              )}

              {/* Allergens */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>⚠️ Alergie</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {COMMON_ALLERGENS.map((a) => {
                    const sel = allergens.includes(a.id);
                    return (
                      <button key={a.id} onClick={() => toggleAllergen(a.id)}
                        style={{
                          padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                          background: sel ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
                          color: sel ? "#ef4444" : "rgba(255,255,255,0.55)",
                          border: sel ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(255,255,255,0.06)",
                        }}>
                        {a.icon} {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Diet */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>🥗 Dieta</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(Object.keys(DIETS) as Diet[]).map((key) => {
                    const sel = diet === key;
                    return (
                      <button key={key} onClick={() => setDiet(key)}
                        style={{
                          padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                          background: sel ? "rgba(110,252,180,0.15)" : "rgba(255,255,255,0.04)",
                          color: sel ? "#6efcb4" : "rgba(255,255,255,0.55)",
                          border: sel ? "1px solid rgba(110,252,180,0.25)" : "1px solid rgba(255,255,255,0.06)",
                        }}>
                        {DIETS[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                ← Wstecz
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)}
                style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg, #6efcb4, #3dd990)", border: "none", color: "#0a0f0d", boxShadow: "0 4px 20px rgba(110,252,180,0.2)" }}>
                Dalej →
              </button>
            ) : (
              <button onClick={handleComplete}
                style={{ flex: 1, padding: 14, borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(135deg, #6efcb4, #3dd990)", border: "none", color: "#0a0f0d", boxShadow: "0 4px 20px rgba(110,252,180,0.2)" }}>
                ✅ Zapisz profil
              </button>
            )}
          </div>

          {/* Skip */}
          {step === 0 && (
            <button onClick={onSkip}
              style={{ width: "100%", marginTop: 12, padding: 8, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
              Pomiń na razie
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
