"use client";

import { useRouter } from "next/navigation";

interface Props {
  feature: string;
  children: React.ReactNode;
  isPremium: boolean;
}

export default function PremiumGate({ feature, children, isPremium }: Props) {
  const router = useRouter();

  if (isPremium) return <>{children}</>;

  return (
    <div className="min-h-[100dvh] bg-[#F5F2EB] flex items-center justify-center p-5">
      <div className="card-elevated rounded-[24px] p-8 text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl mx-auto mb-4">
          👑
        </div>
        <h2 className="text-[20px] font-bold text-[#1A3A0A] mb-2">Funkcja Premium</h2>
        <p className="text-[13px] text-gray-400 mb-1">{feature}</p>
        <p className="text-[12px] text-gray-300 mb-6">Odblokuj pełen dostęp do SkładAI</p>

        <div className="space-y-2 text-left mb-6">
          {[
            "♾️ Nielimitowane skany AI",
            "💰 Znajdź najlepszą cenę produktu na Ceneo i Allegro",
            "🔍 Szukaj produktów bez szkodliwych składników",
            "📊 Dashboard zdrowotny",
            "🩸 Panel cukrzyka (WW, IG)",
            "🤰 Panel ciąży",
            "🍺 Kalkulator promili",
            "⚔️ Scan Battle",
            "📈 Weekly Wrapped",
            "🛒 Lista zakupów",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-[12px] text-emerald-500">✓</span>
              <span className="text-[12px] text-gray-600 font-medium">{item}</span>
            </div>
          ))}
        </div>

        <button onClick={() => router.push("/premium")}
          className="w-full py-4 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-white font-bold rounded-[18px] active:scale-[0.97] transition-all text-[15px] shadow-xl shadow-orange-500/25">
          👑 Odblokuj Premium
        </button>
        <button onClick={() => router.back()}
          className="w-full mt-3 py-2 text-[12px] text-gray-400 font-semibold">
          ← Wróć
        </button>
      </div>
    </div>
  );
}
