import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka Prywatności — SkładAI",
  description: "Polityka prywatności aplikacji SkładAI.",
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

export default function PrivacyPolicyPage() {
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
            Polityka Prywatności
          </h1>
        </header>

        {/* 1. Administrator */}
        <h2 style={sectionTitle}>1. Administrator danych</h2>
        <p style={paragraph}>
          Administratorem danych osobowych przetwarzanych w aplikacji SkładAI jest:
        </p>
        <p style={paragraph}>
          <strong>Patryk Rękas</strong>
          <br />
          Tarnobrzeg, Polska
          <br />
          Kontakt:{" "}
          <a href="mailto:skladai.app@gmail.com" style={link}>
            skladai.app@gmail.com
          </a>
        </p>

        {/* 2. Jakie dane zbieramy */}
        <h2 style={sectionTitle}>2. Jakie dane zbieramy</h2>
        <ul style={list}>
          <li>
            <strong>Dane konta</strong> — imię i adres e-mail uzyskane podczas logowania przez Apple Sign In lub
            Google Sign In.
          </li>
          <li>
            <strong>Dane profilu</strong> — waga, wzrost, wiek, cel (odchudzanie / utrzymanie / masa), poziom
            aktywności, alergie, typ skóry.
          </li>
          <li>
            <strong>Zdjęcia</strong> — zdjęcia etykiet produktów, dań oraz sylwetki (CheckForm). Są przetwarzane
            przez AI w celu analizy i nie są trwale przechowywane na naszym serwerze.
          </li>
          <li>
            <strong>Historia skanów</strong> — wyniki dotychczasowych analiz produktów.
          </li>
          <li>
            <strong>Dane z dziennika posiłków</strong> — wpisane posiłki, kalorie, makroskładniki.
          </li>
          <li>
            <strong>Dane aktywności</strong> — kroki i spalone kalorie pobierane z Apple Health lub Google Fit
            wyłącznie za zgodą użytkownika.
          </li>
        </ul>

        {/* 3. Cel przetwarzania */}
        <h2 style={sectionTitle}>3. Cel przetwarzania</h2>
        <ul style={list}>
          <li>Personalizacja wyników skanów oraz rekomendacji.</li>
          <li>Śledzenie progresu — wagi, pomiarów i bilansu kalorycznego.</li>
          <li>Poprawa jakości i rozwoju usługi.</li>
        </ul>

        {/* 4. Podmioty trzecie */}
        <h2 style={sectionTitle}>4. Przetwarzanie przez podmioty trzecie</h2>
        <p style={paragraph}>
          W celu realizacji funkcji aplikacji niektóre dane są przekazywane do następujących dostawców:
        </p>
        <ul style={list}>
          <li>
            <strong>Anthropic API (Claude AI)</strong> — analiza składu produktów oraz zdjęć.
          </li>
          <li>
            <strong>Google Cloud Vision</strong> — OCR rozpoznający tekst z etykiet.
          </li>
          <li>
            <strong>Supabase</strong> — przechowywanie danych użytkownika.
          </li>
          <li>
            <strong>Apple / Google</strong> — uwierzytelnianie (Sign In).
          </li>
        </ul>
        <p style={paragraph}>
          Zdjęcia są wysyłane do API jedynie w celu analizy i nie są trwale przechowywane przez wymienione
          usługi.
        </p>

        {/* 5. Przechowywanie */}
        <h2 style={sectionTitle}>5. Przechowywanie danych</h2>
        <ul style={list}>
          <li>Dane przechowywane są na serwerach Supabase zlokalizowanych w Unii Europejskiej.</li>
          <li>Dane lokalne (preferencje, sesja) zapisywane są w localStorage przeglądarki / aplikacji.</li>
          <li>Użytkownik może w dowolnym momencie usunąć konto i powiązane z nim dane.</li>
        </ul>

        {/* 6. Prawa użytkownika */}
        <h2 style={sectionTitle}>6. Prawa użytkownika</h2>
        <ul style={list}>
          <li>Prawo dostępu do swoich danych.</li>
          <li>
            Prawo do usunięcia danych — wyślij wiadomość na{" "}
            <a href="mailto:skladai.app@gmail.com" style={link}>
              skladai.app@gmail.com
            </a>
            .
          </li>
          <li>Prawo do sprzeciwu wobec przetwarzania.</li>
        </ul>

        {/* 7. Cookies */}
        <h2 style={sectionTitle}>7. Pliki cookies</h2>
        <ul style={list}>
          <li>Aplikacja nie wykorzystuje plików cookies do śledzenia użytkowników.</li>
          <li>localStorage służy wyłącznie do przechowywania preferencji oraz danych sesji.</li>
        </ul>

        {/* 8. Zmiany */}
        <h2 style={sectionTitle}>8. Zmiany w polityce</h2>
        <ul style={list}>
          <li>O zmianach informujemy bezpośrednio w aplikacji.</li>
          <li>Dalsze korzystanie z aplikacji po wprowadzeniu zmian oznacza ich akceptację.</li>
        </ul>

        {/* 9. Informacja medyczna */}
        <h2 style={sectionTitle}>9. Informacja medyczna</h2>
        <ul style={list}>
          <li>SkładAI nie jest wyrobem medycznym.</li>
          <li>Wyniki analizy mają charakter wyłącznie orientacyjny.</li>
          <li>W razie wątpliwości skonsultuj się z dietetykiem lub lekarzem.</li>
        </ul>

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
            Pytania i wnioski:{" "}
            <a href="mailto:skladai.app@gmail.com" style={link}>
              skladai.app@gmail.com
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
