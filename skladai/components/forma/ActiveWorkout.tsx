"use client";
// FORMA — Aktywny trening (Faza 3/4). Tymczasowy stub — pełna wersja w Fazie 3.
export default function ActiveWorkout({ goBack }: {
  goBack: () => void;
  sessionId: string;
  workoutId: string;
  openExerciseHistory: (exerciseId: string) => void;
}) {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--fg, #fff)" }}>
      <button onClick={goBack} style={{ color: "var(--c-orange, #f97316)" }}>‹ Wróć</button>
      <p style={{ marginTop: 20 }}>Aktywny trening — wkrótce</p>
    </div>
  );
}
