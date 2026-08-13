/**
 * FORMA — Mapa aktywacji mięśniowej dla ćwiczeń.
 *
 * Dla każdego ćwiczenia: udział procentowy poszczególnych mięśni w pracy oraz
 * rozkład wewnątrz mięśnia (które GŁOWY pracują mocniej). Wartości są
 * szacunkowe — pochodzą z analizy biomechanicznej (ramiona dźwigni, zakres
 * ruchu, pozycja stawów) skorelowanej z danymi elektromiograficznymi (EMG)
 * z literatury. Traktuj je jako mapę akcentów treningowych, nie pomiar.
 *
 * `share`  — udział mięśnia w całkowitej pracy ćwiczenia (suma ≈ 100).
 * `heads`  — rozkład wewnątrz mięśnia w % (suma = 100 dla danego mięśnia).
 */

import type { MuscleId } from "./muscles";

export type ActivationRole = "primary" | "secondary" | "support" | "stabilizer";

export interface MuscleActivation {
  muscle: MuscleId;
  share: number;
  role: ActivationRole;
  heads?: Record<string, number>;
  /** Niuans specyficzny dla TEGO ćwiczenia. */
  note?: string;
}

export interface ExerciseAnatomy {
  id: string;
  name: string;
  /** Frazy do dopasowania nazwy wpisanej przez użytkownika (znormalizowane w runtime). */
  aliases: string[];
  /** Wzorzec ruchu — do etykiety. */
  pattern: string;
  /** Wskazówka: co zmienia akcenty w tym ćwiczeniu. */
  tip: string;
  activation: MuscleActivation[];
}

const E = (
  id: string, name: string, pattern: string, aliases: string[], tip: string,
  activation: MuscleActivation[],
): ExerciseAnatomy => ({ id, name, pattern, aliases, tip, activation });

export const EXERCISE_ANATOMY: ExerciseAnatomy[] = [
  // ───────────────────────── KLATKA ─────────────────────────
  E("bench_flat", "Wyciskanie sztangi leżąc", "Pchanie poziome",
    ["wyciskanie sztangi lezac", "wyciskanie lezac", "bench press", "wyciskanie plaskie", "lawka plaska", "benchpress", "wyciskanie sztangi na plaskiej"],
    "Szerszy chwyt → więcej klatki, wąski → więcej tricepsa. Łopatki ściągnięte i schowane w dół przez cały ruch — to chroni bark i zwiększa napięcie klatki.",
    [
      { muscle: "chest", share: 40, role: "primary", heads: { clavicular: 25, sternal: 55, abdominal: 20 }, note: "Największe napięcie w dolnej fazie (rozciągnięcie) — kontroluj opuszczanie 2–3 s." },
      { muscle: "triceps", share: 25, role: "primary", heads: { long: 25, lateral: 40, medial: 35 }, note: "Dokłada się głównie w górnej połowie ruchu (dokończenie wyprostu)." },
      { muscle: "delts", share: 22, role: "secondary", heads: { front: 82, side: 14, rear: 4 }, note: "Akton przedni pracuje mocno — dlatego rzadko potrzebuje osobnych wznosów przodem." },
      { muscle: "serratus", share: 5, role: "support" },
      { muscle: "lats", share: 3, role: "stabilizer", heads: { upper: 70, lower: 30 }, note: "Działa jak sprężyna stabilizująca — świadome „wkręcenie” barków w ławkę zwiększa siłę." },
      { muscle: "rotator_cuff", share: 3, role: "stabilizer", heads: { supraspinatus: 20, infraspinatus: 35, teres_minor: 20, subscapularis: 25 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("bench_incline", "Wyciskanie sztangi na skosie dodatnim", "Pchanie skośne w górę",
    ["wyciskanie skos gorny", "skos dodatni", "incline bench", "wyciskanie na skosie", "incline press", "wyciskanie skos"],
    "Kąt 30–45° to optimum. Powyżej 45° ćwiczenie zamienia się w wyciskanie barkowe i klatka przestaje być głównym pracownikiem.",
    [
      { muscle: "chest", share: 37, role: "primary", heads: { clavicular: 50, sternal: 40, abdominal: 10 }, note: "Najlepszy dostępny bodziec na górną (obojczykową) część klatki." },
      { muscle: "delts", share: 28, role: "primary", heads: { front: 85, side: 12, rear: 3 } },
      { muscle: "triceps", share: 25, role: "secondary", heads: { long: 28, lateral: 38, medial: 34 } },
      { muscle: "serratus", share: 4, role: "support" },
      { muscle: "rotator_cuff", share: 4, role: "stabilizer", heads: { supraspinatus: 25, infraspinatus: 35, teres_minor: 20, subscapularis: 20 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("bench_decline", "Wyciskanie na skosie ujemnym", "Pchanie skośne w dół",
    ["skos ujemny", "decline bench", "decline press", "wyciskanie skos ujemny"],
    "Największe obciążenie dolnej części klatki i najmniejszy udział barku — dobra opcja, gdy bark boli przy płaskiej ławce.",
    [
      { muscle: "chest", share: 44, role: "primary", heads: { clavicular: 12, sternal: 48, abdominal: 40 } },
      { muscle: "triceps", share: 28, role: "primary", heads: { long: 25, lateral: 40, medial: 35 } },
      { muscle: "delts", share: 16, role: "secondary", heads: { front: 80, side: 15, rear: 5 } },
      { muscle: "serratus", share: 5, role: "support" },
      { muscle: "abs", share: 4, role: "stabilizer", heads: { upper: 65, lower: 35 } },
      { muscle: "rotator_cuff", share: 3, role: "stabilizer", heads: { supraspinatus: 20, infraspinatus: 35, teres_minor: 20, subscapularis: 25 } },
    ]),
  E("db_bench", "Wyciskanie hantli leżąc", "Pchanie poziome (jednostronne)",
    ["wyciskanie hantli lezac", "hantle lezac", "dumbbell press", "wyciskanie hantlami", "wyciskanie hantli"],
    "Większy zakres ruchu niż sztanga i mocniejsze rozciągnięcie klatki na dole — kosztem ciężaru. Hantle wymagają więcej pracy stabilizatorów.",
    [
      { muscle: "chest", share: 42, role: "primary", heads: { clavicular: 25, sternal: 55, abdominal: 20 }, note: "Głębsze rozciągnięcie niż przy sztandze = silniejszy bodziec hipertroficzny." },
      { muscle: "triceps", share: 22, role: "secondary", heads: { long: 25, lateral: 40, medial: 35 } },
      { muscle: "delts", share: 22, role: "secondary", heads: { front: 80, side: 15, rear: 5 } },
      { muscle: "rotator_cuff", share: 6, role: "stabilizer", heads: { supraspinatus: 20, infraspinatus: 35, teres_minor: 20, subscapularis: 25 }, note: "Pracuje wyraźnie mocniej niż przy sztandze — hantle trzeba kontrolować w trzech płaszczyznach." },
      { muscle: "serratus", share: 5, role: "support" },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("db_incline", "Wyciskanie hantli na skosie", "Pchanie skośne w górę",
    ["wyciskanie hantli na skosie", "hantle skos", "incline dumbbell", "wyciskanie hantli skos"],
    "Połączenie najlepszego kąta na górę klatki z pełnym zakresem hantli — jedno z najskuteczniejszych ćwiczeń na górną część klatki.",
    [
      { muscle: "chest", share: 39, role: "primary", heads: { clavicular: 52, sternal: 38, abdominal: 10 } },
      { muscle: "delts", share: 27, role: "primary", heads: { front: 85, side: 12, rear: 3 } },
      { muscle: "triceps", share: 21, role: "secondary", heads: { long: 28, lateral: 38, medial: 34 } },
      { muscle: "rotator_cuff", share: 6, role: "stabilizer", heads: { supraspinatus: 25, infraspinatus: 35, teres_minor: 20, subscapularis: 20 } },
      { muscle: "serratus", share: 4, role: "support" },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("fly", "Rozpiętki", "Przywodzenie poziome (izolacja)",
    ["rozpietki", "rozpietki hantlami", "fly", "motylek", "rozpietki na skosie", "butterfly"],
    "Izolacja klatki bez tricepsa. Lekko ugięte łokcie przez cały ruch — to ćwiczenie na rozciągnięcie i kontrolę, nie na ciężar.",
    [
      { muscle: "chest", share: 62, role: "primary", heads: { clavicular: 25, sternal: 55, abdominal: 20 }, note: "Najczystsza izolacja klatki — brak tricepsa oznacza, że to klatka jest ogniwem limitującym." },
      { muscle: "delts", share: 18, role: "secondary", heads: { front: 85, side: 12, rear: 3 } },
      { muscle: "biceps", share: 6, role: "stabilizer", heads: { long: 60, short: 40 }, note: "Pracuje izometrycznie, trzymając kąt w łokciu." },
      { muscle: "serratus", share: 6, role: "support" },
      { muscle: "rotator_cuff", share: 5, role: "stabilizer", heads: { supraspinatus: 20, infraspinatus: 35, teres_minor: 20, subscapularis: 25 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("cable_fly", "Krzyżowanie linek wyciągu", "Przywodzenie poziome (stałe napięcie)",
    ["krzyzowanie linek", "cable fly", "brama", "krzyzowanie wyciagu", "crossover"],
    "Wyciąg daje stałe napięcie w całym zakresie (hantle tracą je na górze). Wysokość uchwytów wybiera część klatki: góra wyciągu → dolna klatka, dół → górna.",
    [
      { muscle: "chest", share: 64, role: "primary", heads: { clavicular: 28, sternal: 52, abdominal: 20 }, note: "Stałe napięcie także w skurczu — możesz realnie „docisnąć” ruch na końcu." },
      { muscle: "delts", share: 16, role: "secondary", heads: { front: 85, side: 12, rear: 3 } },
      { muscle: "serratus", share: 8, role: "support" },
      { muscle: "core_deep", share: 6, role: "stabilizer" },
      { muscle: "rotator_cuff", share: 6, role: "stabilizer", heads: { supraspinatus: 20, infraspinatus: 35, teres_minor: 20, subscapularis: 25 } },
    ]),
  E("pushup", "Pompki", "Pchanie poziome (masa ciała)",
    ["pompki", "push up", "pushup", "push-up", "pompka"],
    "Dodaj „plus” na końcu (wypchnięcie barków do przodu) — to jedyny moment, w którym mocno trafiasz w zębaty przedni, kluczowy dla zdrowego barku.",
    [
      { muscle: "chest", share: 36, role: "primary", heads: { clavicular: 28, sternal: 52, abdominal: 20 } },
      { muscle: "triceps", share: 24, role: "primary", heads: { long: 25, lateral: 40, medial: 35 } },
      { muscle: "delts", share: 18, role: "secondary", heads: { front: 82, side: 14, rear: 4 } },
      { muscle: "serratus", share: 9, role: "support", note: "Pompki to jedno z najlepszych ćwiczeń na zębaty przedni — sztanga tego nie daje (łopatki są zablokowane o ławkę)." },
      { muscle: "core_deep", share: 7, role: "stabilizer" },
      { muscle: "abs", share: 6, role: "stabilizer", heads: { upper: 55, lower: 45 } },
    ]),
  E("dips", "Dipy (pompki na poręczach)", "Pchanie pionowe w dół",
    ["dipy", "poreczach", "dips", "pompki na poreczach", "dip"],
    "Tułów pochylony do przodu → klatka. Tułów pionowo, łokcie przy ciele → triceps. To ty decydujesz, które ćwiczenie robisz.",
    [
      { muscle: "chest", share: 34, role: "primary", heads: { clavicular: 10, sternal: 45, abdominal: 45 }, note: "Przy pochyleniu tułowia to jedno z najsilniejszych ćwiczeń na dolną klatkę." },
      { muscle: "triceps", share: 32, role: "primary", heads: { long: 30, lateral: 40, medial: 30 } },
      { muscle: "delts", share: 16, role: "secondary", heads: { front: 85, side: 10, rear: 5 } },
      { muscle: "rotator_cuff", share: 7, role: "stabilizer", heads: { supraspinatus: 20, infraspinatus: 30, teres_minor: 20, subscapularis: 30 }, note: "Nie schodź niżej niż do 90° w łokciu, jeśli czujesz ciągnięcie z przodu barku." },
      { muscle: "serratus", share: 6, role: "support" },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
    ]),
  E("machine_press", "Wyciskanie na maszynie", "Pchanie poziome (prowadzone)",
    ["wyciskanie na maszynie", "hammer press", "maszyna klatka", "wyciskanie maszyna"],
    "Tor ruchu jest prowadzony, więc stabilizatory pracują mniej, a ty możesz bezpiecznie zejść bliżej upadku mięśniowego — świetne na koniec treningu.",
    [
      { muscle: "chest", share: 48, role: "primary", heads: { clavicular: 25, sternal: 55, abdominal: 20 } },
      { muscle: "triceps", share: 24, role: "secondary", heads: { long: 25, lateral: 40, medial: 35 } },
      { muscle: "delts", share: 20, role: "secondary", heads: { front: 85, side: 12, rear: 3 } },
      { muscle: "serratus", share: 5, role: "support" },
      { muscle: "rotator_cuff", share: 3, role: "stabilizer", heads: { supraspinatus: 20, infraspinatus: 35, teres_minor: 20, subscapularis: 25 } },
    ]),

  // ───────────────────────── PLECY ─────────────────────────
  E("pullup", "Podciąganie nachwytem", "Ciągnięcie pionowe",
    ["podciaganie nachwytem", "podciaganie", "pull up", "pullup", "pull-up", "podciagniecia"],
    "Prowadź ŁOKCIE w dół do kieszeni, nie szarp dłońmi. Pełen zwis na dole (rozciągnięcie najszerszego) to połowa wartości tego ćwiczenia.",
    [
      { muscle: "lats", share: 38, role: "primary", heads: { upper: 35, lower: 65 }, note: "Najlepsze ćwiczenie na szerokość pleców — ciąg pionowy maksymalnie angażuje włókna dolne/pionowe." },
      { muscle: "biceps", share: 15, role: "secondary", heads: { long: 62, short: 38 }, note: "Nachwyt ogranicza biceps względem podchwytu — pracuje w mniej korzystnej pozycji." },
      { muscle: "traps", share: 10, role: "secondary", heads: { upper: 15, middle: 40, lower: 45 }, note: "Część dolna pracuje mocno (obniżanie łopatki) — dlatego podciąganie tak dobrze robi na postawę." },
      { muscle: "teres_major", share: 8, role: "secondary" },
      { muscle: "rhomboids", share: 7, role: "secondary" },
      { muscle: "brachialis", share: 6, role: "secondary", note: "Przy nachwycie przejmuje dużą część pracy zginania łokcia." },
      { muscle: "forearms", share: 6, role: "support", heads: { flexors: 70, extensors: 10, brachioradialis: 20 } },
      { muscle: "delts", share: 4, role: "support", heads: { front: 10, side: 15, rear: 75 } },
      { muscle: "abs", share: 3, role: "stabilizer", heads: { upper: 40, lower: 60 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("chinup", "Podciąganie podchwytem", "Ciągnięcie pionowe (supinacja)",
    ["podciaganie podchwytem", "podchwytem", "chin up", "chinup", "chin-up"],
    "Podchwyt ustawia biceps w najsilniejszej pozycji — dlatego podciągniesz się więcej razy niż nachwytem. Świetne jako ćwiczenie na plecy I biceps jednocześnie.",
    [
      { muscle: "lats", share: 35, role: "primary", heads: { upper: 30, lower: 70 } },
      { muscle: "biceps", share: 22, role: "primary", heads: { long: 45, short: 55 }, note: "Supinacja przedramienia stawia biceps w pełnej przewadze mechanicznej — stąd większa siła." },
      { muscle: "traps", share: 9, role: "secondary", heads: { upper: 15, middle: 38, lower: 47 } },
      { muscle: "teres_major", share: 7, role: "secondary" },
      { muscle: "rhomboids", share: 6, role: "secondary" },
      { muscle: "brachialis", share: 6, role: "secondary" },
      { muscle: "forearms", share: 6, role: "support", heads: { flexors: 72, extensors: 10, brachioradialis: 18 } },
      { muscle: "abs", share: 5, role: "stabilizer", heads: { upper: 40, lower: 60 } },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
    ]),
  E("pullup_neutral", "Podciąganie chwytem neutralnym", "Ciągnięcie pionowe (chwyt młotkowy)",
    ["podciaganie chwytem neutralnym", "podciaganie neutralnym chwytem", "neutral grip pull up", "podciaganie neutralne"],
    "Chwyt neutralny jest najprzyjaźniejszy dla barku i łokcia — dobry wybór, gdy nachwyt drażni staw. Angażuje mocno mięsień ramienny, więc buduje też grubość ramion.",
    [
      { muscle: "lats", share: 37, role: "primary", heads: { upper: 32, lower: 68 } },
      { muscle: "biceps", share: 18, role: "primary", heads: { long: 55, short: 45 }, note: "Chwyt neutralny daje bicepsowi lepszą pozycję niż nachwyt, ale gorszą niż podchwyt." },
      { muscle: "traps", share: 9, role: "secondary", heads: { upper: 15, middle: 39, lower: 46 } },
      { muscle: "brachialis", share: 8, role: "secondary", note: "Chwyt neutralny stawia mięsień ramienny w najlepszej pozycji — stąd świetny wpływ na obwód ramienia." },
      { muscle: "teres_major", share: 7, role: "secondary" },
      { muscle: "rhomboids", share: 6, role: "secondary" },
      { muscle: "forearms", share: 6, role: "support", heads: { flexors: 70, extensors: 10, brachioradialis: 20 } },
      { muscle: "delts", share: 4, role: "support", heads: { front: 10, side: 15, rear: 75 } },
      { muscle: "abs", share: 3, role: "stabilizer", heads: { upper: 40, lower: 60 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("lat_pulldown", "Ściąganie drążka wyciągu górnego", "Ciągnięcie pionowe (prowadzone)",
    ["sciaganie drazka", "wyciag gorny", "lat pulldown", "sciaganie drazka wyciagu", "sciaganie", "pulldown"],
    "Nie odchylaj się mocno do tyłu — wtedy zamieniasz to w wiosłowanie. Klatka wypchnięta, drążek do góry mostka, łokcie w dół.",
    [
      { muscle: "lats", share: 42, role: "primary", heads: { upper: 32, lower: 68 } },
      { muscle: "biceps", share: 15, role: "secondary", heads: { long: 58, short: 42 } },
      { muscle: "traps", share: 11, role: "secondary", heads: { upper: 15, middle: 40, lower: 45 } },
      { muscle: "teres_major", share: 9, role: "secondary" },
      { muscle: "rhomboids", share: 8, role: "secondary" },
      { muscle: "brachialis", share: 6, role: "support" },
      { muscle: "forearms", share: 5, role: "support", heads: { flexors: 75, extensors: 10, brachioradialis: 15 } },
      { muscle: "delts", share: 4, role: "support", heads: { front: 10, side: 15, rear: 75 } },
    ]),
  E("bb_row", "Wiosłowanie sztangą", "Ciągnięcie poziome",
    ["wioslowanie sztanga", "barbell row", "wioslowanie", "wioslowanie sztanga w opadzie", "bent over row"],
    "Buduje GRUBOŚĆ pleców (podciąganie buduje szerokość). Tułów blisko równolegle do podłogi, brzuch napięty, plecy neutralne — bez bujania.",
    [
      { muscle: "lats", share: 30, role: "primary", heads: { upper: 55, lower: 45 }, note: "Ciąg poziomy mocniej angażuje włókna górne/poprzeczne niż podciąganie." },
      { muscle: "traps", share: 16, role: "primary", heads: { upper: 15, middle: 55, lower: 30 }, note: "Część środkowa to główny gracz — ściąganie łopatek do kręgosłupa." },
      { muscle: "rhomboids", share: 12, role: "primary" },
      { muscle: "erectors", share: 12, role: "secondary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 }, note: "Pracują izometrycznie, trzymając tułów w pochyleniu — to spory koszt zmęczeniowy." },
      { muscle: "delts", share: 10, role: "secondary", heads: { front: 5, side: 15, rear: 80 } },
      { muscle: "biceps", share: 9, role: "secondary", heads: { long: 55, short: 45 } },
      { muscle: "forearms", share: 6, role: "support", heads: { flexors: 75, extensors: 10, brachioradialis: 15 } },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
    ]),
  E("db_row", "Wiosłowanie hantlem", "Ciągnięcie poziome (jednostronne)",
    ["wioslowanie hantlem", "one arm row", "wioslowanie jednorącz", "wioslowanie hantla", "wioslowanie jednoracz"],
    "Podparcie zdejmuje pracę z prostowników, więc możesz skupić się w 100% na plecach. Większy zakres niż przy sztandze — pozwól łopatce wysunąć się do przodu na dole.",
    [
      { muscle: "lats", share: 38, role: "primary", heads: { upper: 55, lower: 45 } },
      { muscle: "traps", share: 15, role: "primary", heads: { upper: 18, middle: 55, lower: 27 } },
      { muscle: "rhomboids", share: 12, role: "primary" },
      { muscle: "delts", share: 10, role: "secondary", heads: { front: 5, side: 15, rear: 80 } },
      { muscle: "biceps", share: 10, role: "secondary", heads: { long: 55, short: 45 } },
      { muscle: "obliques", share: 6, role: "stabilizer", heads: { external: 55, internal: 45 }, note: "Opierają się rotacji tułowia — jednostronna praca to darmowy trening antyrotacyjny." },
      { muscle: "forearms", share: 5, role: "support", heads: { flexors: 75, extensors: 10, brachioradialis: 15 } },
      { muscle: "erectors", share: 4, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
    ]),
  E("cable_row", "Wiosłowanie na wyciągu dolnym", "Ciągnięcie poziome (siedząc)",
    ["wyciag dolny", "seated row", "wioslowanie siedzac", "wioslowanie na wyciagu", "wioslowanie wyciag"],
    "Uchwyt wąski/neutralny → więcej najszerszego. Uchwyt szeroki i łokcie na zewnątrz → więcej czworobocznego środkowego i równoległobocznych.",
    [
      { muscle: "lats", share: 34, role: "primary", heads: { upper: 55, lower: 45 } },
      { muscle: "traps", share: 18, role: "primary", heads: { upper: 12, middle: 58, lower: 30 } },
      { muscle: "rhomboids", share: 14, role: "primary" },
      { muscle: "delts", share: 10, role: "secondary", heads: { front: 5, side: 15, rear: 80 } },
      { muscle: "biceps", share: 10, role: "secondary", heads: { long: 55, short: 45 } },
      { muscle: "erectors", share: 7, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "forearms", share: 5, role: "support", heads: { flexors: 75, extensors: 10, brachioradialis: 15 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("tbar_row", "Wiosłowanie sztangą T", "Ciągnięcie poziome (podparte)",
    ["t-bar", "t bar", "sztanga t", "wioslowanie t", "tbar"],
    "Podparcie klatki eliminuje pracę prostowników i oszukiwanie tułowiem — cała praca zostaje w plecach.",
    [
      { muscle: "lats", share: 34, role: "primary", heads: { upper: 55, lower: 45 } },
      { muscle: "traps", share: 18, role: "primary", heads: { upper: 15, middle: 55, lower: 30 } },
      { muscle: "rhomboids", share: 14, role: "primary" },
      { muscle: "delts", share: 11, role: "secondary", heads: { front: 5, side: 15, rear: 80 } },
      { muscle: "biceps", share: 10, role: "secondary", heads: { long: 55, short: 45 } },
      { muscle: "forearms", share: 6, role: "support", heads: { flexors: 75, extensors: 10, brachioradialis: 15 } },
      { muscle: "erectors", share: 5, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "teres_major", share: 2, role: "support" },
    ]),
  E("deadlift", "Martwy ciąg", "Ciągnięcie z podłoża (biodrowe)",
    ["martwy ciag", "deadlift", "martwy ciag klasyczny", "martwy", "mc klasyczny"],
    "Najbardziej globalne ćwiczenie w siłowni. Sztanga blisko goleni, plecy neutralne, ruch startuje z NÓG — dopiero potem prostują się biodra.",
    [
      { muscle: "erectors", share: 21, role: "primary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 }, note: "Pracują ANTY-zgięciowo: ich zadaniem jest nie dopuścić do zaokrąglenia pleców." },
      { muscle: "glutes", share: 20, role: "primary", heads: { maximus: 85, medius: 11, minimus: 4 }, note: "Maksymalne napięcie w górnej fazie (dokończenie wyprostu bioder)." },
      { muscle: "hamstrings", share: 19, role: "primary", heads: { bf_long: 34, bf_short: 6, semitendinosus: 30, semimembranosus: 30 } },
      { muscle: "quads", share: 12, role: "secondary", heads: { rectus_femoris: 12, vastus_lateralis: 36, vastus_medialis: 28, vastus_intermedius: 24 }, note: "Pracują głównie na starcie z podłoża — im wyżej sztanga, tym mniej." },
      { muscle: "traps", share: 8, role: "secondary", heads: { upper: 58, middle: 27, lower: 15 }, note: "Utrzymują obręcz barkową izometrycznie — martwy ciąg buduje kaptury bez ani jednego szrugsa." },
      { muscle: "lats", share: 7, role: "secondary", heads: { upper: 45, lower: 55 }, note: "Trzymają sztangę przy ciele. „Włącz najszersze” = krótsza dźwignia = bezpieczniejsze plecy." },
      { muscle: "forearms", share: 6, role: "support", heads: { flexors: 78, extensors: 12, brachioradialis: 10 }, note: "Chwyt jest tu najczęstszym ogniwem limitującym — trenuj go, zanim sięgniesz po paski." },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
      { muscle: "adductors", share: 3, role: "support", heads: { magnus: 80, longus_brevis: 20 } },
    ]),
  E("rdl", "Martwy ciąg rumuński", "Zawias biodrowy",
    ["martwy ciag rumunski", "rumunski", "rdl", "romanian deadlift", "ciag rumunski"],
    "To NIE przysiad ze sztangą w ręku. Kolana lekko ugięte i nieruchome, biodra jadą do tyłu, sztanga sunie po udzie. Schodzisz tak nisko, jak pozwala rozciągnięcie dwugłowych bez zaokrąglenia pleców.",
    [
      { muscle: "hamstrings", share: 38, role: "primary", heads: { bf_long: 36, bf_short: 4, semitendinosus: 30, semimembranosus: 30 }, note: "Najlepszy bodziec na dwugłowe w ROZCIĄGNIĘCIU — ale nie trafia w głowę krótką (jednostawową)." },
      { muscle: "glutes", share: 25, role: "primary", heads: { maximus: 84, medius: 12, minimus: 4 } },
      { muscle: "erectors", share: 18, role: "primary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "adductors", share: 7, role: "secondary", heads: { magnus: 85, longus_brevis: 15 } },
      { muscle: "traps", share: 5, role: "stabilizer", heads: { upper: 60, middle: 25, lower: 15 } },
      { muscle: "forearms", share: 4, role: "support", heads: { flexors: 78, extensors: 12, brachioradialis: 10 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("shrugs", "Szrugsy (unoszenie barków)", "Elewacja łopatki",
    ["szrugsy", "shrugs", "wznosy barkow", "unoszenie barkow", "shrug", "szrugs"],
    "Ruch to unoszenie barków PIONOWO do uszu — nie krążenie. Pauza 1 s na górze robi tu więcej niż dokładanie ciężaru.",
    [
      { muscle: "traps", share: 66, role: "primary", heads: { upper: 78, middle: 18, lower: 4 }, note: "Praktycznie czysta izolacja części zstępującej (górnej)." },
      { muscle: "forearms", share: 14, role: "support", heads: { flexors: 80, extensors: 12, brachioradialis: 8 }, note: "Chwyt limituje ćwiczenie szybciej niż kaptury." },
      { muscle: "rhomboids", share: 8, role: "secondary" },
      { muscle: "delts", share: 6, role: "support", heads: { front: 20, side: 50, rear: 30 } },
      { muscle: "erectors", share: 6, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
    ]),
  E("face_pull", "Face pull", "Ciągnięcie poziome wysokie + rotacja zewnętrzna",
    ["face pull", "facepull", "przyciaganie liny do twarzy", "face pulls"],
    "Najlepsza polisa dla barków. Lina na wysokości twarzy, łokcie wysoko, na końcu ruchu ZEWNĘTRZNA rotacja — jakbyś pokazywał biceps. Lekki ciężar, 15–20 powtórzeń.",
    [
      { muscle: "delts", share: 32, role: "primary", heads: { front: 3, side: 17, rear: 80 } },
      { muscle: "traps", share: 26, role: "primary", heads: { upper: 20, middle: 45, lower: 35 } },
      { muscle: "rotator_cuff", share: 20, role: "primary", heads: { supraspinatus: 12, infraspinatus: 45, teres_minor: 33, subscapularis: 10 }, note: "Jedno z niewielu ćwiczeń, które realnie wzmacnia rotatory zewnętrzne pod obciążeniem." },
      { muscle: "rhomboids", share: 14, role: "secondary" },
      { muscle: "biceps", share: 5, role: "support", heads: { long: 60, short: 40 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("pullover", "Przenoszenie sztangi / hantla", "Wyprost ramienia w barku",
    ["pullover", "przenoszenie hantla", "przenoszenie sztangi", "przenoszenie za glowe"],
    "Ćwiczenie „pomiędzy” klatką a plecami — decyduje ustawienie łokci. Łokcie szeroko i tułów płasko → więcej klatki, łokcie blisko i tułów napięty → więcej najszerszego.",
    [
      { muscle: "lats", share: 34, role: "primary", heads: { upper: 40, lower: 60 } },
      { muscle: "chest", share: 24, role: "primary", heads: { clavicular: 15, sternal: 45, abdominal: 40 } },
      { muscle: "triceps", share: 15, role: "secondary", heads: { long: 70, lateral: 15, medial: 15 }, note: "Głowa długa pracuje mocno, bo ramię jest nad głową (jej pełne rozciągnięcie)." },
      { muscle: "teres_major", share: 10, role: "secondary" },
      { muscle: "serratus", share: 8, role: "support" },
      { muscle: "abs", share: 5, role: "stabilizer", heads: { upper: 60, lower: 40 } },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
    ]),

  // ───────────────────────── BARKI ─────────────────────────
  E("ohp", "Wyciskanie żołnierskie (OHP)", "Pchanie pionowe",
    ["wyciskanie zolnierskie", "ohp", "overhead press", "wyciskanie nad glowe", "wyciskanie sztangi stojac", "military press", "wyciskanie zolnierskie stojac"],
    "Pośladki i brzuch napięte — bez tego lędźwie przejmują ruch. Na górze schowaj głowę „przez okno” (sztanga nad środkiem stopy), to domyka pracę barku.",
    [
      { muscle: "delts", share: 42, role: "primary", heads: { front: 62, side: 33, rear: 5 }, note: "Jedyne ćwiczenie, które mocno obciąża akton przedni I boczny jednocześnie." },
      { muscle: "triceps", share: 26, role: "primary", heads: { long: 30, lateral: 38, medial: 32 } },
      { muscle: "traps", share: 12, role: "secondary", heads: { upper: 45, middle: 20, lower: 35 }, note: "Część dolna obraca łopatkę w górę — bez niej ramię nie wejdzie bezpiecznie nad głowę." },
      { muscle: "serratus", share: 7, role: "support" },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
      { muscle: "abs", share: 4, role: "stabilizer", heads: { upper: 60, lower: 40 } },
      { muscle: "chest", share: 2, role: "support", heads: { clavicular: 90, sternal: 10, abdominal: 0 } },
      { muscle: "rotator_cuff", share: 2, role: "stabilizer", heads: { supraspinatus: 35, infraspinatus: 30, teres_minor: 15, subscapularis: 20 } },
    ]),
  E("db_ohp", "Wyciskanie hantli nad głowę", "Pchanie pionowe (jednostronne)",
    ["wyciskanie hantli nad glowe", "hantli nad glowe", "wyciskanie hantli siedzac", "dumbbell shoulder press", "wyciskanie barkow hantlami"],
    "Hantle pozwalają na naturalny tor ruchu i większy zakres niż sztanga — często przyjaźniejsze dla barku. Nie zderzaj hantli na górze, zatrzymaj tuż przed.",
    [
      { muscle: "delts", share: 45, role: "primary", heads: { front: 58, side: 37, rear: 5 } },
      { muscle: "triceps", share: 24, role: "primary", heads: { long: 30, lateral: 38, medial: 32 } },
      { muscle: "traps", share: 11, role: "secondary", heads: { upper: 45, middle: 20, lower: 35 } },
      { muscle: "serratus", share: 7, role: "support" },
      { muscle: "rotator_cuff", share: 5, role: "stabilizer", heads: { supraspinatus: 35, infraspinatus: 30, teres_minor: 15, subscapularis: 20 } },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
      { muscle: "abs", share: 3, role: "stabilizer", heads: { upper: 60, lower: 40 } },
    ]),
  E("lateral_raise", "Wznosy bokiem", "Odwodzenie ramienia (izolacja)",
    ["wznosy bokiem", "wznosy hantli bokiem", "lateral raise", "odwodzenie ramion", "wznosy bokiem hantlami", "wznosy ramion bokiem"],
    "To ćwiczenie na szerokość barków. Zero zamachu — prowadź ŁOKCIAMI, kciuk lekko niżej niż mały palec, zatrzymaj na wysokości barków. Lekki ciężar, 12–20 powt.",
    [
      { muscle: "delts", share: 68, role: "primary", heads: { front: 15, side: 78, rear: 7 }, note: "Najczystszy dostępny bodziec na akton boczny — nic innego nie robi tego lepiej." },
      { muscle: "traps", share: 16, role: "secondary", heads: { upper: 62, middle: 28, lower: 10 }, note: "Powyżej wysokości barków kaptury przejmują ruch — dlatego zatrzymujemy się na poziomie barków." },
      { muscle: "rotator_cuff", share: 9, role: "support", heads: { supraspinatus: 55, infraspinatus: 20, teres_minor: 15, subscapularis: 10 }, note: "Nadgrzebieniowy inicjuje pierwsze ~15° ruchu." },
      { muscle: "serratus", share: 4, role: "support" },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("front_raise", "Wznosy przodem", "Zginanie ramienia (izolacja)",
    ["wznosy przodem", "front raise", "wznosy hantli przodem", "wznosy ramion przodem"],
    "Najbardziej zbędne ćwiczenie barkowe dla większości — akton przedni dostaje ogrom pracy z każdego wyciskania. Dodaj tylko, jeśli świadomie go specjalizujesz.",
    [
      { muscle: "delts", share: 66, role: "primary", heads: { front: 82, side: 15, rear: 3 } },
      { muscle: "chest", share: 12, role: "secondary", heads: { clavicular: 85, sternal: 15, abdominal: 0 } },
      { muscle: "traps", share: 10, role: "secondary", heads: { upper: 50, middle: 25, lower: 25 } },
      { muscle: "serratus", share: 6, role: "support" },
      { muscle: "abs", share: 3, role: "stabilizer", heads: { upper: 60, lower: 40 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("rear_fly", "Odwrotne rozpiętki", "Odwodzenie poziome (izolacja)",
    ["odwrotne rozpietki", "rear delt", "wznosy w opadzie", "reverse fly", "rozpietki w opadzie", "odwrotne rozpietki hantlami"],
    "Kciuki w dół i ruch prowadzony łokciami na zewnątrz, bez ściągania łopatek — jeśli ściągasz łopatki, robisz wiosłowanie i tylny akton oddaje pracę kapturom.",
    [
      { muscle: "delts", share: 52, role: "primary", heads: { front: 2, side: 13, rear: 85 }, note: "Tylny akton to najbardziej zaniedbana część barku — a decyduje o postawie i zdrowiu stawu." },
      { muscle: "traps", share: 20, role: "secondary", heads: { upper: 15, middle: 55, lower: 30 } },
      { muscle: "rhomboids", share: 14, role: "secondary" },
      { muscle: "rotator_cuff", share: 8, role: "support", heads: { supraspinatus: 10, infraspinatus: 50, teres_minor: 30, subscapularis: 10 } },
      { muscle: "erectors", share: 6, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
    ]),
  E("arnold", "Arnold press", "Pchanie pionowe + rotacja",
    ["arnold press", "arnold", "wyciskanie arnolda"],
    "Rotacja na starcie dodaje zakresu dla aktonu przedniego. Kosztem: mniejszy ciężar i większe wymagania wobec barku — nie dla osób z historią kontuzji.",
    [
      { muscle: "delts", share: 48, role: "primary", heads: { front: 64, side: 32, rear: 4 } },
      { muscle: "triceps", share: 21, role: "secondary", heads: { long: 30, lateral: 38, medial: 32 } },
      { muscle: "traps", share: 11, role: "secondary", heads: { upper: 45, middle: 22, lower: 33 } },
      { muscle: "rotator_cuff", share: 9, role: "support", heads: { supraspinatus: 25, infraspinatus: 30, teres_minor: 15, subscapularis: 30 }, note: "Rotacja pod obciążeniem mocno angażuje stożek — zaczynaj lekko." },
      { muscle: "serratus", share: 6, role: "support" },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
    ]),
  E("upright_row", "Podciąganie sztangi wzdłuż tułowia", "Ciągnięcie pionowe wysokie",
    ["podciaganie sztangi wzdluz tulowia", "wzdluz tulowia", "upright row", "podciaganie wzdluz"],
    "Trzymaj szerszy chwyt i nie ciągnij wyżej niż do wysokości barków — wąski chwyt + wysokie ciągnięcie to klasyczny przepis na konflikt podbarkowy.",
    [
      { muscle: "delts", share: 38, role: "primary", heads: { front: 25, side: 62, rear: 13 } },
      { muscle: "traps", share: 30, role: "primary", heads: { upper: 65, middle: 25, lower: 10 } },
      { muscle: "biceps", share: 10, role: "secondary", heads: { long: 55, short: 45 } },
      { muscle: "forearms", share: 8, role: "support", heads: { flexors: 70, extensors: 15, brachioradialis: 15 } },
      { muscle: "rhomboids", share: 8, role: "secondary" },
      { muscle: "rotator_cuff", share: 6, role: "stabilizer", heads: { supraspinatus: 40, infraspinatus: 25, teres_minor: 15, subscapularis: 20 } },
    ]),

  // ───────────────────────── RAMIONA ─────────────────────────
  E("bb_curl", "Uginanie ramion ze sztangą", "Zginanie łokcia",
    ["uginanie ramion ze sztanga", "uginanie ramion sztanga", "barbell curl", "uginanie ze sztanga", "biceps sztanga", "uginanie sztangi", "uginanie ramion"],
    "Łokcie przyklejone do tułowia, tułów nieruchomy. Jeśli musisz bujać — ciężar jest za duży i biceps oddaje pracę plecom i biodrom.",
    [
      { muscle: "biceps", share: 58, role: "primary", heads: { long: 52, short: 48 } },
      { muscle: "brachialis", share: 20, role: "primary", note: "Zawsze pracuje razem z bicepsem — to on pod spodem wypycha go do góry." },
      { muscle: "forearms", share: 13, role: "secondary", heads: { flexors: 40, extensors: 20, brachioradialis: 40 } },
      { muscle: "delts", share: 5, role: "stabilizer", heads: { front: 80, side: 15, rear: 5 } },
      { muscle: "erectors", share: 2, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("db_curl", "Uginanie hantlami", "Zginanie łokcia + supinacja",
    ["uginanie hantlami", "dumbbell curl", "uginanie hantli", "uginanie ramion hantlami", "biceps hantle"],
    "Zacznij chwytem neutralnym i OBRACAJ dłoń na zewnątrz w trakcie unoszenia — supinacja to druga funkcja bicepsa, którą sztanga pomija.",
    [
      { muscle: "biceps", share: 60, role: "primary", heads: { long: 50, short: 50 }, note: "Supinacja w trakcie ruchu dokłada bodziec, którego nie da uginanie sztangą." },
      { muscle: "brachialis", share: 18, role: "primary" },
      { muscle: "forearms", share: 14, role: "secondary", heads: { flexors: 45, extensors: 15, brachioradialis: 40 } },
      { muscle: "delts", share: 5, role: "stabilizer", heads: { front: 80, side: 15, rear: 5 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("cable_curl", "Uginanie ramion na wyciągu dolnym", "Zginanie łokcia (stałe napięcie)",
    ["uginanie ramion na wyciagu dolnym", "biceps na wyciagu", "uginanie na wyciagu", "cable curl", "uginanie ramion wyciag"],
    "Wyciąg trzyma napięcie w całym zakresie — także na samym dole i górze, gdzie hantle je tracą. Świetne na koniec treningu bicepsa, w wyższym zakresie powtórzeń.",
    [
      { muscle: "biceps", share: 57, role: "primary", heads: { long: 50, short: 50 }, note: "Stałe napięcie w pełnym zakresie — biceps nie ma momentu odpoczynku jak przy hantlach." },
      { muscle: "brachialis", share: 19, role: "primary" },
      { muscle: "forearms", share: 14, role: "secondary", heads: { flexors: 45, extensors: 15, brachioradialis: 40 } },
      { muscle: "delts", share: 5, role: "stabilizer", heads: { front: 80, side: 15, rear: 5 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
      { muscle: "erectors", share: 2, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
    ]),
  E("hammer_curl", "Uginanie młotkowe", "Zginanie łokcia (chwyt neutralny)",
    ["uginanie mlotkowe", "mlotkowe", "hammer curl", "mlotki", "uginanie mlotkowe hantlami"],
    "Chwyt neutralny przenosi pracę z bicepsa na mięsień ramienny i ramienno-promieniowy — to ćwiczenie na GRUBOŚĆ ramienia i przedramię.",
    [
      { muscle: "brachialis", share: 33, role: "primary", note: "Chwyt młotkowy stawia go w najlepszej pozycji — najskuteczniejsze ćwiczenie na ten mięsień." },
      { muscle: "biceps", share: 32, role: "primary", heads: { long: 62, short: 38 }, note: "Pracuje mniej niż przy podchwycie (brak supinacji), za to głowa długa dominuje." },
      { muscle: "forearms", share: 28, role: "primary", heads: { flexors: 25, extensors: 15, brachioradialis: 60 }, note: "Ramienno-promieniowy pracuje tu najmocniej ze wszystkich uginań." },
      { muscle: "delts", share: 4, role: "stabilizer", heads: { front: 80, side: 15, rear: 5 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("preacher_curl", "Uginanie na modlitewniku", "Zginanie łokcia (ramię z przodu)",
    ["modlitewnik", "preacher curl", "uginanie na modlitewniku", "preacher"],
    "Ramię przed tułowiem = głowa KRÓTKA bicepsa w przewadze. Nie prostuj gwałtownie na dole — w pełnym rozciągnięciu ścięgno jest najbardziej narażone.",
    [
      { muscle: "biceps", share: 62, role: "primary", heads: { long: 32, short: 68 }, note: "Ramię wysunięte do przodu skraca głowę długą i przenosi pracę na krótką." },
      { muscle: "brachialis", share: 22, role: "primary", note: "Podparcie ramienia eliminuje oszukiwanie — pracuje wyraźnie mocniej niż w uginaniu stojąc." },
      { muscle: "forearms", share: 13, role: "secondary", heads: { flexors: 45, extensors: 15, brachioradialis: 40 } },
      { muscle: "delts", share: 3, role: "stabilizer", heads: { front: 85, side: 10, rear: 5 } },
    ]),
  E("incline_curl", "Uginanie na skosie", "Zginanie łokcia (ramię z tyłu)",
    ["uginanie na skosie", "incline curl", "uginanie hantlami na skosie", "uginanie na lawce skosnej"],
    "Ramię COFNIĘTE za tułów maksymalnie rozciąga głowę długą — to najlepsze ćwiczenie na SZCZYT bicepsa. Pozwól rękom zwisać swobodnie na dole.",
    [
      { muscle: "biceps", share: 64, role: "primary", heads: { long: 72, short: 28 }, note: "Największe rozciągnięcie głowy długiej ze wszystkich uginań — silny bodziec hipertroficzny." },
      { muscle: "brachialis", share: 18, role: "primary" },
      { muscle: "forearms", share: 13, role: "secondary", heads: { flexors: 45, extensors: 15, brachioradialis: 40 } },
      { muscle: "delts", share: 5, role: "stabilizer", heads: { front: 75, side: 15, rear: 10 } },
    ]),
  E("skullcrusher", "Wyciskanie francuskie", "Prostowanie łokcia (ramię nad głową)",
    ["wyciskanie francuskie", "francuskie", "skull crusher", "skullcrusher", "lamacz czaszek", "wyciskanie francuskie lezac"],
    "Opuszczaj sztangę ZA głowę, nie do czoła — to zwiększa rozciągnięcie głowy długiej i zdejmuje nacisk z łokcia. Łokcie trzymaj nieruchomo.",
    [
      { muscle: "triceps", share: 76, role: "primary", heads: { long: 45, lateral: 30, medial: 25 }, note: "Ramię nad głową rozciąga głowę długą — najlepszy sposób, by trafić w największą część tricepsa." },
      { muscle: "forearms", share: 10, role: "support", heads: { flexors: 45, extensors: 45, brachioradialis: 10 } },
      { muscle: "delts", share: 7, role: "stabilizer", heads: { front: 80, side: 15, rear: 5 } },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
      { muscle: "abs", share: 3, role: "stabilizer", heads: { upper: 60, lower: 40 } },
    ]),
  E("pushdown", "Prostowanie ramion na wyciągu", "Prostowanie łokcia (ramię przy tułowiu)",
    ["prostowanie ramion na wyciagu", "pushdown", "prostowanie ramion", "wyciag triceps", "prostowanie na wyciagu", "triceps wyciag", "prostowanie ramion z liną"],
    "Łokcie przyklejone do boków. To ćwiczenie akcentuje głowę boczną („podkowę”) — ale samo w sobie NIE rozwinie głowy długiej, potrzebujesz do tego pracy nad głową.",
    [
      { muscle: "triceps", share: 82, role: "primary", heads: { long: 22, lateral: 45, medial: 33 }, note: "Ramię przy tułowiu = głowa długa w niekorzystnej pozycji. Świetne na boczną, słabe na długą." },
      { muscle: "forearms", share: 8, role: "support", heads: { flexors: 40, extensors: 50, brachioradialis: 10 } },
      { muscle: "delts", share: 4, role: "stabilizer", heads: { front: 60, side: 20, rear: 20 } },
      { muscle: "lats", share: 3, role: "stabilizer", heads: { upper: 60, lower: 40 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("overhead_ext", "Wyciskanie francuskie zza głowy", "Prostowanie łokcia (pełne rozciągnięcie)",
    ["wyciskanie francuskie zza glowy", "zza glowy", "overhead extension", "wyciskanie hantla zza glowy", "prostowanie zza glowy", "french press"],
    "Najlepsze ćwiczenie na głowę długą tricepsa — ramię nad głową daje jej pełne rozciągnięcie. Badania nad treningiem w rozciągnięciu pokazują tu wyraźną przewagę nad pushdownami.",
    [
      { muscle: "triceps", share: 80, role: "primary", heads: { long: 55, lateral: 24, medial: 21 }, note: "Głowa długa w maksymalnym rozciągnięciu — tu rośnie największa część tricepsa." },
      { muscle: "delts", share: 7, role: "stabilizer", heads: { front: 70, side: 25, rear: 5 } },
      { muscle: "forearms", share: 6, role: "support", heads: { flexors: 45, extensors: 45, brachioradialis: 10 } },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
      { muscle: "abs", share: 3, role: "stabilizer", heads: { upper: 65, lower: 35 } },
    ]),
  E("close_grip_bench", "Wyciskanie wąskim chwytem", "Pchanie poziome (akcent triceps)",
    ["wyciskanie waskim chwytem", "waskim chwytem", "close grip", "close grip bench", "wyciskanie waskie"],
    "Chwyt na szerokość barków (nie węziej — to obciąża nadgarstki), łokcie blisko ciała. Najcięższe ćwiczenie, jakie możesz zrobić na triceps.",
    [
      { muscle: "triceps", share: 45, role: "primary", heads: { long: 28, lateral: 40, medial: 32 }, note: "Pozwala użyć największego ciężaru ze wszystkich ćwiczeń tricepsowych." },
      { muscle: "chest", share: 30, role: "secondary", heads: { clavicular: 30, sternal: 52, abdominal: 18 } },
      { muscle: "delts", share: 17, role: "secondary", heads: { front: 85, side: 12, rear: 3 } },
      { muscle: "forearms", share: 4, role: "support", heads: { flexors: 50, extensors: 40, brachioradialis: 10 } },
      { muscle: "serratus", share: 2, role: "support" },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("diamond_pushup", "Pompki diamentowe", "Pchanie poziome wąskie (masa ciała)",
    ["pompki diamentowe", "diamentowe", "diamond pushup", "pompki waskie"],
    "Wersja pompki z maksymalnym akcentem na triceps. Jeśli bolą nadgarstki, rozsuń dłonie nieco szerzej — efekt zostanie prawie ten sam.",
    [
      { muscle: "triceps", share: 45, role: "primary", heads: { long: 27, lateral: 40, medial: 33 } },
      { muscle: "chest", share: 27, role: "secondary", heads: { clavicular: 30, sternal: 52, abdominal: 18 } },
      { muscle: "delts", share: 15, role: "secondary", heads: { front: 85, side: 12, rear: 3 } },
      { muscle: "core_deep", share: 6, role: "stabilizer" },
      { muscle: "abs", share: 5, role: "stabilizer", heads: { upper: 55, lower: 45 } },
      { muscle: "serratus", share: 2, role: "support" },
    ]),

  // ───────────────────────── NOGI ─────────────────────────
  E("squat", "Przysiad ze sztangą", "Przysiad (kolanowo-biodrowy)",
    ["przysiad ze sztanga", "back squat", "przysiad", "przysiady", "przysiad tylny", "przysiady ze sztanga"],
    "Głębokość buduje uda bardziej niż sam ciężar. Zejdź co najmniej do równoległości ud z podłogą, kolana podążają za palcami, klatka wysoko.",
    [
      { muscle: "quads", share: 35, role: "primary", heads: { rectus_femoris: 14, vastus_lateralis: 35, vastus_medialis: 28, vastus_intermedius: 23 }, note: "Prosty uda pracuje najsłabiej z czwórki — jest dwustawowy i w przysiadzie prawie nie zmienia długości." },
      { muscle: "glutes", share: 25, role: "primary", heads: { maximus: 82, medius: 14, minimus: 4 }, note: "Największe napięcie w dolnej fazie (rozciągnięcie) — dlatego głęboki przysiad tak dobrze buduje pośladki." },
      { muscle: "adductors", share: 13, role: "secondary", heads: { magnus: 72, longus_brevis: 28 }, note: "Przywodziciel wielki dokłada do prostowania bioder tyle, co niejeden hamstring." },
      { muscle: "erectors", share: 12, role: "secondary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "hamstrings", share: 8, role: "secondary", heads: { bf_long: 35, bf_short: 5, semitendinosus: 30, semimembranosus: 30 }, note: "Pracują głównie stabilizująco — przysiad nie zastąpi uginania nóg ani martwego rumuńskiego." },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
      { muscle: "abs", share: 2, role: "stabilizer", heads: { upper: 50, lower: 50 } },
      { muscle: "calves", share: 1, role: "stabilizer", heads: { gastro_medial: 30, gastro_lateral: 25, soleus: 45 } },
    ]),
  E("front_squat", "Przysiad przedni", "Przysiad (akcent czworogłowy)",
    ["przysiad przedni", "front squat", "przysiady przednie"],
    "Sztanga z przodu wymusza pionowy tułów — więcej pracy czworogłowego, mniej pleców i pośladków. Bardzo dobre dla osób, którym w tylnym przysiadzie „ucieka” tułów.",
    [
      { muscle: "quads", share: 44, role: "primary", heads: { rectus_femoris: 20, vastus_lateralis: 32, vastus_medialis: 27, vastus_intermedius: 21 }, note: "Pionowy tułów = większy udział czworogłowego niż w przysiadzie tylnym." },
      { muscle: "glutes", share: 20, role: "primary", heads: { maximus: 82, medius: 14, minimus: 4 } },
      { muscle: "erectors", share: 14, role: "secondary", heads: { iliocostalis: 28, longissimus: 44, spinalis: 28 }, note: "Pracują ciężko izometrycznie — utrzymanie klatki w górze to główny limiter tego ćwiczenia." },
      { muscle: "adductors", share: 10, role: "secondary", heads: { magnus: 70, longus_brevis: 30 } },
      { muscle: "abs", share: 5, role: "stabilizer", heads: { upper: 60, lower: 40 } },
      { muscle: "hamstrings", share: 4, role: "support", heads: { bf_long: 35, bf_short: 5, semitendinosus: 30, semimembranosus: 30 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("leg_press", "Wyciskanie nogami (suwnica)", "Pchanie nogami (prowadzone)",
    ["wyciskanie nogami", "leg press", "suwnica", "wyciskanie na suwnicy", "prasa"],
    "Stopy wyżej na platformie → więcej pośladków i dwugłowych. Niżej → więcej czworogłowego. Nie blokuj kolan na końcu i nie odrywaj lędźwi od oparcia.",
    [
      { muscle: "quads", share: 48, role: "primary", heads: { rectus_femoris: 10, vastus_lateralis: 36, vastus_medialis: 29, vastus_intermedius: 25 }, note: "Prosty uda pracuje mało — biodro jest zgięte przez cały ruch." },
      { muscle: "glutes", share: 24, role: "primary", heads: { maximus: 85, medius: 11, minimus: 4 } },
      { muscle: "adductors", share: 14, role: "secondary", heads: { magnus: 72, longus_brevis: 28 } },
      { muscle: "hamstrings", share: 9, role: "secondary", heads: { bf_long: 35, bf_short: 5, semitendinosus: 30, semimembranosus: 30 } },
      { muscle: "calves", share: 3, role: "support", heads: { gastro_medial: 32, gastro_lateral: 28, soleus: 40 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("lunges", "Wykroki", "Wypad jednonóż",
    ["wykroki", "lunges", "wykrok", "wypady", "wykroki chodzone", "walking lunge"],
    "Dłuższy krok → więcej pośladka i dwugłowego. Krótszy → więcej czworogłowego. Tułów lekko pochylony do przodu zwiększa pracę pośladka.",
    [
      { muscle: "quads", share: 34, role: "primary", heads: { rectus_femoris: 16, vastus_lateralis: 34, vastus_medialis: 28, vastus_intermedius: 22 } },
      { muscle: "glutes", share: 30, role: "primary", heads: { maximus: 72, medius: 22, minimus: 6 }, note: "Praca jednonóż mocno angażuje pośladek średni — stabilizuje miednicę przed opadaniem." },
      { muscle: "hamstrings", share: 14, role: "secondary", heads: { bf_long: 36, bf_short: 6, semitendinosus: 29, semimembranosus: 29 } },
      { muscle: "adductors", share: 10, role: "secondary", heads: { magnus: 70, longus_brevis: 30 } },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
      { muscle: "erectors", share: 4, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "calves", share: 3, role: "stabilizer", heads: { gastro_medial: 30, gastro_lateral: 25, soleus: 45 } },
    ]),
  E("bulgarian", "Przysiady bułgarskie", "Przysiad jednonóż (podparty)",
    ["przysiady bulgarskie", "bulgarskie", "bulgarian", "split squat", "przysiad bulgarski"],
    "Najlepsze ćwiczenie jednonóż na masę nóg. Duży zakres i mocne rozciągnięcie pośladka na dole. Wymaga mniej ciężaru niż przysiad przy podobnym bodźcu.",
    [
      { muscle: "quads", share: 34, role: "primary", heads: { rectus_femoris: 15, vastus_lateralis: 35, vastus_medialis: 28, vastus_intermedius: 22 } },
      { muscle: "glutes", share: 32, role: "primary", heads: { maximus: 74, medius: 21, minimus: 5 }, note: "Głębokie rozciągnięcie pośladka na dole — jeden z najlepszych bodźców hipertroficznych." },
      { muscle: "hamstrings", share: 13, role: "secondary", heads: { bf_long: 36, bf_short: 6, semitendinosus: 29, semimembranosus: 29 } },
      { muscle: "adductors", share: 10, role: "secondary", heads: { magnus: 72, longus_brevis: 28 } },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
      { muscle: "obliques", share: 3, role: "stabilizer", heads: { external: 50, internal: 50 } },
      { muscle: "calves", share: 3, role: "stabilizer", heads: { gastro_medial: 30, gastro_lateral: 25, soleus: 45 } },
    ]),
  E("leg_extension", "Prostowanie nóg", "Wyprost kolana (izolacja)",
    ["prostowanie nog", "leg extension", "prostowanie nog siedzac", "maszyna prostowanie nog"],
    "Jedyne ćwiczenie, które porządnie trafia w PROSTY UDA (biodro wyprostowane). Odchyl oparcie do tyłu, by jeszcze go wydłużyć. Pauza 1 s w skurczu.",
    [
      { muscle: "quads", share: 88, role: "primary", heads: { rectus_femoris: 28, vastus_lateralis: 28, vastus_medialis: 24, vastus_intermedius: 20 }, note: "Prosty uda pracuje tu najmocniej ze wszystkich ćwiczeń nóg — w przysiadzie jest w gorszej pozycji." },
      { muscle: "hip_flexors", share: 6, role: "support", heads: { psoas: 55, iliacus: 45 } },
      { muscle: "tibialis", share: 3, role: "stabilizer" },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("leg_curl", "Uginanie nóg", "Zgięcie kolana (izolacja)",
    ["uginanie nog", "leg curl", "uginanie nog lezac", "uginanie nog siedzac", "maszyna uginanie nog"],
    "JEDYNY sposób, by trafić w głowę krótką dwugłowego uda (jednostawową) — martwy ciąg rumuński tego nie zrobi. Dlatego oba ćwiczenia są potrzebne.",
    [
      { muscle: "hamstrings", share: 84, role: "primary", heads: { bf_long: 28, bf_short: 22, semitendinosus: 26, semimembranosus: 24 }, note: "Wersja SIEDZĄC (biodro zgięte) daje większy przyrost niż leżąc — dwugłowe pracują w rozciągnięciu." },
      { muscle: "calves", share: 9, role: "secondary", heads: { gastro_medial: 45, gastro_lateral: 40, soleus: 15 }, note: "Brzuchaty łydki przechodzi przez kolano — dokłada się do jego zginania." },
      { muscle: "glutes", share: 4, role: "stabilizer", heads: { maximus: 80, medius: 15, minimus: 5 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("hip_thrust", "Hip thrust (wypychanie bioder)", "Wyprost biodra (poziomy)",
    ["hip thrust", "wypychanie bioder", "hipthrust", "unoszenie bioder", "wypychanie bioder ze sztanga"],
    "Największe napięcie pośladka w PEŁNYM WYPROŚCIE — dokładnie tam, gdzie przysiad daje najmniej. Podbródek do klatki, żebra w dół, pauza 1–2 s na górze.",
    [
      { muscle: "glutes", share: 62, role: "primary", heads: { maximus: 86, medius: 11, minimus: 3 }, note: "Najwyższa zmierzona aktywacja pośladka wielkiego ze wszystkich popularnych ćwiczeń." },
      { muscle: "hamstrings", share: 20, role: "secondary", heads: { bf_long: 38, bf_short: 4, semitendinosus: 29, semimembranosus: 29 } },
      { muscle: "quads", share: 8, role: "secondary", heads: { rectus_femoris: 8, vastus_lateralis: 34, vastus_medialis: 30, vastus_intermedius: 28 } },
      { muscle: "adductors", share: 5, role: "support", heads: { magnus: 85, longus_brevis: 15 } },
      { muscle: "abs", share: 3, role: "stabilizer", heads: { upper: 40, lower: 60 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("calf_standing", "Wspięcia na palce stojąc", "Zgięcie podeszwowe (kolano proste)",
    ["wspiecia na palce stojac", "wspiecia stojac", "calf raise", "lydki stojac", "wspiecia na palce", "wspiecia"],
    "Kolano PROSTE = pracuje mięsień brzuchaty łydki. Pełen zakres z pauzą 2 s w rozciągnięciu (pięta nisko) — to on buduje łydki, nie szarpanie ciężarem.",
    [
      { muscle: "calves", share: 88, role: "primary", heads: { gastro_medial: 40, gastro_lateral: 33, soleus: 27 }, note: "Wyprostowane kolano stawia brzuchatego w pełnej przewadze — płaszczkowaty dokłada mniej." },
      { muscle: "tibialis", share: 4, role: "stabilizer" },
      { muscle: "quads", share: 3, role: "stabilizer", heads: { rectus_femoris: 15, vastus_lateralis: 35, vastus_medialis: 28, vastus_intermedius: 22 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
      { muscle: "forearms", share: 2, role: "support", heads: { flexors: 80, extensors: 10, brachioradialis: 10 } },
    ]),
  E("calf_seated", "Wspięcia na palce siedząc", "Zgięcie podeszwowe (kolano zgięte)",
    ["wspiecia na palce siedzac", "wspiecia siedzac", "seated calf", "lydki siedzac", "wspiecia siedzac na maszynie"],
    "Kolano ZGIĘTE wyłącza brzuchatego i izoluje PŁASZCZKOWATEGO — jedyny sposób, by go porządnie trafić. Jeśli robisz tylko wspięcia stojąc, połowa łydki nie dostaje bodźca.",
    [
      { muscle: "calves", share: 90, role: "primary", heads: { gastro_medial: 12, gastro_lateral: 10, soleus: 78 }, note: "Zgięte kolano skraca brzuchatego, więc całą pracę przejmuje płaszczkowaty." },
      { muscle: "tibialis", share: 5, role: "stabilizer" },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
    ]),
  E("goblet_squat", "Przysiad goblet", "Przysiad z obciążeniem z przodu",
    ["przysiad goblet", "goblet", "goblet squat", "przysiad z hantlem"],
    "Najlepszy przysiad do nauki wzorca — ciężar z przodu automatycznie prostuje tułów i pogłębia przysiad. Świetne rozgrzewkowo i dla początkujących.",
    [
      { muscle: "quads", share: 41, role: "primary", heads: { rectus_femoris: 18, vastus_lateralis: 33, vastus_medialis: 28, vastus_intermedius: 21 } },
      { muscle: "glutes", share: 24, role: "primary", heads: { maximus: 82, medius: 14, minimus: 4 } },
      { muscle: "adductors", share: 12, role: "secondary", heads: { magnus: 72, longus_brevis: 28 } },
      { muscle: "erectors", share: 9, role: "secondary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "abs", share: 6, role: "stabilizer", heads: { upper: 60, lower: 40 } },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
      { muscle: "hamstrings", share: 3, role: "support", heads: { bf_long: 35, bf_short: 5, semitendinosus: 30, semimembranosus: 30 } },
    ]),
  E("hack_squat", "Przysiad hack (maszyna)", "Przysiad prowadzony",
    ["przysiad hack", "hack squat", "hack", "maszyna hack"],
    "Prowadzony tor pozwala zejść nisko i blisko upadku bez ryzyka. Stopy niżej na platformie → maksymalny akcent na czworogłowy.",
    [
      { muscle: "quads", share: 55, role: "primary", heads: { rectus_femoris: 12, vastus_lateralis: 35, vastus_medialis: 29, vastus_intermedius: 24 }, note: "Jedno z najsilniejszych ćwiczeń na czworogłowy — plecy nie są ogniwem limitującym." },
      { muscle: "glutes", share: 21, role: "primary", heads: { maximus: 85, medius: 11, minimus: 4 } },
      { muscle: "adductors", share: 12, role: "secondary", heads: { magnus: 72, longus_brevis: 28 } },
      { muscle: "hamstrings", share: 7, role: "secondary", heads: { bf_long: 35, bf_short: 5, semitendinosus: 30, semimembranosus: 30 } },
      { muscle: "calves", share: 3, role: "support", heads: { gastro_medial: 32, gastro_lateral: 28, soleus: 40 } },
      { muscle: "core_deep", share: 2, role: "stabilizer" },
    ]),
  E("nordic_curl", "Nordic curl", "Zgięcie kolana (ekscentryczne)",
    ["nordic curl", "nordic", "nordic hamstring", "uginanie nordyckie"],
    "Najlepiej udokumentowane ćwiczenie prewencyjne na naderwania dwugłowego uda. Opuszczaj się maksymalnie wolno — praca ekscentryczna jest tu celem.",
    [
      { muscle: "hamstrings", share: 78, role: "primary", heads: { bf_long: 30, bf_short: 20, semitendinosus: 26, semimembranosus: 24 }, note: "Ekstremalne obciążenie ekscentryczne — w badaniach obniża ryzyko urazu dwugłowego nawet o ponad połowę." },
      { muscle: "glutes", share: 9, role: "secondary", heads: { maximus: 85, medius: 11, minimus: 4 } },
      { muscle: "calves", share: 5, role: "support", heads: { gastro_medial: 45, gastro_lateral: 40, soleus: 15 } },
      { muscle: "erectors", share: 4, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
    ]),

  E("good_morning", "Good morning", "Zawias biodrowy (sztanga na barkach)",
    ["good morning", "dzien dobry", "sklony ze sztanga", "good mornings"],
    "Sztanga na barkach wydłuża dźwignię dla prostowników — zaczynaj lekko. Kolana miękkie, biodra w tył, kręgosłup neutralny, schodzisz do rozciągnięcia dwugłowych.",
    [
      { muscle: "hamstrings", share: 34, role: "primary", heads: { bf_long: 36, bf_short: 4, semitendinosus: 30, semimembranosus: 30 }, note: "Pracują w mocnym rozciągnięciu — jeden z najsilniejszych bodźców na tylną taśmę." },
      { muscle: "erectors", share: 28, role: "primary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 }, note: "Utrzymanie neutralnego kręgosłupa jest tu ogniwem limitującym." },
      { muscle: "glutes", share: 24, role: "primary", heads: { maximus: 85, medius: 11, minimus: 4 } },
      { muscle: "adductors", share: 7, role: "secondary", heads: { magnus: 85, longus_brevis: 15 } },
      { muscle: "core_deep", share: 4, role: "stabilizer" },
      { muscle: "traps", share: 3, role: "stabilizer", heads: { upper: 60, middle: 25, lower: 15 } },
    ]),
  E("sumo_deadlift", "Martwy ciąg sumo", "Ciągnięcie z podłoża (szeroka postawa)",
    ["martwy ciag sumo", "sumo deadlift", "sumo", "martwy sumo"],
    "Szeroka postawa skraca drogę sztangi i przesuwa akcent z prostowników na czworogłowe i przywodziciele. Kolana na zewnątrz, klatka wysoko, sztanga blisko goleni.",
    [
      { muscle: "glutes", share: 24, role: "primary", heads: { maximus: 82, medius: 14, minimus: 4 } },
      { muscle: "quads", share: 20, role: "primary", heads: { rectus_femoris: 12, vastus_lateralis: 35, vastus_medialis: 29, vastus_intermedius: 24 }, note: "Wersja sumo obciąża czworogłowe wyraźnie mocniej niż klasyk." },
      { muscle: "adductors", share: 18, role: "primary", heads: { magnus: 75, longus_brevis: 25 }, note: "Szeroka postawa czyni z przywodzicieli jednego z głównych graczy." },
      { muscle: "hamstrings", share: 15, role: "secondary", heads: { bf_long: 34, bf_short: 6, semitendinosus: 30, semimembranosus: 30 } },
      { muscle: "erectors", share: 13, role: "secondary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 }, note: "Pracują mniej niż w martwym klasycznym — tułów jest bardziej pionowy." },
      { muscle: "traps", share: 5, role: "stabilizer", heads: { upper: 60, middle: 25, lower: 15 } },
      { muscle: "forearms", share: 5, role: "support", heads: { flexors: 78, extensors: 12, brachioradialis: 10 } },
    ]),
  E("hip_abduction", "Odwodzenie nóg na maszynie", "Odwodzenie uda",
    ["odwodzenie nog", "odwodzenie na maszynie", "hip abduction", "abduktory", "odwodziciele"],
    "To ćwiczenie na pośladek ŚREDNI, nie wielki. Lekkie pochylenie tułowia do przodu zwiększa jego udział. Kontrola ważniejsza od ciężaru.",
    [
      { muscle: "glutes", share: 68, role: "primary", heads: { maximus: 25, medius: 60, minimus: 15 }, note: "Najlepsza izolacja pośladka średniego — tego, który stabilizuje miednicę i chroni kolano." },
      { muscle: "quads", share: 10, role: "secondary", heads: { rectus_femoris: 10, vastus_lateralis: 45, vastus_medialis: 25, vastus_intermedius: 20 } },
      { muscle: "core_deep", share: 8, role: "stabilizer" },
      { muscle: "hamstrings", share: 8, role: "support", heads: { bf_long: 40, bf_short: 10, semitendinosus: 25, semimembranosus: 25 } },
      { muscle: "erectors", share: 6, role: "stabilizer", heads: { iliocostalis: 40, longissimus: 40, spinalis: 20 } },
    ]),
  E("hip_adduction", "Przywodzenie nóg na maszynie", "Przywodzenie uda",
    ["przywodzenie nog", "przywodzenie na maszynie", "hip adduction", "adduktory", "przywodziciele maszyna"],
    "Trenuj przywodziciele w pełnym rozciągnięciu — to one najczęściej ulegają naciągnięciu w sportach ze sprintem i zmianą kierunku.",
    [
      { muscle: "adductors", share: 74, role: "primary", heads: { magnus: 60, longus_brevis: 40 }, note: "Praca w rozciągnięciu realnie obniża ryzyko naciągnięcia pachwiny." },
      { muscle: "quads", share: 10, role: "secondary", heads: { rectus_femoris: 15, vastus_lateralis: 25, vastus_medialis: 40, vastus_intermedius: 20 } },
      { muscle: "core_deep", share: 8, role: "stabilizer" },
      { muscle: "glutes", share: 5, role: "support", heads: { maximus: 60, medius: 25, minimus: 15 } },
      { muscle: "hamstrings", share: 3, role: "support", heads: { bf_long: 30, bf_short: 10, semitendinosus: 30, semimembranosus: 30 } },
    ]),
  E("step_up", "Wejścia na skrzynię", "Wypad jednonóż w górę",
    ["wejscia na skrzynie", "step up", "wejscia na podest", "wchodzenie na skrzynie"],
    "Cały ciężar ma iść przez nogę na skrzyni — nie odbijaj się nogą dolną. Im wyższa skrzynia, tym więcej pośladka.",
    [
      { muscle: "quads", share: 36, role: "primary", heads: { rectus_femoris: 16, vastus_lateralis: 34, vastus_medialis: 28, vastus_intermedius: 22 } },
      { muscle: "glutes", share: 32, role: "primary", heads: { maximus: 72, medius: 22, minimus: 6 }, note: "Praca jednonóż mocno angażuje pośladek średni — stabilizuje miednicę." },
      { muscle: "hamstrings", share: 14, role: "secondary", heads: { bf_long: 36, bf_short: 6, semitendinosus: 29, semimembranosus: 29 } },
      { muscle: "adductors", share: 9, role: "secondary", heads: { magnus: 70, longus_brevis: 30 } },
      { muscle: "core_deep", share: 5, role: "stabilizer" },
      { muscle: "calves", share: 4, role: "support", heads: { gastro_medial: 32, gastro_lateral: 28, soleus: 40 } },
    ]),
  E("glute_kickback", "Wyprost nogi w tył (wyciąg)", "Wyprost biodra jednonóż",
    ["wyprost nogi w tyl", "glute kickback", "kickback", "zakopywanie", "wymachy w tyl"],
    "Izolacja pośladka wielkiego. Miednica nieruchoma — jeśli odchylasz się w bok albo prostujesz lędźwie, ruch przejmują prostowniki.",
    [
      { muscle: "glutes", share: 62, role: "primary", heads: { maximus: 88, medius: 9, minimus: 3 }, note: "Najczystsza izolacja pośladka wielkiego w pełnym wyproście biodra." },
      { muscle: "hamstrings", share: 24, role: "secondary", heads: { bf_long: 40, bf_short: 4, semitendinosus: 28, semimembranosus: 28 } },
      { muscle: "erectors", share: 8, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "core_deep", share: 6, role: "stabilizer" },
    ]),
  E("seated_leg_curl", "Uginanie nóg siedząc", "Zgięcie kolana (biodro zgięte)",
    ["uginanie nog siedzac", "seated leg curl", "uginanie siedzac", "zginanie nog siedzac"],
    "Wersja SIEDZĄC daje większe przyrosty niż leżąc, bo biodro jest zgięte i dwugłowe pracują w rozciągnięciu. Jeśli masz do wyboru jedną — wybierz tę.",
    [
      { muscle: "hamstrings", share: 84, role: "primary", heads: { bf_long: 30, bf_short: 22, semitendinosus: 25, semimembranosus: 23 }, note: "Zgięte biodro rozciąga głowy dwustawowe — silniejszy bodziec niż w wersji leżąc." },
      { muscle: "calves", share: 9, role: "secondary", heads: { gastro_medial: 45, gastro_lateral: 40, soleus: 15 } },
      { muscle: "glutes", share: 4, role: "stabilizer", heads: { maximus: 80, medius: 15, minimus: 5 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
    ]),
  E("smith_squat", "Przysiad w maszynie Smitha", "Przysiad prowadzony",
    ["przysiad w smithie", "smith squat", "przysiad smith", "maszyna smitha"],
    "Prowadzony tor pozwala ustawić stopy dalej przed sobą i mocniej zaakcentować czworogłowe albo pośladki. Mniej pracy stabilizatorów niż w wolnym przysiadzie.",
    [
      { muscle: "quads", share: 42, role: "primary", heads: { rectus_femoris: 13, vastus_lateralis: 35, vastus_medialis: 28, vastus_intermedius: 24 } },
      { muscle: "glutes", share: 24, role: "primary", heads: { maximus: 82, medius: 14, minimus: 4 } },
      { muscle: "adductors", share: 13, role: "secondary", heads: { magnus: 72, longus_brevis: 28 } },
      { muscle: "hamstrings", share: 8, role: "secondary", heads: { bf_long: 35, bf_short: 5, semitendinosus: 30, semimembranosus: 30 } },
      { muscle: "erectors", share: 8, role: "secondary", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "core_deep", share: 3, role: "stabilizer" },
      { muscle: "calves", share: 2, role: "stabilizer", heads: { gastro_medial: 30, gastro_lateral: 25, soleus: 45 } },
    ]),

  // ───────────────────────── CORE ─────────────────────────
  E("plank", "Deska (plank)", "Antywyprost (izometria)",
    ["deska", "plank", "deska przodem", "planek"],
    "To ćwiczenie ANTYRUCHOWE — zadaniem brzucha jest nie pozwolić miednicy opaść. Podwiń miednicę i ściśnij pośladki; 30 s w pełnym napięciu bije 3 minuty w zwisie.",
    [
      { muscle: "core_deep", share: 32, role: "primary", note: "Deska to przede wszystkim trening poprzecznego brzucha — czyli naturalnego pasa stabilizującego." },
      { muscle: "abs", share: 30, role: "primary", heads: { upper: 45, lower: 55 } },
      { muscle: "obliques", share: 16, role: "secondary", heads: { external: 55, internal: 45 } },
      { muscle: "glutes", share: 8, role: "secondary", heads: { maximus: 85, medius: 12, minimus: 3 } },
      { muscle: "delts", share: 6, role: "stabilizer", heads: { front: 70, side: 25, rear: 5 } },
      { muscle: "serratus", share: 5, role: "support" },
      { muscle: "erectors", share: 3, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
    ]),
  E("crunch", "Brzuszki", "Zgięcie tułowia (od góry)",
    ["brzuszki", "crunch", "spiecia brzucha", "spiecia", "crunches"],
    "Przybliżasz KLATKĘ do miednicy → akcent na włókna górne. Nie ciągnij za głowę, zakres jest krótki. Aby brzuch rósł, dokładaj obciążenie — nie powtórzenia.",
    [
      { muscle: "abs", share: 66, role: "primary", heads: { upper: 68, lower: 32 } },
      { muscle: "obliques", share: 18, role: "secondary", heads: { external: 55, internal: 45 } },
      { muscle: "core_deep", share: 10, role: "support" },
      { muscle: "hip_flexors", share: 6, role: "support", heads: { psoas: 55, iliacus: 45 }, note: "Im bardziej prostujesz nogi, tym mocniej zginacze bioder przejmują ruch." },
    ]),
  E("leg_raise", "Unoszenie nóg w zwisie", "Zgięcie tułowia (od dołu)",
    ["unoszenie nog w zwisie", "unoszenie nog", "leg raise", "unoszenie kolan", "unoszenie nog na drazku", "hanging leg raise"],
    "Kluczowa zasada: PODWIŃ miednicę do tyłu na końcu ruchu. Samo unoszenie nóg to praca zginaczy bioder, nie brzucha — dopiero podwinięcie miednicy włącza włókna dolne.",
    [
      { muscle: "abs", share: 45, role: "primary", heads: { upper: 28, lower: 72 }, note: "Włókna dolne pracują najmocniej — ale tylko jeśli faktycznie podwijasz miednicę." },
      { muscle: "hip_flexors", share: 26, role: "primary", heads: { psoas: 58, iliacus: 42 }, note: "Bez podwinięcia miednicy to głównie ich ćwiczenie, a nie brzucha." },
      { muscle: "obliques", share: 12, role: "secondary", heads: { external: 55, internal: 45 } },
      { muscle: "core_deep", share: 8, role: "support" },
      { muscle: "lats", share: 5, role: "stabilizer", heads: { upper: 50, lower: 50 } },
      { muscle: "forearms", share: 4, role: "support", heads: { flexors: 80, extensors: 10, brachioradialis: 10 } },
    ]),
  E("russian_twist", "Russian twist", "Rotacja tułowia",
    ["russian twist", "skrety rosyjskie", "skrety tulowia", "russian twists"],
    "Ruch ma iść z KLATKI, nie z rąk. Uważaj z ciężarem i dużym zakresem — rotacja pod dużym obciążeniem to spore wymaganie dla odcinka lędźwiowego.",
    [
      { muscle: "obliques", share: 52, role: "primary", heads: { external: 52, internal: 48 } },
      { muscle: "abs", share: 24, role: "secondary", heads: { upper: 55, lower: 45 } },
      { muscle: "core_deep", share: 12, role: "support" },
      { muscle: "hip_flexors", share: 7, role: "support", heads: { psoas: 55, iliacus: 45 } },
      { muscle: "erectors", share: 5, role: "stabilizer", heads: { iliocostalis: 40, longissimus: 40, spinalis: 20 } },
    ]),
  E("ab_wheel", "Kółko (ab wheel)", "Antywyprost dynamiczny",
    ["ab wheel", "kolko", "rolka", "kolko do brzucha", "ab roller"],
    "Jedno z najtrudniejszych ćwiczeń na brzuch. Miednica podwinięta przez cały ruch — jeśli lędźwie zaczynają się wyginać, skróć zakres. Zaczynaj z kolan.",
    [
      { muscle: "abs", share: 44, role: "primary", heads: { upper: 50, lower: 50 }, note: "Praca ekscentryczna przeciw wyprostowi kręgosłupa — bardzo silny bodziec." },
      { muscle: "core_deep", share: 22, role: "primary" },
      { muscle: "obliques", share: 12, role: "secondary", heads: { external: 55, internal: 45 } },
      { muscle: "lats", share: 10, role: "secondary", heads: { upper: 45, lower: 55 }, note: "Hamują ruch ramion — dlatego po kółku plecy potrafią być obolałe." },
      { muscle: "triceps", share: 5, role: "stabilizer", heads: { long: 60, lateral: 20, medial: 20 } },
      { muscle: "erectors", share: 4, role: "stabilizer", heads: { iliocostalis: 30, longissimus: 45, spinalis: 25 } },
      { muscle: "delts", share: 3, role: "stabilizer", heads: { front: 70, side: 20, rear: 10 } },
    ]),
];

// ──────────────────────────────────────────────────────────────────
// Dopasowanie nazwy ćwiczenia → profil anatomiczny
// ──────────────────────────────────────────────────────────────────

/** Normalizacja: małe litery, bez ogonków, tylko litery/cyfry + pojedyncze spacje. */
export function normalizeExerciseName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Pre-liczona, znormalizowana lista aliasów (najdłuższe najpierw = najbardziej specyficzne). */
const ALIAS_INDEX: Array<{ alias: string; ex: ExerciseAnatomy }> = EXERCISE_ANATOMY
  .flatMap((ex) => [ex.name, ...ex.aliases].map((a) => ({ alias: normalizeExerciseName(a), ex })))
  .filter((x) => x.alias.length > 0)
  .sort((a, b) => b.alias.length - a.alias.length);

/** Aliasy rozbite na tokeny (do etapu 2 dopasowania). */
const TOKEN_INDEX = ALIAS_INDEX
  .map(({ alias, ex }) => ({ tokens: alias.split(" ").filter(Boolean), alias, ex }))
  .filter((x) => x.tokens.length >= 2);

/**
 * Dopasowuje dowolną nazwę ćwiczenia (wpisaną ręcznie lub odczytaną przez AI)
 * do profilu anatomicznego. Dwa etapy:
 *
 *  1. Dopasowanie ciągłe — wygrywa NAJDŁUŻSZY alias będący podciągiem nazwy.
 *     Dzięki temu „wyciskanie hantli na skosie” trafia w hantle, nie w sztangę.
 *  2. Dopasowanie tokenowe (gdy etap 1 zawiedzie) — alias pasuje, jeśli WSZYSTKIE
 *     jego słowa występują w nazwie w dowolnej kolejności. Obsługuje wtrącenia,
 *     np. „wyciskanie SZTANGI na skosie” → alias „wyciskanie na skosie”.
 *     Wygrywa alias o największej liczbie trafionych słów.
 */
export function matchExerciseAnatomy(name: string): ExerciseAnatomy | null {
  const n = normalizeExerciseName(name);
  if (!n) return null;

  // Etap 1 — podciąg (najbardziej specyficzny alias wygrywa)
  for (const { alias, ex } of ALIAS_INDEX) {
    if (n === alias || n.includes(alias)) return ex;
  }

  // Etap 2 — wszystkie słowa aliasu obecne w nazwie
  const words = new Set(n.split(" ").filter(Boolean));
  let best: { score: number; len: number; ex: ExerciseAnatomy } | null = null;
  for (const { tokens, alias, ex } of TOKEN_INDEX) {
    if (!tokens.every((t) => words.has(t))) continue;
    const score = tokens.length;
    if (!best || score > best.score || (score === best.score && alias.length > best.len)) {
      best = { score, len: alias.length, ex };
    }
  }
  return best ? best.ex : null;
}

/** Aktywacje posortowane malejąco po udziale. */
export function sortedActivation(ex: ExerciseAnatomy): MuscleActivation[] {
  return [...ex.activation].sort((a, b) => b.share - a.share);
}
