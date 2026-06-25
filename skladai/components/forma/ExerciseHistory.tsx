"use client";
// FORMA — Historia ćwiczenia (Faza 4/4). Tymczasowy stub — pełna wersja w Fazie 4.
export default function ExerciseHistory({ goBack }: {
  goBack: () => void;
  exerciseId: string;
}) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--fg, #fff)" }}>
      <button onClick={goBack} style={{ color: "var(--c-orange, #f97316)" }}>‹ Wróć</button>
      <p style={{ marginTop: 20 }}>Historia ćwiczenia — wkrótce</p>
    </div>
  );
}
