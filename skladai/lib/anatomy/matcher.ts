/**
 * FORMA — Rozpoznawanie ćwiczenia po dowolnej nazwie użytkownika.
 *
 * Trzy warstwy (w tej kolejności):
 *   1. LOKALNIE — scoring po aliasach + dopasowanie rozmyte (literówki, inna
 *      kolejność słów, brak ogonków) + kontekst partii mięśniowej z nazwy.
 *   2. AI       — /api/exercise-match dla nazw, których logika nie ogarnia.
 *   3. USER     — gdy wciąż niepewne, apka pyta i ZAPAMIĘTUJE wybór na stałe.
 *
 * Kluczowa różnica względem prostego dopasowania: zwracamy RANKING kandydatów
 * z wynikiem i flagą pewności, żeby UI wiedziało, kiedy zapytać użytkownika.
 */

import { EXERCISE_ANATOMY, normalizeExerciseName, type ExerciseAnatomy } from "./exercises";
import { nsGet, nsSet } from "@/lib/native-storage";

// ──────────────────────────────────────────────────────────────────
// Dodatkowe aliasy — realne nazwy z dzienników użytkowników
// (trzymane osobno, żeby nie puchł główny katalog)
// ──────────────────────────────────────────────────────────────────
const EXTRA_ALIASES: Record<string, string[]> = {
  bench_flat: ["plaska", "lawce poziomej", "lawka pozioma", "wyciskanie poziome", "wyciskanie sztangi plaskie", "wyciskanie na lawce poziomej", "klata sztanga", "wyciskanie plaskiej"],
  bench_incline: ["skos gora", "lawka skosna dodatnia", "wyciskanie gora", "skosna dodatnia"],
  db_incline: ["hantle skos gora", "wyciskanie hantli skos dodatni"],
  leg_extension: ["wyprosty", "wyprosty nog", "prostowanie kolan", "wyprost nog", "maszyna wyprosty"],
  leg_curl: ["uginania nog", "uginania lezac", "uginania siedzac", "zginanie nog", "maszyna uginania"],
  lateral_raise: ["wznosy boczne", "wznosy hantli bokiem", "odwodzenie hantli", "boczne wznosy", "wznosy bokiem hantli"],
  pushdown: ["linkami na wyciagu gornym", "triceps wyciag gorny", "wyciag gorny triceps", "triceps linka", "prostowanie ramion linka", "triceps uginanie rak z linkami na wyciagu gornym", "wyprosty triceps"],
  cable_curl: ["linkami na wyciagu dolnym", "biceps wyciag dolny", "wyciag dolny biceps", "biceps linka", "biceps uginanie rak z linkami na wyciagu dolnym"],
  overhead_ext: ["triceps zza glowy", "prostowanie rak zza glowy", "triceps prostowanie rak zza glowy na wyciagu", "wyciag zza glowy"],
  fly: ["butterfly", "butterfly na klatke", "motyl", "maszyna motylek", "rozpietki maszyna"],
  cable_row: ["wioslowanie na maszynie", "wioslowanie maszyna", "maszyna plecy", "wioslowanie na maszynie plecy", "wioslowanie siedzac maszyna"],
  pullup_neutral: ["podciaganie chwytem neutralnym", "podciaganie neutralnym chwytem", "chwytem neutralnym", "neutralnym chwytem", "podciaganie neutralne", "podciaganie mlotkowe"],
  calf_standing: ["wspiecia na lydki", "lydki", "wspiecia lydki", "lydka stojac"],
  ohp: ["ohp", "zolnierskie", "wyciskanie zolnierskie ohp", "barki sztanga"],
  dips: ["poreczy", "pompki na poreczy"],
  leg_press: ["suwnica", "prasa nogi", "maszyna nogi"],
  chinup: ["podciaganie podchwyt"],
  face_pull: ["facepull", "face pulls", "przyciaganie do twarzy"],
  hammer_curl: ["mlotkowe na biceps", "uginanie mlotkowe na biceps", "hammer"],
  incline_curl: ["uginanie rak na lawce skosnej", "biceps lawka skosna", "uginanie na lawce skosnej na biceps"],
  squat: ["przysiady ze sztanga z tylu", "back squat", "przysiad tylny"],
  rdl: ["rumunski martwy", "martwy rumunski"],
};

/** Słowa-wskazówki o partii → id mięśnia, który powinien być głównym. */
const MUSCLE_HINTS: Array<{ re: RegExp; muscle: string }> = [
  { re: /\btriceps\w*\b|trojglow/, muscle: "triceps" },
  { re: /\bbiceps\w*\b|dwuglowy ramienia/, muscle: "biceps" },
  { re: /\bklat\w*|piersiow\w*/, muscle: "chest" },
  { re: /\bplec\w*|grzbiet\w*|najszersz\w*/, muscle: "lats" },
  { re: /\bbark\w*|naramienn\w*|delt\w*/, muscle: "delts" },
  { re: /\blydk\w*|lydek/, muscle: "calves" },
  { re: /\bposladk\w*|glut\w*/, muscle: "glutes" },
  { re: /\bbrzuch\w*|brzuszk\w*/, muscle: "abs" },
  { re: /\bczworoglow\w*|\budo\b|\buda\b/, muscle: "quads" },
  { re: /\bdwuglow\w* uda|hamstring\w*/, muscle: "hamstrings" },
  { re: /\bkaptur\w*|czworoboczn\w*/, muscle: "traps" },
];

/** Główny (najbardziej obciążony) mięsień ćwiczenia. */
function primaryMuscle(ex: ExerciseAnatomy): string {
  return [...ex.activation].sort((a, b) => b.share - a.share)[0]?.muscle ?? "";
}

// ── dopasowanie rozmyte (współczynnik Dice'a na bigramach) ──
function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  const t = s.replace(/\s+/g, " ");
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((g) => { if (B.has(g)) inter++; });
  return (2 * inter) / (A.size + B.size);
}
/** Czy dwa słowa to „to samo z literówką / inną końcówką". */
function tokenAlike(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && (a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5)))) return true;
  return dice(a, b) >= 0.82;
}

export interface MatchCandidate {
  ex: ExerciseAnatomy;
  score: number;
  /** Krótkie uzasadnienie (do UI wyboru). */
  why: string;
}
export interface MatchOutcome {
  best: ExerciseAnatomy | null;
  /** true → można użyć bez pytania użytkownika */
  confident: boolean;
  candidates: MatchCandidate[];
}

/** Wszystkie frazy identyfikujące dane ćwiczenie. */
function phrasesOf(ex: ExerciseAnatomy): string[] {
  return [ex.name, ...ex.aliases, ...(EXTRA_ALIASES[ex.id] ?? [])]
    .map(normalizeExerciseName)
    .filter(Boolean);
}

const PHRASE_CACHE = new Map<string, string[]>();
function cachedPhrases(ex: ExerciseAnatomy): string[] {
  let p = PHRASE_CACHE.get(ex.id);
  if (!p) { p = phrasesOf(ex); PHRASE_CACHE.set(ex.id, p); }
  return p;
}

/**
 * Rozpoznaje ćwiczenie lokalnie. Zwraca ranking kandydatów + flagę pewności.
 */
export function matchExercise(rawName: string): MatchOutcome {
  const n = normalizeExerciseName(rawName);
  if (!n) return { best: null, confident: false, candidates: [] };
  const words = n.split(" ").filter(Boolean);

  // wskazówka o partii z nazwy (np. „triceps …", „… na klatkę")
  const hinted = MUSCLE_HINTS.filter((h) => h.re.test(n)).map((h) => h.muscle);

  const scored: MatchCandidate[] = [];
  for (const ex of EXERCISE_ANATOMY) {
    let best = 0;
    let why = "";
    for (const p of cachedPhrases(ex)) {
      let s = 0;
      let reason = "";
      if (n === p) { s = 1000; reason = "dokładna nazwa"; }
      else if (n.includes(p)) { s = 600 + p.length * 2; reason = "zawiera nazwę"; }
      else if (p.includes(n) && n.length >= 5) { s = 480 + n.length * 2; reason = "skrót nazwy"; }
      else {
        const pt = p.split(" ").filter(Boolean);
        const matched = pt.filter((t) => words.some((w) => tokenAlike(w, t))).length;
        const frac = pt.length ? matched / pt.length : 0;
        if (frac === 1) { s = 350 + pt.length * 15; reason = "wszystkie słowa"; }
        else if (frac >= 0.6) { s = 150 * frac + pt.length * 5; reason = "większość słów"; }
        const d = dice(n, p);
        const ds = d * 220;
        if (ds > s) { s = ds; reason = "podobna nazwa"; }
      }
      if (s > best) { best = s; why = reason; }
    }
    if (best <= 0) continue;

    // kontekst partii: nazwa mówi „triceps", więc ćwiczenie na plecy traci punkty
    if (hinted.length) {
      const pm = primaryMuscle(ex);
      const supports = ex.activation.some((a) => hinted.includes(a.muscle) && a.share >= 20);
      if (hinted.includes(pm)) best += 120;
      else if (supports) best += 45;
      else best -= 90;
    }
    scored.push({ ex, score: Math.round(best), why });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];
  const confident = !!top && top.score >= 340 && (!second || top.score - second.score >= 60);

  return {
    best: top?.ex ?? null,
    confident,
    candidates: scored.slice(0, 6).filter((c) => c.score >= 90),
  };
}

// ──────────────────────────────────────────────────────────────────
// Zapamiętane przypisania (wybór użytkownika / wynik AI)
// ──────────────────────────────────────────────────────────────────
const MAP_KEY = "wn_exercise_anatomy_map";
let mapCache: Record<string, string> | null = null;

async function loadMap(): Promise<Record<string, string>> {
  if (mapCache) return mapCache;
  try {
    const raw = await nsGet(MAP_KEY);
    mapCache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { mapCache = {}; }
  return mapCache;
}

/** Trwale przypisuje nazwę użytkownika do ćwiczenia z katalogu. */
export async function rememberMapping(rawName: string, anatomyId: string): Promise<void> {
  const key = normalizeExerciseName(rawName);
  if (!key) return;
  const m = await loadMap();
  m[key] = anatomyId;
  mapCache = m;
  try { await nsSet(MAP_KEY, JSON.stringify(m)); } catch { /* offline */ }
}

/** Usuwa zapamiętane przypisanie (gdy user chce zmienić). */
export async function forgetMapping(rawName: string): Promise<void> {
  const key = normalizeExerciseName(rawName);
  const m = await loadMap();
  if (key in m) {
    delete m[key];
    mapCache = m;
    try { await nsSet(MAP_KEY, JSON.stringify(m)); } catch { /* offline */ }
  }
}

function byId(id: string): ExerciseAnatomy | null {
  return EXERCISE_ANATOMY.find((e) => e.id === id) ?? null;
}

export interface ResolveResult {
  ex: ExerciseAnatomy | null;
  /** skąd wynik: zapamiętane / lokalne / AI / trzeba zapytać */
  source: "saved" | "local" | "ai" | "ask";
  candidates: MatchCandidate[];
}

/**
 * Pełne rozwiązanie nazwy — zapamiętane → lokalne → AI → pytanie do użytkownika.
 * `useAi=false` pomija warstwę sieciową (np. przy renderze offline).
 */
export async function resolveExercise(rawName: string, useAi = true): Promise<ResolveResult> {
  // 1) zapamiętane przypisanie
  const saved = (await loadMap())[normalizeExerciseName(rawName)];
  if (saved) {
    const ex = byId(saved);
    if (ex) return { ex, source: "saved", candidates: [] };
  }

  // 2) lokalny scoring
  const local = matchExercise(rawName);
  if (local.confident && local.best) return { ex: local.best, source: "local", candidates: local.candidates };

  // 3) AI — tylko gdy lokalnie niepewne
  if (useAi) {
    try {
      const res = await fetch("/api/exercise-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: rawName, candidates: local.candidates.map((c) => ({ id: c.ex.id, name: c.ex.name })) }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id?: string | null; confident?: boolean };
        if (data.id) {
          const ex = byId(data.id);
          if (ex && data.confident) {
            await rememberMapping(rawName, ex.id);
            return { ex, source: "ai", candidates: local.candidates };
          }
          if (ex) return { ex, source: "ask", candidates: mergeTop(local.candidates, ex) };
        }
      }
    } catch { /* offline → pytamy użytkownika */ }
  }

  // 4) trzeba zapytać
  return { ex: local.best, source: "ask", candidates: local.candidates };
}

/** Podpowiedź AI na czele listy kandydatów. */
function mergeTop(list: MatchCandidate[], ex: ExerciseAnatomy): MatchCandidate[] {
  const rest = list.filter((c) => c.ex.id !== ex.id);
  return [{ ex, score: 999, why: "podpowiedź AI" }, ...rest].slice(0, 6);
}

/** Pełna lista ćwiczeń do ręcznego wyboru (z filtrem tekstowym). */
export function searchCatalog(query: string): ExerciseAnatomy[] {
  const q = normalizeExerciseName(query);
  if (!q) return EXERCISE_ANATOMY;
  return EXERCISE_ANATOMY.filter((ex) => cachedPhrases(ex).some((p) => p.includes(q) || dice(p, q) > 0.5));
}
