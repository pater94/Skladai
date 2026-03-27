"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPremiumStatus, activatePremium, deactivatePremium, isPremium as checkIsPremium } from "@/lib/storage";

const FEATURES = [
  { icon: "📸", title: "Skan etykiet", free: "5 dziennie", premium: "Bez limitu" },
  { icon: "🍽️", title: "Skan dań", free: "2 dziennie", premium: "Bez limitu" },
  { icon: "📊", title: "Dashboard zdrowotny", free: "—", premium: "✓" },
  { icon: "🩸", title: "Panel cukrzyka", free: "—", premium: "✓" },
  { icon: "🤰", title: "Panel ciąży", free: "—", premium: "✓" },
  { icon: "⚠️", title: "Alerty alergenów", free: "Podstawowe", premium: "Rozbudowane" },
  { icon: "🍺", title: "Kalkulator promili", free: "✓", premium: "✓" },
  { icon: "⚔️", title: "Scan Battle", free: "Solo", premium: "Solo + VS" },
  { icon: "📈", title: "Weekly Wrapped", free: "—", premium: "✓" },
  { icon: "🛒", title: "Lista zakupów", free: "—", premium: "✓" },
  { icon: "🥄", title: "Łyżeczki cukru", free: "✓", premium: "✓" },
  { icon: "🔥", title: "Streak & badges", free: "✓", premium: "✓" },
];

export default function PremiumPage() {
  const router = useRouter();
  const [premium, setPremium] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPremium(checkIsPremium());
    setLoaded(true);
  }, []);

  const handleActivate = () => {
    // DEMO: aktywuje 30 dni premium
    // W produkcji: tu byłby Stripe/PayU/przelewy24
    activatePremium(30);
    setPremium(true);
  };

  const handleDeactivate = () => {
    deactivatePremium();
    setPremium(false);
  };

  if (!loaded) return null;

  return (
    <div className="min-h-[100dvh] bg-[#F5F2EB]">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-[60px]" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/10 blur-[60px]" />
        <div className="max-w-md mx-auto px-5 pt-6 pb-24 relative z-10">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 text-[13px] text-white/80 font-semibold px-4 py-2 rounded-full bg-white/10 border border-white/20 active:scale-95 transition-all mb-6">
            ← Powrót
          </button>
          <div className="text-center">
            <span className="text-5xl block mb-3">👑</span>
            <h1 className="text-[28px] font-black text-white">SkładAI Premium</h1>
            <p className="text-white/70 text-[14px] mt-2 font-medium">Pełna kontrola nad tym co jesz</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-14 pb-24 relative z-20">
        {/* Status */}
        {premium && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[20px] p-5 mb-4 text-center">
            <p className="text-[16px] font-bold text-emerald-700">✅ Premium aktywne!</p>
            <p className="text-[12px] text-emerald-600 mt-1">
              Do: {new Date(getPremiumStatus().expiresAt || "").toLocaleDateString("pl-PL")}
            </p>
            <button onClick={handleDeactivate}
              className="mt-3 text-[11px] text-red-400 font-semibold">
              Dezaktywuj (test)
            </button>
          </div>
        )}

        {/* Pricing */}
        {!premium && (
          <div className="card-elevated rounded-[24px] p-6 mb-4">
            <div className="text-center mb-5">
              <p className="text-[32px] font-black text-[#1A3A0A]">19 <span className="text-[16px] font-bold text-gray-400">zł/mies.</span></p>
              <p className="text-[12px] text-gray-400 mt-1">Mniej niż kawa w Starbucks ☕</p>
            </div>

            <button onClick={handleActivate}
              className="w-full py-4 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-white font-bold rounded-[18px] active:scale-[0.97] transition-all text-[15px] shadow-xl shadow-orange-500/25 mb-3">
              👑 Aktywuj Premium (demo — 30 dni za darmo)
            </button>
            <p className="text-[10px] text-gray-300 text-center">
              Demo: kliknij żeby aktywować. W produkcji tu będzie płatność.
            </p>
          </div>
        )}

        {/* Feature comparison */}
        <div className="card-elevated rounded-[24px] p-5">
          <h2 className="text-[16px] font-bold text-[#1A3A0A] mb-4">Porównanie planów</h2>

          {/* Header row */}
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-2">
            <div className="flex-1" />
            <div className="w-16 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Free</p>
            </div>
            <div className="w-16 text-center">
              <p className="text-[10px] font-bold text-amber-500 uppercase">Premium</p>
            </div>
          </div>

          {/* Feature rows */}
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-2 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-[14px] w-6">{f.icon}</span>
              <span className="flex-1 text-[12px] font-medium text-gray-600">{f.title}</span>
              <span className="w-16 text-center text-[11px] text-gray-400 font-semibold">{f.free}</span>
              <span className="w-16 text-center text-[11px] text-emerald-600 font-bold">{f.premium}</span>
            </div>
          ))}
        </div>

        {/* Testimonials mock */}
        <div className="card-elevated rounded-[24px] p-5 mt-4">
          <p className="text-[13px] font-bold text-[#1A3A0A] mb-3">💬 Co mówią użytkownicy</p>
          <div className="space-y-3">
            {[
              { text: "Odkąd mam Premium, oszczędzam ~150 zł miesięcznie na śmieciowym jedzeniu.", author: "Kasia, 28 lat" },
              { text: "Panel cukrzyka zmienił moje podejście do WW. Nie wyobrażam sobie bez tego.", author: "Marek, 45 lat" },
              { text: "Scan Battle na imprezach to hit. Wszyscy pytają o tę apkę!", author: "Tomek, 23 lata" },
            ].map((t, i) => (
              <div key={i} className="bg-gray-50 rounded-[14px] p-3">
                <p className="text-[12px] text-gray-600 italic">"{t.text}"</p>
                <p className="text-[10px] text-gray-400 mt-1 font-semibold">— {t.author}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[9px] text-gray-300 text-center mt-4 px-4">
          SkładAI nie jest wyrobem medycznym. Premium nie zmienia dokładności analizy — daje dostęp do dodatkowych narzędzi.
        </p>
      </div>
    </div>
  );
}
