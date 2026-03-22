"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Scanner from "@/components/Scanner";
import HistoryList from "@/components/HistoryList";
import { addToHistory, checkRateLimit, incrementScanCount } from "@/lib/storage";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setRemaining(checkRateLimit().remaining);
  }, []);

  const handleScan = useCallback(
    async (base64: string) => {
      setError(null);

      const { allowed } = checkRateLimit();
      if (!allowed) {
        setError("Osiągnięto dzienny limit skanów. Spróbuj jutro.");
        return;
      }

      if (!navigator.onLine) {
        setError("Brak połączenia z internetem.");
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Wystąpił błąd. Spróbuj ponownie.");
          setIsLoading(false);
          return;
        }

        incrementScanCount();
        setRemaining(checkRateLimit().remaining);

        // Create small thumbnail for history
        const canvas = document.createElement("canvas");
        const img = new Image();
        img.src = base64;
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - minDim) / 2,
          (img.height - minDim) / 2,
          minDim,
          minDim,
          0,
          0,
          96,
          96
        );
        const thumbnail = canvas.toDataURL("image/jpeg", 0.5);

        const historyItem = addToHistory(data, thumbnail);
        router.push(`/wyniki/${historyItem.id}`);
      } catch {
        setError("Analiza trwa dłużej niż zwykle. Spróbuj ponownie.");
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2E7D32] text-3xl mb-3">
            🔬
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SkładAI</h1>
          <p className="text-sm text-gray-500 mt-1">
            Zeskanuj etykietę — poznaj skład produktu
          </p>
        </div>

        {/* Scanner */}
        <Scanner onScan={handleScan} isLoading={isLoading} />

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Rate limit info */}
        {!isLoading && remaining !== null && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Pozostało skanów dzisiaj: {remaining}
          </p>
        )}

        {/* History */}
        <HistoryList />
      </div>
    </div>
  );
}
