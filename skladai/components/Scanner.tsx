"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { compressImage } from "@/lib/compress";
import { isNative, takePhotoForMode } from "@/lib/native-camera";
import type { ScanMode } from "@/lib/types";
import PhotoPreview from "./PhotoPreview";

interface ScannerProps {
  onScan: (base64: string) => void;
  isLoading: boolean;
  mode?: ScanMode;
  loadingMessage?: string;
  onFridgeScan?: (base64: string) => void;
  autoOpenGallery?: boolean;
}

export default function Scanner({ onScan, isLoading, mode = "food", loadingMessage, onFridgeScan, autoOpenGallery }: ScannerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fridgeInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [secondPreview, setSecondPreview] = useState<string | null>(null);
  const [awaitingSecond, setAwaitingSecond] = useState(false);
  const secondCameraRef = useRef<HTMLInputElement>(null);
  const secondGalleryRef = useRef<HTMLInputElement>(null);
  const [photoSource, setPhotoSource] = useState<"camera" | "gallery">("camera");

  useEffect(() => {
    if (autoOpenGallery && galleryInputRef.current) {
      const timer = setTimeout(() => { galleryInputRef.current?.click(); }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoOpenGallery]);

  const isCosmetics = mode === "cosmetics";
  const isForma = mode === "forma";
  const isSuplement = mode === "suplement";
  const isMealMode = mode === "meal";
  const isDark = isCosmetics || isForma || isSuplement || isMealMode;
  const showSecondPhotoOption = (mode === "food" || mode === "cosmetics" || mode === "suplement") && !isLoading;

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      try {
        const maxDim = (mode === "cosmetics" || mode === "suplement") ? 1200 : 2000;
        const compressed = await compressImage(file, maxDim);

        if (awaitingSecond) {
          // This is the second photo — store it
          setSecondPreview(compressed);
          setAwaitingSecond(false);
          return; // Don't scan yet — user will click "Analizuj oba"
        } else if (showSecondPhotoOption) {
          // First photo — show preview and option to add second
          setPreview(compressed);
          setSecondPreview(null);
        } else {
          // Non-label modes — scan immediately
          setPreview(compressed);
          onScan(compressed);
        }
      } catch (err) {
        console.error("Compression error:", err);
      }
    },
    [onScan, mode, awaitingSecond, preview, showSecondPhotoOption]
  );

  const handleScanSingle = () => {
    if (preview) {
      if (secondPreview) {
        // Two images — send with separator
        onScan(preview + "|||SECOND|||" + secondPreview);
      } else {
        onScan(preview);
      }
      setPreview(null);
      setSecondPreview(null);
    }
  };

  const handleAddSecond = () => {
    setAwaitingSecond(true);
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setSecondPreview(null);
    setAwaitingSecond(false);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Clone file reference before reset — Android may clear files array after native preview
    const fileClone = new File([file], file.name, { type: file.type });
    requestAnimationFrame(() => { e.target.value = ""; });
    handleFile(fileClone);
  };

  const onFridgeInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || !onFridgeScan) return;
    try {
      const compressed = await compressImage(file);
      setPreview(compressed);
      onFridgeScan(compressed);
    } catch (err) {
      console.error("Compression error:", err);
    }
    e.target.value = "";
  };

  // ── Native camera handlers (Capacitor) ──
  const handleNativeCamera = useCallback(async () => {
    if (!isNative()) return;
    const base64 = await takePhotoForMode(mode, "camera");
    if (!base64) return;
    setPhotoSource("camera");

    if (awaitingSecond && showSecondPhotoOption) {
      setSecondPreview(base64);
      setAwaitingSecond(false);
    } else if (showSecondPhotoOption) {
      setPreview(base64);
      setSecondPreview(null);
    } else {
      setPreview(base64);
      onScan(base64);
    }
  }, [mode, awaitingSecond, showSecondPhotoOption, onScan]);

  const handleNativeGallery = useCallback(async () => {
    if (!isNative()) return;
    const base64 = await takePhotoForMode(mode, "gallery");
    if (!base64) return;
    setPhotoSource("gallery");

    if (awaitingSecond && showSecondPhotoOption) {
      setSecondPreview(base64);
      setAwaitingSecond(false);
    } else if (showSecondPhotoOption) {
      setPreview(base64);
      setSecondPreview(null);
    } else {
      setPreview(base64);
      onScan(base64);
    }
  }, [mode, awaitingSecond, showSecondPhotoOption, onScan]);

  const handleNativeFridge = useCallback(async () => {
    if (!isNative() || !onFridgeScan) return;
    const base64 = await takePhotoForMode("food", "camera");
    if (!base64) return;
    setPreview(base64);
    onFridgeScan(base64);
  }, [onFridgeScan]);

  // Unified click handlers — use native if available, otherwise fall back to file input
  const openCamera = useCallback(() => {
    setPhotoSource("camera");
    if (isNative()) { handleNativeCamera(); }
    else { cameraInputRef.current?.click(); }
  }, [handleNativeCamera]);

  const openGallery = useCallback(() => {
    setPhotoSource("gallery");
    if (isNative()) { handleNativeGallery(); }
    else { galleryInputRef.current?.click(); }
  }, [handleNativeGallery]);

  const openFridge = useCallback(() => {
    if (isNative()) { handleNativeFridge(); }
    else { fridgeInputRef.current?.click(); }
  }, [handleNativeFridge]);

  const labels: Record<string, { main: string; gallery: string; loading: string }> = {
    food: { main: "Zrób zdjęcie etykiety", gallery: "Wybierz z galerii", loading: "Analizuję skład..." },
    cosmetics: { main: "Zrób zdjęcie składu", gallery: "Wybierz z galerii", loading: "Analizuję skład..." },
    suplement: { main: "Zrób zdjęcie etykiety", gallery: "Wybierz z galerii", loading: "Analizuję suplement..." },
    meal: { main: "Zrób zdjęcie dania", gallery: "Wybierz z galerii", loading: "Rozpoznaję danie..." },
    forma: { main: "Zrób CheckForm", gallery: "Wybierz z galerii", loading: "Analizuję formę..." },
    text_search: { main: "Zrób zdjęcie etykiety", gallery: "Wybierz z galerii", loading: "Analizuję..." },
  };
  const l = labels[mode] || labels.food;

  if (isLoading) {
    const spinnerOuter = isCosmetics ? "border-t-fuchsia-500" : isSuplement ? "border-t-blue-500" : isMealMode ? "border-t-orange-500" : isForma ? "border-t-[#F97316]" : "border-t-[#2D5A16]";
    const spinnerInner = isCosmetics ? "border-b-purple-400" : isSuplement ? "border-b-blue-400" : isMealMode ? "border-b-amber-400" : isForma ? "border-b-[#EF4444]" : "border-b-[#84CC16]";
    const progressBar = isCosmetics ? "from-fuchsia-500 via-purple-500 to-violet-500" : isSuplement ? "from-blue-500 via-blue-400 to-blue-500" : isMealMode ? "from-orange-500 via-amber-500 to-orange-500" : isForma ? "from-[#F97316] via-[#EF4444] to-[#F97316]" : "from-[#2D5A16] via-[#84CC16] to-[#2D5A16]";
    const emoji = isSuplement ? "💊" : isMealMode ? "🍽️" : isForma ? "💪" : "🔬";
    return (
      <div className={`rounded-[24px] p-8 anim-fade-scale ${isDark ? "velvet-card" : "card-elevated"}`}>
        <div className="flex flex-col items-center justify-center gap-6">
          <div className="relative w-28 h-28">
            <div className={`absolute inset-0 rounded-full border-[3px] ${isDark ? "border-white/5" : "border-gray-100"}`} />
            <div className={`absolute inset-0 rounded-full border-[3px] border-transparent ${spinnerOuter}`} style={{ animation: "spinSlow 1s linear infinite" }} />
            <div className={`absolute inset-2 rounded-full border-[2px] border-transparent ${spinnerInner}`} style={{ animation: "spinSlow 1.5s linear infinite reverse" }} />
            <span className="absolute inset-0 flex items-center justify-center text-5xl anim-float">
              {emoji}
            </span>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${isDark ? "text-white" : "text-[#1A3A0A]"}`}>
              {loadingMessage || l.loading}
            </p>
            <p className={`text-[13px] mt-1 font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>To potrwa kilka sekund</p>
          </div>
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/5" : "bg-gray-100"}`}>
            <div className={`h-full rounded-full bg-gradient-to-r ${progressBar}`} style={{ animation: "shimmer 1.5s infinite", backgroundSize: "200% 100%" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Premium photo preview for food/cosmetics/suplement */}
      {preview && !isLoading && showSecondPhotoOption && (
        <PhotoPreview
          mode={mode as "food" | "cosmetics" | "suplement"}
          source={photoSource}
          photo1={preview}
          photo2={secondPreview}
          onAddSecondPhoto={() => {
            setAwaitingSecond(true);
            if (photoSource === "camera") {
              if (isNative()) { handleNativeCamera(); } else { secondCameraRef.current?.click(); }
            } else {
              if (isNative()) { handleNativeGallery(); } else { secondGalleryRef.current?.click(); }
            }
          }}
          onAnalyzeSingle={() => {
            if (preview) { onScan(preview); setPreview(null); setSecondPreview(null); }
          }}
          onAnalyzeBoth={() => {
            if (preview && secondPreview) {
              onScan(preview + "|||SECOND|||" + secondPreview);
              setPreview(null);
              setSecondPreview(null);
            }
          }}
          onRetakePhoto1={() => {
            setPreview(null);
            setSecondPreview(null);
            if (photoSource === "camera") { openCamera(); } else { openGallery(); }
          }}
          onRetakePhoto2={() => {
            setSecondPreview(null);
            setAwaitingSecond(true);
            if (photoSource === "camera") {
              if (isNative()) { handleNativeCamera(); } else { secondCameraRef.current?.click(); }
            } else {
              if (isNative()) { handleNativeGallery(); } else { secondGalleryRef.current?.click(); }
            }
          }}
          onBack={handleCancelPreview}
        />
      )}

      {/* Hidden inputs for second photo */}
      <input ref={secondCameraRef} type="file" accept="image/*" capture="environment" onChange={onInputChange} className="hidden" />
      <input ref={secondGalleryRef} type="file" accept="image/*" onChange={onInputChange} className="hidden" />

      {/* Simple preview for non-label modes or during loading */}
      {preview && (isLoading || !showSecondPhotoOption) && (
        <div className={`rounded-[20px] p-3 mb-1 anim-fade-scale ${isCosmetics || isForma ? "velvet-card" : "card-elevated"}`}>
          <img src={preview} alt="Podgląd" className="w-full max-h-52 rounded-2xl object-contain" />
        </div>
      )}

      {/* Main camera button — unified premium design for ALL modes (hidden when PhotoPreview is showing) */}
      {!(preview && !isLoading && showSecondPhotoOption) && (() => {
        const themes: Record<string, { gradient: string; iconBg: string; iconStroke1: string; iconStroke2: string; subColor: string; subText: string; emoji: string }> = {
          food: { gradient: "linear-gradient(135deg, #1A3A0A 0%, #2D5A16 50%, #3D7A1F 100%)", iconBg: "rgba(132,204,22,0.12)", iconStroke1: "#BEF264", iconStroke2: "#84CC16", subColor: "rgba(132,204,22,0.9)", subText: "🔬 AI Vision przeanalizuje skład", emoji: "🔬" },
          cosmetics: { gradient: "linear-gradient(135deg, #6B21A8 0%, #9333EA 50%, #A855F7 100%)", iconBg: "rgba(232,121,249,0.12)", iconStroke1: "#F0ABFC", iconStroke2: "#E879F9", subColor: "rgba(232,121,249,0.9)", subText: "🔬 AI Vision przeanalizuje skład kosmetyku", emoji: "✨" },
          meal: { gradient: "linear-gradient(135deg, #C2410C 0%, #EA580C 50%, #F97316 100%)", iconBg: "rgba(251,191,36,0.12)", iconStroke1: "#FDE68A", iconStroke2: "#FBBF24", subColor: "rgba(251,191,36,0.9)", subText: "🔬 AI Vision rozpozna składniki i kalorie", emoji: "🍽️" },
          forma: { gradient: "linear-gradient(135deg, #F97316 0%, #EF4444 100%)", iconBg: "rgba(249,115,22,0.12)", iconStroke1: "#FDBA74", iconStroke2: "#F97316", subColor: "rgba(255,255,255,0.9)", subText: "✦ POWERED BY AI VISION", emoji: "🔥" },
        };
        const t = themes[mode] || themes.food;
        return (
          <button
            type="button"
            onClick={openCamera}
            className="w-full group relative overflow-hidden flex items-center gap-4 px-5 py-[22px] text-white rounded-[20px] active:scale-[0.97] transition-all duration-200 shadow-xl"
            style={{ background: t.gradient }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)" }} />
            <div className="absolute left-[20%] right-[20%] top-1/2 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${t.iconStroke2}40, transparent)` }} />
            <div className="relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: t.iconBg }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" stroke={t.iconStroke1} strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="7" y1="12" x2="17" y2="12" stroke={t.iconStroke2} strokeWidth="1.5" strokeDasharray="2 2"/>
              </svg>
            </div>
            <div className="relative">
              <span className="text-[17px] font-[800] block">{l.main}</span>
              <span className="text-[12px] font-semibold block mt-1.5" style={{
                color: t.subColor,
                ...(mode === "forma" ? { textTransform: "uppercase" as const, letterSpacing: "2px", fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.3)" } : {}),
              }}>{t.subText}</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent -translate-x-full group-active:translate-x-full transition-transform duration-700" />
          </button>
        );
      })()}

      {/* Secondary buttons — food: row with fridge + gallery, others: just gallery (hidden when PhotoPreview is showing) */}
      {!(preview && !isLoading && showSecondPhotoOption) && (!isCosmetics && !isMealMode && !isForma && onFridgeScan ? (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={openFridge}
            className="relative flex-[1.3] flex items-center justify-center gap-2 py-3.5 rounded-[16px] active:scale-[0.97] transition-all duration-200 font-bold text-[13px] text-[#2D5A16]"
            style={{ background: "linear-gradient(135deg, rgba(132,204,22,0.08), rgba(132,204,22,0.04))", border: "1.5px solid rgba(132,204,22,0.15)" }}
          >
            <span>🧊</span>
            <span>Skanuj lodówkę</span>
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[8px] font-bold text-white rounded-[4px]" style={{ background: "#84CC16" }}>NEW</span>
          </button>
          <button
            type="button"
            onClick={openGallery}
            className="flex-[0.7] flex items-center justify-center gap-2 py-3.5 bg-white rounded-[16px] shadow-sm active:scale-[0.97] transition-all duration-200 font-semibold text-[13px] text-[#1A3A0A]"
          >
            <span>🖼️</span>
            <span>Z galerii</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openGallery}
          className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-[18px] active:scale-[0.97] transition-all duration-200 ${
            isCosmetics
              ? "velvet-card text-white/70 font-semibold text-[14px]"
              : isForma
              ? "velvet-card text-white/70 font-semibold text-[14px]"
              : "card-elevated text-[#1A3A0A]/70 font-semibold text-[14px]"
          }`}
        >
          <span className="text-lg">🖼️</span>
          <span>{l.gallery}</span>
        </button>
      ))}

      {/* Hidden inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onInputChange} className="hidden" />
      {onFridgeScan && <input ref={fridgeInputRef} type="file" accept="image/*" capture="environment" onChange={onFridgeInputChange} className="hidden" />}
      <input ref={galleryInputRef} type="file" accept="image/*" onChange={onInputChange} className="hidden" />
    </div>
  );
}
