"use client";

/**
 * FORMA — Import treningu ze zdjęcia (notatnik / screenshot).
 * AI Vision (/api/workout-import) czyta ćwiczenia + serie → dopasowanie po
 * nazwie do istniejących ćwiczeń (progres kontynuowany) → edytowalny podgląd
 * z progresem (vs ostatnio / od startu) → zapis sesji (lib/workoutJournal).
 * Akcent pomarańcz #f97316. Liczby białe. Przyrosty zielone / spadki czerwone.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { isNative, takePhotoForMode } from "@/lib/native-camera";
import { compressImage } from "@/lib/compress";
import {
  listWorkouts, listExercises, findExerciseByName, getExerciseBaseline, importWorkoutSession,
  createWorkout, getCurrentUserId,
  type WnWorkout, type WnKind, type ImportExercise,
} from "@/lib/workoutJournal";

const GREEN = "#5fd39a";
const RED = "#f87171";

interface EditSet { weight: string; reps: string; duration: string; }
interface Baseline { metric: "weight" | "reps"; lastTop: number | null; firstTop: number | null; record: number | null; }
interface EditExercise { name: string; kind: WnKind; sets: EditSet[]; matched: boolean; baseline?: Baseline; exerciseId?: string; }

function pnum(s: string): number | null {
  const t = (s || "").replace(",", ".").trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}
function round2(n: number) { return Math.round(n * 100) / 100; }

export default function WorkoutImport({ goBack, onSaved }: { goBack: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<"capture" | "loading" | "preview">("capture");
  const [error, setError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<EditExercise[]>([]);
  const [workouts, setWorkouts] = useState<WnWorkout[]>([]);
  // Cel zapisu: "__new__" = nowy trening (z nazwą), "" = bez treningu, lub id istniejącego.
  const [target, setTarget] = useState<string>("__new__");
  const [newName, setNewName] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  // undefined = sprawdzam, null = gość (nie zapisze), string = zalogowany.
  const [authUid, setAuthUid] = useState<string | null | undefined>(undefined);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void listWorkouts().then(setWorkouts); }, []);

  /**
   * Odniesienie („rekord", „vs ostatnio") liczymy DOPIERO po wyborze treningu
   * docelowego i wyłącznie z jego historii — inaczej pokazywalibyśmy progres
   * zlepiony z innych treningów. Nowy trening = brak historii = brak progresu.
   */
  useEffect(() => {
    const realWorkout = target !== "__new__" && target !== "" ? target : null;
    let cancelled = false;
    (async () => {
      const withBase = await Promise.all(exercises.map(async (ex) => {
        if (!realWorkout || !ex.exerciseId) return { ...ex, baseline: undefined };
        const b = await getExerciseBaseline(ex.exerciseId, realWorkout);
        return b.sessions > 0
          ? { ...ex, baseline: { metric: b.metric, lastTop: b.lastTop, firstTop: b.firstTop, record: b.record } }
          : { ...ex, baseline: undefined };
      }));
      if (!cancelled) setExercises(withBase);
    })();
    return () => { cancelled = true; };
    // celowo bez `exercises` w zależnościach — przeliczamy przy ZMIANIE treningu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  useEffect(() => { void getCurrentUserId().then(setAuthUid); }, []);

  const parseImage = useCallback(async (base64: string) => {
    setStep("loading"); setError(null);
    try {
      const res = await fetch("/api/workout-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: base64 }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Nie udało się odczytać."); setStep("capture"); return; }
      const parsed: ImportExercise[] = Array.isArray(data.exercises) ? data.exercises : [];
      if (!parsed.length) { setError("Nie rozpoznano ćwiczeń na zdjęciu. Spróbuj wyraźniejsze / lepiej oświetlone."); setStep("capture"); return; }
      const allEx = await listExercises();
      const edit: EditExercise[] = await Promise.all(parsed.map(async (ie): Promise<EditExercise> => {
        const match = await findExerciseByName(ie.name, allEx);
        let baseline: Baseline | undefined;
        // odniesienie liczone dopiero po wyborze treningu docelowego (efekt niżej)
        return {
          name: ie.name || "Ćwiczenie",
          kind: (ie.kind as WnKind) || "weighted",
          sets: (ie.sets || []).map((s) => ({ weight: s.weight != null ? String(s.weight) : "", reps: s.reps != null ? String(s.reps) : "", duration: s.duration != null ? String(s.duration) : "" })),
          matched: !!match, baseline, exerciseId: match?.id,
        };
      }));
      setExercises(edit);
      setStep("preview");
    } catch { setError("Błąd sieci. Spróbuj ponownie."); setStep("capture"); }
  }, []);

  // Aparat / galeria — odporne na 3 tryby awarii:
  //  1) natywny plugin działa → takePhotoForMode (jak w Skanerze),
  //  2) plugin rzuca realnym błędem → fallback do <input type=file>,
  //  3) brak pluginu (isNative=false, np. build iOS bez @capacitor/camera) →
  //     od razu <input type=file> (WKWebView-safe, patrz style hiddenFileInput).
  // Nigdy „po cichu": jeśli nic nie zadziała, pokazujemy błąd.
  const openCam = async () => {
    setError(null);
    if (isNative()) {
      try {
        const b = await takePhotoForMode("forma", "camera");
        if (b) void parseImage(b);
        return; // sukces lub anulowanie przez usera
      } catch (e) {
        console.warn("[WorkoutImport] natywny aparat zawiódł → fallback input", e);
      }
    }
    if (cameraRef.current) cameraRef.current.click();
    else setError("Nie udało się otworzyć aparatu. Spróbuj przez galerię.");
  };
  const openGal = async () => {
    setError(null);
    if (isNative()) {
      try {
        const b = await takePhotoForMode("forma", "gallery");
        if (b) void parseImage(b);
        return;
      } catch (e) {
        console.warn("[WorkoutImport] natywna galeria zawiodła → fallback input", e);
      }
    }
    if (galleryRef.current) galleryRef.current.click();
    else setError("Nie udało się otworzyć galerii.");
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type.startsWith("image/")) { try { const b = await compressImage(f, 2200); void parseImage(b); } catch {} }
    e.target.value = "";
  };

  // ── edytory podglądu ──
  const setExName = (i: number, name: string) => setExercises((p) => p.map((ex, k) => k === i ? { ...ex, name } : ex));
  const setSetField = (i: number, si: number, field: keyof EditSet, val: string) =>
    setExercises((p) => p.map((ex, k) => k === i ? { ...ex, sets: ex.sets.map((s, j) => j === si ? { ...s, [field]: val } : s) } : ex));
  const addSet = (i: number) => setExercises((p) => p.map((ex, k) => {
    if (k !== i) return ex;
    const last = ex.sets[ex.sets.length - 1];
    return { ...ex, sets: [...ex.sets, last ? { ...last } : { weight: "", reps: "", duration: "" }] };
  }));
  const removeSet = (i: number, si: number) => setExercises((p) => p.map((ex, k) => k === i ? { ...ex, sets: ex.sets.filter((_, j) => j !== si) } : ex));
  const removeExercise = (i: number) => setExercises((p) => p.filter((_, k) => k !== i));

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    // Zapis idzie do chmury (Supabase) → wymaga logowania. Gość: jasny komunikat + CTA.
    const uid = authUid ?? await getCurrentUserId();
    if (!uid) {
      setAuthUid(null);
      setError("Zaloguj się, aby zapisać trening — dane synchronizują się w chmurze.");
      return;
    }
    const payload: ImportExercise[] = exercises.map((ex) => ({
      name: ex.name,
      kind: ex.kind,
      sets: ex.sets.map((s) => ({ weight: pnum(s.weight), reps: pnum(s.reps), duration: pnum(s.duration) })).filter((s) => s.weight != null || s.reps != null || s.duration != null),
    })).filter((ex) => ex.name.trim() && ex.sets.length);
    if (!payload.length) { setError("Brak serii do zapisania — uzupełnij ciężar lub powtórzenia."); return; }
    setSaving(true);
    // Ustal trening docelowy: nowy (z nazwą) / istniejący / bez treningu.
    let targetId: string | null;
    if (target === "__new__") {
      const nm = newName.trim() || `Trening ${date}`;
      const w = await createWorkout(nm);
      if (!w) { setSaving(false); setError("Nie udało się utworzyć treningu. Spróbuj ponownie."); return; }
      targetId = w.id;
    } else {
      targetId = target || null; // "" = bez treningu
    }
    const result = await importWorkoutSession({ workoutId: targetId, date, exercises: payload });
    setSaving(false);
    if (result) onSaved(); else setError("Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.");
  };

  const requestLogin = () => { try { window.dispatchEvent(new Event("request-login")); } catch { /* noop */ } };

  // ── RENDER ──
  return (
    <div style={{ animation: "fadeInUp 0.4s ease both", paddingBottom: 90 }}>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={hiddenFileInput} />
      <input ref={galleryRef} type="file" accept="image/*" onChange={onFile} style={hiddenFileInput} />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} aria-label="Wróć" style={backBtn}>‹</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: "var(--fg, #fff)" }}>Import ze zdjęcia</h2>
          <p style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>AI odczyta trening z notatnika lub screena</p>
        </div>
        <span style={chip}>Forma</span>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 12, fontSize: 12.5, background: "rgba(var(--c-red-rgb, 239,68,68),0.12)", color: "var(--c-red, #ef4444)", border: "1px solid rgba(var(--c-red-rgb, 239,68,68),0.25)" }}>{error}</div>
      )}

      {step === "capture" && (
        <div style={{ textAlign: "center", padding: "28px 18px", borderRadius: 18, background: "linear-gradient(145deg, rgba(var(--c-orange-rgb, 249,115,22),0.09), rgba(var(--c-orange-rgb, 249,115,22),0.02))", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.2)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📸</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--fg, #fff)" }}>Zaimportuj trening ze zdjęcia</div>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(var(--fg-rgb, 255,255,255),0.55)", margin: "8px auto 20px", maxWidth: 280 }}>
            Zrób zdjęcie notatnika albo screena z apki. AI rozpozna ćwiczenia i serie, dopasuje do Twoich i pokaże progres.
          </p>
          <button onClick={openCam} className="w-full active:scale-[0.97] transition-transform" style={{ ...primaryBtn, marginBottom: 10 }}>📷 Zrób zdjęcie</button>
          <button onClick={openGal} className="w-full active:scale-95 transition-transform" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.55)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🖼️ lub wybierz z galerii</button>
        </div>
      )}

      {step === "loading" && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="wi-spin" style={{ width: 40, height: 40, margin: "0 auto 16px", borderRadius: "50%", border: "3px solid rgba(var(--c-orange-rgb, 249,115,22),0.2)", borderTopColor: "var(--c-orange, #f97316)" }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg, #fff)" }}>AI czyta Twój trening…</div>
          <div style={{ fontSize: 12, color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginTop: 4 }}>Rozpoznaję ćwiczenia i serie</div>
          <style>{`.wi-spin{animation:wiSpin 0.8s linear infinite}@keyframes wiSpin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.wi-spin{animation-duration:2s}}`}</style>
        </div>
      )}

      {step === "preview" && (
        <>
          {/* Baner: gość nie zapisze do chmury */}
          {authUid === null && (
            <button onClick={requestLogin} className="w-full active:scale-[0.98] transition-transform" style={{ marginBottom: 14, padding: "11px 13px", borderRadius: 12, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: "rgba(var(--c-orange-rgb, 249,115,22),0.1)", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.28)", color: "var(--fg, #fff)", fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <span>Nie jesteś zalogowany — <strong style={{ color: "var(--c-orange, #f97316)", textDecoration: "underline" }}>zaloguj się</strong>, aby zapisać trening w chmurze.</span>
            </button>
          )}

          {/* Cel zapisu: nowy trening (z nazwą) / istniejący / bez treningu */}
          <div style={{ marginBottom: 12 }}>
            <label style={miniLabel}>Zapisz do treningu</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }}>
              <option value="__new__">➕ Nowy trening</option>
              {workouts.length > 0 && (
                <optgroup label="Dopisz do istniejącego">
                  {workouts.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </optgroup>
              )}
              <option value="">Bez treningu (tylko wpis)</option>
            </select>
          </div>

          {/* Nazwa nowego treningu */}
          {target === "__new__" && (
            <div style={{ marginBottom: 12 }}>
              <label style={miniLabel}>Nazwa treningu</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`np. Push A, Nogi, FBW`} style={inputStyle} />
              <div style={{ fontSize: 10.5, color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginTop: 4 }}>
                Puste = {"„"}Trening {date}{"”"}
              </div>
            </div>
          )}

          {/* Data */}
          <div style={{ marginBottom: 16 }}>
            <label style={miniLabel}>Data treningu</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
          </div>

          {/* Ćwiczenia */}
          <div className="flex flex-col gap-3">
            {exercises.map((ex, i) => {
              const byReps = ex.kind === "bodyweight";
              const importTop = ex.sets.reduce<number | null>((top, s) => {
                const v = byReps ? pnum(s.reps) : pnum(s.weight);
                return v != null && (top == null || v > top) ? v : top;
              }, null);
              const unit = byReps ? "" : " kg";
              const dLast = ex.baseline?.lastTop != null && importTop != null ? round2(importTop - ex.baseline.lastTop) : null;
              const dStart = ex.baseline?.firstTop != null && importTop != null ? round2(importTop - ex.baseline.firstTop) : null;
              return (
                <div key={i} style={{ padding: "13px 13px 12px", borderRadius: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.08)" }}>
                  {/* Nazwa + status + usuń */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <input value={ex.name} onChange={(e) => setExName(i, e.target.value)} style={{ flex: 1, minWidth: 0, background: "none", border: "none", color: "var(--fg, #fff)", fontSize: 15, fontWeight: 800, outline: "none", padding: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99, whiteSpace: "nowrap", ...(ex.matched ? { color: GREEN, background: "rgba(95,211,154,0.14)" } : { color: "var(--c-orange, #f97316)", background: "rgba(var(--c-orange-rgb, 249,115,22),0.14)" }) }}>
                      {ex.matched ? "✓ znane" : "nowe"}
                    </span>
                    <button onClick={() => removeExercise(i)} aria-label="Usuń ćwiczenie" style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "rgba(var(--c-red-rgb, 239,68,68),0.1)", border: "none", color: "var(--c-red, #ef4444)", fontSize: 15, cursor: "pointer" }}>×</button>
                  </div>

                  {/* Progres (tylko dopasowane z historią) */}
                  {ex.matched && ex.baseline?.record != null && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10, fontSize: 11 }}>
                      <span style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.55)" }}>🏆 Rekord <strong style={{ color: "var(--fg, #fff)" }}>{ex.baseline.record}{unit}</strong></span>
                      {dLast != null && dLast !== 0 && <span style={{ color: dLast > 0 ? GREEN : RED, fontWeight: 700 }}>{dLast > 0 ? "↑" : "↓"} {Math.abs(dLast)}{unit} vs ostatnio</span>}
                      {dStart != null && dStart !== 0 && <span style={{ color: dStart > 0 ? GREEN : RED, fontWeight: 700 }}>{dStart > 0 ? "↑" : "↓"} {Math.abs(dStart)}{unit} od startu</span>}
                    </div>
                  )}

                  {/* Serie */}
                  <div className="flex flex-col gap-1.5">
                    {ex.sets.map((s, si) => (
                      <div key={si} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 20, textAlign: "center", fontSize: 12, fontWeight: 700, color: "rgba(var(--fg-rgb, 255,255,255),0.4)" }}>{si + 1}</span>
                        {!byReps && <input inputMode="decimal" value={s.weight} placeholder="kg" onChange={(e) => setSetField(i, si, "weight", e.target.value)} style={setField} />}
                        <input inputMode="numeric" value={s.reps} placeholder="powt." onChange={(e) => setSetField(i, si, "reps", e.target.value)} style={setField} />
                        <button onClick={() => removeSet(i, si)} aria-label="Usuń serię" style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, background: "rgba(var(--fg-rgb, 255,255,255),0.05)", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.4)", fontSize: 15, cursor: "pointer" }}>×</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addSet(i)} style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: "var(--c-orange, #f97316)", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}>+ Dodaj serię</button>
                </div>
              );
            })}
          </div>

          {/* Zapisz */}
          <button onClick={() => authUid === null ? requestLogin() : void handleSave()} disabled={saving} data-testid="import-save" className="w-full active:scale-[0.98] transition-transform" style={{ ...primaryBtn, marginTop: 20, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Zapisuję…" : authUid === null ? "🔒 Zaloguj się, aby zapisać" : `Zapisz trening (${exercises.length} ćw.)`}
          </button>
          <button onClick={() => { setStep("capture"); setExercises([]); }} className="w-full active:scale-95 transition-transform" style={{ marginTop: 10, background: "none", border: "none", color: "rgba(var(--fg-rgb, 255,255,255),0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ↻ Zrób nowe zdjęcie
          </button>
        </>
      )}
    </div>
  );
}

// WKWebView (iOS) czasem NIE otwiera pickera dla input[type=file] z
// display:none klikanego programowo. Trzymamy input w layoucie (1×1 px,
// przezroczysty, poza ekranem) — wtedy .click() niezawodnie otwiera picker.
const hiddenFileInput: React.CSSProperties = { position: "fixed", left: 0, bottom: 0, width: 1, height: 1, opacity: 0, border: 0, padding: 0, zIndex: -1 };
const backBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 18, cursor: "pointer" };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 800, padding: "5px 11px", borderRadius: 99, flexShrink: 0, background: "rgba(var(--c-orange-rgb, 249,115,22),0.15)", color: "var(--c-orange, #f97316)", border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.3)" };
const primaryBtn: React.CSSProperties = { padding: "14px", borderRadius: 16, border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", background: "linear-gradient(135deg, var(--c-orange, #f97316), var(--c-orange-3, #ea580c))", boxShadow: "0 6px 22px rgba(var(--c-orange-rgb, 249,115,22),0.3)" };
const miniLabel: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.4)", marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 11, background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 13, fontWeight: 600, outline: "none" };
const setField: React.CSSProperties = { flex: 1, minWidth: 0, padding: "9px 10px", borderRadius: 10, textAlign: "center", background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)", color: "var(--fg, #fff)", fontSize: 14, fontWeight: 700, outline: "none" };
