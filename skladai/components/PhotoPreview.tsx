"use client";

import { useEffect, useState } from "react";

interface PhotoPreviewProps {
  mode: "food" | "cosmetics" | "suplement";
  source: "camera" | "gallery";
  photo1: string;
  photo2: string | null;
  onAddSecondPhoto: () => void;
  onAnalyzeSingle: () => void;
  onAnalyzeBoth: () => void;
  onRetakePhoto1: () => void;
  onRetakePhoto2: () => void;
  onBack: () => void;
}

const THEMES = {
  food: {
    accent: "#6efcb4", accentDark: "#3dd990", accentMid: "#50e89e",
    accentLight: "rgba(110,252,180,0.10)", accentGlow: "rgba(110,252,180,0.25)",
    gradStart: "rgba(110,252,180,0.06)", gradEnd: "rgba(110,252,180,0.01)",
    darkBtn: true,
    checklist: [
      { icon: "🧪", text: "Skład / lista składników", desc: "pełna lista z etykiety" },
      { icon: "📊", text: "Tabela wartości odżywczych", desc: "kalorie, białko, tłuszcze, węglowodany" },
    ],
    hint: "Nie zmieściło się wszystko na jednym zdjęciu? Zrób drugie — np. skład z jednej strony, tabela odżywcza z drugiej.",
    p1: "Składniki", p2: "Wartości odżywcze", analyzeText: "produkt",
  },
  suplement: {
    accent: "#3b82f6", accentDark: "#1d4ed8", accentMid: "#2563eb",
    accentLight: "rgba(59,130,246,0.12)", accentGlow: "rgba(59,130,246,0.3)",
    gradStart: "rgba(59,130,246,0.06)", gradEnd: "rgba(59,130,246,0.01)",
    darkBtn: false,
    checklist: [
      { icon: "📋", text: "Nazwa suplementu", desc: "np. Witamina D3 2000 IU" },
      { icon: "🧪", text: "Pełny skład / składniki", desc: "składniki aktywne i pomocnicze" },
      { icon: "⚖️", text: "Dawkowanie i porcja", desc: "ile tabletek, ile mg/µg" },
    ],
    hint: "Nie zmieściło się wszystko? Zrób drugie zdjęcie — np. dawkowanie z przodu, skład z tyłu.",
    p1: "Przód", p2: "Tył / skład", analyzeText: "suplement",
  },
  cosmetics: {
    accent: "#C084FC", accentDark: "#7c3aed", accentMid: "#a855f7",
    accentLight: "rgba(192,132,252,0.12)", accentGlow: "rgba(192,132,252,0.3)",
    gradStart: "rgba(192,132,252,0.06)", gradEnd: "rgba(192,132,252,0.01)",
    darkBtn: false,
    checklist: [
      { icon: "📋", text: "Nazwa kosmetyku", desc: "marka + typ produktu" },
      { icon: "🧪", text: "Pełna lista składników", desc: "cała lista Ingredients z opakowania" },
      { icon: "📦", text: "Pojemność i typ", desc: "np. 50ml, krem na noc" },
    ],
    hint: "Nie zmieściło się wszystko? Zrób drugie zdjęcie — np. nazwa z przodu, lista składników z tyłu.",
    p1: "Przód", p2: "Tył / skład", analyzeText: "kosmetyk",
  },
};

export default function PhotoPreview({
  mode, source, photo1, photo2,
  onAddSecondPhoto, onAnalyzeSingle, onAnalyzeBoth,
  onRetakePhoto1, onRetakePhoto2, onBack,
}: PhotoPreviewProps) {
  const t = THEMES[mode];
  const bc = t.darkBtn ? "#0a0f0d" : "#fff";
  const [checkAnim, setCheckAnim] = useState(0);

  useEffect(() => {
    if (!photo2) {
      setCheckAnim(0);
      const timers = [
        setTimeout(() => setCheckAnim(1), 300),
        setTimeout(() => setCheckAnim(2), 600),
        setTimeout(() => setCheckAnim(3), 900),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [photo2, mode]);

  const isDual = photo2 !== null;

  // ── DUAL PHOTO VIEW ──
  if (isDual) {
    return (
      <div style={{ padding: "0 2px 120px" }} className="anim-fade-scale">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div onClick={onBack} style={{ width: 32, height: 32, borderRadius: 10, background: t.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}>←</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Oba zdjęcia</div>
          <div style={{ marginLeft: "auto", background: t.accentLight, color: t.accent, fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 10 }}>✓ KOMPLET</div>
        </div>

        {/* Two photos */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[photo1, photo2].map((photo, n) => (
            <div key={n} style={{
              flex: 1, height: 155, borderRadius: 16,
              background: `linear-gradient(160deg, ${n === 1 ? t.gradStart : "rgba(255,255,255,0.02)"}, #0d1210)`,
              border: n === 1 ? `1.5px solid ${t.accent}44` : "1.5px solid rgba(255,255,255,0.06)",
              position: "relative", overflow: "hidden",
            }}>
              <img src={photo!} alt={`Zdjęcie ${n + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
              {/* Mini scanner brackets */}
              <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
                <g stroke={n === 1 ? t.accent : "rgba(255,255,255,0.1)"} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5">
                  <path d="M12 35 L12 18 Q12 12 18 12 L35 12" /><path d="M138 12 L155 12 Q161 12 161 18 L161 35" />
                  <path d="M161 122 L161 139 Q161 145 155 145 L138 145" /><path d="M35 145 L18 145 Q12 145 12 139 L12 122" />
                </g>
              </svg>
              {/* Label */}
              <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: n === 1 ? t.accent : "rgba(255,255,255,0.55)" }}>
                  {n === 0 ? t.p1 : t.p2}
                </span>
              </div>
              {/* Badge */}
              <div style={{ position: "absolute", top: 8, right: 8, background: n === 1 ? t.accent : "rgba(255,255,255,0.1)", color: n === 1 && t.darkBtn ? "#0a0f0d" : "#fff", fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>{n + 1}/2</div>
              {/* Checkmark on photo 1 */}
              {n === 0 && <div style={{ position: "absolute", top: 8, left: 8, background: "#22c55e", color: "#fff", fontSize: 9, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>}
            </div>
          ))}
        </div>

        {/* Success card */}
        <div style={{ background: `${t.accent}0F`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: `1px solid ${t.accent}26`, borderRadius: 14, padding: "13px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: t.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✅</div>
          <div>
            <div style={{ fontSize: 12.5, color: t.accent, fontWeight: 700 }}>Gotowe do analizy</div>
            <div style={{ fontSize: 10.5, color: `${t.accent}99`, marginTop: 2 }}>AI połączy informacje z obu zdjęć</div>
          </div>
        </div>

        {/* Analyze button */}
        <button type="button" onClick={onAnalyzeBoth} style={{
          width: "100%", padding: 17, borderRadius: 14, border: "none",
          background: `linear-gradient(135deg, ${t.accent}, ${t.accentMid}, ${t.accentDark})`,
          backgroundSize: "200% 200%", animation: "gradientShift 3s ease infinite",
          color: bc, fontWeight: 800, fontSize: 16, cursor: "pointer",
          boxShadow: `0 6px 24px ${t.accentGlow}`, marginBottom: 12,
        }}>🔬 Analizuj {t.analyzeText}</button>

        {/* Change photo links */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          <button type="button" onClick={onRetakePhoto1} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer", padding: 6 }}>🔄 Zmień zdjęcie 1</button>
          <button type="button" onClick={onRetakePhoto2} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", fontSize: 11, cursor: "pointer", padding: 6 }}>🔄 Zmień zdjęcie 2</button>
        </div>
      </div>
    );
  }

  // ── SINGLE PHOTO VIEW ──
  return (
    <div style={{ padding: "0 2px 120px", position: "relative" }} className="anim-fade-scale">
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: 300, height: 120,
        background: `radial-gradient(ellipse, ${t.accentGlow}, transparent 70%)`,
        opacity: 0.4, pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div onClick={onBack} style={{ width: 32, height: 32, borderRadius: 10, background: t.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}>←</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Podgląd zdjęcia</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10.5, marginTop: 1 }}>{source === "gallery" ? "Wybrano z galerii" : "Zrobiono aparatem"}</div>
        </div>
        <div style={{ marginLeft: "auto", background: `linear-gradient(135deg, ${t.accent}, ${t.accentMid})`, color: bc, fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 10 }}>ZDJĘCIE 1</div>
      </div>

      {/* Photo with scanner brackets */}
      <div style={{ width: "100%", height: 185, borderRadius: 18, background: `linear-gradient(160deg, ${t.gradStart}, #0d1210, ${t.gradEnd})`, position: "relative", overflow: "hidden", marginBottom: 16 }}>
        <img src={photo1} alt="Zdjęcie" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
        {/* Scan line */}
        <div style={{ position: "absolute", left: 20, right: 20, top: "50%", height: 2, background: `linear-gradient(90deg, transparent, ${t.accent}80, transparent)`, animation: "scanPulse 2.5s ease-in-out infinite" }} />
        {/* Scanner brackets */}
        <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
          <defs><filter id="bGlow"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
          <g stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" fill="none" filter="url(#bGlow)" opacity="0.7">
            <path d="M24 55 L24 32 Q24 24 32 24 L55 24" /><path d="M260 24 L283 24 Q291 24 291 32 L291 55" />
            <path d="M291 132 L291 155 Q291 163 283 163 L260 163" /><path d="M55 163 L32 163 Q24 163 24 155 L24 132" />
          </g>
        </svg>
        {/* Center icon */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            {source === "gallery" ? "🖼️" : "📸"}
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
            {mode === "food" ? "Etykieta produktu" : "Przód opakowania"}
          </span>
        </div>
      </div>

      {/* Glass info card — AI POTRZEBUJE */}
      <div style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${t.accent}22`, borderRadius: 16, padding: "14px 14px 12px", marginBottom: 12, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${t.accent}60, transparent)` }} />
        <div style={{ fontSize: 11.5, fontWeight: 800, color: t.accent, marginBottom: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>AI potrzebuje</div>
        {t.checklist.map((item, i) => {
          const visible = i < checkAnim;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: i < t.checklist.length - 1 ? 10 : 0,
              opacity: visible ? 1 : 0.25, transform: visible ? "translateX(0)" : "translateX(-8px)",
              transition: `all 0.4s cubic-bezier(.4,0,.2,1) ${i * 0.15}s`,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: visible ? t.accentLight : "rgba(255,255,255,0.03)", border: `1px solid ${visible ? t.accent + "33" : "rgba(255,255,255,0.05)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: visible ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)", lineHeight: "17px" }}>{item.text}</div>
                <div style={{ fontSize: 10.5, color: visible ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)", lineHeight: "14px", marginTop: 1 }}>{item.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hint */}
      <div style={{ borderRadius: 12, padding: "10px 12px", marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.7 }}>💡</span>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: "16px" }}>{t.hint}</span>
      </div>

      {/* CTA — animated gradient border */}
      <div style={{ position: "relative", borderRadius: 15, padding: 2, background: `linear-gradient(135deg, ${t.accent}, ${t.accentDark}, ${t.accent})`, backgroundSize: "200% 200%", animation: "gradientShift 3s ease infinite", marginBottom: 10 }}>
        <button type="button" onClick={onAddSecondPhoto} style={{ width: "100%", padding: 15, borderRadius: 13, border: "none", background: "#0a0e0c", color: t.accent, fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {source === "gallery" ? "🖼️" : "📸"} Dodaj drugie zdjęcie
        </button>
      </div>

      {/* Secondary — analyze single */}
      <button type="button" onClick={onAnalyzeSingle} style={{ width: "100%", padding: 13, borderRadius: 13, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.55)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
        Analizuj z jednym zdjęciem →
      </button>
    </div>
  );
}
