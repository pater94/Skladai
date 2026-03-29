import { NextRequest, NextResponse } from "next/server";
import type { ScanMode } from "@/lib/types";

export const maxDuration = 60;

// ==================== STEP 1: READ LABEL (OCR) ====================

const READ_FOOD_LABEL = `Jesteś precyzyjnym czytnikiem tekstu. Twoim JEDYNYM zadaniem jest DOKŁADNE odczytanie KAŻDEGO tekstu widocznego na zdjęciu etykiety produktu spożywczego.

PROCEDURA ODCZYTU — WYKONAJ KROK PO KROKU:

KROK 1 — NAZWA PRODUKTU:
Znajdź NAJWIĘKSZY, NAJWYRAŹNIEJSZY tekst na opakowaniu. To jest nazwa produktu.
NIE jest to: lista składników, nazwa producenta ani wartość odżywcza.
Przykłady: "Wafle ryżowe z solą morską", "Jogurt naturalny", "Ketchup łagodny"

KROK 2 — MARKA:
Znajdź logo lub nazwę firmy/producenta. Zwykle na górze lub dole opakowania.

KROK 3 — WAGA:
Szukaj: "200 g", "500 ml", "1 L" itp.

KROK 4 — LISTA SKŁADNIKÓW:
Znajdź sekcję zaczynającą się od "Składniki:", "Skład:", "Ingredients:"
Przepisz KAŻDY składnik DOKŁADNIE jak jest napisany, zachowując kolejność.
Alergeny zwykle są POGRUBIONE lub WIELKIMI LITERAMI.

KROK 5 — TABELA WARTOŚCI ODŻYWCZYCH:
Znajdź tabelę. Przepisz KAŻDĄ wartość CYFRA PO CYFRZE.
UWAGA: Nie zamieniaj wartości miejscami! Tłuszcz ≠ białko ≠ węglowodany.
Zwróć uwagę czy to "na 100g" czy "na porcję" — podaj NA 100g.

KROK 6 — ALERGENY:
"Zawiera:" lub "Może zawierać:" — przepisz dokładnie.

ODPOWIEDŹ (dokładnie ten format):

NAZWA: [tekst]
MARKA: [tekst]
WAGA: [tekst]
SKŁADNIKI: [pełna lista, dokładnie jak na etykiecie]
ALERGENY ZAWIERA: [lista]
ALERGENY MOŻE ZAWIERAĆ: [lista]
WARTOŚCI ODŻYWCZE NA 100g:
Energia: [X] kcal
Tłuszcz: [X] g
  w tym nasycone: [X] g
Węglowodany: [X] g
  w tym cukry: [X] g
Białko: [X] g
Sól: [X] g
Błonnik: [X] g

ZASADY KRYTYCZNE:
- Przepisuj DOKŁADNIE co widzisz, litera po literze, cyfra po cyfrze
- NIGDY nie zgaduj wartości których nie widzisz — napisz "niewidoczne"
- Jeśli tekst jest rozmazany/nieczytelny, napisz "nieczytelne" i opisz co MOŻESZ odczytać
- Jeśli widzisz kilka produktów na zdjęciu, odczytaj NAJWIĘKSZY/NAJBLIŻSZY
- Nazwa produktu to NIGDY nie jest pierwszy składnik z listy składników
- NIGDY nie zgaduj nazwy produktu na podstawie jednego składnika. Jeśli nie widzisz nazwy — napisz "NAZWA: niewidoczna"
- Jeśli etykieta jest w wielu językach — szukaj POLSKIEJ wersji nazwy/składników najpierw, potem angielskiej
- Jeśli zdjęcie jest obrócone lub pod kątem — odczytaj tekst mimo to (obrót nie zmienia liter)
- WALIDACJA: sprawdź czy wartości odżywcze pasują do produktu. Sól ma 0g białka/węgli/tłuszczu. Jeśli widzisz białko 2.4g i węgle 9.4g — to NIE JEST sól, nawet jeśli chlorek sodu jest na liście składników
- Tabela wartości odżywczych jest KLUCZOWA — jeśli ją widzisz, MUSISZ ją odczytać. Nie pisz "brak danych" jeśli tabela jest widoczna na zdjęciu`;

const READ_COSMETICS_LABEL = `Jesteś precyzyjnym czytnikiem tekstu. Odczytaj DOKŁADNIE cały tekst ze zdjęcia etykiety kosmetyku.

PROCEDURA:
1. NAZWA — największy tekst marketingowy na opakowaniu (np. "Żel pod prysznic", "Szampon do włosów suchych")
   - Podaj nazwę PO POLSKU — jeśli jest polska wersja na etykiecie, użyj jej
   - Jeśli etykieta jest w innym języku, PRZETŁUMACZ na polski (np. "Gel douche" → "Żel pod prysznic")
   - Jeśli widzisz kilka języków, szukaj polskiego najpierw
   - Jeśli NIE WIDZISZ nazwy — napisz "NAZWA: niewidoczna", NIE wymyślaj
2. MARKA — logo/producent. Jeśli nie widać — "niewidoczna", NIE zgaduj.
3. POJEMNOŚĆ — "200 ml", "50 g"
4. TYP — rozróżniaj DOKŁADNIE: żel pod prysznic / sól do kąpieli / szampon / odżywka / krem / serum / tonik / peeling / masło do ciała / mleczko / olejek / balsam / pasta do zębów / deodorant / inne
   WAŻNE: Jeśli pierwszy składnik to Sodium Chloride + produkt ma granulki/kryształki → TYP: sól do kąpieli (NIE żel pod prysznic)
5. LISTA SKŁADNIKÓW — sekcja po "Ingredients:", "INCI:", "Skład:" — lista po łacinie oddzielona przecinkami
   - PRZEPISUJ DOKŁADNIE każdy składnik
   - NIGDY nie dodawaj składników których nie widzisz
   - Jeśli lista nieczytelna — napisz "nieczytelne"
6. OSTRZEŻENIA — tekst po "Uwaga:", "Caution:", "Warning:"

ODPOWIEDŹ:
NAZWA: [polska nazwa produktu LUB niewidoczna]
MARKA: [marka LUB niewidoczna]
POJEMNOŚĆ: [tekst]
TYP: [dokładny typ kosmetyku]
SKŁADNIKI: [pełna lista, dokładnie jak na etykiecie]
OSTRZEŻENIA: [tekst]

ZASADY KRYTYCZNE:
- Przepisuj TYLKO to co widzisz — NIGDY nie wymyślaj składników z pamięci
- Jeśli kojarzysz markę/produkt — IGNORUJ tę wiedzę, opisuj WYŁĄCZNIE to co jest na zdjęciu
- "nieczytelne" jeśli tekst niewidoczny, NIE uzupełniaj z głowy`;

// ==================== STEP 2: ANALYZE (with image cross-reference) ====================

const FOOD_ANALYSIS = `Jesteś ekspertem od żywienia. Otrzymujesz:
1. ODCZYTANY TEKST z etykiety (z kroku OCR)
2. ORYGINALNE ZDJĘCIE etykiety (do weryfikacji)

Twoim zadaniem jest PRZEANALIZOWAĆ produkt i zwrócić JSON.

KRYTYCZNE ZASADY:
- Nazwa produktu = ta z ODCZYTANEGO TEKSTU, NIE wymyślaj innej. Jeśli OCR napisał "NAZWA: niewidoczna" — wpisz "Nieznany produkt", NIE zgaduj
- Wartości odżywcze = DOKŁADNIE z odczytanego tekstu, NIE zgaduj. Jeśli OCR podał wartości (np. białko 2.4g, węgle 9.4g) — UŻYJ ICH w polu nutrition, nie wpisuj "brak danych"
- Jeśli wartość jest "nieczytelne" lub "niewidoczne" — WTEDY wpisz "brak danych"
- Zweryfikuj z obrazem: czy nazwa się zgadza? Czy wartości wyglądają poprawnie?
- WALIDACJA: suma tłuszcz + węgle + białko (w gramach) NIE MOŻE przekroczyć 100g na 100g produktu
- NIE ZGADUJ produktu na podstawie jednego składnika! Jeśli widzisz chlorek sodu ale wartości to białko 2.4g, węgle 9.4g — to NIE JEST sól. Porównaj SKŁAD z WARTOŚCIAMI ODŻYWCZYMI żeby prawidłowo zidentyfikować produkt
- Jeśli OCR odczytał temperaturę przechowywania (-18°C) — to jest mrożonka, nie sól
- PRIORYTET: nazwa z etykiety > zgadywanie. Jeśli nie widzisz nazwy — napisz "Nieznany produkt" i analizuj skład który MASZ

Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown):
{
  "name": "Nazwa produktu (DOKŁADNIE z odczytu)",
  "brand": "Marka",
  "weight": "Waga",
  "score": 7,
  "verdict_short": "Dobry/Doskonały/Przeciętny/Słaby/Unikaj",
  "verdict": "2-3 zdania Z CHARAKTEREM (patrz styl poniżej)",
  "ingredients": [
    {"name": "Nazwa składnika", "original": "Jak na etykiecie", "category": "natural|processed|controversial|harmful", "risk": "safe|caution|warning", "explanation": "Wyjaśnienie po ludzku"}
  ],
  "allergens": ["Mleko", "Gluten"],
  "pros": ["Plus 1", "Plus 2"],
  "cons": ["Minus 1", "Minus 2"],
  "tip": "Praktyczna rada",
  "nutrition": [
    {"label": "Energia", "value": "X kcal", "icon": "⚡"},
    {"label": "Tłuszcz", "value": "X g", "icon": "🫧", "sub": "nasycone: X g"},
    {"label": "Węglowodany", "value": "X g", "icon": "🍞", "sub": "w tym cukry: X g"},
    {"label": "Białko", "value": "X g", "icon": "💪"},
    {"label": "Sól", "value": "X g", "icon": "🧂"}
  ],
  "sugar_teaspoons": 2.5,
  "fun_comparisons": ["porównanie 1", "porównanie 2", "porównanie 3"],
  "diabetes_info": {"ww_per_100g": 1.45, "ww_per_package": null, "glycemic_index": "średni", "diabetes_badge": "caution", "diabetes_tip": "rada"},
  "pregnancy_info": {"alerts": [], "safe_nutrients": [], "caffeine_mg": 0},
  "allergy_info": {"detected_allergens": [], "may_contain": [], "is_safe": true}
}

SCORING (1-10):
10: Jeden składnik (mięso, woda). 9: 2-3 naturalne. 8: Krótki skład. 7: Dobry z zastrzeżeniami.
6: Przeciętny. 5: Niepotrzebne dodatki. 4: Dużo przetworzenia. 3: Kontrowersyjne. 2: Głównie chemia. 1: Niebezpieczny.

STYL — MĄDRY KUMPEL:
9-10: "Brawo! Gdyby wszystkie produkty tak wyglądały, byłbym bezrobotny."
6-8: "Solidny wybór, ale ten cukier mógłby być niższy."
4-5: "9 składników w chlebie to jak CV na 5 stron — za dużo."
1-3: "Koktajl chemiczny. Cisowianka jest obok na półce. Serio."

PORÓWNANIA: Big Mac=563kcal, Snickers=488, pączek=350, jabłko=52, jajko=78. Spalanie: bieganie ~6kcal/min.
ŁYŻECZKI: 1 łyżeczka = 4g cukru. Zawsze oblicz.
WW = węglowodany_przyswajalne / 10. IG: niski<55, średni 55-70, wysoki>70.
Wypełnij diabetes_info, pregnancy_info, allergy_info ZAWSZE.

PREGNANCY_INFO — ZASADY WYPEŁNIANIA:
Sprawdź produkt pod kątem substancji ryzykownych w ciąży/karmieniu:
- Alkohol (jakikolwiek, nawet w śladowych ilościach) → alert: "Zawiera alkohol — bezwzględnie unikać w ciąży"
- Surowe mięso / ryby / sushi (jeśli produkt to np. tatar, sushi, carpaccio) → alert: "Surowe mięso/ryby — ryzyko listerii i toksoplazmozy"
- Niepasteryzowane mleko i sery (camembert, brie, gorgonzola, feta z mleka niepasteryzowanego) → alert: "Ser z niepasteryzowanego mleka — ryzyko listerii"
- Kofeina (oblicz mg — kawa, cola, energy drink, herbata, czekolada) → wypełnij caffeine_mg
- Surowe jaja (majonez domowy, tiramisu, kogel-mogel) → alert: "Może zawierać surowe jaja — ryzyko salmonelli"
- Ryby z wysoką zawartością rtęci (tuńczyk, miecznik, makrela królewska) → alert: "Ryba z wysoką zawartością rtęci — ogranicz spożycie w ciąży"
- safe_nutrients: wymień składniki korzystne w ciąży (kwas foliowy, żelazo, wapń, DHA, jod)
Jeśli produkt nie ma żadnych ryzyk → alerts: [], safe_nutrients z listy powyżej jeśli są obecne.`;


const COSMETICS_ANALYSIS = `Jesteś PROFESJONALNYM DERMATOLOGIEM i kosmetologiem. Otrzymujesz ODCZYTANY TEKST ze składu INCI + ZDJĘCIE do weryfikacji.

====== ZASADY KRYTYCZNE — CZYTAJ NAJPIERW ======

1. NAZWA PRODUKTU — ZAWSZE po polsku:
   - Użyj nazwy z odczytanego tekstu (już przetłumaczonej przez OCR krok)
   - Jeśli OCR podał nazwę obcojęzyczną — PRZETŁUMACZ na polski
   - ZŁE: "Gel douche Palmolive", "Sprchový gel"  DOBRE: "Żel pod prysznic Palmolive"
   - Jeśli brak nazwy: "Nieznany [typ produktu]"

2. NIGDY NIE WYMYŚLAJ SKŁADNIKÓW:
   - Komentuj TYLKO składniki które są w ODCZYTANYM TEKŚCIE
   - Nie dodawaj składników "których na pewno tam są" bo kojarzysz markę
   - Jeśli składnik nie jest na liście → nie istnieje dla Ciebie

3. KLASYFIKACJA — bądź precyzyjny:
   - Sodium Chloride jako PIERWSZY składnik + granulki/kryształy → "sól do kąpieli" (NIE żel)
   - Sprawdź typ: żel pod prysznic / sól do kąpieli / szampon / odżywka / krem / serum / tonik / peeling / masło do ciała / balsam / pasta do zębów / deodorant

4. SILNE ALERGENY — ZAWSZE FLAGUJ (obniż ocenę o 1-2 + dodaj do warnings z level "alarm"):
   - Methylchloroisothiazolinone (MCI) — jeden z najsilniejszych alergenów kontaktowych
   - Methylisothiazolinone (MI) — UE ograniczyła stosowanie ze względu na masowe reakcje
   - Formaldehyd i donory: DMDM Hydantoin, Quaternium-15, Imidazolidinyl Urea, Diazolidinyl Urea
   - Cinnamal, Isoeugenol, Lyral

5. RYZYKO W CIĄŻY (dodaj pregnancy_risk: true do warnings):
   - Retinol / Retinoids / Retinyl Palmitate / Tretinoin (teratogenne!)
   - Kwas salicylowy >2% (Salicylic Acid)
   - Formaldehyd i donory: DMDM Hydantoin, Quaternium-15, Imidazolidinyl Urea, Diazolidinyl Urea
   - Hydrochinon (Hydroquinone)
   - Olejki eteryczne: Rosmarinus (rozmaryn), Salvia (szałwia), Camphor (kamfora)
   - Ftalany: Dibutyl Phthalate (DBP), DEHP, DEP
   Gdy wykryjesz → level: "alarm", pregnancy_risk: true, tekst: "CIĄŻA: Zawiera [składnik] — może być szkodliwy w ciąży. Skonsultuj z lekarzem."

====== TON — 3 POZIOMY ======

POZIOM 1 (większość produktów — brak poważnych problemów):
Rzeczowy, profesjonalny. "Solidny skład z dobrymi humektantami. Gliceryna i pantenol nawilżają skutecznie."

POZIOM 2 (popularny irytant lub składnik problematyczny dla profilu usera):
Taktowny, pomocny. "Zawiera SLS, który może podrażniać skórę wrażliwą. Przy atopii warto rozważyć łagodniejszą alternatywę."
NIE pisz: "To katastrofa!", "prawdziwy agresor", "horror"

POZIOM 3 (silny alergen MCI/MI, formaldehyd, ryzyko w ciąży):
Jednoznaczne ostrzeżenie z ⚠️. "⚠️ UWAGA: Produkt zawiera Methylisothiazolinone — jeden z najsilniejszych alergenów kontaktowych. Szczególnie ryzykowny przy wrażliwej i atopowej skórze."

====== FORMAT ODPOWIEDZI ======

Odpowiedz WYŁĄCZNIE JSON (bez markdown):
{
  "name": "Polska nazwa produktu",
  "brand": "Marka z etykiety (lub null jeśli niewidoczna)",
  "volume": "Pojemność",
  "category": "Dokładny typ kosmetyku po polsku",
  "score": 7,
  "risk_level": "LOW|MED|HIGH",
  "verdict_short": "Dobry/Doskonały/Przeciętny/Słaby/Unikaj",
  "verdict": "2-3 zdania — poziom 1/2/3 wg tonacji. Jeśli masz profil skóry, odnieś się do niego.",
  "ingredients": [
    {
      "name": "Nazwa INCI",
      "polish_name": "Polska nazwa",
      "function": "Co robi w kosmetyku",
      "category": "safe|caution|controversial|harmful",
      "risk": "safe|caution|warning",
      "explanation": "Krótkie wyjaśnienie po ludzku"
    }
  ],
  "warnings": [
    {"text": "Treść ostrzeżenia", "level": "info|caution|alarm", "pregnancy_risk": false}
  ],
  "good_for": ["Sucha skóra", "Włosy zniszczone"],
  "bad_for": ["Skóra wrażliwa", "Atopia"],
  "allergens": ["Parfum", "Limonene"],
  "pros": ["Plus 1", "Plus 2"],
  "cons": ["Minus 1"],
  "tip": "Praktyczna, konkretna rada",
  "is_vegan": true,
  "ingredient_count": 12,
  "safe_count": 10,
  "caution_count": 1,
  "harmful_count": 1,
  "fun_comparisons": ["Ciekawostka o składzie"],
  "price_comparison": {
    "verdict": "Przepłacasz / Dobra cena / Okazja",
    "similar_products": [
      {"name": "Tańsza opcja", "price_range": "15-25 zł", "why_similar": "Te same aktywne składniki"}
    ],
    "better_option": {
      "name": "Lepsza opcja w podobnej cenie",
      "price_range": "20-30 zł",
      "why_better": "Czystszy skład, bez SLS, z ceramidami"
    },
    "savings_tip": "Krótka rada"
  },
  "compatibility": {
    "works_well_with": ["Kwas hialuronowy", "Ceramidy"],
    "avoid_with": ["Retinol (jednoczesne stosowanie)"],
    "best_time": "rano|wieczór|oba"
  },
  "pao_months": 12
}

SCORING (1-10):
10: Minimalny, bezpieczny skład. 8-9: Bardzo dobry, 1-2 drobne uwagi. 6-7: Dobry z zastrzeżeniami.
4-5: Kilka kontrowersyjnych składników. 2-3: Słaby, irytanty. 1: Silny alergen LUB składnik niebezpieczny w ciąży.

PERSONALIZACJA: Jeśli jest profil skóry — oceniaj pod kątem TEGO profilu i w verdict odnoś się do niego.
KOMPATYBILNOŚĆ: Retinol+AHA/BHA → nie łącz wieczorem, Wit.C+Niacynamid → można łączyć (mit obalony).
PAO: null jeśli nie widzisz symbolu słoiczka z miesiącami na zdjęciu.`


const MEAL_ANALYSIS = `Analizujesz ZDJĘCIE DANIA (nie etykiety!). Rozpoznaj co jest na talerzu i oszacuj wartości.

Odpowiedz WYŁĄCZNIE JSON:
{
  "meal_name": "nazwa dania", "name": "nazwa dania", "brand": "", "score": 8,
  "verdict_short": "Dobry/Doskonały/Przeciętny/Słaby", "verdict": "2-3 zdania z charakterem",
  "items": [
    {"name": "składnik", "estimated_weight_g": 200, "min_reasonable_g": 80, "max_reasonable_g": 400,
     "calories_per_100g": 165, "protein_per_100g": 31, "fat_per_100g": 3.6, "carbs_per_100g": 0,
     "calories": 330, "protein": 62, "fat": 7, "carbs": 0}
  ],
  "total": {"calories": 566, "protein": 67, "fat": 7.6, "carbs": 53},
  "sugar_teaspoons": 0,
  "fun_comparisons": ["porównanie 1", "porównanie 2"],
  "tip": "rada", "pros": [], "cons": [], "allergens": []
}

ZASADY: Oszacuj wizualnie (talerz ~25cm). Wagi z "~". Sos/dressing = dolicz!
Podaj wartości PER 100g (do slidera) + szacowane wagi + min/max.
STYL: mądry kumpel. Porównania: Big Mac=563, jabłko=52, jajko=78. Spalanie: bieganie ~6kcal/min.`;

// ==================== TEXT SEARCH (AI food database) ====================

const TEXT_SEARCH_PROMPT = `Użytkownik wpisuje jedzenie tekstem. Podaj wartości odżywcze.
Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown):
{
  "name": "Nazwa posiłku/produktu",
  "brand": "",
  "score": 8,
  "verdict_short": "Dobry/Doskonały/Przeciętny/Słaby/Unikaj",
  "verdict": "Komentarz z osobowością",
  "items": [
    {
      "name": "Banan",
      "portion": "1 średni (120g)",
      "calories": 107,
      "protein": 1.3,
      "fat": 0.4,
      "carbs": 27,
      "sugar": 14,
      "fiber": 3.1,
      "score": 8,
      "emoji": "🍌",
      "verdict": "Świetna przekąska — szybka energia, potas.",
      "fun_comparison": "107 kcal = 11 min biegania 🏃",
      "calories_per_100g": 89,
      "protein_per_100g": 1.1,
      "fat_per_100g": 0.3,
      "carbs_per_100g": 23,
      "default_portion_g": 120,
      "min_portion_g": 30,
      "max_portion_g": 300
    }
  ],
  "total": {"calories": 107, "protein": 1.3, "fat": 0.4, "carbs": 27},
  "sugar_teaspoons": 3.5,
  "fun_comparisons": ["107 kcal = 11 min biegania", "Tyle co 2 jabłka"],
  "tip": "Rada",
  "pros": [], "cons": [], "allergens": []
}
ZASADY:
- Jeden produkt (np. "banan") → standardowa porcja + wartości per 100g
- Z gramaturą (np. "ryż 200g") → przelicz na tę gramaturę
- Cały posiłek (np. "schabowy z ziemniakami i surówką") → rozbij na składniki + suma
- Markowy (np. "Big Mac", "Latte Starbucks") → znane wartości
- Dodaj emoji do każdego
- Score 1-10 jak przy skanowaniu
- ZAWSZE podaj wartości per 100g + default/min/max portion do slidera
- Po POLSKU, styl mądry kumpel
- Lepiej lekko przeszacować kalorie niż niedoszacować`;

// ==================== CHECKFORM (body analysis) ====================

const CHECKFORM_PROMPT = `Analizujesz ZDJĘCIE SYLWETKI użytkownika.
Oceń wizualnie kompozycję ciała. To jest ESTYMACJA WIZUALNA, nie pomiar medyczny.
Zawsze podawaj ZAKRESY, nie dokładne liczby.

Odpowiedz WYŁĄCZNIE JSON:
{
  "name": "CheckForm",
  "brand": "",
  "score": 7,
  "body_fat_range": "15-20%",
  "body_fat_range_low": 15,
  "body_fat_range_high": 20,
  "body_fat_category": "athletic|fit|average|above_average|high",
  "muscle_mass": "above_average|average|below_average",
  "overall_score": 7.5,
  "score_label": "Dobra forma",
  "visible_strengths": ["Widoczna definicja ramion", "Proporcjonalna sylwetka"],
  "areas_to_improve": ["Okolica brzucha — lekki nadmiar", "Klatka — potencjał na rozwój"],
  "verdict_short": "Dobra forma",
  "verdict": "Motywujący komentarz z osobowością",
  "tip": "Praktyczna rada treningowa lub dietetyczna",
  "bmi": 25.9,
  "bmi_category": "Górna granica normy",
  "photo_warnings": [],
  "pros": ["Mocna strona 1"],
  "cons": ["Do poprawy 1"],
  "allergens": [],
  "fun_comparisons": ["Ciekawostka fitness"]
}

KATEGORIE BODY FAT:
Mężczyźni: athletic 6-13%, fit 14-17%, average 18-24%, above_average 25-31%, high 32%+
Kobiety: athletic 14-20%, fit 21-24%, average 25-31%, above_average 32-39%, high 40%+

SCORING (1-10): 10=profesjonalny sportowiec, 8-9=świetna forma, 6-7=dobra, 4-5=przeciętna, 2-3=nadmiar tłuszczu, 1=zagrożenie

STYL: ZAWSZE motywujący, NIGDY upokarzający.
4/10 NIE mówi "jesteś gruby" — mówi "Masz solidną bazę. Z dietą i ruchem za 3 miesiące będziesz nie do poznania."
Chwal konkretne rzeczy. Dawaj konkretne porady. Ludzie robią to zdjęcie z odwagą — szanuj to.

WALIDACJA ZDJĘCIA: Jeśli widzisz problemy (ciemne, luźne ubranie, zły kąt) dodaj do photo_warnings.
Jeśli zdjęcie za słabe — odmów grzecznie.

WAŻNE: Zakresy (np. "15-20%"), NIGDY dokładne cyfry. Dodaj disclaimer w verdict.`;

// ==================== ALCOHOL SEARCH ====================

const ALCOHOL_SEARCH_PROMPT = `Użytkownik szuka informacji o alkoholu. Odpowiedz WYŁĄCZNIE JSON:
{
  "name": "Nazwa alkoholu",
  "emoji": "🍺",
  "type": "piwo|wino|wódka|whisky|drink|rum|gin|likier|inne",
  "default_ml": 500,
  "abv_percent": 5.0,
  "alcohol_grams": 19.7,
  "calories": 215,
  "flavor_profile": "2-3 zdania o smaku, nutach, z czym pasuje. Pisz jak sommelier ale po ludzku.",
  "fun_fact": "Ciekawostka o historii lub produkcji, 1-2 zdania.",
  "verdict": "Komentarz z osobowością, humor mile widziany."
}
ZASADY:
- Gramy alkoholu = ml × (ABV/100) × 0.789
- Kalorie alkoholu = gramy_alkoholu × 7 + kalorie z cukrów/węglowodanów
- Piwo ~43kcal/100ml, wino ~85kcal/100ml, wódka ~231kcal/100ml
- Styl: jak sommelier z humorem. Po polsku.
- Jeśli to koktajl/drink — podaj składniki i proporcje w flavor_profile
- Bądź dokładny z % alkoholu dla konkretnych marek`;

// ==================== ALCOHOL SCAN ====================

const ALCOHOL_SCAN_PROMPT = `Analizujesz ZDJĘCIE ETYKIETY ALKOHOLU (butelka/puszka/szklanka).
Rozpoznaj markę, objętość, % alkoholu. Odpowiedz WYŁĄCZNIE JSON:
{
  "name": "Nazwa alkoholu",
  "emoji": "🍺",
  "type": "piwo|wino|wódka|whisky|drink|rum|gin|likier|inne",
  "default_ml": 500,
  "abv_percent": 5.0,
  "alcohol_grams": 19.7,
  "calories": 215,
  "flavor_profile": "2-3 zdania o smaku, nutach, charakter.",
  "fun_fact": "Ciekawostka o produkcie/marce, 1-2 zdania.",
  "verdict": "Komentarz z osobowością."
}
ZASADY:
- Odczytaj % alkoholu z etykiety DOKŁADNIE
- Odczytaj objętość (ml/l) DOKŁADNIE
- Gramy alkoholu = ml × (ABV/100) × 0.789
- Jeśli nie widzisz % alkoholu, oszacuj na podstawie typu napoju
- Po polsku, styl sommelier z humorem`;

// ==================== SEARCH SUGGESTIONS ====================

// ==================== INCI INGREDIENT SEARCH ====================

const INCI_SEARCH_PROMPT = `Użytkownik szuka informacji o składniku kosmetycznym. Odpowiedz WYŁĄCZNIE JSON:
{
  "name": "Nazwa składnika (INCI)",
  "polish_name": "Polska nazwa",
  "safety": "safe|caution|controversial|harmful",
  "safety_label": "Bezpieczny / Kontrowersyjny / Ryzykowny / Szkodliwy",
  "what_it_does": "Co robi w kosmetyku (2-3 zdania)",
  "good_for": ["Typ skóry / problem dla którego jest dobry"],
  "bad_for": ["Typ skóry / problem dla którego jest zły"],
  "optimal_concentration": "Optymalne stężenie (np. 2-10%) lub null",
  "combine_with": ["Składniki z którymi dobrze łączyć"],
  "avoid_with": ["Składniki których unikać razem"],
  "fun_fact": "Ciekawostka 1-2 zdania",
  "products_with": [
    {"name": "Produkt z tym składnikiem", "price_range": "20-30 zł"}
  ],
  "verdict": "Komentarz z osobowością"
}
STYL: jak ekspert z humorem. Po polsku.
"Niacynamid to jak szwajcarski scyzoryk pielęgnacji — robi wszystko i robi to dobrze."
"SLS myje skutecznie ale Twoja skóra płacze po nim. Szukaj łagodniejszych zamienników."`;

// ==================== BEAUTY ACADEMY ====================

const BEAUTY_ACADEMY_PROMPT = `Użytkownik pyta o temat beauty/pielęgnacji. Napisz krótki, przystępny artykuł (5-8 zdań).
Odpowiedz WYŁĄCZNIE JSON:
{
  "title": "Tytuł artykułu",
  "content": "Treść artykułu — 5-8 zdań, przystępny język, z osobowością",
  "key_points": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "tip": "Praktyczna rada na koniec"
}
STYL: jak mądra koleżanka — nie nudny podręcznik. Po polsku.`;

const SEARCH_SUGGESTIONS_PROMPT =`Użytkownik wpisuje w wyszukiwarkę jedzenia. Podaj 5-8 propozycji produktów pasujących do tekstu. Dla każdego podaj nazwę, domyślną porcję (w polskiej mierze + gramy), kalorie na tę porcję, emoji. Odpowiedz WYŁĄCZNIE JSON: { "suggestions": [{ "name": "Pierś z kurczaka", "emoji": "🍗", "default_portion_label": "1 porcja (150g)", "default_portion_grams": 150, "calories": 248 }] }. Po POLSKU. Max 8 propozycji.`;

// ==================== INGREDIENT EXPLAIN ====================

const INGREDIENT_EXPLAIN_PROMPT = `Wyjaśnij po polsku czym jest podany składnik lub alergen. Bądź konkretny, ludzki, z osobowością. Max 3-4 zdania.
Odpowiedz WYŁĄCZNIE JSON:
{
  "name": "Nazwa składnika",
  "explanation": "Wyjaśnienie po ludzku, 3-4 zdania. Co to jest, skąd pochodzi, do czego służy w produkcie.",
  "risk_level": "safe|caution|warning",
  "who_should_worry": "Kto powinien unikać (np. diabetycy, alergicy, dzieci) lub 'Nikt — bezpieczny dla wszystkich'",
  "fun_fact": "Ciekawostka o tym składniku (1-2 zdania)"
}
STYL: mądry kumpel. Nie strasz, ale nie bagatelizuj.
"safe" = bezpieczny dla prawie wszystkich
"caution" = kontrowersyjny lub podrażniający u wrażliwych
"warning" = potencjalnie szkodliwy, unikaj jeśli możesz`;

// ==================== FRIDGE SCAN ====================

const FRIDGE_SCAN_PROMPT = `Analizujesz ZDJĘCIE WNĘTRZA LODÓWKI. Rozpoznaj widoczne produkty, oceń każdy 1-10.
Odpowiedz WYŁĄCZNIE JSON:
{
  "name": "Skan lodówki",
  "brand": "",
  "score": 6,
  "fridge_score": 6.2,
  "products": [
    {"name": "Produkt", "score": 8, "category": "nabiał|mięso|napoje|warzywa|owoce|przetwory|przekąski|inne", "emoji": "🥛"}
  ],
  "average_score": 6.2,
  "best_product": {"name": "Najlepszy", "score": 10},
  "worst_product": {"name": "Najgorszy", "score": 2},
  "verdict_short": "Dobra/Przeciętna/Słaba",
  "verdict": "Zabawny komentarz z osobowością. Np. 'Twoja lodówka na 6.2/10. Pepsi ciągnie średnią w dół. Wyrzuć ją a skoczy do 7.8!'",
  "tip": "Co zmienić żeby było lepiej",
  "improvement": "Które produkty wyrzucić/zamienić żeby średnia skoczyła",
  "pros": ["Plus 1"],
  "cons": ["Minus 1"],
  "allergens": [],
  "fun_comparisons": ["Ciekawostka o lodówce"]
}
STYL: zabawny, bezpośredni, mądry kumpel. Oceń realnie ale z humorem.
Rozpoznaj WSZYSTKO co widzisz — nawet częściowo widoczne produkty.`;

// ==================== HELPER ====================

async function callClaude(
  apiKey: string,
  system: string,
  userContent: unknown[],
  maxTokens: number,
  timeoutMs: number,
  model: string = "claude-sonnet-4-20250514"
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return { error: true, status: response.status };
    }
    const data = await response.json();
    return { error: false, text: data.content?.[0]?.text || "" };
  } catch (err: unknown) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      return { error: true, status: 504 };
    }
    throw err;
  }
}

function parseJsonResponse(text: string) {
  // Step 1: Remove markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/g, "").replace(/\s*```$/g, "");
  }

  // Step 2: Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // Step 3: Extract JSON between first { and last }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    }
    throw new Error("No valid JSON found in response");
  }
}

// Validate nutrition values make sense
function validateNutrition(result: Record<string, unknown>): void {
  if (!result.nutrition || !Array.isArray(result.nutrition)) return;

  const nutr = result.nutrition as Array<{ label: string; value: string }>;
  let fat = 0, carbs = 0, protein = 0;

  for (const n of nutr) {
    const val = parseFloat(n.value?.match?.(/[\d.]+/)?.[0] || "0");
    if (n.label.toLowerCase().includes("tłuszcz") && !n.label.includes("nasycone")) fat = val;
    if (n.label.toLowerCase().includes("węglo")) carbs = val;
    if (n.label.toLowerCase().includes("biał")) protein = val;
  }

  // Basic sanity: macros per 100g can't exceed 100g total
  if (fat + carbs + protein > 110) {
    console.warn(`Nutrition validation warning: fat(${fat}) + carbs(${carbs}) + protein(${protein}) = ${fat + carbs + protein} > 100g`);
    // Don't reject, but log — AI might have read per-package values
  }
}

// ==================== API ROUTE ====================

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Brak klucza API." }, { status: 500 });
    }

    let body;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
    }

    const { image, image2, mode = "food", text } = body as { image?: string; image2?: string; mode?: string; text?: string };

    // === ALCOHOL SEARCH MODE ===
    if (mode === "alcohol_search") {
      if (!text || text.trim().length < 1) {
        return NextResponse.json({ error: "Wpisz nazwę alkoholu." }, { status: 400 });
      }
      const res = await callClaude(apiKey, ALCOHOL_SEARCH_PROMPT, [
        { type: "text", text: `Użytkownik szuka: "${text.trim()}"` },
      ], 1536, 15000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try {
        const result = parseJsonResponse(res.text);
        result.mode = "alcohol_search";
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie znaleziono tego alkoholu." }, { status: 422 });
      }
    }

    // === ALCOHOL SCAN MODE ===
    if (mode === "alcohol_scan" && image) {
      const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!match) return NextResponse.json({ error: "Nieprawidłowy format." }, { status: 400 });
      const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const base64Data = match[2];
      const imgContent = { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: base64Data } };
      const res = await callClaude(apiKey, ALCOHOL_SCAN_PROMPT, [
        imgContent,
        { type: "text", text: "Rozpoznaj ten alkohol — markę, objętość, % alkoholu. Odpowiedz JSON." },
      ], 1536, 30000); // Sonnet — etykieta alkoholu (tekst)
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try {
        const result = parseJsonResponse(res.text);
        result.mode = "alcohol_scan";
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie udało się rozpoznać alkoholu." }, { status: 422 });
      }
    }

    // === INCI SEARCH MODE ===
    if (mode === "inci_search") {
      if (!text || text.trim().length < 1) {
        return NextResponse.json({ error: "Wpisz nazwę składnika." }, { status: 400 });
      }
      const res = await callClaude(apiKey, INCI_SEARCH_PROMPT, [
        { type: "text", text: `Użytkownik szuka składnika kosmetycznego: "${text.trim()}"` },
      ], 2048, 15000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try {
        return NextResponse.json(parseJsonResponse(res.text));
      } catch {
        return NextResponse.json({ error: "Nie znaleziono składnika." }, { status: 422 });
      }
    }

    // === BEAUTY ACADEMY MODE ===
    if (mode === "beauty_academy") {
      if (!text || text.trim().length < 3) {
        return NextResponse.json({ error: "Wpisz pytanie." }, { status: 400 });
      }
      const res = await callClaude(apiKey, BEAUTY_ACADEMY_PROMPT, [
        { type: "text", text: `Temat/pytanie: "${text.trim()}"` },
      ], 2048, 15000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try {
        return NextResponse.json(parseJsonResponse(res.text));
      } catch {
        return NextResponse.json({ error: "Nie udało się wygenerować artykułu." }, { status: 422 });
      }
    }

    // === SEARCH SUGGESTIONS MODE ===
    if (mode === "search_suggestions") {
      if (!text || text.trim().length < 2) {
        return NextResponse.json({ suggestions: [] });
      }
      const res = await callClaude(apiKey, SEARCH_SUGGESTIONS_PROMPT, [
        { type: "text", text: `Użytkownik wpisuje: "${text.trim()}"` },
      ], 1024, 10000);
      if (res.error) return NextResponse.json({ suggestions: [] });
      try {
        const result = parseJsonResponse(res.text);
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ suggestions: [] });
      }
    }

    // === INGREDIENT EXPLAIN MODE ===
    if (mode === "ingredient_explain") {
      if (!text || text.trim().length < 1) {
        return NextResponse.json({ error: "Brak nazwy składnika." }, { status: 400 });
      }
      const res = await callClaude(apiKey, INGREDIENT_EXPLAIN_PROMPT, [
        { type: "text", text: `Wyjaśnij składnik/alergen: "${text.trim()}"` },
      ], 1024, 15000);

      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try {
        const result = parseJsonResponse(res.text);
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie udało się wyjaśnić." }, { status: 422 });
      }
    }

    // === TEXT SEARCH MODE (no image needed) ===
    if (mode === "text_search") {
      if (!text || text.trim().length < 2) {
        return NextResponse.json({ error: "Wpisz co jesz." }, { status: 400 });
      }
      const res = await callClaude(apiKey, TEXT_SEARCH_PROMPT, [
        { type: "text", text: `Użytkownik szuka: "${text.trim()}"\nPodaj wartości odżywcze. Odpowiedz JSON.` },
      ], 4096, 20000);

      if (res.error) {
        return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      }
      try {
        const result = parseJsonResponse(res.text);
        result.type = "text_search";
        if (!result.name) result.name = text.trim();
        if (!result.brand) result.brand = "";
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie udało się znaleźć tego produktu." }, { status: 422 });
      }
    }

    // === VOICE FOOD MODE ===
    if (mode === "voice_food") {
      if (!text || text.trim().length < 2) return NextResponse.json({ error: "Nie rozpoznano tekstu." }, { status: 400 });
      const voiceFoodPrompt = `Użytkownik powiedział głosowo co zjadł. Transkrypcja: "${text.trim()}"
Zinterpretuj DOKŁADNIE co użytkownik zjadł.
ZASADY: Rozpoznaj ilości (dwa, trzy, pół), miary (kromka, szklanka, łyżka, garść), sposób (smażone, gotowane, z grilla), marki. Jeśli brak ilości → 1 standardowa porcja. Slang OK ("kebsa"="kebab").
Odpowiedz WYŁĄCZNIE JSON:
{"interpreted_text":"...","confidence":"high","items":[{"name":"Jajko na twardo","emoji":"🥚","quantity":2,"unit":"szt","portion_label":"2 sztuki","portion_grams":120,"calories_per_100g":130,"calories":156,"protein":12.6,"fat":10.6,"carbs":1.2,"slider_min_qty":1,"slider_max_qty":6,"slider_min_grams":30,"slider_max_grams":360,"measures":[{"name":"sztuka","grams":60}]}],"total":{"calories":156,"protein":12.6,"fat":10.6,"carbs":1.2},"verdict":"Komentarz z osobowością","needs_clarification":false,"clarification_question":null}
Podaj calories_per_100g i measures dla KAŻDEGO produktu. Po polsku.`;
      const res = await callClaude(apiKey, voiceFoodPrompt, [{ type: "text", text: `Transkrypcja: "${text.trim()}"` }], 4096, 25000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try { return NextResponse.json(parseJsonResponse(res.text)); } catch { return NextResponse.json({ error: "Nie udało się rozpoznać." }, { status: 422 }); }
    }

    // === VOICE ALCOHOL MODE ===
    if (mode === "voice_alcohol") {
      if (!text || text.trim().length < 2) return NextResponse.json({ error: "Nie rozpoznano tekstu." }, { status: 400 });
      const voiceAlcPrompt = `Użytkownik powiedział głosowo co wypił. Transkrypcja: "${text.trim()}"
Zinterpretuj co wypił. Rozpoznaj marki, typ (piwo/wino/wódka/whisky/drink), ilość, objętość. Standardowo: piwo 500ml, wino 150ml, wódka 50ml.
Odpowiedz WYŁĄCZNIE JSON:
{"interpreted_text":"...","items":[{"name":"Tyskie","emoji":"🍺","type":"piwo","quantity":2,"unit":"szt","default_ml":500,"abv_percent":5.2,"alcohol_grams":20.5,"total_alcohol_grams":41.0,"calories_per_unit":215,"total_calories":430,"flavor_profile":"Opis smaku 2-3 zdania","fun_fact":"Ciekawostka 1-2 zdania","slider_min_qty":1,"slider_max_qty":10,"slider_min_ml":330,"slider_max_ml":1000}],"total_alcohol_grams":41,"total_calories":430,"fun_comparison":"porównanie kaloryczne"}
Po polsku. Styl: jak sommelier z humorem.`;
      const res = await callClaude(apiKey, voiceAlcPrompt, [{ type: "text", text: `Transkrypcja: "${text.trim()}"` }], 4096, 25000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try { return NextResponse.json(parseJsonResponse(res.text)); } catch { return NextResponse.json({ error: "Nie udało się rozpoznać." }, { status: 422 }); }
    }

    // === FRIDGE RECIPES MODE ===
    if (mode === "fridge_recipes") {
      if (!text || text.trim().length < 2) return NextResponse.json({ error: "Brak listy produktów." }, { status: 400 });
      const goal = body.goal || "maintenance";
      const goalLabels: Record<string, string> = { reduction: "REDUKCJA (max 500kcal, min 25g białka, dużo warzyw)", mass: "MASA (min 600kcal, min 40g białka, duże porcje)", maintenance: "UTRZYMANIE (400-600kcal, zbalansowane)" };
      const fridgePrompt = `Produkty w lodówce: ${text.trim()}
Cel użytkownika: ${goalLabels[goal] || goalLabels.maintenance}
Zaproponuj 4-5 dań z tych składników dopasowanych do celu.
Odpowiedz WYŁĄCZNIE JSON:
{"recipes":[{"name":"nazwa","emoji":"🥗","calories":420,"protein":38,"fat":16,"carbs":28,"fiber":6,"prep_time_min":15,"difficulty":"łatwy","difficulty_emoji":"🟢","uses_ingredients":["kurczak","ryż"],"missing_ingredients":["awokado (opcjonalne)"],"short_description":"Szybki i sycący","why_good_for_goal":"Idealny stosunek białko/kalorie","tags":["high-protein"]}]}
Styl: APETYCZNY i MOTYWUJĄCY. Po polsku.`;
      const res = await callClaude(apiKey, fridgePrompt, [{ type: "text", text: "Zaproponuj przepisy." }], 4096, 25000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try { return NextResponse.json(parseJsonResponse(res.text)); } catch { return NextResponse.json({ error: "Nie udało się wygenerować przepisów." }, { status: 422 }); }
    }

    // === RECIPE DETAIL MODE ===
    if (mode === "recipe_detail") {
      if (!text || text.trim().length < 2) return NextResponse.json({ error: "Brak nazwy przepisu." }, { status: 400 });
      const ingredients = body.ingredients || "";
      const goal = body.goal || "maintenance";
      const recipePrompt = `Wygeneruj PEŁNY PRZEPIS PREMIUM QUALITY dla: "${text.trim()}"
Dostępne składniki: ${ingredients}. Cel: ${goal}.
Przepis na poziomie NAJLEPSZYCH stron kulinarnych: dokładne gramy, czasy, temperatury, pro tipy.
Odpowiedz WYŁĄCZNIE JSON:
{"name":"...","subtitle":"...","emoji":"🥗","servings":1,"prep_time_min":15,"difficulty":"łatwy","nutrition":{"calories":420,"protein":38,"fat":16,"carbs":28,"fiber":6,"sugar":5},"percent_of_daily":20,"goal_comment":"Komentarz do celu","ingredients":[{"name":"Pierś z kurczaka","amount":"150g","in_fridge":true,"calories":248,"note":null}],"seasonings":"sól, pieprz, papryka","steps":[{"number":1,"title":"NAZWA KROKU","time_min":10,"instruction":"Szczegółowa instrukcja","tip":"Pro tip"}],"pro_tips":["tip1","tip2"],"verdict":"Zabawny komentarz końcowy"}
Język: jak kumpel w kuchni. Kroki KRÓTKIE (max 3 zdania). Po polsku.`;
      const res = await callClaude(apiKey, recipePrompt, [{ type: "text", text: "Wygeneruj przepis." }], 6144, 30000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try { return NextResponse.json(parseJsonResponse(res.text)); } catch { return NextResponse.json({ error: "Nie udało się wygenerować przepisu." }, { status: 422 }); }
    }

    // === SUPLEMENT ACADEMY MODE ===
    if (mode === "suplement_academy") {
      if (!text || text.trim().length < 3) {
        return NextResponse.json({ error: "Wpisz pytanie." }, { status: 400 });
      }
      const supplementAcademyPrompt = `Jesteś ekspertem od suplementów diety i farmakologiem. Piszesz rzetelne, oparte na nauce artykuły edukacyjne po polsku.
Ton: jak trener/dietetyk sportowy — konkretny, oparty na badaniach, bez BS.
ZASADY: Tylko prawdziwe informacje, podawaj konkretne dawki i odniesienia do badań, bez pseudonauki.
Odpowiedz WYŁĄCZNIE poprawnym JSON (bez markdown, bez komentarzy):
{"title": "Tytuł artykułu", "content": "Treść artykułu (3-5 akapitów, konkretna, oparta na dowodach)", "key_points": ["Punkt 1", "Punkt 2", "Punkt 3", "Punkt 4"], "evidence_level": "mocne", "tip": "Praktyczna porada do zapamiętania"}`;
      const res = await callClaude(apiKey, supplementAcademyPrompt, [
        { type: "text", text: `Napisz artykuł na temat: "${text.trim()}". Odpowiedz WYŁĄCZNIE JSON.` },
      ], 3072, 25000);
      if (res.error) return NextResponse.json({ error: `Błąd (${res.status}).` }, { status: res.status! });
      try {
        return NextResponse.json(parseJsonResponse(res.text));
      } catch {
        return NextResponse.json({ error: "Nie udało się wygenerować artykułu." }, { status: 422 });
      }
    }

    if (!image) {
      return NextResponse.json({ error: "Brak zdjęcia." }, { status: 400 });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Nieprawidłowy format zdjęcia." }, { status: 400 });
    }

    const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    const base64Data = match[2];

    // Parse secondary image if present (from image2 field)
    let secondBase64Data: string | null = null;
    if (image2) {
      const match2 = image2.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match2) {
        secondBase64Data = match2[2];
      }
    }

    if (base64Data.length > 5_000_000) {
      return NextResponse.json({ error: "Zdjęcie za duże. Zrób zdjęcie z bliższej odległości." }, { status: 400 });
    }
    if (secondBase64Data && secondBase64Data.length > 5_000_000) {
      return NextResponse.json({ error: "Drugie zdjęcie za duże." }, { status: 400 });
    }

    const imageContent = {
      type: "image" as const,
      source: { type: "base64" as const, media_type: mediaType, data: base64Data },
    };

    // === MEAL MODE: Single step (Opus — complex visual recognition) ===
    if (mode === "meal") {
      const res = await callClaude(apiKey, MEAL_ANALYSIS, [
        imageContent,
        { type: "text", text: "Rozpoznaj co jest na talerzu i oszacuj wartości odżywcze. Odpowiedz JSON." },
      ], 4096, 45000, "claude-opus-4-20250514");

      if (res.error) {
        return NextResponse.json({ error: `Błąd analizy (${res.status}).` }, { status: res.status! });
      }

      try {
        const result = parseJsonResponse(res.text);
        if (!result.name && result.meal_name) result.name = result.meal_name;
        if (!result.brand) result.brand = "";
        result.type = "meal";
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie udało się rozpoznać dania. Spróbuj z lepszym zdjęciem." }, { status: 422 });
      }
    }

    // === FRIDGE SCAN MODE (Opus — must recognize many products in one photo) ===
    if (mode === "fridge_scan") {
      const res = await callClaude(apiKey, FRIDGE_SCAN_PROMPT, [
        imageContent,
        { type: "text", text: "Przeanalizuj zawartość tej lodówki. Rozpoznaj produkty, oceń każdy 1-10, daj średnią. Odpowiedz JSON." },
      ], 4096, 45000, "claude-opus-4-20250514");

      if (res.error) return NextResponse.json({ error: `Błąd analizy (${res.status}).` }, { status: res.status! });
      try {
        const result = parseJsonResponse(res.text);
        result.type = "fridge_scan";
        if (!result.name) result.name = "Skan lodówki";
        if (!result.brand) result.brand = "";
        if (!result.score && result.fridge_score) result.score = Math.round(result.fridge_score);
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie udało się przeanalizować lodówki." }, { status: 422 });
      }
    }

    // === FORMA MODE: Body check ===
    if (mode === "forma") {
      // Inject user profile data if available
      const profileHint = body.profileData
        ? `\nDane użytkownika: płeć=${body.profileData.gender}, waga=${body.profileData.weight_kg}kg, wzrost=${body.profileData.height_cm}cm, wiek=${body.profileData.age}, BMI=${body.profileData.bmi}`
        : "";

      const res = await callClaude(apiKey, CHECKFORM_PROMPT, [
        imageContent,
        { type: "text", text: `Przeanalizuj sylwetkę na zdjęciu.${profileHint}\nOdpowiedz JSON.` },
      ], 4096, 45000, "claude-opus-4-20250514");

      if (res.error) {
        return NextResponse.json({ error: `Błąd analizy (${res.status}).` }, { status: res.status! });
      }
      try {
        const result = parseJsonResponse(res.text);
        result.type = "forma";
        result.name = "CheckForm";
        result.brand = "";
        if (!result.score && result.overall_score) result.score = result.overall_score;
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie udało się przeanalizować zdjęcia. Spróbuj z lepszym oświetleniem." }, { status: 422 });
      }
    }

    // === SUPLEMENT MODE: OCR → Analysis ===
    if (mode === "suplement") {
      const supplementAnalysisPrompt = `Jesteś ekspertem od suplementów diety. Przeanalizuj etykietę suplementu i oceń jego wartość.

ODPOWIEDZ WYŁĄCZNIE JSON (bez markdown):
{
  "name": "Nazwa produktu (po polsku)",
  "brand": "Marka",
  "form": "tabletki/kapsułki/proszek/żel/płyn/inne",
  "score": 7,
  "verdict_short": "Krótka ocena (max 8 słów)",
  "verdict": "Rzetelna ocena składu (3-4 zdania, konkretna, oparta na nauce)",
  "ingredients": [
    {
      "name": "Witamina C (kwas askorbinowy)",
      "dose": "500 mg",
      "daily_value_percent": 625,
      "category": "essential",
      "risk": "safe",
      "explanation": "Silny antyoksydant. Dawka skuteczna, bezpieczna."
    }
  ],
  "daily_dose": "1 kapsułka dziennie",
  "dose_warning": null,
  "pros": ["Co najmniej 3 plusy"],
  "cons": ["Co najmniej 2 minusy lub null"],
  "tip": "Praktyczna wskazówka stosowania",
  "allergens": [],
  "is_vegan": true,
  "interactions": ["Z lekiem X może...", "Nie łączyć z..."],
  "who_for": ["Osoby z niedoborem X", "Sportowcy"],
  "who_avoid": ["Osoby z chorobą X", "Kobiety w ciąży (powyżej dawki Y)"],
  "fun_comparisons": ["Ciekawostka 1", "Ciekawostka 2"]
}

KATEGORIE składników:
- essential: kluczowe, naukowo potwierdzone (witaminy, minerały w odpowiednich dawkach)
- beneficial: pomocne, dobre dowody
- neutral: bezpieczne, ale słabe dowody
- unnecessary: bez udowodnionej skuteczności (dużo marketingowych składników)
- risky: potencjalnie szkodliwe, interakcje z lekami, overdose risk

ZASADY:
- Ocena 1-10: 8-10 = sprawdzony skład z dobrymi dawkami, 5-7 = przeciętny, 1-4 = marketing > substancja
- Dawka dzienna: sprawdź normy EU (% NRV) — zaznacz jeśli przekracza 300% NRV
- dose_warning: jeśli jakaś dawka jest niebezpiecznie wysoka lub ryzykowna (np. wit. A >10000 IU)
- interactions: TYLKO jeśli są realne interakcje lekowe lub medyczne (nie wymyślaj)
- Bądź rzetelny — nie chwal jeśli produkt jest przesycony marketingiem
- Odpowiadaj PO POLSKU`;

      // Run OCR for supplement label
      let supplOcrText = "";
      const gvKey = process.env.GOOGLE_VISION_API_KEY;
      if (gvKey) {
        try {
          const gvRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${gvKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requests: [{ image: { content: base64Data }, features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }] }] }),
          });
          if (gvRes.ok) {
            const gvData = await gvRes.json();
            const ann = gvData.responses?.[0];
            supplOcrText = ann?.fullTextAnnotation?.text || ann?.textAnnotations?.[0]?.description || "";
          }
        } catch { /* ignore OCR failure */ }
      }

      const supplImgContent = {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType, data: base64Data },
      };

      const supplUserContent: unknown[] = [supplImgContent];
      if (supplOcrText.length > 20) {
        supplUserContent.push({
          type: "text",
          text: `Google Vision OCR odczytał z etykiety:\n\n---\n${supplOcrText}\n---\n\nUżyj OCR jako główne źródło danych o składnikach i dawkach. Przeanalizuj suplement. Odpowiedz WYŁĄCZNIE JSON.`,
        });
      } else {
        supplUserContent.push({
          type: "text",
          text: "Odczytaj i przeanalizuj ten suplement diety. Odpowiedz WYŁĄCZNIE JSON.",
        });
      }

      const res = await callClaude(apiKey, supplementAnalysisPrompt, supplUserContent, 5120, 30000);
      if (res.error) return NextResponse.json({ error: `Błąd analizy (${res.status}).` }, { status: res.status! });
      try {
        const result = parseJsonResponse(res.text);
        result.type = "suplement";
        if (!result.name) result.name = "Nieznany suplement";
        if (typeof result.score !== "number") result.score = 5;
        if (!result.pros) result.pros = [];
        if (!result.cons) result.cons = [];
        if (!result.allergens) result.allergens = [];
        if (!result.fun_comparisons) result.fun_comparisons = [];
        if (!result.interactions) result.interactions = [];
        if (!result.who_for) result.who_for = [];
        if (!result.who_avoid) result.who_avoid = [];
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: "Nie udało się przeanalizować suplementu." }, { status: 422 });
      }
    }

    // === FOOD & COSMETICS: Google Vision OCR → Claude Analysis ===
    const isCosmetics = mode === "cosmetics";

    // secondBase64Data is already parsed at the top of the route

    // STEP 1: Google Cloud Vision OCR — specialized text extraction
    let ocrText = "";
    const googleVisionKey = process.env.GOOGLE_VISION_API_KEY;

    // Helper to call Vision API
    async function callVisionOCR(b64: string): Promise<string> {
      if (!googleVisionKey) return "";
      try {
        const resp = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${googleVisionKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requests: [{ image: { content: b64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }] }],
            }),
          }
        );
        if (resp.ok) {
          const data = await resp.json();
          const ann = data.responses?.[0];
          return ann?.fullTextAnnotation?.text || ann?.textAnnotations?.[0]?.description || "";
        }
      } catch (err) { console.error("Vision OCR error:", err); }
      return "";
    }

    // OCR first image
    const firstOCR = await callVisionOCR(imageContent.source.data as string);
    ocrText = firstOCR;

    // OCR second image if present
    if (secondBase64Data) {
      const secondOCR = await callVisionOCR(secondBase64Data);
      if (secondOCR) {
        ocrText = ocrText + "\n\n--- DRUGA STRONA OPAKOWANIA ---\n\n" + secondOCR;
        console.log(`Google Vision OCR: ${firstOCR.length} + ${secondOCR.length} chars from 2 images`);
      }
    } else {
      console.log(`Google Vision OCR: extracted ${ocrText.length} chars`);
    }

    // STEP 2: Claude Sonnet analyzes the OCR text + original image for cross-reference
    const analysisPrompt = isCosmetics ? COSMETICS_ANALYSIS : FOOD_ANALYSIS;

    const skinProfileHint = isCosmetics && body.skinProfile
      ? `\n\nPROFIL SKÓRY UŻYTKOWNIKA:\nTyp: ${body.skinProfile.skin_type}, Wrażliwość: ${body.skinProfile.sensitivity}, Wiek skóry: ${body.skinProfile.skin_age}\nProblemy: ${body.skinProfile.skin_problems?.join(", ") || "brak"}\nWłosy: ${body.skinProfile.hair_type || "brak"}, Problemy włosów: ${body.skinProfile.hair_problems?.join(", ") || "brak"}\nSPERSONALIZUJ wyniki pod ten profil.`
      : "";

    // Build user message with OCR text + image
    const userContent: unknown[] = [imageContent];

    if (ocrText.length > 20) {
      // We have good OCR text — send it along with the image
      userContent.push({
        type: "text",
        text: `Google Vision OCR odczytał z etykiety następujący tekst:\n\n---\n${ocrText}\n---\n\nUżyj tego tekstu jako GŁÓWNE źródło danych (nazwa produktu, składniki, wartości odżywcze, alergeny). Zweryfikuj z obrazem powyżej. Jeśli OCR tekst zawiera wartości odżywcze — użyj DOKŁADNIE tych liczb, nie zgaduj. Przeanalizuj produkt i odpowiedz WYŁĄCZNIE poprawnym JSON.${skinProfileHint}`,
      });
    } else {
      // OCR failed or returned too little — fall back to image-only analysis
      userContent.push({
        type: "text",
        text: `Odczytaj DOKŁADNIE cały tekst z tego zdjęcia etykiety, a następnie przeanalizuj produkt. Odpowiedz WYŁĄCZNIE poprawnym JSON.${skinProfileHint}`,
      });
    }

    // Sonnet for labels (Google Vision does the OCR heavy lifting) — 5x cheaper, 2x faster
    const result1 = await callClaude(apiKey, analysisPrompt, userContent, isCosmetics ? 7168 : 5120, 30000);

    if (result1.error) {
      if (result1.status === 429) return NextResponse.json({ error: "Zbyt wiele zapytań. Poczekaj chwilę." }, { status: 429 });
      if (result1.status === 401) return NextResponse.json({ error: "Problem z kluczem API." }, { status: 401 });
      return NextResponse.json({ error: `Błąd analizy (${result1.status}).` }, { status: result1.status! });
    }

    const step2 = result1;

    try {
      const result = parseJsonResponse(step2.text);
      result.type = isCosmetics ? "cosmetics" : "food";

      // Validation
      if (!result.name || result.name.length < 2) result.name = "Nieznany produkt";
      if (typeof result.score !== "number" || result.score < 1 || result.score > 10) result.score = 5;
      if (!result.pros) result.pros = [];
      if (!result.cons) result.cons = [];
      if (!result.allergens) result.allergens = [];
      if (!result.fun_comparisons) result.fun_comparisons = [];

      // Validate nutrition
      if (!isCosmetics) validateNutrition(result);

      return NextResponse.json(result);
    } catch {
      console.error("Failed to parse AI response:", step2.text?.substring(0, 500));
      return NextResponse.json({ error: "Nie udało się przeanalizować. Spróbuj wyraźniejsze zdjęcie." }, { status: 422 });
    }
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Wystąpił błąd. Spróbuj ponownie." }, { status: 500 });
  }
}
