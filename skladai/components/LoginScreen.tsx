"use client";

interface LoginScreenProps {
  onSkip: () => void;
}

export default function LoginScreen({ onSkip }: LoginScreenProps) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-hidden"
      style={{ background: "#0a0e0c" }}
    >
      {/* Ambient */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -40, left: "50%", transform: "translateX(-50%)",
          width: 350, height: 350,
          background: "radial-gradient(ellipse at 30% 20%, rgba(110,252,180,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(59,130,246,0.05) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 flex flex-col flex-1" style={{ padding: "30px 24px 30px" }}>
        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* Logo */}
          <div style={{
            width: 80, height: 80, margin: "0 auto 16px", borderRadius: 22,
            background: "linear-gradient(135deg, #0d1210, #131a16)",
            border: "1.5px solid rgba(110,252,180,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
            boxShadow: "0 8px 32px rgba(110,252,180,0.12)",
          }}>
            <span style={{
              fontSize: 38, fontWeight: 900,
              background: "linear-gradient(135deg, #6efcb4, #3dd990)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>S</span>
            <svg width="80" height="80" style={{ position: "absolute", top: 0, left: 0 }}>
              <g stroke="#6efcb4" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4">
                <path d="M12 28 L12 16 Q12 12 16 12 L28 12" />
                <path d="M52 12 L64 12 Q68 12 68 16 L68 28" />
                <path d="M68 52 L68 64 Q68 68 64 68 L52 68" />
                <path d="M28 68 L16 68 Q12 68 12 64 L12 52" />
              </g>
            </svg>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 4 }}>
            Skład<span style={{ color: "#6efcb4" }}>AI</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 500, lineHeight: "18px" }}>
            Zaloguj się żeby zsynchronizować<br/>dane i historię skanów
          </div>
        </div>

        {/* Benefits glass card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: 14, marginBottom: 28,
        }}>
          {[
            { icon: "🔄", text: "Synchronizacja między urządzeniami" },
            { icon: "📊", text: "Historia wszystkich skanów w chmurze" },
            { icon: "⚠️", text: "Spersonalizowane ostrzeżenia o alergenach" },
            { icon: "🎯", text: "AI dostosowane do Twojego profilu" },
          ].map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 3 ? 10 : 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "rgba(110,252,180,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
              }}>{b.icon}</div>
              <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", fontWeight: 500, lineHeight: "16px" }}>{b.text}</span>
            </div>
          ))}
        </div>

        {/* Google */}
        <button
          className="w-full active:scale-[0.98] transition-transform"
          style={{
            padding: "15px 16px", borderRadius: 14,
            border: "1.5px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            marginBottom: 10, cursor: "pointer",
          }}
          onClick={() => { /* TODO: Supabase Auth — Google */ }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14.5 }}>Kontynuuj z Google</span>
        </button>

        {/* Apple */}
        <button
          className="w-full active:scale-[0.98] transition-transform"
          style={{
            padding: "15px 16px", borderRadius: 14,
            border: "none", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            marginBottom: 20, cursor: "pointer",
          }}
          onClick={() => { /* TODO: Supabase Auth — Apple */ }}
        >
          <svg width="17" height="20" viewBox="0 0 17 20" fill="#000">
            <path d="M13.54 10.73c-.02-2.1 1.75-3.13 1.83-3.18-1-1.45-2.55-1.65-3.1-1.67-1.31-.14-2.58.78-3.25.78-.68 0-1.71-.76-2.82-.74-1.44.02-2.78.85-3.52 2.14-1.51 2.62-.39 6.49 1.07 8.62.72 1.04 1.58 2.2 2.7 2.16 1.09-.04 1.5-.7 2.81-.7 1.31 0 1.69.7 2.82.67 1.17-.02 1.91-1.05 2.61-2.09.83-1.2 1.17-2.37 1.19-2.43-.03-.01-2.27-.87-2.29-3.44l-.05-.12zM11.41 4.02c.58-.72.98-1.71.87-2.71-.84.04-1.88.57-2.49 1.28-.54.63-1.02 1.65-.89 2.62.94.07 1.9-.47 2.51-1.19z"/>
          </svg>
          <span style={{ color: "#000", fontWeight: 700, fontSize: 14.5 }}>Kontynuuj z Apple</span>
        </button>

        {/* Skip */}
        <div style={{ textAlign: "center" }}>
          <button onClick={onSkip} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
            Pomiń — używaj bez konta
          </button>
        </div>

        {/* Privacy */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 10.5, color: "rgba(255,255,255,0.2)", lineHeight: "15px" }}>
          Logując się akceptujesz <a href="/privacy" style={{ color: "#6efcb4", opacity: 0.5, textDecoration: "none" }}>Politykę prywatności</a>
        </div>
      </div>
    </div>
  );
}
