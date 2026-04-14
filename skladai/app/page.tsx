"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Scanner from "@/components/Scanner";
import PhotoPreview from "@/components/PhotoPreview";
import HistoryList from "@/components/HistoryList";
import MorningAfter from "@/components/MorningAfter";
import SkinProfileSetup, { hasSkinProfile } from "@/components/SkinProfileSetup";
import InciSearch from "@/components/InciSearch";
import VoiceLog from "@/components/VoiceLog";
import {
  addToHistory,
  checkFreeTierLimit,
  incrementScanCount,
  getSavedMode,
  saveMode,
  updateStreak,
  getHistory,
} from "@/lib/storage";
import { compressImageSmall, clampBase64Size } from "@/lib/compress";

// For 2-photo modes (cosmetics, suplement) the combined body must stay
// well under Vercel's 4.5 MB request limit. Native Capacitor Camera
// quality=85 can emit 1.2-2 MB JPEGs which is too big when doubled up.
const CAMERA_CLAMP_KB = (mode: string) =>
  mode === "cosmetics" || mode === "suplement" ? 900 : 1500;
import { isNative, takePhotoForMode } from "@/lib/native-camera";
import { devLog } from "@/lib/dev-log";
import ActivityBadges from "@/components/ActivityBadges";
import type { ScanMode, ScanHistoryItem } from "@/lib/types";
import { Apple, UtensilsCrossed, Sparkles, Pill } from "lucide-react";

/* ── tip arrays ── */
const FOOD_TIPS = [
  "Granola 'fit' ma często więcej cukru i kalorii niż zwykłe płatki owsiane za 3 zł",
  "'Proteinowy' jogurt za 8 zł vs zwykły Skyr za 4 zł — sprawdź skład, będziesz w szoku",
  "Produkt 'bez cukru' może mieć syrop glukozowo-fruktozowy — to TEN SAM cukier, inna nazwa",
  "Baton 'FIT' za 7 zł: 380 kcal, 18g cukru. Banan za 1 zł: 107 kcal, zero przetworzenia",
  "Napis 'FIT' na opakowaniu nie jest regulowany prawnie. Każdy może go użyć. Nawet na cukierkach",
  "Masło orzechowe 'fit' za 25 zł vs zwykłe 100% orzechów za 12 zł — ten sam skład, inna etykieta",
  "Owsianka 'proteinowa' za 8 zł = płatki owsiane za 2 zł + łyżka białka. Dopłacasz 6 zł za mieszanie",
  "Chleb 'fit' za 9 zł i zwykły żytni za 4 zł mają prawie identyczny skład. Płacisz za opakowanie",
  "Woda 'witaminowa' za 6 zł: cukier + aromaty + grosze witamin. Zwykła woda + owoc = lepiej i taniej",
  "Płatki śniadaniowe 'pełnoziarniste' mają tyle cukru co ciastka. Sprawdź tył opakowania, nie przód",
  "Porcja na opakowaniu to często 30g. A kto je 30g chipsów? Mnóż kalorie ×3 dla realnej porcji",
  "Składniki na etykiecie są od największej ilości. Jeśli cukier jest drugi — to głównie cukier jesz",
];

const COSMETIC_TIPS = [
  "Krem za 120 zł i za 25 zł mogą mieć IDENTYCZNY skład INCI. Różnica to opakowanie i marketing",
  "'Dermatologicznie testowany' nie znaczy 'zatwierdzony'. Każdy krem można 'przetestować'",
  "'Naturalny' kosmetyk może zawierać 95% chemii. Słowo 'naturalny' nie jest regulowane prawnie",
  "Kwas hialuronowy za 15 zł działa tak samo jak za 200 zł — to ten sam składnik",
  "Większość kremów przeciwzmarszczkowych za 50+ nie ma składników które naprawdę działają",
  "3 składniki które NAPRAWDĘ działają: retinol, witamina C, niacynamid. Reszta to marketing",
  "'Bez parabenów' to nie zawsze plus — zamienniki mogą być gorsze od parabenów",
  "SPF w kremie na dzień to za mało. Potrzebujesz osobnego filtra SPF 30+ każdego dnia",
  "Drogie serum z 'peptydami' może mieć ich 0.001%. Sprawdź pozycję na liście składników",
  "Perfumy (Fragrance/Parfum) to najczęstsza przyczyna alergii skórnych. A są prawie wszędzie",
  "Skład jest podany od największego do najmniejszego stężenia. 'Super składnik' na końcu = śladowe ilości",
  "Kolagen w kremie NIE wnika w skórę — cząsteczki są za duże. Ale nawilża powierzchnię",
];

const MEAL_TIPS = [
  "Sos i dressing to ukryte kalorie — AI je doliczy!",
  "Obiad babci to zwykle 800-1200 kcal. Ciekawe ile Twój?",
  "Restauracyjne porcje mają średnio 2x więcej kalorii niż domowe",
  "Zdjęcie z góry daje najlepszą estymację — AI widzi proporcje",
  "Kebab o 3 w nocy? AI nie ocenia, ale kalorie policzy",
];

const SUPLEMENT_TIPS = [
  "Magnez w formie tlenku ma przyswajalność ~4%. Cytrynian lub bisglicynian — nawet 40%",
  "Kreatyna monohydrat to jedyny suplement siłowy z naprawdę mocnymi dowodami naukowymi",
  "Witaminę D3 bierz z tłuszczem — jest rozpuszczalna w tłuszczach i bez niego się nie wchłonie",
  "BCAA przy diecie bogatej w białko to wyrzucone pieniądze — wszystko masz w jedzeniu",
  "Omega-3: liczy się ilość EPA+DHA, nie objętość kapsułki. Sprawdź tył opakowania",
  "Żelazo i wapń konkurują o wchłanianie — nie bierz ich razem. Odstęp min. 2 godziny",
  "Kolagen w tabletkach rozkłada się na aminokwasy — nie trafia bezpośrednio do stawów",
  "Witamina C poprawia wchłanianie żelaza — bierz je razem",
  "Suplementy 'all-in-one' często mają dawki poniżej skutecznych — sprawdź każdy składnik",
  "Probiotyki bierz na pusty żołądek — kwas żołądkowy po posiłku je niszczy",
  "Kurkumina bez piperyny ma przyswajalność ~2%. Z piperyną — nawet 2000% więcej",
  "Białko serwatkowe to nie 'chemia' — to wyizolowane białko z mleka, nic więcej",
];

/* ── accent config per mode ── */
const ACCENT_MAP: Record<string, { hex: string; rgb: string }> = {
  food:      { hex: "#6efcb4", rgb: "110,252,180" },
  meal:      { hex: "#FBBF24", rgb: "251,191,36" },
  cosmetics: { hex: "#C084FC", rgb: "192,132,252" },
  suplement: { hex: "#3b82f6", rgb: "59,130,246" },
};

/* ── MicButton component ── */
function MicButton({ accentRgb, onPress }: { accentRgb: string; onPress?: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    // Show tooltip on first visit
    if (!localStorage.getItem("micTooltipShown")) {
      setShowTooltip(true);
      const timer = setTimeout(() => {
        setShowTooltip(false);
        localStorage.setItem("micTooltipShown", "1");
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Show NEW badge until first mic use
    if (!localStorage.getItem("voiceUsed")) {
      setShowBadge(true);
    }
  }, []);

  const handleMicClick = () => {
    devLog("[MicButton] clicked");
    setShowTooltip(false);
    localStorage.setItem("micTooltipShown", "1");
    if (!localStorage.getItem("voiceUsed")) {
      localStorage.setItem("voiceUsed", "1");
      setShowBadge(false);
    }
    onPress?.();
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 10px)", right: 0,
          padding: "8px 14px", borderRadius: 10,
          background: "rgba(110,252,180,0.15)", border: "1px solid rgba(110,252,180,0.25)",
          color: "#6efcb4", fontSize: 12, fontWeight: 600,
          whiteSpace: "nowrap", zIndex: 10,
          animation: "micTooltipFade 0.3s ease",
        }}>
          Powiedz co zjadłeś!
          <div style={{
            position: "absolute", bottom: -5, right: 18, width: 10, height: 10,
            background: "rgba(110,252,180,0.15)", border: "1px solid rgba(110,252,180,0.25)",
            borderTop: "none", borderLeft: "none",
            transform: "rotate(45deg)",
          }} />
        </div>
      )}
      {/* NEW badge */}
      {showBadge && (
        <span style={{
          position: "absolute", top: -4, right: -4, zIndex: 10,
          fontSize: 8, padding: "2px 6px", borderRadius: 6,
          background: "#6efcb4", color: "#0a0e0c", fontWeight: 700,
        }}>NEW</span>
      )}
      {/* Mic button */}
      <button
        onClick={handleMicClick}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(110,252,180,0.12)",
          border: "1.5px solid rgba(110,252,180,0.25)",
          cursor: "pointer",
          animation: "micPulse 2.5s ease-in-out infinite",
          transition: "all 0.2s",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6efcb4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="1" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="8" y1="21" x2="16" y2="21" />
        </svg>
      </button>
    </div>
  );
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // State-based lock — disables button + blocks onChange
  const scanLockRef = useRef(false); // Synchronous ref lock (backup guard, same lifecycle as isScanning)
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ScanMode>("food");
  const [tipIndex, setTipIndex] = useState(0);
  const [showSkinQuiz, setShowSkinQuiz] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [secondPhotoPreview, setSecondPhotoPreview] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<"camera" | "gallery">("camera");
  const [awaitingSecondPhoto, setAwaitingSecondPhoto] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [voiceInitialText, setVoiceInitialText] = useState<string | undefined>(undefined);
  // Remember the last attempted scan so the error banner can offer "Ponów skan"
  const [lastScanArgs, setLastScanArgs] = useState<{ kind: "scan" | "fridge"; base64: string } | null>(null);
  const router = useRouter();

  const submitFoodSearch = () => {
    const trimmed = foodSearchQuery.trim();
    if (!trimmed) return;
    setVoiceInitialText(trimmed);
    setShowVoice(true);
    setFoodSearchQuery("");
  };

  const fridgeInputRef = useRef<HTMLInputElement>(null);
  const secondCameraInputRef = useRef<HTMLInputElement>(null);
  const secondGalleryInputRef = useRef<HTMLInputElement>(null);

  // Only food keeps the 2-photo preview flow. Cosmetics and suplement go
  // straight to OCR → AI analysis after a single photo, matching the user
  // expectation of "take one photo of the ingredients and get a result".
  const showPhotoPreview = mode === "food";

  const accent = ACCENT_MAP[mode] || ACCENT_MAP.food;

  useEffect(() => {
    setMode(getSavedMode());
  }, []);

  // Lock body scroll when PhotoPreview is open
  useEffect(() => {
    const isOpen = !isLoading && !!photoPreview && showPhotoPreview;
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [photoPreview, isLoading, showPhotoPreview]);

  // Safety: auto-reset stuck scan lock after 10s
  useEffect(() => {
    if (isScanning) {
      const timeout = setTimeout(() => {
        console.warn("[ScanLock] Auto-reset after 10s timeout");
        setIsScanning(false);
        scanLockRef.current = false;
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isScanning]);

  // Filter recent scans by current mode
  useEffect(() => {
    const all = getHistory();
    const filtered = all.filter((item) => (item.scanType || "food") === mode);
    setRecentScans(filtered.slice(0, 3));
  }, [mode]);

  useEffect(() => {
    const tips = mode === "cosmetics" ? COSMETIC_TIPS : mode === "meal" ? MEAL_TIPS : FOOD_TIPS;
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [mode]);

  const handleModeChange = (newMode: ScanMode) => {
    setMode(newMode);
    saveMode(newMode);
    setError(null);
    setTipIndex(0);
    if (newMode === "cosmetics" && !hasSkinProfile()) {
      setShowSkinQuiz(true);
    }
  };

  const handleScan = useCallback(
    async (base64: string) => {
      // Synchronous lock — prevents double scanning even with rapid calls
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setError(null);
      setLastScanArgs({ kind: "scan", base64 });
      const { allowed } = checkFreeTierLimit();
      if (!allowed) {
        scanLockRef.current = false;
        router.push("/premium?reason=limit");
        return;
      }
      if (!navigator.onLine) { setError("Brak połączenia z internetem."); scanLockRef.current = false; return; }
      setIsLoading(true);
      setLoadingMessage(undefined);

      const skinProfile = mode === "cosmetics" ? (() => {
        try { return JSON.parse(localStorage.getItem("skladai_skin_profile") || "null"); } catch { return null; }
      })() : null;

      const DUAL_SEP = "|||SECOND|||";

      const doScan = async (imageData: string) => {
        let primaryImg = imageData;
        let secondImg: string | undefined;
        if (imageData.includes(DUAL_SEP)) {
          const parts = imageData.split(DUAL_SEP);
          primaryImg = parts[0];
          secondImg = parts[1];
        }

        const controller = new AbortController();
        // Vercel serverless functions are capped at maxDuration=60s. Giving
        // the client a 70s budget leaves ~10s for the server to send a 504
        // if it dies, without making the user stare at a spinner for 90+
        // seconds per attempt when the network is bad.
        const timeout = setTimeout(() => controller.abort(), 70000);
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              image: primaryImg,
              ...(secondImg ? { image2: secondImg } : {}),
              mode,
              ...(skinProfile ? { skinProfile } : {}),
            }),
          });
          clearTimeout(timeout);
          let data;
          try { data = await res.json(); } catch {
            throw new Error(`server_${res.status}`);
          }
          // Include the HTTP status code in the message so the retry logic
          // below (which matches on "504"/"413"/"500"/"422" substrings) can
          // correctly detect transient errors even when the server returned
          // a localized Polish error string.
          if (!res.ok) throw new Error(`error_${res.status}: ${data.error || ""}`);
          return data;
        } catch (err) {
          clearTimeout(timeout);
          if (err instanceof Error && err.name === "AbortError") {
            throw new Error("timeout_504");
          }
          throw err;
        }
      };

      try {
        let data;
        try {
          data = await doScan(base64);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("504") || msg.includes("413") || msg.includes("server_504")) {
            // Timeout/too large — retry with smaller image
            setLoadingMessage("Ponawianie z mniejszym zdjęciem...");
            const smallerImage = await compressImageSmall(base64);
            data = await doScan(smallerImage);
          } else if (msg.includes("500") || msg.includes("422") || msg.includes("error_500") || msg.includes("error_422")) {
            // Server/parsing error — silent retry once with same image
            setLoadingMessage("Ponawianie analizy...");
            data = await doScan(base64);
          } else {
            throw err;
          }
        }

        incrementScanCount();
        updateStreak();
        const canvas = document.createElement("canvas");
        const img = new window.Image();
        img.src = base64;
        await new Promise((resolve) => { img.onload = resolve; });
        canvas.width = 96; canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, 96, 96);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.5);
        const historyItem = addToHistory(data, thumbnail, mode);
        router.push(`/wyniki/${historyItem.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // Strip internal "error_NNN: " / "server_NNN" prefixes before showing to user.
        const cleanMsg = msg.replace(/^(error_\d+:\s*|server_\d+\s*:?\s*|timeout_\d+\s*:?\s*)/, "").trim();
        if (msg.includes("504") || msg.includes("timeout")) {
          setError("Nie udało się przeanalizować produktu. Spróbuj ponownie — upewnij się, że etykieta ze składem jest dobrze widoczna.");
        } else {
          setError(cleanMsg || "Wystąpił błąd. Spróbuj ponownie.");
        }
      } finally { setIsLoading(false); setIsScanning(false); scanLockRef.current = false; }
    },
    [router, mode]
  );

  const handleFridgeScan = useCallback(
    async (base64: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setError(null);
      setLastScanArgs({ kind: "fridge", base64 });
      const { allowed } = checkFreeTierLimit();
      if (!allowed) { scanLockRef.current = false; router.push("/premium?reason=limit"); return; }
      if (!navigator.onLine) { setError("Brak połączenia z internetem."); scanLockRef.current = false; return; }
      setIsLoading(true);
      setLoadingMessage("Skanuję lodówkę...");
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mode: "fridge_scan" }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Błąd."); setIsLoading(false); return; }
        incrementScanCount();
        updateStreak();
        if (data.products && Array.isArray(data.products)) {
          const productNames = data.products.map((p: { name: string }) => p.name).join(", ");
          localStorage.setItem("skladai_fridge_products", productNames);
        }
        const canvas = document.createElement("canvas");
        const img = new window.Image();
        img.src = base64;
        await new Promise((resolve) => { img.onload = resolve; });
        canvas.width = 96; canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, 96, 96);
        const thumbnail = canvas.toDataURL("image/jpeg", 0.5);
        data.type = "fridge";
        const historyItem = addToHistory(data, thumbnail, "food" as ScanMode);
        router.push(`/wyniki/${historyItem.id}`);
      } catch { setError("Nie udało się przeanalizować produktu. Spróbuj ponownie — upewnij się, że etykieta ze składem jest dobrze widoczna."); }
      finally { setIsLoading(false); scanLockRef.current = false; }
    },
    [router]
  );

  const isCosmetics = mode === "cosmetics";
  const isMeal = mode === "meal";
  const isSuplement = mode === "suplement";
  const tips = isSuplement ? SUPLEMENT_TIPS : isMeal ? MEAL_TIPS : isCosmetics ? COSMETIC_TIPS : FOOD_TIPS;

  /* ── helper: handle direct camera file for the custom viewfinder ── */
  const handleDirectFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, isFridge?: boolean) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      e.target.value = "";
      // For fridge, use compressImage default; for regular, use compressImage from Scanner
      // We delegate to Scanner component for preview/dual-photo logic,
      // but for fridge we handle directly
      if (isFridge && handleFridgeScan) {
        const { compressImage } = await import("@/lib/compress");
        const compressed = await compressImage(file);
        handleFridgeScan(compressed);
      }
    },
    [handleFridgeScan]
  );

  const onFridgeInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await handleDirectFile(e, true);
    },
    [handleDirectFile]
  );

  /* ── time-ago helper ── */
  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "teraz";
    if (mins < 60) return `${mins} min temu`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h temu`;
    const days = Math.floor(hrs / 24);
    return `${days}d temu`;
  }

  function getScoreColor(score: number): string {
    if (score >= 7) return "#22c55e";
    if (score >= 4) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <div className="min-h-[100dvh] relative overflow-hidden" style={{ background: "#0a0f0d" }}>
      {/* ── Floating blobs ── */}
      <div
        className="fixed top-[-10%] left-[-5%] w-72 h-72 rounded-full opacity-30 pointer-events-none"
        style={{ background: "#10b981", filter: "blur(50px)", animation: "float1 9s ease-in-out infinite" }}
      />
      <div
        className="fixed top-[30%] right-[-10%] w-60 h-60 rounded-full opacity-25 pointer-events-none"
        style={{ background: "#06b6d4", filter: "blur(45px)", animation: "float2 8s ease-in-out infinite" }}
      />
      <div
        className="fixed bottom-[10%] left-[20%] w-56 h-56 rounded-full opacity-20 pointer-events-none"
        style={{ background: "#34d399", filter: "blur(40px)", animation: "float3 10s ease-in-out infinite" }}
      />
      <div
        className="fixed top-[60%] right-[30%] w-40 h-40 rounded-full opacity-15 pointer-events-none"
        style={{ background: "#10b981", filter: "blur(50px)", animation: "float1 7s ease-in-out infinite reverse" }}
      />

      {/* ── Film grain overlay ── */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-md mx-auto px-5 pb-28">
        {/* ══ 1. TOP BAR ══ */}
        <div className="flex items-center justify-between pt-6 pb-4 anim-fade-up">
          <h1 className="text-[28px] font-black tracking-[-1px]">
            <span className="text-white">Skład</span>
            <span style={{ color: accent.hex, textShadow: `0 0 20px ${accent.hex}60` }} className="transition-colors duration-300">AI</span>
          </h1>
          <ActivityBadges theme="dark" />
        </div>

        {/* ══ 2. HEADLINE ══ */}
        {(() => {
          const headlines: Record<string, { line1: string; accent: string; line2: string; sub: string }> = {
            food:      { line1: "Sprawdź co", accent: "naprawdę", line2: "jesz",              sub: "Zrób zdjęcie etykiety. AI przeanalizuje skład." },
            meal:      { line1: "Sprawdź co", accent: "naprawdę", line2: "jesz",              sub: "Zrób zdjęcie dania. AI oszacuje kalorie." },
            cosmetics: { line1: "Sprawdź co", accent: "nakładasz", line2: "na skórę",         sub: "Zrób zdjęcie składu (tył opakowania)" },
            suplement: { line1: "Sprawdź swój", accent: "suplement", line2: "witaminowy",      sub: "Zrób zdjęcie składu (tył opakowania)" },
          };
          const h = headlines[mode] || headlines.food;
          return (
            <div className="text-center mt-2 mb-7 anim-fade-up-1">
              <h2 className="text-[26px] font-extrabold text-white leading-tight">
                {h.line1}{" "}
                <span style={{ color: accent.hex, textShadow: `0 0 30px ${accent.hex}50` }} className="transition-colors duration-300">
                  {h.accent}
                </span>{" "}
                {h.line2}
              </h2>
              <p className="text-[13px] mt-2 font-medium transition-all duration-300" style={{ color: "rgba(255,255,255,0.55)" }}>
                {h.sub}
              </p>
            </div>
          );
        })()}

        {/* ══ 3. SUB-TABS ══ */}
        <div
          className="rounded-2xl p-1 mb-6 anim-fade-up-2"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex gap-1">
            {([
              { id: "food" as ScanMode, Icon: Apple, label: "Żywność", color: "#6efcb4" },
              { id: "meal" as ScanMode, Icon: UtensilsCrossed, label: "Danie", color: "#FBBF24" },
              { id: "cosmetics" as ScanMode, Icon: Sparkles, label: "Kosmetyk", color: "#C084FC" },
              { id: "suplement" as ScanMode, Icon: Pill, label: "Suplement", color: "#3b82f6" },
            ]).map((tab) => {
              const isActive = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleModeChange(tab.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-1 text-[12px] rounded-xl font-semibold transition-all duration-300"
                  style={{
                    backgroundColor: isActive ? `${tab.color}15` : "transparent",
                    color: isActive ? tab.color : "rgba(255,255,255,0.55)",
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  <tab.Icon size={15} strokeWidth={2.2} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Morning After (food mode only) ── */}
        {mode === "food" && <MorningAfter />}

        {/* ══ Loading state ══ */}
        {isLoading && (
          <Scanner onScan={handleScan} isLoading={isLoading} mode={mode} loadingMessage={loadingMessage} onFridgeScan={handleFridgeScan} />
        )}

        {/* ══ Photo Preview (between photo and analysis) ══ */}
        {!isLoading && photoPreview && showPhotoPreview && (
          <div data-scrollable="true" className="anim-fade-up-2" style={{ position: "fixed", inset: 0, zIndex: 150, background: "#0a0e0c", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 14px" }}>
            <PhotoPreview
              mode={mode as "food" | "cosmetics" | "suplement"}
              source={photoSource}
              photo1={photoPreview}
              photo2={secondPhotoPreview}
              onAddSecondPhoto={async () => {
                devLog("[SecondPhoto] click — source:", photoSource, "mode:", mode, "isNative:", isNative());
                setAwaitingSecondPhoto(true);
                const src: "camera" | "gallery" = photoSource;
                const fallbackRef = src === "camera" ? secondCameraInputRef : secondGalleryInputRef;
                try {
                  if (isNative()) {
                    devLog("[SecondPhoto] trying native takePhotoForMode");
                    const base64 = await takePhotoForMode(mode, src);
                    devLog("[SecondPhoto] native result:", base64 ? `ok (${base64.length} chars)` : "null (user cancelled)");
                    if (base64) {
                      const clamped = await clampBase64Size(base64, CAMERA_CLAMP_KB(mode));
                      setSecondPhotoPreview(clamped);
                    }
                    setAwaitingSecondPhoto(false);
                  } else {
                    devLog("[SecondPhoto] web — clicking hidden input");
                    fallbackRef.current?.click();
                  }
                } catch (err) {
                  console.error("[SecondPhoto] native camera failed, falling back to file input:", err);
                  // Fallback: hidden file input works in WKWebView too
                  fallbackRef.current?.click();
                  // Don't reset awaitingSecondPhoto — the hidden input's onChange will handle it
                }
              }}
              onAnalyzeSingle={() => {
                const img = photoPreview;
                setPhotoPreview(null); setSecondPhotoPreview(null);
                handleScan(img);
              }}
              onAnalyzeBoth={() => {
                if (photoPreview && secondPhotoPreview) {
                  const combined = photoPreview + "|||SECOND|||" + secondPhotoPreview;
                  setPhotoPreview(null); setSecondPhotoPreview(null);
                  handleScan(combined);
                }
              }}
              onRetakePhoto1={() => {
                setPhotoPreview(null); setSecondPhotoPreview(null);
                if (photoSource === "camera") {
                  (document.getElementById("main-camera-input") as HTMLInputElement)?.click();
                } else {
                  (document.getElementById("gallery-input") as HTMLInputElement)?.click();
                }
              }}
              onRetakePhoto2={async () => {
                devLog("[RetakePhoto2] click — source:", photoSource, "mode:", mode);
                setSecondPhotoPreview(null);
                setAwaitingSecondPhoto(true);
                const src: "camera" | "gallery" = photoSource;
                const fallbackRef = src === "camera" ? secondCameraInputRef : secondGalleryInputRef;
                try {
                  if (isNative()) {
                    const base64 = await takePhotoForMode(mode, src);
                    if (base64) {
                      const clamped = await clampBase64Size(base64, CAMERA_CLAMP_KB(mode));
                      setSecondPhotoPreview(clamped);
                    }
                    setAwaitingSecondPhoto(false);
                  } else {
                    fallbackRef.current?.click();
                  }
                } catch (err) {
                  console.error("[RetakePhoto2] native camera failed, falling back to file input:", err);
                  fallbackRef.current?.click();
                }
              }}
              onBack={() => { setPhotoPreview(null); setSecondPhotoPreview(null); setAwaitingSecondPhoto(false); }}
            />
            {/* Hidden inputs for second photo */}
            {/* Hidden inputs for second photo — only used for food (showPhotoPreview guard) */}
            <input ref={secondCameraInputRef} type="file" accept="image/*" capture="environment" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !file.type.startsWith("image/")) return;
              const fileClone = new File([file], file.name, { type: file.type });
              e.target.value = "";
              try {
                const { compressImage } = await import("@/lib/compress");
                const compressed = await compressImage(fileClone, 2000);
                const clamped = await clampBase64Size(compressed, CAMERA_CLAMP_KB(mode));
                setSecondPhotoPreview(clamped);
                setAwaitingSecondPhoto(false);
              } catch { setAwaitingSecondPhoto(false); }
            }} className="hidden" />
            <input ref={secondGalleryInputRef} type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !file.type.startsWith("image/")) return;
              const fileClone = new File([file], file.name, { type: file.type });
              e.target.value = "";
              try {
                const { compressImage } = await import("@/lib/compress");
                const compressed = await compressImage(fileClone, 2000);
                const clamped = await clampBase64Size(compressed, CAMERA_CLAMP_KB(mode));
                setSecondPhotoPreview(clamped);
                setAwaitingSecondPhoto(false);
              } catch { setAwaitingSecondPhoto(false); }
            }} className="hidden" />
          </div>
        )}

        {/* ══ 4. VIEWFINDER (main CTA) ══ */}
        {!isLoading && !photoPreview && (
          <div className="anim-fade-up-2">
            {/* Neon viewfinder */}
            <div className="flex flex-col items-center mb-5">
              <button
                disabled={isLoading || isScanning}
                onClick={async () => {
                  if (isLoading || isScanning) return;
                  if (isNative()) {
                    if (scanLockRef.current) return;
                    scanLockRef.current = true;
                    setIsScanning(true);
                    try {
                      const base64 = await takePhotoForMode(mode, "camera");
                      const clamped = base64 ? await clampBase64Size(base64, CAMERA_CLAMP_KB(mode)) : null;
                      scanLockRef.current = false;
                      setIsScanning(false);
                      if (clamped) {
                        if (showPhotoPreview) {
                          setPhotoSource("camera");
                          setPhotoPreview(clamped);
                          setSecondPhotoPreview(null);
                        } else {
                          handleScan(clamped);
                        }
                      }
                    } catch (err) {
                      setIsScanning(false);
                      scanLockRef.current = false;
                      console.error("[Scan] Native camera failed, falling back to file input:", err);
                      // Fallback: use file input (works in WKWebView)
                      const inp = document.getElementById("main-camera-input") as HTMLInputElement;
                      inp?.click();
                    }
                  } else {
                    const inp = document.getElementById("main-camera-input") as HTMLInputElement;
                    inp?.click();
                  }
                }}
                className="relative w-[220px] h-[220px] rounded-[36px] flex flex-col items-center justify-center active:scale-[0.96] transition-transform"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid rgba(${accent.rgb},0.1)`,
                  boxShadow: `0 0 30px rgba(${accent.rgb},0.05)`,
                  animation: "pulse-glow 3s ease-in-out infinite",
                  ["--accent-rgb" as string]: accent.rgb,
                }}
              >
                {/* 4 corner L-shapes */}
                <div className="absolute top-3 left-3 w-8 h-8 border-t-[3px] border-l-[3px] rounded-tl-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />
                <div className="absolute top-3 right-3 w-8 h-8 border-t-[3px] border-r-[3px] rounded-tr-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />
                <div className="absolute bottom-3 left-3 w-8 h-8 border-b-[3px] border-l-[3px] rounded-bl-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />
                <div className="absolute bottom-3 right-3 w-8 h-8 border-b-[3px] border-r-[3px] rounded-br-lg transition-colors duration-300" style={{ borderColor: accent.hex, boxShadow: `0 0 10px rgba(${accent.rgb},0.3), 0 0 20px rgba(${accent.rgb},0.1)` }} />

                {/* Animated scan line */}
                <div
                  className="absolute left-[15%] right-[15%] h-[2px] pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${accent.hex} 50%, transparent 100%)`,
                    opacity: 0.4,
                    animation: "scanline 2.8s ease-in-out infinite alternate",
                  }}
                />

                {/* Camera icon */}
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={accent.hex} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 mb-3 transition-colors duration-300">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>

                {/* SKANUJ text */}
                <span
                  className="text-[14px] font-bold tracking-[3px] uppercase transition-colors duration-300"
                  style={{ color: accent.hex, textShadow: `0 0 15px rgba(${accent.rgb},0.4)` }}
                >
                  SKANUJ
                </span>
              </button>

              {/* Hidden camera input */}
              <input id="main-camera-input" type="file" accept="image/*" capture="environment" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith("image/")) return;
                if (scanLockRef.current) return;
                scanLockRef.current = true;
                setIsScanning(true);
                const fileClone = new File([file], file.name, { type: file.type });
                e.target.value = "";
                try {
                  const { compressImage } = await import("@/lib/compress");
                  const maxDim = (mode === "cosmetics" || mode === "suplement") ? 1200 : 2000;
                  const compressed = await compressImage(fileClone, maxDim);
                  const clamped = await clampBase64Size(compressed, CAMERA_CLAMP_KB(mode));
                  scanLockRef.current = false;
                  setIsScanning(false);
                  if (awaitingSecondPhoto && showPhotoPreview) {
                    setSecondPhotoPreview(clamped);
                    setAwaitingSecondPhoto(false);
                  } else if (showPhotoPreview) {
                    setPhotoSource("camera");
                    setPhotoPreview(clamped);
                    setSecondPhotoPreview(null);
                  } else {
                    handleScan(clamped);
                  }
                } catch { setIsScanning(false); scanLockRef.current = false; }
              }} className="hidden" />
              <input id="gallery-input" type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !file.type.startsWith("image/")) return;
                if (scanLockRef.current) return;
                scanLockRef.current = true;
                setIsScanning(true);
                const fileClone = new File([file], file.name, { type: file.type });
                e.target.value = "";
                try {
                  const { compressImage } = await import("@/lib/compress");
                  const maxDim = (mode === "cosmetics" || mode === "suplement") ? 1200 : 2000;
                  const compressed = await compressImage(fileClone, maxDim);
                  const clamped = await clampBase64Size(compressed, CAMERA_CLAMP_KB(mode));
                  scanLockRef.current = false;
                  setIsScanning(false);
                  if (awaitingSecondPhoto && showPhotoPreview) {
                    setSecondPhotoPreview(clamped);
                    setAwaitingSecondPhoto(false);
                  } else if (showPhotoPreview) {
                    setPhotoSource("gallery");
                    setPhotoPreview(clamped);
                    setSecondPhotoPreview(null);
                  } else {
                    handleScan(clamped);
                  }
                } catch { setIsScanning(false); scanLockRef.current = false; }
              }} className="hidden" />

              {/* Sub-buttons: Lodówka (tylko Żywność) + Galeria (zawsze) */}
              <div className="flex gap-3 mt-4 w-full max-w-[280px]">
                {mode === "food" && (
                  <button
                    disabled={isLoading || isScanning}
                    onClick={async () => {
                      if (isLoading || isScanning) return;
                      if (isNative()) {
                        try {
                          const base64 = await takePhotoForMode("food", "camera");
                          if (base64) handleFridgeScan(base64);
                        } catch (err) {
                          console.error("[Fridge] Native camera failed, falling back:", err);
                          fridgeInputRef.current?.click();
                        }
                      } else { fridgeInputRef.current?.click(); }
                    }}
                    className="flex-[1.3] relative rounded-2xl py-3 px-3 text-center active:scale-[0.96] transition-all disabled:opacity-50"
                    style={{ background: `rgba(${accent.rgb},0.06)`, border: `1px solid rgba(${accent.rgb},0.12)` }}
                  >
                    <span className="absolute -top-1.5 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: accent.hex }}>NEW</span>
                    <span className="text-[13px] font-bold text-white/80 block">🧊 Lodówka</span>
                    <span className="text-[9px] text-white/50 block mt-0.5">Multi-skan AI</span>
                  </button>
                )}
                <button
                  disabled={isLoading || isScanning}
                  onClick={async () => {
                    if (isLoading || isScanning) return;
                    if (isNative()) {
                      if (scanLockRef.current) return;
                      scanLockRef.current = true;
                      setIsScanning(true);
                      try {
                        const base64 = await takePhotoForMode(mode, "gallery");
                        const clamped = base64 ? await clampBase64Size(base64, CAMERA_CLAMP_KB(mode)) : null;
                        scanLockRef.current = false;
                        setIsScanning(false);
                        if (clamped) {
                          if (showPhotoPreview) {
                            setPhotoSource("gallery");
                            setPhotoPreview(clamped);
                            setSecondPhotoPreview(null);
                          } else {
                            handleScan(clamped);
                          }
                        }
                      } catch (err) {
                        setIsScanning(false);
                        scanLockRef.current = false;
                        console.error("[Gallery] Native gallery failed, falling back to file input:", err);
                        (document.getElementById("gallery-input") as HTMLInputElement)?.click();
                      }
                    } else { (document.getElementById("gallery-input") as HTMLInputElement)?.click(); }
                  }}
                  className={`${mode === "food" ? "flex-[0.7]" : "flex-1"} rounded-2xl py-3 px-3 text-center active:scale-[0.96] transition-all disabled:opacity-50`}
                  style={{ background: `rgba(${accent.rgb},0.04)`, border: `1px solid rgba(${accent.rgb},0.08)` }}
                >
                  <span className="text-[13px] font-semibold text-white/60 block">🖼️ Galeria</span>
                </button>
              </div>
            </div>

            {/* Wyszukiwarka — glass dark style (tylko Żywność) */}
            {mode === "food" && (
              <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center px-4 py-3 gap-3">
                  <span className="text-white/50 text-[14px]">🔍</span>
                  <input
                    type="text"
                    value={foodSearchQuery}
                    onChange={(e) => setFoodSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitFoodSearch();
                      }
                    }}
                    placeholder="np. 2 jajka, kanapka z serem, kawa..."
                    className="flex-1 bg-transparent text-white/80 text-[13px] outline-none placeholder:text-white/40"
                  />
                  {foodSearchQuery.trim().length > 0 ? (
                    <button
                      type="button"
                      onClick={submitFoodSearch}
                      aria-label="Szukaj"
                      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                      style={{
                        background: "#6efcb4",
                        color: "#0a0f0d",
                        fontSize: 18,
                        fontWeight: 900,
                        border: "none",
                        boxShadow: "0 4px 12px rgba(110,252,180,0.25)",
                      }}
                    >
                      →
                    </button>
                  ) : (
                    <MicButton accentRgb={accent.rgb} onPress={() => { setVoiceInitialText(undefined); setShowVoice(true); }} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* (duplicate Scanner removed — already rendered above) */}

        {/* ══ Value prop banner (kosmetyk/suplement only) ══ */}
        {(isCosmetics || isSuplement) && !isLoading && (
          <div className="mt-4 rounded-2xl p-4 anim-fade-up-2" style={{
            background: isCosmetics ? "rgba(192,132,252,0.04)" : "rgba(59,130,246,0.04)",
            border: `1px solid ${isCosmetics ? "rgba(192,132,252,0.10)" : "rgba(59,130,246,0.10)"}`,
          }}>
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">💰</span>
              <div>
                <p className="text-[13px] font-bold text-white/80">{isCosmetics ? "Nie przepłacaj." : "Sprawdź gdzie kupisz taniej."}</p>
                <p className="text-[11px] text-white/55 mt-0.5 leading-relaxed">{isCosmetics ? "AI sprawdzi skład i pomoże znaleźć ten produkt w najlepszej cenie." : "AI oceni skład i dawki. Porównaj ceny na Ceneo i Allegro."}</p>
              </div>
            </div>
          </div>
        )}

        {/* ══ Quick link (suplement only) ══ */}
        {isSuplement && !isLoading && (
          <div className="mt-5 anim-fade-up-3">
            <a
              href="/suplement-academy"
              className="flex items-center gap-3.5 rounded-2xl p-4 active:scale-[0.97] transition-transform"
              style={{
                background: "rgba(59,130,246,0.04)",
                border: "1px solid rgba(59,130,246,0.10)",
              }}
            >
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl shrink-0">💊</div>
              <div>
                <span className="text-[13px] font-bold text-white/80 block">Suplement Academy</span>
                <span className="text-[10px] text-blue-400/70 block mt-0.5">Naucz się wybierać suplementy jak ekspert</span>
              </div>
              <span className="text-white/55 text-sm shrink-0 ml-auto">{"›"}</span>
            </a>
          </div>
        )}

        {/* ══ INCI Search + Quick links (cosmetics only) ══ */}
        {isCosmetics && !isLoading && (
          <div className="mt-5 space-y-3 anim-fade-up-3">
            <InciSearch />
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/rutyna", emoji: "🪞", label: "Moja rutyna" },
                { href: "/lazienka", emoji: "🚿", label: "Moja łazienka" },
                { href: "/beauty-academy", emoji: "📚", label: "Beauty Academy" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl p-3.5 text-center active:scale-[0.97] transition-transform"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-[20px] block">{link.emoji}</span>
                  <span className="text-[11px] font-bold text-white/60 mt-1 block">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ══ Error ══ */}
        {error && (
          <div
            className="mt-4 p-4 rounded-2xl"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.15)",
            }}
          >
            <p className="text-sm text-center font-semibold text-red-400">{error}</p>
            {lastScanArgs && !error.toLowerCase().includes("brak po\u0142\u0105czenia") && (
              <button
                onClick={() => {
                  const args = lastScanArgs;
                  setError(null);
                  if (args.kind === "fridge") handleFridgeScan(args.base64);
                  else handleScan(args.base64);
                }}
                className="mt-3 w-full py-2.5 rounded-xl font-bold text-[13px] active:scale-[0.97] transition-all"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#fca5a5",
                }}
              >
                🔄 Ponów skan
              </button>
            )}
          </div>
        )}

        {/* ══ 7. TIP BANNER (only cosmetics & suplement) ══ */}
        {(isCosmetics || isSuplement) && (
        <div
          className="mt-5 p-4 rounded-2xl anim-fade-up-3 transition-all duration-500"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid rgba(${accent.rgb},0.12)`,
            backdropFilter: "blur(10px)",
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-base mt-0.5">{isCosmetics ? "✨" : "💊"}</span>
            <div>
              <p
                className="text-[9px] tracking-[1.5px] uppercase font-semibold mb-1.5 transition-colors duration-300"
                style={{ color: accent.hex }}
              >
                PORADA
              </p>
              <p className="text-[12px] leading-relaxed font-medium text-white/60 transition-opacity duration-300">
                {tips[tipIndex]}
              </p>
            </div>
          </div>
        </div>
        )}

        {/* ══ Full History ══ */}
        <HistoryList isCosmetics={true} mode={mode} />
      </div>

      {/* ══ Skin profile quiz ══ */}
      {showSkinQuiz && (
        <SkinProfileSetup
          onComplete={() => setShowSkinQuiz(false)}
          onSkip={() => setShowSkinQuiz(false)}
        />
      )}

      {/* ── Hidden fridge input ── */}
      <input ref={fridgeInputRef} type="file" accept="image/*" capture="environment" onChange={onFridgeInputChange} className="hidden" />

      {/* ── Voice Log Modal ── */}
      {showVoice && (
        <VoiceLog
          mode="food"
          initialOpen={true}
          hideButton={true}
          initialText={voiceInitialText}
          onComplete={() => {
            setShowVoice(false);
            setVoiceInitialText(undefined);
          }}
          onClose={() => {
            setShowVoice(false);
            setVoiceInitialText(undefined);
          }}
        />
      )}
    </div>
  );
}
