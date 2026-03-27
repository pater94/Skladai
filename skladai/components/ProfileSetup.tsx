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
    <div className="min-h-[100dvh] bg-[#F5F2EB]">
      {/* Header */}
      <div className="matcha-hero relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-[60px]" />
        <div className="max-w-md mx-auto px-5 pt-14 pb-20 relative z-10">
          <div className="text-center">
            <h1 className="text-[28px] font-black text-white tracking-tight">Twój profil</h1>
            <p className="text-white/50 text-[13px] mt-1">Krok {step + 1} z 4</p>
          </div>
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-4">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? "w-8 bg-lime-400" : "w-4 bg-white/20"}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-10 pb-10 relative z-20">
        <div className="card-elevated rounded-[24px] p-6">
          {/* STEP 0: Basic data */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-[18px] font-bold text-[#1A3A0A]">Podstawowe dane</h2>

              {/* Name */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Imię (opcjonalne)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Twoje imię"
                  className="w-full mt-2 px-4 py-3 rounded-[14px] bg-gray-50 text-[14px] text-gray-800 font-semibold outline-none focus:ring-2 focus:ring-[#1A3A0A]/20 transition-all"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Płeć</label>
                <div className="flex gap-2 mt-2">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`flex-1 py-3 rounded-[14px] text-[13px] font-bold transition-all ${
                        gender === g ? "bg-[#1A3A0A] text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {g === "male" ? "👨 Mężczyzna" : "👩 Kobieta"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Wiek: {age} lat</label>
                <input type="range" min={14} max={90} value={age} onChange={(e) => setAge(+e.target.value)}
                  className="w-full mt-2 accent-[#1A3A0A]" />
              </div>

              {/* Weight */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Waga: {weight} kg</label>
                <input type="range" min={30} max={200} value={weight} onChange={(e) => setWeight(+e.target.value)}
                  className="w-full mt-2 accent-[#1A3A0A]" />
              </div>

              {/* Height */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Wzrost: {height} cm</label>
                <input type="range" min={120} max={220} value={height} onChange={(e) => setHeight(+e.target.value)}
                  className="w-full mt-2 accent-[#1A3A0A]" />
              </div>

              <p className="text-[10px] text-gray-400 text-center">🔒 Dane zapisane TYLKO lokalnie na Twoim telefonie. Nie wysyłamy na serwer.</p>
            </div>
          )}

          {/* STEP 1: Activity */}
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-[18px] font-bold text-[#1A3A0A]">Poziom aktywności</h2>
              {(Object.keys(ACTIVITY_LEVELS) as ActivityLevel[]).map((key) => {
                const level = ACTIVITY_LEVELS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setActivity(key)}
                    className={`w-full text-left p-4 rounded-[16px] transition-all ${
                      activity === key ? "bg-[#1A3A0A] text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <p className="font-bold text-[14px]">{level.label}</p>
                    <p className={`text-[12px] mt-0.5 ${activity === key ? "text-white/60" : "text-gray-400"}`}>{level.description}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* STEP 2: Goal */}
          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-[18px] font-bold text-[#1A3A0A]">Twój cel</h2>
              {(Object.keys(GOALS) as Goal[]).map((key) => {
                const g = GOALS[key];
                const icons = { maintain: "⚖️", lose: "🔥", gain: "💪", healthy: "🥗" };
                return (
                  <button
                    key={key}
                    onClick={() => setGoal(key)}
                    className={`w-full text-left p-4 rounded-[16px] transition-all ${
                      goal === key ? "bg-[#1A3A0A] text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <p className="font-bold text-[14px]">{icons[key]} {g.label}</p>
                    {g.modifier !== 0 && (
                      <p className={`text-[12px] mt-0.5 ${goal === key ? "text-white/60" : "text-gray-400"}`}>
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
            <div className="space-y-5">
              <h2 className="text-[18px] font-bold text-[#1A3A0A]">Profil zdrowotny</h2>
              <p className="text-[12px] text-gray-400 -mt-2">Opcjonalne — pomaga dopasować analizę</p>

              {/* Diabetes */}
              <div>
                <p className="text-[12px] font-semibold text-gray-600 mb-2">🩸 Cukrzyca</p>
                <div className="flex gap-2">
                  <button onClick={() => setDiabetes(null)}
                    className={`flex-1 py-2.5 rounded-[12px] text-[12px] font-bold ${!diabetes ? "bg-[#1A3A0A] text-white" : "bg-gray-100 text-gray-500"}`}>
                    Brak
                  </button>
                  {(Object.keys(DIABETES_TYPES) as DiabetesType[]).map((key) => (
                    <button key={key} onClick={() => setDiabetes(key)}
                      className={`flex-1 py-2.5 rounded-[12px] text-[12px] font-bold ${diabetes === key ? "bg-[#1A3A0A] text-white" : "bg-gray-100 text-gray-500"}`}>
                      {DIABETES_TYPES[key].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pregnancy (only for female) */}
              {gender === "female" && (
                <div>
                  <p className="text-[12px] font-semibold text-gray-600 mb-2">🤰 Ciąża</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPregnancy(null)}
                      className={`flex-1 py-2.5 rounded-[12px] text-[11px] font-bold ${!pregnancy ? "bg-[#1A3A0A] text-white" : "bg-gray-100 text-gray-500"}`}>
                      Brak
                    </button>
                    {(Object.keys(TRIMESTERS) as Trimester[]).map((key) => (
                      <button key={key} onClick={() => setPregnancy(key)}
                        className={`flex-1 py-2.5 rounded-[12px] text-[11px] font-bold ${pregnancy === key ? "bg-[#1A3A0A] text-white" : "bg-gray-100 text-gray-500"}`}>
                        {TRIMESTERS[key].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergens */}
              <div>
                <p className="text-[12px] font-semibold text-gray-600 mb-2">⚠️ Alergie</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_ALLERGENS.map((a) => (
                    <button key={a.id} onClick={() => toggleAllergen(a.id)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        allergens.includes(a.id) ? "bg-red-500 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                      {a.icon} {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diet */}
              <div>
                <p className="text-[12px] font-semibold text-gray-600 mb-2">🥗 Dieta</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DIETS) as Diet[]).map((key) => (
                    <button key={key} onClick={() => setDiet(key)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        diet === key ? "bg-[#1A3A0A] text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                      {DIETS[key].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                className="flex-1 py-3.5 rounded-[14px] text-[14px] font-bold bg-gray-100 text-gray-600 active:scale-[0.97] transition-all">
                ← Wstecz
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)}
                className="flex-1 py-3.5 rounded-[14px] text-[14px] font-bold bg-[#1A3A0A] text-white active:scale-[0.97] transition-all shadow-lg">
                Dalej →
              </button>
            ) : (
              <button onClick={handleComplete}
                className="flex-1 py-3.5 rounded-[14px] text-[14px] font-bold bg-[#1A3A0A] text-white active:scale-[0.97] transition-all shadow-lg">
                ✅ Zapisz profil
              </button>
            )}
          </div>

          {/* Skip */}
          {step === 0 && (
            <button onClick={onSkip}
              className="w-full mt-3 py-2 text-[12px] text-gray-400 font-semibold">
              Pomiń na razie
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
