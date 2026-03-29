"use client";

import { useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

interface AcademyArticle {
  title: string;
  content: string;
  key_points: string[];
  tip: string;
}

const TOPICS = [
  { id: 1,  emoji: "🧴", title: "Jaka kolejność nakładania kosmetyków?",     readMin: 3, lead: "Od najlżejszego do najcięższego" },
  { id: 2,  emoji: "⚗️", title: "Czym się różni AHA od BHA?",                readMin: 4, lead: "Złuszczanie chemiczne — który wybrać?" },
  { id: 3,  emoji: "✨", title: "Czy retinol naprawdę działa?",               readMin: 5, lead: "Złoty standard anti-aging pod lupą" },
  { id: 4,  emoji: "🔍", title: "Jak czytać listę składników?",              readMin: 3, lead: "Kolejność na liście = ilość w produkcie" },
  { id: 5,  emoji: "🫧", title: "Co znaczy 'non-comedogenic'?",              readMin: 2, lead: "Czy naprawdę nie zatyka porów?" },
  { id: 6,  emoji: "☀️", title: "Jak dobrać SPF?",                           readMin: 3, lead: "SPF 30 vs 50 — czy różnica ma sens?" },
  { id: 7,  emoji: "🧪", title: "Czy parabeny są naprawdę szkodliwe?",       readMin: 4, lead: "Mit vs nauka — co mówią badania?" },
  { id: 8,  emoji: "💧", title: "Pielęgnacja skóry tłustej",                 readMin: 4, lead: "Nawilżanie to nie wróg — to sojusznik" },
  { id: 9,  emoji: "🌙", title: "Niacynamid — co potrafi ten składnik?",      readMin: 4, lead: "Versatile hero w każdej rutynie" },
  { id: 10, emoji: "🌿", title: "Naturalne vs syntetyczne — co jest lepsze?", readMin: 5, lead: "Naturalny ≠ bezpieczny, syntetyczny ≠ zły" },
  { id: 11, emoji: "💆", title: "Jak pielęgnować skórę wrażliwą?",            readMin: 4, lead: "Mniej kroków, więcej spokoju" },
  { id: 12, emoji: "🚫", title: "Czego NIE łączyć w pielęgnacji?",           readMin: 4, lead: "Retinol + AHA = przepis na podrażnienie" },
  { id: 13, emoji: "🤰", title: "Składniki zakazane w ciąży",                readMin: 5, lead: "Co odstawić gdy planujesz dziecko?" },
  { id: 14, emoji: "🧪", title: "PEGi, SLSy i silikony — unikać czy nie?",  readMin: 5, lead: "Straszaki z etykiet pod lupą nauki" },
];

const DAILY_TIPS = [
  "Zawsze nakładaj krem z SPF jako ostatni krok porannej rutyny — po nim nic nie nakładaj!",
  "Witaminę C stosuj rano (antyoksydant + wzmocnienie SPF), retinol — wyłącznie wieczorem.",
  "Peelingi AHA/BHA i retinol nie powinny być używane tej samej nocy — to za duże podrażnienie.",
  "Kwas hialuronowy nakładaj na lekko wilgotną skórę — wtedy wiąże wodę z powietrza i naskórka.",
  "Niacynamid i witamina C mogą być używane razem — wbrew popularnym mitom są kompatybilne.",
  "Produkty z retinolem wymagają co najmniej 2-3 tygodni regularnego stosowania, żeby zobaczyć efekty.",
  "Zmień poszewkę na poduszkę co 3-4 dni — bakterie z tkaniny to częsta przyczyna wyprysków.",
  "Krem pod oczy nakładaj opuszkiem palca serdecznego — najmniejszy nacisk, delikatna skóra.",
  "Złuszczanie to nie tylko peeling — kwas glikolowy w toniku działa subtelniej i bezpieczniej.",
  "Skóra tłusta też potrzebuje nawilżenia — pomiń go a gruczoły łojowe produkują jeszcze więcej sebum.",
  "Plamy po słońcu rozjaśniasz witaminą C, niacynamidem i alfa-arbutyną — nie wyciskaniem!",
  "Ceramidy to 'cement' między komórkami skóry — niedobór to sucha, reaktywna cera.",
  "Tonik to nie woda różana — dobry tonik z AHA lub niacynamidem to pełnoprawny krok pielęgnacji.",
  "Makijaż z SPF nie wystarczy — musisz nałożyć go na całą twarz w odpowiedniej ilości (2 palce).",
];

function getDailyTip(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
}

export default function BeautyAcademyPage() {
  const [selectedTopic, setSelectedTopic] = useState<typeof TOPICS[number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<AcademyArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTopicClick = async (topic: typeof TOPICS[number]) => {
    setSelectedTopic(topic);
    setLoading(true);
    setArticle(null);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "beauty_academy",
          text: topic.title,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setArticle({
          title: data.title || topic.title,
          content: data.content || data.verdict || "Treść artykułu będzie wkrótce dostępna.",
          key_points: data.key_points || data.pros || [],
          tip: data.tip || "",
        });
      } else {
        setError("Nie udało się załadować artykułu. Spróbuj ponownie.");
      }
    } catch {
      setError("Brak połączenia z internetem. Sprawdź połączenie i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setArticle(null);
    setError(null);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0D0B0E]">
      <div className="max-w-md mx-auto px-5 pt-3">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold opacity-70 hover:opacity-100 transition-opacity" style={{color: 'inherit'}}>
          <span>←</span> Wstecz
        </Link>
      </div>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-purple-500/8 blur-[100px]" />
        <div className="absolute top-20 right-0 w-[200px] h-[200px] rounded-full bg-fuchsia-500/10 blur-[80px]" />

        <div className="max-w-md mx-auto px-5 pt-14 pb-8 relative z-10">
          <div className="text-center">
            <Link href="/" className="inline-block">
              <h1 className="text-[32px] font-black tracking-[-1.5px] mb-1">
                <span className="text-white">Skład</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-purple-400">AI</span>
              </h1>
            </Link>
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="h-[1px] w-8 bg-purple-400/40" />
              <span className="text-[9px] tracking-[2px] uppercase text-white/40 font-semibold">{"📚"} BEAUTY ACADEMY</span>
              <div className="h-[1px] w-8 bg-purple-400/40" />
            </div>
            <p className="text-white/40 text-[13px] font-medium">
              {selectedTopic ? "AI tłumaczy kosmetyki prostym językiem" : "Naucz się czytać etykiety jak ekspert"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 pb-28 relative z-20">
        {/* Topic List */}
        {!selectedTopic && (
          <div className="space-y-2.5">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleTopicClick(topic)}
                className="w-full flex items-center gap-3.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 hover:bg-white/[0.06] hover:border-purple-500/20 transition-all active:scale-[0.98] text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center text-xl shrink-0">
                  {topic.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm font-semibold leading-snug">{topic.title}</p>
                  <p className="text-purple-400/40 text-[10px] font-medium mt-0.5">{topic.lead} · ~{topic.readMin} min</p>
                </div>
                <span className="text-white/15 text-sm shrink-0">{"›"}</span>
              </button>
            ))}

            {/* Daily Tip */}
            <div className="mt-4 p-4 rounded-[18px] bg-white/[0.03] border border-amber-400/15">
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">{"✨"}</span>
                <div>
                  <p className="text-[9px] tracking-[1.5px] uppercase font-semibold text-amber-300/70 mb-1.5">Porada dnia</p>
                  <p className="text-white/60 text-[12px] leading-relaxed font-medium">
                    {getDailyTip()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {selectedTopic && loading && (
          <div className="text-center py-16">
            <div className="inline-block w-12 h-12 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin mb-4" />
            <p className="text-white/40 text-sm font-semibold">AI przygotowuje artykuł...</p>
            <p className="text-white/20 text-xs mt-1">{selectedTopic.title}</p>
          </div>
        )}

        {/* Error State */}
        {selectedTopic && error && (
          <div>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-white/40 text-sm font-semibold mb-6 hover:text-white/60 transition-colors"
            >
              <span>{"←"}</span> Powrót do tematów
            </button>
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-red-400 text-sm font-semibold">{error}</p>
              <button
                onClick={() => handleTopicClick(selectedTopic)}
                className="mt-3 px-5 py-2 rounded-xl bg-purple-500/20 text-purple-300 text-xs font-bold"
              >
                Spróbuj ponownie
              </button>
            </div>
          </div>
        )}

        {/* Article */}
        {selectedTopic && article && !loading && (
          <div>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-white/40 text-sm font-semibold mb-6 hover:text-white/60 transition-colors"
            >
              <span>{"←"}</span> Powrót do tematów
            </button>

            {/* Article Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-2xl shrink-0">
                {selectedTopic.emoji}
              </div>
              <h2 className="text-white text-lg font-bold leading-tight">{article.title}</h2>
            </div>

            {/* Article Content */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-5 mb-4">
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line">{article.content}</p>
            </div>

            {/* Key Points */}
            {article.key_points.length > 0 && (
              <div className="bg-purple-500/[0.06] border border-purple-500/15 rounded-[20px] p-5 mb-4">
                <p className="text-[9px] tracking-[1.5px] uppercase font-semibold text-purple-400/60 mb-3">Kluczowe punkty</p>
                <div className="space-y-2.5">
                  {article.key_points.map((point, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-lg bg-purple-500/20 flex items-center justify-center text-[10px] font-bold text-purple-400 shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-white/60 text-sm leading-snug">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            {article.tip && (
              <div className="p-4 rounded-[18px] bg-white/[0.03] border border-amber-400/15">
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5">{"💡"}</span>
                  <div>
                    <p className="text-[9px] tracking-[1.5px] uppercase font-semibold text-amber-300/70 mb-1.5">Zapamiętaj</p>
                    <p className="text-white/60 text-[12px] leading-relaxed font-medium">{article.tip}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Back link */}
        <Link
          href="/"
          className="block text-center mt-6 text-white/30 text-xs font-semibold hover:text-white/50 transition-colors"
        >
          Powrót do skanera
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
