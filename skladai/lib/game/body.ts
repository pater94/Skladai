/**
 * FORMA RPG — kompozycja ciała, czyli to, co widać na postaci.
 *
 * CZYSTE FUNKCJE, zero zapytań do bazy. Zamieniają rozproszone sygnały
 * (zdjęcia CheckForm, waga, dorobek siłowy) na DWIE liczby 0-100, na których
 * stoi cały wygląd awatara:
 *
 *   muscle   — umięśnienie: szerokość barków, obwód ramion, klatka
 *   leanness — wysmuklenie: talia, definicja, widoczność mięśni
 *
 * ── Dlaczego akurat dwie osie ────────────────────────────────────────────
 * Bo tak działa rekompozycja. Można schudnąć bez mięśni, przytyć w mięśnie,
 * albo robić jedno i drugie naraz. Jedna liczba („forma") skleiłaby te
 * przypadki w kłamstwo. Dwie osie pokazują je osobno i dokładnie tak samo
 * zmieniają sylwetkę, jak zmieniałaby się w lustrze.
 *
 * ── Dlaczego mediana, a nie ostatni pomiar ───────────────────────────────
 * Zdjęcie sylwetki to pomiar OBARCZONY SZUMEM. Światło, nawodnienie, pora
 * dnia, pompa po treningu i kąt aparatu potrafią przesunąć ocenę o kilka
 * punktów procentowych w każdą stronę — więcej niż realna zmiana w miesiąc.
 * Dlatego nic tu nie liczy się z jednego zdjęcia: bierzemy medianę z kilku
 * ostatnich pomiarów i przesuwamy stan powoli. Postać ma odzwierciedlać
 * TREND ciała, nie to, jak dobrze wypadło wczorajsze selfie.
 */

// ── Wejście ──────────────────────────────────────────────────────────────

/** Pojedynczy odczyt CheckForm — tyle, ile realnie wyciągamy ze skanu. */
export interface BodyReading {
  /** Dzień pomiaru, YYYY-MM-DD. */
  day: string;
  /** Środek zakresu tkanki tłuszczowej w %, np. „10-14%" → 12. Null gdy brak. */
  bodyFatPct: number | null;
  /** Ocena masy mięśniowej ze skanu. */
  muscleMass: MuscleMassLabel | null;
  /** Ile ujęć złożyło się na ten pomiar (front/bok/tył). */
  photos: number;
}

export type MuscleMassLabel = "low" | "below_average" | "average" | "above_average" | "high";

export interface BodyInput {
  gender: "male" | "female" | null;
  /** Odczyty CheckForm, dowolna kolejność. */
  readings: BodyReading[];
  /** Waga w kg, od najstarszej do najnowszej. Może być pusta. */
  weightsKg: number[];
  /** Dorobek siłowy z ostatnich 28 dni — zapasowe źródło umięśnienia. */
  volume28Kg: number;
  trainingDays28: number;
}

export interface BodyState {
  muscle: number;         // 0-100
  leanness: number;       // 0-100
  /** Ile realnych pomiarów stoi za tym stanem — steruje zaufaniem w UI. */
  samples: number;
  /** Skąd wzięło się umięśnienie i wysmuklenie. */
  source: "photos" | "training" | "mixed" | "none";
  /** Zmiana względem najstarszego okna, w punktach. Null gdy za mało danych. */
  muscleDelta: number | null;
  leannessDelta: number | null;
}

// ── Stałe ────────────────────────────────────────────────────────────────

/**
 * Ile ujęć musi mieć sesja, żeby liczyć się jako pełnoprawny pomiar.
 *
 * Jedno zdjęcie kłamie — z przodu wyjdzie inaczej niż z boku, a sam przód
 * potrafi ukryć całą dystrybucję tkanki. Trzy ujęcia to minimum, przy którym
 * ocena przestaje zależeć od tego, jak akurat stanąłeś.
 */
export const PHOTOS_PER_SESSION = 3;

/** Ile ostatnich pomiarów wchodzi do mediany. */
const WINDOW = 3;

/** Widełki tkanki tłuszczowej mapowane na wysmuklenie 0-100. */
const FAT_RANGE = {
  male: { lean: 8, fat: 32 },
  female: { lean: 16, fat: 42 },
} as const;

const MUSCLE_LABEL_SCORE: Record<MuscleMassLabel, number> = {
  low: 12,
  below_average: 32,
  average: 50,
  above_average: 72,
  high: 90,
};

// ── Narzędzia ────────────────────────────────────────────────────────────

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function median(xs: number[]): number | null {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * „10-14%" → 12. Akceptuje też „~15%", „15" i „15,5%".
 *
 * Zakres jest tu regułą, nie wyjątkiem — model celowo zwraca widełki,
 * bo pojedyncza liczba udawałaby precyzję, której ze zdjęcia nie ma.
 */
export function parseFatRange(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const nums = String(raw).replace(",", ".").match(/\d+(\.\d+)?/g);
  if (!nums?.length) return null;
  const vals = nums.map(Number).filter((n) => n > 0 && n < 70);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Procent tkanki → wysmuklenie 0-100 (mniej tłuszczu = wyżej). */
export function leannessFromFat(fatPct: number, gender: "male" | "female" | null): number {
  const r = gender === "female" ? FAT_RANGE.female : FAT_RANGE.male;
  return clamp(Math.round(((r.fat - fatPct) / (r.fat - r.lean)) * 100));
}

/**
 * Umięśnienie z samego treningu — używane, dopóki nie ma zdjęć.
 *
 * Skala celowo płaska: bez zdjęcia nie wiemy, jak ciało wygląda, więc
 * postać nie ma prawa wyglądać na wyrzeźbioną tylko dlatego, że ktoś
 * podniósł dużo kilogramów. To ma być wskazówka, nie werdykt.
 */
export function muscleFromTraining(volume28Kg: number, trainingDays28: number): number {
  const vol = clamp(Math.sqrt(Math.max(0, volume28Kg) / 40000) * 55, 0, 55);
  const rhythm = clamp((trainingDays28 / 16) * 25, 0, 25);
  return clamp(Math.round(vol + rhythm), 0, 80);
}

// ── Główna funkcja ───────────────────────────────────────────────────────

/**
 * Stan ciała na podstawie wszystkiego, co wiemy.
 *
 * Kolejność zaufania: zdjęcia (mediana z ostatnich {@link WINDOW} sesji) →
 * trening → nic. Waga sama w sobie nie przesuwa osi, bo kilogram mięśni i
 * kilogram tłuszczu ważą tyle samo; służy wyłącznie do delikatnej korekty
 * wysmuklenia, gdy widać wyraźny trend, a zdjęć brak.
 */
export function bodyStateFrom(input: BodyInput): BodyState {
  const { gender, readings, weightsKg, volume28Kg, trainingDays28 } = input;

  // Tylko sesje z kompletem ujęć — reszta to materiał poglądowy, nie pomiar.
  const solid = readings
    .filter((r) => r.photos >= PHOTOS_PER_SESSION)
    .sort((a, b) => a.day.localeCompare(b.day));

  const recent = solid.slice(-WINDOW);
  const older = solid.slice(0, -WINDOW);

  const fatNow = median(recent.map((r) => r.bodyFatPct).filter((x): x is number => x != null));
  const muscleNow = median(
    recent.map((r) => (r.muscleMass ? MUSCLE_LABEL_SCORE[r.muscleMass] : NaN)).filter(Number.isFinite),
  );

  const trainingMuscle = muscleFromTraining(volume28Kg, trainingDays28);

  let muscle: number;
  let leanness: number;
  let source: BodyState["source"];

  if (muscleNow != null && fatNow != null) {
    // Zdjęcia mają pierwszeństwo, ale trening dokłada swoje — ktoś, kto
    // ewidentnie pracuje, nie powinien wyglądać na mniej, niż na to zapracował.
    muscle = clamp(Math.round(muscleNow * 0.75 + trainingMuscle * 0.25));
    leanness = leannessFromFat(fatNow, gender);
    source = trainingDays28 > 0 ? "mixed" : "photos";
  } else if (fatNow != null) {
    muscle = trainingMuscle;
    leanness = leannessFromFat(fatNow, gender);
    source = "mixed";
  } else if (trainingDays28 > 0 || volume28Kg > 0) {
    muscle = trainingMuscle;
    // Bez zdjęcia zakładamy przeciętność i pozwalamy trendowi wagi lekko
    // przesunąć — spadek masy przy zachowanym treningu zwykle znaczy redukcję.
    leanness = clamp(50 + weightTrendNudge(weightsKg));
    source = "training";
  } else {
    return { muscle: 30, leanness: 50, samples: 0, source: "none", muscleDelta: null, leannessDelta: null };
  }

  // Zmiana względem starszych sesji — do pokazania „co się zmieniło".
  const fatOld = median(older.map((r) => r.bodyFatPct).filter((x): x is number => x != null));
  const muscleOld = median(
    older.map((r) => (r.muscleMass ? MUSCLE_LABEL_SCORE[r.muscleMass] : NaN)).filter(Number.isFinite),
  );

  return {
    muscle,
    leanness,
    samples: solid.length,
    source,
    muscleDelta: muscleOld != null && muscleNow != null ? Math.round(muscleNow - muscleOld) : null,
    leannessDelta:
      fatOld != null && fatNow != null
        ? leannessFromFat(fatNow, gender) - leannessFromFat(fatOld, gender)
        : null,
  };
}

/**
 * Delikatna korekta wysmuklenia z trendu wagi: maks. ±12 punktów.
 *
 * Celowo słaba. Waga nie odróżnia mięśni od tłuszczu, więc może tu tylko
 * szeptać, a nie decydować.
 */
function weightTrendNudge(weightsKg: number[]): number {
  if (weightsKg.length < 2) return 0;
  const first = weightsKg[0];
  const last = weightsKg[weightsKg.length - 1];
  if (!first || !last) return 0;
  const pct = ((first - last) / first) * 100;   // dodatnie = schudł
  return clamp(Math.round(pct * 2), -12, 12);
}

// ── Opis dla użytkownika ─────────────────────────────────────────────────

/** Nazwa budowy — to, co widać na karcie postaci. */
export function buildName(b: BodyState): string {
  if (b.source === "none") return "Nieznana budowa";
  const m = b.muscle, l = b.leanness;
  if (m >= 70 && l >= 70) return "Wyrzeźbiona";
  if (m >= 70 && l >= 45) return "Atletyczna";
  if (m >= 70) return "Masywna";
  if (m >= 45 && l >= 70) return "Smukła i wysportowana";
  if (m >= 45 && l >= 45) return "Wysportowana";
  if (m >= 45) return "Krzepka";
  if (l >= 70) return "Szczupła";
  if (l >= 45) return "Przeciętna";
  return "Na starcie";
}

/**
 * Czy stan opiera się na czymkolwiek solidnym.
 * Poniżej tego progu UI ma mówić „to jeszcze zgadywanie", a nie udawać pewność.
 */
export function isConfident(b: BodyState): boolean {
  return b.samples >= 2;
}
