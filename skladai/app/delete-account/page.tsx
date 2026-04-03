export default function DeleteAccount() {
  return (
    <div style={{ background: "#0a0f0d", color: "#e0e0e0", minHeight: "100vh", padding: "24px 20px", fontFamily: "system-ui, sans-serif", lineHeight: 1.7 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Usuwanie konta SkładAI</h1>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Ostatnia aktualizacja: kwiecień 2026</p>

        <div style={{ padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 24 }}>
          <p style={{ fontSize: 14 }}>
            Aby usunąć swoje konto i wszystkie powiązane dane, wyślij wiadomość e-mail na adres:{" "}
            <a href="mailto:patrykr12345@gmail.com?subject=Usuń moje konto" style={{ color: "#6efcb4", fontWeight: 700 }}>patrykr12345@gmail.com</a>{" "}
            z tematem <strong style={{ color: "#fff" }}>{'"'}Usuń moje konto{'"'}</strong>.
          </p>
          <p style={{ fontSize: 14, marginTop: 12 }}>
            Twoje dane zostaną usunięte w ciągu <strong style={{ color: "#fff" }}>7 dni roboczych</strong> od otrzymania zgłoszenia.
          </p>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#6efcb4", marginTop: 32, marginBottom: 12 }}>Dane które zostaną usunięte</h2>
        <ul style={{ fontSize: 14, paddingLeft: 20 }}>
          <li>Profil użytkownika (waga, wzrost, wiek, alergie)</li>
          <li>Historia skanów i logi analiz</li>
          <li>Dane logowania (konto Google/Apple OAuth)</li>
          <li>Wpisy dziennika żywieniowego</li>
        </ul>

        <p style={{ fontSize: 13, color: "#888", marginTop: 24 }}>
          Dane przechowywane lokalnie na Twoim urządzeniu (localStorage) możesz usunąć samodzielnie czyszcząc dane aplikacji w ustawieniach przeglądarki lub telefonu.
        </p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#555" }}>SkładAI &copy; 2026. Wszystkie prawa zastrzeżone.</p>
        </div>
      </div>
    </div>
  );
}
