export default function PrivacyPolicy() {
  return (
    <div style={{ background: "#0a0f0d", color: "#e0e0e0", minHeight: "100vh", padding: "24px 20px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Polityka Prywatności</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Ostatnia aktualizacja: 31 marca 2026</p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>1. Administrator danych</h2>
        <p style={{ fontSize: 14 }}>
          Administratorem aplikacji SkładAI jest jej twórca. Kontakt: <a href="mailto:skladai.app@gmail.com" style={{ color: "#84CC16" }}>skladai.app@gmail.com</a>
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>2. Jakie dane zbieramy</h2>
        <p style={{ fontSize: 14 }}>SkładAI przetwarza wyłącznie dane niezbędne do działania aplikacji:</p>
        <ul style={{ fontSize: 14, paddingLeft: 20, marginTop: 8 }}>
          <li><strong>Zdjęcia produktów</strong> — robione aparatem lub wybierane z galerii. Są przesyłane do serwera w celu analizy składu przez AI. Nie są przechowywane na serwerze po zakończeniu analizy.</li>
          <li><strong>Historia skanów</strong> — przechowywana lokalnie na urządzeniu użytkownika (localStorage). Nie jest wysyłana na serwer.</li>
          <li><strong>Profil użytkownika</strong> — dane takie jak waga, wzrost, wiek (jeśli podane) są przechowywane wyłącznie lokalnie na urządzeniu.</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>3. Uprawnienia aplikacji</h2>
        <ul style={{ fontSize: 14, paddingLeft: 20 }}>
          <li><strong>Aparat (Camera)</strong> — do robienia zdjęć etykiet produktów, dań i suplementów w celu analizy składu.</li>
          <li><strong>Galeria (Storage)</strong> — do wybierania istniejących zdjęć z biblioteki urządzenia.</li>
          <li><strong>Mikrofon</strong> — do rozpoznawania mowy (dyktowanie nazw produktów).</li>
          <li><strong>Internet</strong> — do przesyłania zdjęć do API analizy i pobierania wyników.</li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>4. Przetwarzanie zdjęć</h2>
        <p style={{ fontSize: 14 }}>
          Zdjęcia przesyłane do analizy są przetwarzane przez zewnętrzne usługi AI (Anthropic Claude API, Google Cloud Vision) wyłącznie w celu rozpoznania tekstu i analizy składu. Zdjęcia nie są przechowywane na serwerach po zakończeniu analizy. Nie są wykorzystywane do trenowania modeli AI.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>5. Dane lokalne</h2>
        <p style={{ fontSize: 14 }}>
          Wszystkie dane osobowe (profil, historia skanów, preferencje) są przechowywane wyłącznie w pamięci lokalnej urządzenia (localStorage/IndexedDB). Nie mamy do nich dostępu. Użytkownik może je usunąć w dowolnym momencie czyszcząc dane aplikacji.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>6. Udostępnianie danych</h2>
        <p style={{ fontSize: 14 }}>
          Nie sprzedajemy, nie udostępniamy i nie przekazujemy danych osobowych użytkowników podmiotom trzecim. Zdjęcia są przesyłane wyłącznie do dostawców usług AI w celu analizy składu.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>7. Bezpieczeństwo</h2>
        <p style={{ fontSize: 14 }}>
          Komunikacja między aplikacją a serwerem odbywa się przez szyfrowane połączenie HTTPS. Zdjęcia są kompresowane przed wysłaniem i usuwane z pamięci serwera natychmiast po przetworzeniu.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>8. Prawa użytkownika</h2>
        <p style={{ fontSize: 14 }}>Użytkownik ma prawo do:</p>
        <ul style={{ fontSize: 14, paddingLeft: 20, marginTop: 8 }}>
          <li>Usunięcia wszystkich swoich danych lokalnych (Ustawienia &rarr; Wyczyść dane)</li>
          <li>Odmowy udzielenia uprawnień (aparat, mikrofon) — aplikacja będzie działać z ograniczoną funkcjonalnością</li>
          <li>Kontaktu w sprawie danych: <a href="mailto:skladai.app@gmail.com" style={{ color: "#84CC16" }}>skladai.app@gmail.com</a></li>
        </ul>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>9. Dzieci</h2>
        <p style={{ fontSize: 14 }}>
          Aplikacja nie jest przeznaczona dla dzieci poniżej 13 roku życia. Nie zbieramy świadomie danych od dzieci.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#84CC16", marginTop: 32, marginBottom: 12 }}>10. Zmiany w polityce</h2>
        <p style={{ fontSize: 14 }}>
          Zastrzegamy sobie prawo do aktualizacji niniejszej polityki prywatności. O istotnych zmianach poinformujemy w aplikacji.
        </p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#555" }}>SkładAI &copy; 2026. Wszystkie prawa zastrzeżone.</p>
        </div>
      </div>
    </div>
  );
}
