/**
 * healthAlerts (Etap 2 Krok G) — analizuje wynik scanu pod kątem
 * profilu zdrowotnego usera. Zwraca listę alertów do pokazania w
 * `app/wyniki/[id]/page.tsx` (TYLKO w trybie health).
 *
 * MVP: keyword matching w `result.ingredients[].name + .original` +
 * parsing wartości odżywczych z `result.nutrition[]`. W przyszłości
 * można podłączyć dedykowaną bazę alergenów / FODMAP / itp.
 *
 * Korzysta z osobnych pól po Etap 2 Krok D decision (Q2 = A):
 *   - profile.health.allergens   — alergie POKARMOWE
 *   - profile.health.conditions  — schorzenia przewlekłe
 *   - profile.health.diabetes    — cukrzyca (osobne pole)
 *   - profile.health.pregnancy   — ciąża/karmienie
 */

import type { UserProfile, FoodAnalysisResult, CosmeticsAnalysisResult, SupplementAnalysisResult, NutritionItem } from "@/lib/types";

export interface HealthAlert {
  severity: "danger" | "warning" | "info";
  title: string;
  message: string;
  /** Wykryte składniki które wywołały alert (opcjonalne, dla expand UI) */
  ingredients?: string[];
}

// ────────────────────────────────────────────────────────────────────
// Nutrition parser (helper Q4 z analizy — Patryk explicitly poprosił)
// ────────────────────────────────────────────────────────────────────

/**
 * Parsuje wartość z NutritionItem (np. "12g", "12.5 g", "12,5g", "0,4 g")
 * do liczby gramów. Zwraca null gdy nie da się sparsować.
 *
 * Wzorce obsługiwane:
 *   "12g"        → 12
 *   "12.5g"      → 12.5
 *   "12,5 g"     → 12.5  (polski separator dziesiętny)
 *   "0,4g"       → 0.4
 *   "brak danych" → null
 *   ""           → null
 */
export function parseGrams(value: string): number | null {
  if (!value || typeof value !== "string") return null;
  // Wyczyść polski format: "12,5" → "12.5"
  const normalized = value.replace(/,/g, ".");
  // Match: liczba (z opcjonalnym . dla decimal) + opcjonalna spacja + g/ml
  const match = normalized.match(/(-?\d+\.?\d*)\s*g/i);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Wyszuka wartość po label w array nutrition. Case-insensitive,
 * partial match (np. "Cukier" matchnie "w tym cukry").
 */
export function findNutritionValue(
  nutrition: NutritionItem[] | undefined | null,
  labelKeyword: string
): number | null {
  if (!nutrition || !Array.isArray(nutrition)) return null;
  const keyLower = labelKeyword.toLowerCase();
  for (const item of nutrition) {
    if (!item?.label) continue;
    if (item.label.toLowerCase().includes(keyLower)) {
      const v = parseGrams(item.value);
      if (v !== null) return v;
    }
    // Sprawdź też `sub` (np. "w tym cukry: 12g" w sub field)
    if (item.sub && item.sub.toLowerCase().includes(keyLower)) {
      const v = parseGrams(item.sub);
      if (v !== null) return v;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// Allergy keyword maps (per allergen ID → search terms)
// ────────────────────────────────────────────────────────────────────

// POPRAWKA Krok G+ (po failed test C celiac→pszenna): keywords używają
// STEMÓW polskich (po-rdzenny core) zamiast pełnych form mianownika.
// Przykład: "pszen" matchuje pszenica/pszenna/pszenny/pszennej, ale
// nadal NIE matchuje życie/pszczyna/itp. Lista false positives
// zweryfikowana w scripts/test-stage2-smoke.mjs (false-positive guard).
//
// Known limitations:
//   - "ser " (z trailing space) w lactose keywords może łapać "serce" w
//     składach (rzadko spotykane). Lepsze niż brak ser/serek/sernik
//     coverage. Patryk-approved decision.
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  nuts: [
    "orzech", "nut", "nuts",
    "migdał", "almond",
    "nerkowiec", "cashew",
    "pistac", // pistacja/pistacji/pistacjowy
    "pekan", "pecan",
    "macadami", // macadamia/macadamii
    "laskow",   // orzechy laskowe / laskowy
    "hazelnut",
    "arachid",  // arachidy/arachidowy (orzeszki ziemne)
    // UWAGA: "ziem" zbyt szerokie (ziemniaki) — pomijamy
  ],
  fish: [
    "ryb",     // ryby/rybny/rybna
    "łoso",    // łosoś/łososia/łososiowy — stem bez 'ś' końcowego
               // (które w odmianach zmienia się na 's' lub znika)
    "tuńcz", "tuna", // tuńczyk/tuńczyka
    "sardyn", "sardine",
    "makrel", "mackerel",
    "śled",    // śledź/śledzia/śledziowy
    "dorsz",   // dorsz/dorsza/dorszowy
    "anchois", "anchovy",
    "salmon", "cod",
  ],
  eggs: [
    "jaj",     // jaja/jajko/jajek/jajeczny/jajo
    "egg",
    "albumin",
    // USUWAMY "lecytyn" — lecytyna sojowa jest WSZĘDZIE, false positive
    // dla eggs. Lecytyna jaj występuje rzadko i specyficznie nazwana
    // ("lecytyna z żółtek jaj") — wymagałaby osobnego matcha.
    "yolk", "żółtk", // żółtko/żółtka
  ],
  soy: [
    "soj",     // soja/soji/sojowy/sojowa
    "soy",
    "tofu", "tempeh", "edamame", "miso",
    "soybean",
    // "lecytyna sojowa" — najpewniej trafia w "soj" już, ale dla
    // pewności mamy też pełny term:
    "lecytyna sojowa", "soy lecithin",
  ],
  gluten: [
    "pszen",   // pszenica/pszenna/pszenny/pszennej
    "wheat",
    "żyto",    // żyto/żyta — bezpieczny stem (NIE "żyt" bo łapie "życie")
    "żytni",   // żytni/żytnia/żytnie/żytniego — odmiany przymiotnika
    "rye ",    // rye z spacją — chroni przed false positive RYE w innych słowach
    "jęczmie", // jęczmień/jęczmienny — wspólny stem (ń→n w odmianach)
    "barley",
    "ows",     // owies/owsiany/owsianka/owsa
    "oats",
    "gluten",
    "kasz",    // kasza/kasze/kaszy
    "bulgur",
    "kuskus", "couscous",
    "manna", "semolina",
    // Typy pszenicy zawierające gluten — niskie false-positive risk:
    "spelt", "orkisz",
    "kamut",
    "durum",
    "einkorn",
  ],
  shellfish: [
    "krewetk", // krewetka/krewetki — bez standalone "krew" (false pos)
    "shrimp",
    "homar", "lobster",
    "krab", "crab",
    "małż", "mussel",
    "ostryg",  // ostryga/ostrygi/ostrygowy — bez końcowego 'a'
    "oyster",
    "langust", // langusta/langusty
  ],
  sesame: ["sezam", "sesame", "tahini"],
  celery: ["seler", "celery", "celeriac"],
  fructose: [
    "fruktoz",  // fruktoza/fruktozy/fruktozowy
    "fructose",
    // Diakrytyki ó/o nie są zamienne w .includes() — musimy mieć obie:
    "miód",     // miód (mianownik)
    "miod",     // miodu/miody/miodowy (odmiany bez ó)
    "honey",
    "syrop glukozowo-fruktozowy",
    "hfcs",
    "high-fructose corn syrup",
    "agaw",   // agawa/agawy/agawowy — stem (mianownik kończy się 'a' które
              // ginie w odmianach: "syrop z agawy")
    "agave",
  ],
};

/**
 * Wyszukuje keywords w array ingredients (name + original) i zwraca
 * matching składniki (deduplicate, max 5).
 */
function findIngredientsByKeywords(
  ingredients: { name?: string; original?: string }[] | undefined,
  keywords: string[]
): string[] {
  if (!ingredients || !Array.isArray(ingredients)) return [];
  const found = new Set<string>();
  for (const ing of ingredients) {
    const text = `${ing.name || ""} ${ing.original || ""}`.toLowerCase();
    for (const kw of keywords) {
      if (text.includes(kw)) {
        const display = ing.original || ing.name || kw;
        found.add(display);
        break; // jeden składnik = jedno match wystarczy
      }
    }
  }
  return Array.from(found).slice(0, 5);
}

// ────────────────────────────────────────────────────────────────────
// MAIN: getHealthAlertsForScan
// ────────────────────────────────────────────────────────────────────

type ScanLike = FoodAnalysisResult | CosmeticsAnalysisResult | SupplementAnalysisResult;

/**
 * Zwraca listę alertów dla danego scanu + profilu.
 *
 * Pre-conditions:
 *   - Wywołać TYLKO gdy `profile.mode === "health"` (caller gating).
 *   - Caller filtruje sortuje severity.
 *
 * Tactics:
 *   - Każdy alert ma severity (danger/warning/info), title, message
 *   - Empty array = nic do pokazania (czysty produkt vs alergie usera)
 */
export function getHealthAlertsForScan(
  scan: ScanLike | null | undefined,
  profile: UserProfile | null | undefined
): HealthAlert[] {
  if (!scan || !profile?.health) return [];

  const alerts: HealthAlert[] = [];
  // Wszystkie składniki — Cosmetics/Supplement mają inne typy ale wszystkie
  // mają `name` i często `original`. Castujemy bezpiecznie.
  const allIngredients = (scan as { ingredients?: { name?: string; original?: string }[] }).ingredients || [];

  // === 1. Alergie pokarmowe (multi-iterate) ===
  const userAllergens = profile.health.allergens || [];
  for (const allergenId of userAllergens) {
    const keywords = ALLERGEN_KEYWORDS[allergenId];
    if (!keywords) continue; // unknown allergen ID, skip

    const found = findIngredientsByKeywords(allIngredients, keywords);
    if (found.length > 0) {
      const labelMap: Record<string, string> = {
        nuts: "orzechy",
        fish: "rybę",
        eggs: "jaja",
        soy: "soję",
        gluten: "gluten",
        shellfish: "skorupiaki",
        sesame: "sezam",
        celery: "seler",
      };
      const label = labelMap[allergenId] || allergenId;
      alerts.push({
        severity: "danger",
        title: `⚠️ Zawiera ${label}`,
        message: `Wykryto: ${found.join(", ")}. Produkt może wywołać reakcję alergiczną.`,
        ingredients: found,
      });
    }
  }

  // === 2. Cukrzyca — wysoka zawartość cukru ===
  // Próg FSA: 22.5g/100g = "high sugar"
  if (profile.health.diabetes && "nutrition" in scan) {
    const food = scan as FoodAnalysisResult;
    const sugarG = findNutritionValue(food.nutrition, "cukier") ?? findNutritionValue(food.nutrition, "cukry");
    if (sugarG !== null && sugarG >= 22.5) {
      alerts.push({
        severity: "warning",
        title: "🩸 Wysoka zawartość cukru",
        message: `${sugarG}g cukru/100g — wysokie wartości (FSA high: ≥22.5g). Lepiej zjeść z białkiem/tłuszczem żeby spłaszczyć krzywą glukozową.`,
      });
    }

    // Dodatkowo: użyj diabetes_info.glycemic_index jeśli AI go ustawiło
    if (food.diabetes_info?.glycemic_index === "wysoki") {
      alerts.push({
        severity: "info",
        title: "📈 Wysoki indeks glikemiczny",
        message: `WW: ${food.diabetes_info.ww_per_100g}/100g. ${food.diabetes_info.diabetes_tip || "Łącz z błonnikiem i białkiem."}`,
      });
    }
  }

  // === 3. Schorzenia z `conditions` — fallback informacyjny ===
  const conditions = profile.health.conditions || [];

  // Celiakia / nietolerancja glutenu w conditions → traktuj jak alergię gluten
  if (conditions.includes("celiac") && !userAllergens.includes("gluten")) {
    const glutenIngredients = findIngredientsByKeywords(allIngredients, ALLERGEN_KEYWORDS.gluten);
    if (glutenIngredients.length > 0) {
      alerts.push({
        severity: "danger",
        title: "⚠️ Zawiera gluten (celiakia)",
        message: `Wykryto: ${glutenIngredients.join(", ")}. NIE jeść przy celiakii.`,
        ingredients: glutenIngredients,
      });
    }
  }

  // Nietolerancja laktozy — POPRAWKA Krok G+: stem-based PL keywords.
  // "mlek" matchuje mleko/mleka/mleczny/mlekowy. "ser " ma trailing
  // space — known limitation: może łapać "serce" (rzadkie w składach).
  if (conditions.includes("lactose_intolerance")) {
    const lactoseKeywords = [
      "mlek",     // mleko/mleka/mleczny
      "milk",
      "laktoz",   // laktoza/laktozy
      "lactose",
      "serwatk",  // serwatka/serwatkowy
      "whey",
      "kazein", "casein",
      "ser ",     // ser/serek/sernik — known limitation: false positive na "serce"
      "śmietan",  // śmietana/śmietanka/śmietankowy
      "cream",
      "jogurt", "yogurt",
      "maślank",  // maślanka/maślanki
      "masło",    // masło — ALE uwaga: "masło orzechowe" nie ma laktozy.
                  // Akceptujemy edge case — user widzi alert + składnik,
                  // sam ocenia.
      "kefir",
    ];
    const found = findIngredientsByKeywords(allIngredients, lactoseKeywords);
    if (found.length > 0) {
      alerts.push({
        severity: "warning",
        title: "🥛 Zawiera laktozę",
        message: `Wykryto: ${found.join(", ")}. Możesz potrzebować laktazy lub wybrać wersję laktozową.`,
        ingredients: found,
      });
    }
  }

  // Nietolerancja fruktozy — Krok G+ (nowe): reuse ALLERGEN_KEYWORDS.fructose.
  // Łapie fruktozę bezpośrednio, miód, syropy HFCS, agawę.
  if (conditions.includes("fructose_intolerance")) {
    const found = findIngredientsByKeywords(allIngredients, ALLERGEN_KEYWORDS.fructose);
    if (found.length > 0) {
      alerts.push({
        severity: "warning",
        title: "🍎 Zawiera fruktozę",
        message: `Wykryto: ${found.join(", ")}. Możesz potrzebować suplementu ksylozy izomerazy lub unikać.`,
        ingredients: found,
      });
    }
  }

  // Refluks → bardzo kwaśne / pikantne / kofeina
  if (conditions.includes("reflux") && "nutrition" in scan) {
    const food = scan as FoodAnalysisResult;
    if (food.pregnancy_info?.caffeine_mg && food.pregnancy_info.caffeine_mg >= 50) {
      alerts.push({
        severity: "info",
        title: "🔥 Kofeina + refluks",
        message: `${food.pregnancy_info.caffeine_mg}mg kofeiny. Kofeina rozluźnia dolny zwieracz przełyku — może nasilić refluks.`,
      });
    }
  }

  // === 4. Ciąża — kofeina (info-level), alkohol (już AI flagguje w pregnancy_info) ===
  if (profile.health.pregnancy && "pregnancy_info" in scan) {
    const food = scan as FoodAnalysisResult;
    const aiPregAlerts = food.pregnancy_info?.alerts || [];
    for (const aiAlert of aiPregAlerts) {
      alerts.push({
        severity: "warning",
        title: "🤰 Uwaga w ciąży",
        message: aiAlert,
      });
    }
  }

  return alerts;
}
