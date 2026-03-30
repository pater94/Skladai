"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getProfile } from "@/lib/storage";
import { UserProfile } from "@/lib/types";
import VoiceLog, { VoiceMicButton } from "@/components/VoiceLog";
import { isNative, takePhotoForMode } from "@/lib/native-camera";
import {
  DRINK_TYPES, DrinkType, ConsumedDrink, BACSession,
  calculateBAC, timeToSober, timeToDrive, formatMinutes, bacColor,
  totalDrinkCalories, alcoholCalorieComparisons,
  getBACSession, saveBACSession, clearBACSession,
} from "@/lib/bac";

export default function PromilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<BACSession | null>(null);
  const [bac, setBac] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Temp weight for non-profile users
  const [tempWeight, setTempWeight] = useState(80);
  const [tempGender, setTempGender] = useState<"male" | "female">("male");
  const [bodyBuild, setBodyBuild] = useState(1); // 0-3
  const [foodLevel, setFoodLevel] = useState(0); // 0-3

  // Alcohol search
  const [alcoholQuery, setAlcoholQuery] = useState("");
  const [alcoholResult, setAlcoholResult] = useState<{name:string;emoji:string;type:string;default_ml:number;abv_percent:number;alcohol_grams:number;calories:number;flavor_profile:string;fun_fact:string;verdict:string}|null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [alcoholLoading, setAlcoholLoading] = useState(false);
  const [expandedDrink, setExpandedDrink] = useState<string | null>(null);

  // Alcohol scan
  const alcoholScanRef = useRef<HTMLInputElement>(null);

  const weight = profile?.weight_kg || tempWeight;
  const gender = profile?.gender || tempGender;

  const recalculate = useCallback(() => {
    const s = getBACSession();
    setSession(s);
    if (s && s.drinks.length > 0) {
      setBac(calculateBAC(s.drinks, weight, gender, undefined, bodyBuild, foodLevel));
    } else {
      setBac(0);
    }
  }, [weight, gender, bodyBuild, foodLevel]);

  useEffect(() => {
    setProfile(getProfile());
    recalculate();
    setLoaded(true);
    // Update BAC every 30 seconds
    const interval = setInterval(recalculate, 30000);
    return () => clearInterval(interval);
  }, [recalculate]);

  const addDrink = (drinkType: DrinkType) => {
    const drink: ConsumedDrink = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      drinkType,
      time: new Date().toISOString(),
    };

    const current = getBACSession() || {
      drinks: [],
      startTime: new Date().toISOString(),
      date: new Date().toISOString().split("T")[0],
    };

    current.drinks.push(drink);
    saveBACSession(current);
    recalculate();
  };

  const removeDrink = (id: string) => {
    const current = getBACSession();
    if (!current) return;
    current.drinks = current.drinks.filter((d) => d.id !== id);
    if (current.drinks.length === 0) {
      clearBACSession();
    } else {
      saveBACSession(current);
    }
    recalculate();
  };

  const resetSession = () => {
    clearBACSession();
    recalculate();
  };

  // Hardcoded flavor profiles for quick buttons
  const DRINK_FLAVORS: Record<string, { flavor: string; fact: string }> = {
    beer_small: { flavor: "Lekkie, chłodne, delikatnie chmielone. Idealne na spotkanie ze znajomymi.", fact: "Piwo to najstarszy i najczęściej spożywany alkohol na świecie — warzone od ponad 7000 lat!" },
    beer_large: { flavor: "Klasyczne polskie piwo — złociste, orzeźwiające, lekko goryczka chmielowa.", fact: "Polska jest 3. największym producentem piwa w Europie. Statystyczny Polak pije ~97L rocznie." },
    beer_strong: { flavor: "Intensywne, pełne, z wyraźnym alkoholem. Słodowo-karmelowe nuty.", fact: "Piwa mocne mają paradoksalnie mniej chmielu — wyższa zawartość alkoholu wymaga więcej słodu." },
    wine: { flavor: "Eleganckie, owocowe nuty z delikatną kwasowością. Wino to świat sam w sobie.", fact: "Najstarsze znane wino ma 8000 lat. Znaleziono je w glinianych naczyniach w Gruzji." },
    vodka: { flavor: "Czysta, neutralna, lekko piekąca. Podstawa polskiej tradycji alkoholowej.", fact: "Polska i Rosja rywalizują o tytuł ojczyzny wódki. Pierwsza polska wzmianka pochodzi z 1405 roku." },
    whisky: { flavor: "Dymna, karmelowa, z nutami wanilii i dębu. Złożoność rośnie z wiekiem.", fact: "Whisky dojrzewa TYLKO w beczce. Po butelkowaniu nie zmienia się. Ta '12-letnia' nie starzeje się dalej." },
    drink: { flavor: "Owocowy, orzeźwiający, z ukrytym alkoholem. Uwaga — łatwo przedobrzyć!", fact: "Koktajle z parasolką wymyślono w Tiki barach w LA w latach 30. Miały imitować tropikalny raj." },
    custom: { flavor: "Każdy alkohol ma swoją historię i charakter.", fact: "Słowo 'alkohol' pochodzi z arabskiego 'al-kuhl' — oznaczało oryginalnie drobny proszek." },
  };

  const searchAlcohol = async () => {
    if (!alcoholQuery.trim()) return;
    setAlcoholLoading(true);
    setAlcoholResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: alcoholQuery.trim(), mode: "alcohol_search" }),
      });
      const data = await res.json();
      if (res.ok) setAlcoholResult(data);
    } catch { /* ignore */ }
    finally { setAlcoholLoading(false); }
  };

  const addAlcoholResult = () => {
    if (!alcoholResult) return;
    const drinkType: DrinkType = {
      id: "custom_" + Date.now(),
      name: alcoholResult.name,
      ml: alcoholResult.default_ml,
      abv: alcoholResult.abv_percent,
      icon: alcoholResult.emoji || "🍹",
      calories: alcoholResult.calories,
    };
    addDrink(drinkType);
    setAlcoholResult(null);
    setAlcoholQuery("");
  };

  const handleAlcoholScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setAlcoholLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mode: "alcohol_scan" }),
        });
        const data = await res.json();
        if (res.ok) setAlcoholResult(data);
      } catch { /* ignore */ }
      finally { setAlcoholLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  if (!loaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0A0A12]">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full" style={{ animation: "spinSlow 0.8s linear infinite" }} />
      </div>
    );
  }

  const { color, bg, label, emoji } = bacColor(bac);
  const soberMins = timeToSober(bac);
  const driveMins = timeToDrive(bac);
  const drinks = session?.drinks || [];
  const calories = totalDrinkCalories(drinks);
  const comparisons = alcoholCalorieComparisons(calories);

  return (
    <div className="min-h-[100dvh] bg-[#0A0A12]">
      <div className="max-w-md mx-auto px-5 pt-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold opacity-70 hover:opacity-100 transition-opacity" style={{color: 'inherit'}}>
          <span>←</span> Wstecz
        </Link>
      </div>
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[100px]" />
        <div className="absolute top-20 right-0 w-[200px] h-[200px] rounded-full bg-amber-500/5 blur-[80px]" />

        <div className="max-w-md mx-auto px-5 pt-8 pb-6 relative z-10">
          <div className="text-center">
            <h1 className="text-[28px] font-black text-white tracking-tight">Skład<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI</span></h1>
            <p className="text-[13px] font-bold text-indigo-300 tracking-widest uppercase mt-1">ALKOMAT AI</p>
            <p className="text-white/30 text-[11px] mt-1">Sprawdź ile masz promili</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pb-24 relative z-20">
        {/* Weight/gender picker (if no profile) */}
        {!profile && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 mb-4">
            <div className="flex gap-2 mb-3">
              {(["male", "female"] as const).map((g) => (
                <button key={g} onClick={() => setTempGender(g)}
                  className={`flex-1 py-2 rounded-[12px] text-[12px] font-bold transition-all ${
                    tempGender === g ? "bg-indigo-500 text-white" : "bg-white/5 text-white/40"
                  }`}>
                  {g === "male" ? "👨 Mężczyzna" : "👩 Kobieta"}
                </button>
              ))}
            </div>
            <div>
              <span className="text-[10px] text-white/30 font-semibold">Waga: {tempWeight} kg</span>
              <input type="range" min={40} max={150} value={tempWeight}
                onChange={(e) => setTempWeight(+e.target.value)}
                className="w-full accent-indigo-500" />
            </div>
          </div>
        )}

        {/* Body build + Food level */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 mb-4">
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-3">Kompozycja ciała</p>
          <div className="flex gap-1.5 mb-4">
            {["🪶 Szczupły", "🧍 Średni", "💪 Sportowy", "🏋️ Umięśniony"].map((label, i) => (
              <button key={i} onClick={() => { setBodyBuild(i); }}
                className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold transition-all ${
                  bodyBuild === i ? "bg-indigo-500 text-white" : "bg-white/5 text-white/30"
                }`}>{label}</button>
            ))}
          </div>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-3">Co jadłeś</p>
          <div className="flex gap-1.5">
            {["Na czczo", "Przekąska", "Posiłek", "Duży posiłek"].map((label, i) => (
              <button key={i} onClick={() => { setFoodLevel(i); }}
                className={`flex-1 py-2 rounded-[10px] text-[10px] font-bold transition-all ${
                  foodLevel === i ? "bg-amber-500 text-white" : "bg-white/5 text-white/30"
                }`}>{label}</button>
            ))}
          </div>
        </div>

        {/* BAC Display — main */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-[24px] p-6 mb-4 text-center">
          <p className="text-[48px] font-black tracking-tight" style={{ color }}>{bac.toFixed(2)}‰</p>
          <span className="text-[12px] font-bold px-4 py-1.5 rounded-full inline-block mt-1" style={{ backgroundColor: bg, color }}>
            {emoji} {label}
          </span>

          {bac > 0 && (
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-white/[0.03] rounded-[14px] p-3">
                <p className="text-[10px] text-white/30 font-semibold">🚗 Prowadzić za</p>
                <p className="text-[16px] font-bold text-white mt-0.5">{formatMinutes(driveMins)}</p>
              </div>
              <div className="bg-white/[0.03] rounded-[14px] p-3">
                <p className="text-[10px] text-white/30 font-semibold">😴 Trzeźwy za</p>
                <p className="text-[16px] font-bold text-white mt-0.5">{formatMinutes(soberMins)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Driving status */}
        {session && session.drinks.length > 0 && (
          <div className={`rounded-[16px] p-4 mb-4 border ${
            bac < 0.2 ? "bg-emerald-500/10 border-emerald-500/20" : bac < 0.5 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"
          }`}>
            <p className={`text-[13px] font-bold ${
              bac < 0.2 ? "text-emerald-400" : bac < 0.5 ? "text-amber-400" : "text-red-400"
            }`}>
              {bac < 0.2 ? "🚗 Możesz prowadzić ✅" : bac < 0.5 ? `🚗 Stan po użyciu — NIE PROWADŹ ❌ | Za ${formatMinutes(driveMins)}` : `🚗 Nietrzeźwość — NIE PROWADŹ ❌ | Za ${formatMinutes(driveMins)}`}
            </p>
          </div>
        )}

        {/* Running totals */}
        {session && session.drinks.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[16px] p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-[10px] text-white/30 font-semibold">Drinków</p>
                <p className="text-[18px] font-bold text-white">{session.drinks.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/30 font-semibold">Kalorii</p>
                <p className="text-[18px] font-bold text-amber-400">{totalDrinkCalories(session.drinks)} kcal</p>
              </div>
            </div>
          </div>
        )}

        {/* Drink buttons grid */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-[24px] p-5 mb-4">
          <p className="text-[13px] font-bold text-white mb-3">Dodaj drinka</p>
          <div className="grid grid-cols-4 gap-2">
            {DRINK_TYPES.map((drink) => (
              <button key={drink.id} onClick={() => addDrink(drink)}
                className="bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06] rounded-[14px] p-3 text-center active:scale-[0.93] transition-all">
                <span className="text-[24px] block">{drink.icon}</span>
                <span className="text-[9px] text-white/50 font-semibold block mt-1 leading-tight">{drink.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Alcohol search */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={alcoholQuery}
              onChange={(e) => setAlcoholQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchAlcohol()}
              placeholder="🔍 Wpisz alkohol... np. Tyskie, mojito"
              className="flex-1 bg-white/5 border border-white/10 rounded-[12px] px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-indigo-500/50"
            />
            <VoiceMicButton onClick={() => setShowVoice(true)} accent="indigo" />
            <button onClick={searchAlcohol} disabled={alcoholLoading}
              className="px-4 py-2.5 bg-indigo-500 text-white rounded-[12px] text-[12px] font-bold active:scale-95 transition-transform disabled:opacity-50">
              {alcoholLoading ? "..." : "Szukaj"}
            </button>
          </div>
          <button onClick={async () => {
              if (isNative()) {
                const base64 = await takePhotoForMode("food", "camera");
                if (base64) {
                  // Create synthetic event-like object for handleAlcoholScan
                  const res = await fetch(base64);
                  const blob = await res.blob();
                  const file = new File([blob], "alcohol.jpg", { type: "image/jpeg" });
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  if (alcoholScanRef.current) {
                    alcoholScanRef.current.files = dt.files;
                    alcoholScanRef.current.dispatchEvent(new Event("change", { bubbles: true }));
                  }
                }
              } else { alcoholScanRef.current?.click(); }
            }}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-[12px] text-[12px] font-semibold text-white/50 active:scale-[0.97] transition-transform">
            📸 Zeskanuj etykietę alkoholu
          </button>
          <input ref={alcoholScanRef} type="file" accept="image/*" capture="environment" onChange={handleAlcoholScan} className="hidden" />
        </div>

        {/* Alcohol search result */}
        {alcoholResult && (
          <div className="bg-white/[0.03] border border-indigo-500/30 rounded-[20px] p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[32px]">{alcoholResult.emoji}</span>
              <div>
                <p className="text-[15px] font-bold text-white">{alcoholResult.name}</p>
                <p className="text-[11px] text-white/40">{alcoholResult.type} · {alcoholResult.default_ml}ml · {alcoholResult.abv_percent}% · {alcoholResult.calories} kcal</p>
              </div>
            </div>
            <p className="text-[12px] text-white/60 mb-3">{alcoholResult.verdict}</p>
            <div className="space-y-2 mb-4">
              <div className="bg-white/[0.03] rounded-[12px] p-3">
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mb-1">🍷 Profil smakowy</p>
                <p className="text-[12px] text-white/50">{alcoholResult.flavor_profile}</p>
              </div>
              <div className="bg-white/[0.03] rounded-[12px] p-3">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">💡 Ciekawostka</p>
                <p className="text-[12px] text-white/50">{alcoholResult.fun_fact}</p>
              </div>
            </div>
            <button onClick={addAlcoholResult}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-[14px] active:scale-[0.97] transition-transform text-[13px]">
              🍺 Dodaj do Alkomatu
            </button>
          </div>
        )}

        {/* Today's drinks list */}
        {drinks.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[24px] p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-[13px] font-bold text-white">Dziś: {drinks.length} {drinks.length === 1 ? "drink" : "drinków"}</p>
              <button onClick={resetSession} className="text-[11px] text-red-400 font-bold">Resetuj</button>
            </div>
            <div className="space-y-2">
              {drinks.map((d) => {
                const flavorData = DRINK_FLAVORS[d.drinkType.id] || DRINK_FLAVORS.custom;
                const isExpanded = expandedDrink === d.id;
                return (
                  <div key={d.id} className="bg-white/[0.03] rounded-[12px] overflow-hidden">
                    <div className="flex items-center gap-3 p-2.5 cursor-pointer" onClick={() => setExpandedDrink(isExpanded ? null : d.id)}>
                      <span className="text-[18px]">{d.drinkType.icon}</span>
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-white/70">{d.drinkType.name}</p>
                        <p className="text-[10px] text-white/30">
                          {new Date(d.time).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                          {" · "}{d.drinkType.abv}% · {d.drinkType.calories} kcal
                        </p>
                      </div>
                      <span className={`text-white/20 text-[10px] transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                      <button onClick={(e) => { e.stopPropagation(); removeDrink(d.id); }} className="text-white/20 hover:text-red-400 px-1">✕</button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="bg-white/[0.02] rounded-[8px] p-2.5">
                          <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mb-1">🍷 Profil</p>
                          <p className="text-[11px] text-white/40 leading-relaxed">{flavorData.flavor}</p>
                        </div>
                        <div className="bg-white/[0.02] rounded-[8px] p-2.5">
                          <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider mb-1">💡 Ciekawostka</p>
                          <p className="text-[11px] text-white/40 leading-relaxed">{flavorData.fact}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Calories comparison */}
        {calories > 0 && (
          <div className="bg-white/[0.03] border border-amber-400/15 rounded-[24px] p-5 mb-4">
            <p className="text-[13px] font-bold text-amber-400 mb-1">🔥 Kalorie z alkoholu</p>
            <p className="text-[24px] font-black text-white">{calories} kcal</p>
            <p className="text-[11px] text-white/30 mb-3">To tyle co:</p>
            <ul className="space-y-1.5">
              {comparisons.map((c, i) => (
                <li key={i} className="text-[12px] text-white/50">{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Legal thresholds */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-[24px] p-5 mb-4">
          <p className="text-[13px] font-bold text-white mb-3">🇵🇱 Progi prawne w Polsce</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400">0.0–0.2‰</span>
              <span className="text-[12px] text-white/50">Trzeźwy — może prowadzić</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400">0.2–0.5‰</span>
              <span className="text-[12px] text-white/50">Stan po użyciu — wykroczenie</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400">&gt;0.5‰</span>
              <span className="text-[12px] text-white/50">Nietrzeźwość — przestępstwo</span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-[20px] p-4">
          <p className="text-[10px] text-red-400/70 leading-relaxed text-center">
            ⚠️ Kalkulator podaje SZACUNKOWE wartości (wzór Widmarka). NIGDY nie podejmuj decyzji o prowadzeniu na podstawie tego kalkulatora. Jedyna wiarygodna metoda to alkomat lub badanie krwi. W razie wątpliwości — NIE PROWADŹ.
          </p>
        </div>
      </div>

      {/* Voice Log Modal */}
      {showVoice && (
        <VoiceLog
          mode="alcohol"
          initialOpen={true}
          hideButton={true}
          onComplete={(items) => {
            if (items && Array.isArray(items)) {
              const drinks: ConsumedDrink[] = session ? [...session.drinks] : [];
              const startTime = session?.startTime || new Date().toISOString();
              for (const item of items) {
                const r = item as unknown as Record<string, unknown>;
                const qty = (r.quantity as number) || 1;
                const ml = (r.default_ml as number) || 500;
                const abv = (r.abv_percent as number) || 5;
                const name = (r.name as string) || "Drink";
                const emoji = (r.emoji as string) || "🍺";
                const cal = (r.calories_per_unit as number) || Math.round(ml * (abv / 100) * 0.789 * 7);
                for (let i = 0; i < qty; i++) {
                  drinks.push({
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i,
                    drinkType: { id: "custom", name, icon: emoji, ml, abv, calories: cal },
                    customMl: ml,
                    customAbv: abv,
                    time: new Date().toISOString(),
                  });
                }
              }
              const newSession: BACSession = { drinks, startTime, date: new Date().toISOString().split("T")[0] };
              setSession(newSession);
              saveBACSession(newSession);
            }
            setShowVoice(false);
          }}
          onClose={() => setShowVoice(false)}
        />
      )}
    </div>
  );
}
