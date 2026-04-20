import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wsparcie — SkładAI",
  description: "Wsparcie użytkownika aplikacji SkładAI — kontakt, FAQ, pomoc.",
};

const ACCENT = "#6efcb4";
const BG = "#0a0e0c";
const TEXT = "#e6efe9";
const MUTED = "#8a948f";

const sectionTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  color: ACCENT,
  marginTop: 36,
  marginBottom: 12,
  letterSpacing: 0.2,
  textTransform: "uppercase",
};

const questionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#ffffff",
  marginTop: 18,
  marginBottom: 6,
};

const paragraph: React.CSSProperties = {
  fontSize: 14.5,
  color: TEXT,
  lineHeight: 1.75,
  marginBottom: 10,
};

const list: React.CSSProperties = {
  fontSize: 14.5,
  color: TEXT,
  lineHeight: 1.8,
  paddingLeft: 22,
  marginTop: 6,
  marginBottom: 10,
};

const link: React.CSSProperties = {
  color: ACCENT,
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

export default function SupportPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ marginBottom: 36 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 3,
              color: ACCENT,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            SkładAI
          </p>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Wsparcie
          </h1>
        </header>

        {/* Kontakt */}
        <h2 style={sectionTitle}>Kontakt</h2>
        <p style={paragraph}>Masz pytanie, problem lub propozycję?</p>
        <p style={paragraph}>
          📧 E-mail:{" "}
          <a href="mailto:skladai.app@gmail.com" style={link}>
            skladai.app@gmail.com
          </a>
        </p>
        <p style={paragraph}>⏱️ Odpowiadamy w ciągu 48 godzin.</p>

        {/* FAQ */}
        <h2 style={sectionTitle}>Najczęstsze pytania</h2>

        <h3 style={questionTitle}>Jak aktywować Premium?</h3>
        <p style={paragraph}>
          Przejdź do zakładki Profil → Aktywuj Premium. Wybierz plan miesięczny, roczny lub na zawsze.
        </p>

        <h3 style={questionTitle}>Jak anulować subskrypcję?</h3>
        <ul style={list}>
          <li>
            <strong>iOS:</strong> Ustawienia → [Twoje imię] → Subskrypcje → SkładAI → Anuluj.
          </li>
          <li>
            <strong>Android:</strong> Google Play Store → Twoje konto → Subskrypcje → SkładAI → Anuluj.
          </li>
        </ul>

        <h3 style={questionTitle}>Czy moje dane są bezpieczne?</h3>
        <p style={paragraph}>
          Tak. Szczegóły w naszej{" "}
          <a href="/privacy" style={link}>
            Polityce prywatności
          </a>
          .
        </p>

        <h3 style={questionTitle}>Apka nie skanuje poprawnie. Co zrobić?</h3>
        <p style={paragraph}>Upewnij się, że:</p>
        <ul style={list}>
          <li>zdjęcie jest ostre i dobrze oświetlone,</li>
          <li>cała etykieta jest widoczna w kadrze,</li>
          <li>masz aktywne połączenie z internetem.</li>
        </ul>
        <p style={paragraph}>
          Jeśli problem się utrzymuje — napisz na{" "}
          <a href="mailto:skladai.app@gmail.com" style={link}>
            skladai.app@gmail.com
          </a>
          .
        </p>

        {/* Footer */}
        <footer
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12,
            color: MUTED,
            lineHeight: 1.7,
          }}
        >
          <p style={{ margin: 0 }}>Ostatnia aktualizacja: kwiecień 2026</p>
          <p style={{ margin: "6px 0 0" }}>
            Kontakt:{" "}
            <a href="mailto:skladai.app@gmail.com" style={link}>
              skladai.app@gmail.com
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
