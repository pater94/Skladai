"use client";

import { useEffect, useRef, useState } from "react";

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
  food: { accent: "#6efcb4", accentDark: "#3dd990", accentMid: "#50e89e", textOnButton: "#0a0f0d" },
  suplement: { accent: "#3b82f6", accentDark: "#1d4ed8", accentMid: "#2563eb", textOnButton: "#ffffff" },
  cosmetics: { accent: "#C084FC", accentDark: "#7c3aed", accentMid: "#a855f7", textOnButton: "#ffffff" },
};

const CHECKLIST: Record<string, { icon: string; title: string; desc: string }[]> = {
  food: [
    { icon: "\u{1F9EA}", title: "Sk\u0142ad / lista sk\u0142adnik\u00f3w", desc: "pe\u0142na lista z etykiety" },
    { icon: "\u{1F4CA}", title: "Tabela warto\u015bci od\u017cywczych", desc: "kalorie, bia\u0142ko, t\u0142uszcze, w\u0119glowodany" },
  ],
  suplement: [
    { icon: "\u{1F4CB}", title: "Nazwa suplementu", desc: "np. Witamina D3 2000 IU" },
    { icon: "\u{1F9EA}", title: "Pe\u0142ny sk\u0142ad / sk\u0142adniki", desc: "sk\u0142adniki aktywne i pomocnicze" },
    { icon: "\u2696\uFE0F", title: "Dawkowanie i porcja", desc: "ile tabletek, ile mg/\u00b5g" },
  ],
  cosmetics: [
    { icon: "\u{1F4CB}", title: "Nazwa kosmetyku", desc: "marka + typ produktu" },
    { icon: "\u{1F9EA}", title: "Pe\u0142na lista sk\u0142adnik\u00f3w", desc: "ca\u0142a lista Ingredients z opakowania" },
    { icon: "\u{1F4E6}", title: "Pojemno\u015b\u0107 i typ", desc: "np. 50ml, krem na noc" },
  ],
};

const HINTS: Record<string, string> = {
  food: "Nie zmie\u015bci\u0142o si\u0119 wszystko na jednym zdj\u0119ciu? Zr\u00f3b drugie \u2014 np. sk\u0142ad z jednej strony, tabela od\u017cywcza z drugiej.",
  suplement: "Nie zmie\u015bci\u0142o si\u0119 wszystko? Zr\u00f3b drugie zdj\u0119cie \u2014 np. dawkowanie z przodu, sk\u0142ad z ty\u0142u.",
  cosmetics: "Nie zmie\u015bci\u0142o si\u0119 wszystko? Zr\u00f3b drugie zdj\u0119cie \u2014 np. nazwa z przodu, lista sk\u0142adnik\u00f3w z ty\u0142u.",
};

const PHOTO_LABELS: Record<string, [string, string]> = {
  food: ["Sk\u0142adniki", "Warto\u015bci od\u017cywcze"],
  suplement: ["Prz\u00f3d", "Ty\u0142 / sk\u0142ad"],
  cosmetics: ["Prz\u00f3d", "Ty\u0142 / sk\u0142ad"],
};

const ANALYZE_LABELS: Record<string, string> = {
  food: "\u{1F52C} Analizuj produkt",
  suplement: "\u{1F52C} Analizuj suplement",
  cosmetics: "\u{1F52C} Analizuj kosmetyk",
};

const PHOTO_LABEL_SINGLE: Record<string, string> = {
  food: "Etykieta produktu",
  suplement: "Prz\u00f3d opakowania",
  cosmetics: "Prz\u00f3d opakowania",
};

function ScannerBrackets({ color, strokeWidth = 2.5, opacity = 0.7 }: { color: string; strokeWidth?: number; opacity?: number }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200" preserveAspectRatio="none">
      <defs>
        <filter id="bracketGlow">
          <feGaussianBlur stdDeviation="3" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" opacity={opacity} filter="url(#bracketGlow)">
        <path d="M 6 16 L 6 6 L 16 6" />
        <path d="M 184 6 L 194 6 L 194 16" />
        <path d="M 194 184 L 194 194 L 184 194" />
        <path d="M 16 194 L 6 194 L 6 184" />
      </g>
    </svg>
  );
}

export default function PhotoPreview({
  mode,
  source,
  photo1,
  photo2,
  onAddSecondPhoto,
  onAnalyzeSingle,
  onAnalyzeBoth,
  onRetakePhoto1,
  onRetakePhoto2,
  onBack,
}: PhotoPreviewProps) {
  const theme = THEMES[mode];
  const checklist = CHECKLIST[mode];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const isDual = photo2 !== null;

  if (isDual) {
    // ── DUAL PHOTO VIEW ──
    const labels = PHOTO_LABELS[mode];
    return (
      <div className="anim-fade-scale" style={{ padding: "0 2px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: `${theme.accent}1A`,
              border: "none", color: "#fff", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
          >
            &larr;
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Oba zdj\u0119cia</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10.5 }}>
              {source === "gallery" ? "Wybrano z galerii" : "Zrobiono aparatem"}
            </div>
          </div>
          <div style={{
            background: "rgba(34,197,94,0.15)", color: "#22c55e",
            fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 10,
          }}>
            \u2713 KOMPLET
          </div>
        </div>

        {/* Two photos side by side */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {[photo1, photo2].map((photo, i) => {
            const photoLabels = PHOTO_LABELS[mode];
            return (
              <div key={i} style={{
                flex: 1, height: 155, borderRadius: 16, overflow: "hidden", position: "relative",
                border: i === 0 ? "1.5px solid rgba(255,255,255,0.06)" : `1.5px solid ${theme.accent}45`,
                background: i === 1 ? `linear-gradient(160deg, ${theme.accent}0F, #0d1210)` : undefined,
              }}>
                <img src={photo!} alt={`Zdj\u0119cie ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <ScannerBrackets
                  color={i === 0 ? "rgba(255,255,255,0.1)" : theme.accent}
                  strokeWidth={1.5}
                  opacity={0.5}
                />
                {/* Center icon overlay */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  pointerEvents: "none",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: "rgba(255,255,255,0.05)",
                    backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18,
                  }}>
                    {i === 0 ? (source === "gallery" ? "\u{1F5BC}\uFE0F" : "\u{1F4F8}") : "\u{1F4CB}"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
                    {photoLabels[i]}
                  </div>
                </div>
                <span style={{
                  position: "absolute", top: 6, right: 6,
                  background: "rgba(0,0,0,0.6)", color: "#fff",
                  fontSize: 9, padding: "2px 6px", borderRadius: 6,
                }}>
                  {i + 1}/2
                </span>
                {i === 0 && (
                  <span style={{
                    position: "absolute", top: 6, left: 6,
                    fontSize: 12, background: "rgba(34,197,94,0.2)",
                    borderRadius: 6, padding: "1px 4px",
                  }}>
                    \u2713
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Labels */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          {labels.map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
              {label}
            </div>
          ))}
        </div>

        {/* Success card */}
        <div style={{
          background: "rgba(34,197,94,0.06)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(34,197,94,0.15)",
          borderRadius: 14, padding: 14,
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(34,197,94,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>
            \u2705
          </div>
          <div>
            <div style={{ color: "#22c55e", fontWeight: 700, fontSize: 12.5 }}>Gotowe do analizy</div>
            <div style={{ color: "rgba(34,197,94,0.6)", fontSize: 10.5 }}>AI po\u0142\u0105czy informacje z obu zdj\u0119\u0107</div>
          </div>
        </div>

        {/* Analyze button */}
        <button
          type="button"
          onClick={onAnalyzeBoth}
          style={{
            width: "100%", padding: 17, borderRadius: 14, border: "none",
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentMid}, ${theme.accentDark})`,
            backgroundSize: "200% 200%",
            animation: "gradientShift 3s ease infinite",
            boxShadow: `0 6px 24px ${theme.accent}40`,
            color: theme.textOnButton, fontWeight: 800, fontSize: 16,
            cursor: "pointer",
          }}
        >
          {ANALYZE_LABELS[mode]}
        </button>

        {/* Change photo links */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
          <button type="button" onClick={onRetakePhoto1} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.25)",
            fontSize: 11, cursor: "pointer",
          }}>
            {"\u{1F504}"} Zmie\u0144 zdj\u0119cie 1
          </button>
          <button type="button" onClick={onRetakePhoto2} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.25)",
            fontSize: 11, cursor: "pointer",
          }}>
            {"\u{1F504}"} Zmie\u0144 zdj\u0119cie 2
          </button>
        </div>
      </div>
    );
  }

  // ── SINGLE PHOTO VIEW ──
  return (
    <div className="anim-fade-scale" style={{ padding: "0 2px" }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
        width: 300, height: 200, pointerEvents: "none",
        background: `radial-gradient(circle, ${theme.accent}40, transparent)`,
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, position: "relative" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: `${theme.accent}1A`,
            border: "none", color: "#fff", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          &larr;
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Podgl\u0105d zdj\u0119cia</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10.5 }}>
            {source === "gallery" ? "Wybrano z galerii" : "Zrobiono aparatem"}
          </div>
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentDark})`,
          color: theme.textOnButton,
          fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 10,
        }}>
          ZDJ\u0118CIE 1
        </div>
      </div>

      {/* Photo container */}
      <div style={{
        width: "100%", height: 185, borderRadius: 18, overflow: "hidden",
        position: "relative",
        background: `linear-gradient(160deg, ${theme.accent}0F, #0d1210, ${theme.accent}03)`,
        marginBottom: 14,
      }}>
        <img src={photo1} alt="Zdj\u0119cie 1" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <ScannerBrackets color={theme.accent} />
        {/* Scan line */}
        <div className="absolute left-[10%] right-[10%]" style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${theme.accent}80, transparent)`,
          animation: "scanPulse 2.5s ease-in-out infinite",
        }} />
        {/* Center icon overlay */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}>
            {source === "gallery" ? "\u{1F5BC}\uFE0F" : "\u{1F4F8}"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
            {PHOTO_LABEL_SINGLE[mode]}
          </div>
        </div>
      </div>

      {/* Info box */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${theme.accent}21`,
        borderRadius: 16, padding: 14,
        position: "relative", overflow: "hidden",
        marginBottom: 12,
      }}>
        {/* Top gradient stripe */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${theme.accent}66, transparent)`,
        }} />

        <div style={{
          textTransform: "uppercase", letterSpacing: "0.04em",
          fontSize: 11.5, fontWeight: 800, color: theme.accent,
          marginBottom: 12,
        }}>
          AI POTRZEBUJE
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {checklist.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateX(0)" : "translateX(-8px)",
                transition: `all 0.4s cubic-bezier(.4,0,.2,1) ${i * 0.3}s`,
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: `${theme.accent}1A`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{item.title}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>{"\u{1F4A1}"}</span>
        <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
          {HINTS[mode]}
        </span>
      </div>

      {/* Main button — add second photo */}
      <div style={{
        padding: 2, borderRadius: 15,
        background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentDark}, ${theme.accent})`,
        backgroundSize: "200% 200%",
        animation: "gradientShift 3s ease infinite",
        marginBottom: 10,
      }}>
        <button
          type="button"
          onClick={onAddSecondPhoto}
          style={{
            width: "100%", background: "#0a0e0c", color: theme.accent,
            fontWeight: 800, fontSize: 15, borderRadius: 13, padding: 15,
            border: "none", cursor: "pointer",
          }}
        >
          {source === "gallery" ? "\u{1F5BC}\uFE0F Dodaj drugie zdj\u0119cie z galerii" : "\u{1F4F8} Dodaj drugie zdj\u0119cie"}
        </button>
      </div>

      {/* Secondary — analyze single */}
      <button
        type="button"
        onClick={onAnalyzeSingle}
        style={{
          width: "100%", border: "1px solid rgba(255,255,255,0.06)",
          background: "transparent", color: "rgba(255,255,255,0.35)",
          fontWeight: 600, fontSize: 13.5, borderRadius: 13, padding: "12px 0",
          cursor: "pointer",
        }}
      >
        Analizuj z jednym zdj\u0119ciem &rarr;
      </button>
    </div>
  );
}
