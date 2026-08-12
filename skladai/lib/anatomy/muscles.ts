/**
 * FORMA — Katalog anatomiczny mięśni (encyklopedia treningowa).
 *
 * Źródło wiedzy dla interaktywnej mapy mięśni przy ćwiczeniu. Każdy mięsień ma
 * głowy / części składowe (bo to one decydują o akcentach treningowych), funkcję,
 * przyczepy w uproszczeniu, wskazówki treningowe i ciekawostkę.
 *
 * Nazewnictwo: polskie + łacińskie (mianownictwo anatomiczne).
 */

export type MuscleId =
  // przód
  | "chest" | "delts" | "biceps" | "brachialis" | "forearms" | "abs" | "obliques"
  | "core_deep" | "serratus" | "quads" | "adductors" | "hip_flexors" | "tibialis"
  // tył
  | "traps" | "lats" | "rhomboids" | "teres_major" | "rotator_cuff" | "erectors"
  | "glutes" | "hamstrings" | "calves" | "triceps";

export interface MuscleHead {
  id: string;
  /** Nazwa polska głowy / części */
  name: string;
  /** Nazwa łacińska */
  latin: string;
  /** Za co odpowiada + kiedy pracuje najmocniej */
  role: string;
}

export interface Muscle {
  id: MuscleId;
  name: string;
  latin: string;
  /** Partia zbiorcza (do grupowania w UI) */
  group: string;
  /** Na którym widoku sylwetki jest widoczny */
  view: "front" | "back" | "both";
  heads: MuscleHead[];
  /** Funkcja — co robi w ruchu */
  action: string;
  /** Przyczepy (uproszczone) */
  attach: string;
  /** Jak trenować — praktyka */
  training: string;
  /** Ciekawostka / niuans, który robi różnicę */
  fact?: string;
}

export const MUSCLES: Record<MuscleId, Muscle> = {
  // ─────────────────────────────── PRZÓD ───────────────────────────────
  chest: {
    id: "chest",
    name: "Mięsień piersiowy większy",
    latin: "Musculus pectoralis major",
    group: "Klatka piersiowa",
    view: "front",
    heads: [
      { id: "clavicular", name: "Część obojczykowa (górna)", latin: "Pars clavicularis", role: "Zgina ramię w górę i do przodu. Dominuje przy skosie dodatnim (30–45°) i wyciskaniu w górę." },
      { id: "sternal", name: "Część mostkowo-żebrowa (środkowa)", latin: "Pars sternocostalis", role: "Największa i najsilniejsza część. Przywodzi ramię w poziomie — król płaskiego wyciskania." },
      { id: "abdominal", name: "Część brzuszna (dolna)", latin: "Pars abdominalis", role: "Ściąga ramię w dół i do środka. Najmocniej pracuje na skosie ujemnym i dipach." },
    ],
    action: "Przywodzenie ramienia w płaszczyźnie poziomej (zbliżanie do środka ciała), zginanie i rotacja wewnętrzna ramienia.",
    attach: "Od obojczyka, mostka i chrząstek żebrowych → do guzka większego kości ramiennej.",
    training: "Klatka rośnie od objętości w pełnym zakresie ruchu — rozciągnięcie na dole jest bodźcem kluczowym. Kąt ławki zmienia akcent: skos dodatni → góra, płaska → środek, skos ujemny/dipy → dół. Nie musisz robić wszystkich trzech w jednym dniu, ale w tygodniu warto trafić w każdy kąt.",
    fact: "Włókna piersiowego skręcają się przy przyczepie o ~180° — dlatego część dolna przyczepia się WYŻEJ na kości ramiennej niż górna. To dlatego zmiana kąta tak realnie zmienia akcent.",
  },
  delts: {
    id: "delts",
    name: "Mięsień naramienny",
    latin: "Musculus deltoideus",
    group: "Barki",
    view: "both",
    heads: [
      { id: "front", name: "Akton przedni (obojczykowy)", latin: "Pars clavicularis", role: "Unosi ramię w przód, wspiera każde wyciskanie. Najmocniej pracuje w wyciskaniu nad głowę i na skosie dodatnim." },
      { id: "side", name: "Akton boczny (barkowy)", latin: "Pars acromialis", role: "Odwodzi ramię na bok — buduje szerokość barków. Szczyt napięcia między 45° a 90° odwiedzenia." },
      { id: "rear", name: "Akton tylny (grzebieniowy)", latin: "Pars spinalis", role: "Odwodzi ramię w poziomie i prostuje je w tył. Pracuje w odwrotnych rozpiętkach, face pullach i wiosłowaniu z łokciem wysoko." },
    ],
    action: "Odwodzenie ramienia (bok), zginanie (przód), prostowanie i odwodzenie poziome (tył). Stabilizuje głowę kości ramiennej w każdym ruchu góry ciała.",
    attach: "Od obojczyka, wyrostka barkowego i grzebienia łopatki → do guzowatości naramiennej kości ramiennej.",
    training: "Akton przedni dostaje bardzo dużo pracy z każdego wyciskania — rzadko potrzebuje osobnej pracy. Szerokość barków robi akton BOCZNY (wznosy bokiem, dużo powtórzeń, kontrola) a zdrowie i postawę akton TYLNY, który u większości jest zaniedbany. Proporcja objętości, którą warto trzymać: tył ≥ bok > przód.",
    fact: "Naramienny jest mięśniem wielopierzastym — włókna biegną pod kątem do ścięgna. Dzięki temu generuje dużą siłę, ale ma mały zakres skrócenia, więc kocha kontrolę i pełen zakres, a nie zamach.",
  },
  biceps: {
    id: "biceps",
    name: "Mięsień dwugłowy ramienia",
    latin: "Musculus biceps brachii",
    group: "Ramiona",
    view: "front",
    heads: [
      { id: "long", name: "Głowa długa (zewnętrzna)", latin: "Caput longum", role: "Tworzy szczyt bicepsa. Pracuje najmocniej, gdy ramię jest COFNIĘTE za tułów (uginanie na skosie, wyciąg zza ciała)." },
      { id: "short", name: "Głowa krótka (wewnętrzna)", latin: "Caput breve", role: "Buduje grubość i szerokość ramienia od środka. Dominuje, gdy ramię jest WYSUNIĘTE przed tułów (modlitewnik, uginanie z podparciem)." },
    ],
    action: "Zgina staw łokciowy, odwraca (supinuje) przedramię, wspomaga zginanie ramienia w barku.",
    attach: "Głowa długa od guzka nadpanewkowego łopatki, krótka od wyrostka kruczego → wspólne ścięgno do guzowatości kości promieniowej.",
    training: "Biceps to zginacz ŁOKCIA i supinator — najlepiej rośnie, gdy łączysz oba: uginanie z obrotem dłoni na zewnątrz. Pozycja ramienia w barku wybiera głowę: łokieć za tułowiem → długa (szczyt), łokieć przed tułowiem → krótka. Zakres pełny, opuszczanie 2–3 s, bez bujania tułowiem.",
    fact: "Biceps to tylko ~1/3 obwodu ramienia w widoku z boku — resztę robi triceps i mięsień ramienny pod spodem. Chcesz grubych ramion? Trenuj triceps i ramienny co najmniej tyle samo.",
  },
  brachialis: {
    id: "brachialis",
    name: "Mięsień ramienny",
    latin: "Musculus brachialis",
    group: "Ramiona",
    view: "front",
    heads: [
      { id: "main", name: "Brzusiec główny", latin: "Corpus musculi", role: "Czysty zginacz łokcia — nie zależy od ustawienia dłoni. Maksymalnie aktywny przy chwycie młotkowym i neutralnym." },
    ],
    action: "Zgina staw łokciowy — najsilniejszy zginacz łokcia niezależnie od pozycji przedramienia.",
    attach: "Od dolnej połowy przedniej powierzchni kości ramiennej → do guzowatości kości łokciowej.",
    training: "Leży POD bicepsem — jego rozwój wypycha biceps do góry i realnie zwiększa obwód ramienia. Rośnie od chwytu młotkowego i neutralnego oraz od uginania z przedramieniem w pronacji (chwyt nachwytem, np. uginanie odwrotne).",
    fact: "Bo nie przyczepia się do kości promieniowej (tej, która się obraca), ustawienie dłoni go nie obchodzi — dlatego chwyt młotkowy „przekierowuje” pracę z bicepsa właśnie na niego.",
  },
  forearms: {
    id: "forearms",
    name: "Mięśnie przedramienia",
    latin: "Musculi antebrachii",
    group: "Przedramiona",
    view: "both",
    heads: [
      { id: "flexors", name: "Zginacze (strona dłoniowa)", latin: "Compartimentum flexorum", role: "Zaciskają chwyt i zginają nadgarstek. Pracują w każdym martwym ciągu, wiosłowaniu i podciąganiu." },
      { id: "extensors", name: "Prostowniki (strona grzbietowa)", latin: "Compartimentum extensorum", role: "Prostują nadgarstek i stabilizują go pod obciążeniem. Zwykle zaniedbane — ich słabość to częsta przyczyna „łokcia tenisisty”." },
      { id: "brachioradialis", name: "Ramienno-promieniowy", latin: "Musculus brachioradialis", role: "Widoczny wał na zewnętrznej stronie przedramienia. Zgina łokieć — maksymalnie przy chwycie młotkowym." },
    ],
    action: "Chwyt (siła ścisku), zginanie i prostowanie nadgarstka, współudział w zginaniu łokcia.",
    attach: "Głównie od nadkłykci kości ramiennej → przez nadgarstek do kości śródręcza i paliczków.",
    training: "Najlepiej rosną od pracy, którą i tak wykonujesz: ciężkie martwe ciągi, wiosłowania, zwisy i spacer farmera. Jeśli chwyt jest ogniwem, które puszcza pierwsze — trenuj go osobno (zwisy na czas, spacery), zamiast od razu sięgać po paski.",
    fact: "Siła chwytu jest jednym z najlepiej udokumentowanych markerów ogólnego zdrowia i długowieczności — trening przedramion to nie tylko estetyka.",
  },
  abs: {
    id: "abs",
    name: "Mięsień prosty brzucha",
    latin: "Musculus rectus abdominis",
    group: "Brzuch / core",
    view: "front",
    heads: [
      { id: "upper", name: "Włókna górne", latin: "Fibrae superiores", role: "Dominują, gdy przybliżasz KLATKĘ do miednicy (brzuszki, spięcia na wyciągu)." },
      { id: "lower", name: "Włókna dolne", latin: "Fibrae inferiores", role: "Dominują, gdy przybliżasz MIEDNICĘ do klatki (unoszenie nóg, podciąganie kolan w zwisie)." },
    ],
    action: "Zgina tułów (przybliża mostek do miednicy), odchyla miednicę do tyłu, stabilizuje kręgosłup przy każdym ciężkim boju.",
    attach: "Od spojenia łonowego → do chrząstek żeber V–VII i wyrostka mieczykowatego.",
    training: "To jeden mięsień, ale ruch decyduje o rozkładzie napięcia: zginanie od góry → włókna górne, zginanie od dołu → dolne. Rośnie tak samo jak każdy inny mięsień — od progresji obciążenia (spięcia z obciążeniem, unoszenie nóg z ciężarem), a nie od setek powtórzeń.",
    fact: "„Kaloryfer” to nie efekt treningu, tylko genetycznie ustalone smugi ścięgniste (inscriptiones tendineae). Możesz zmienić grubość mięśnia i poziom tkanki tłuszczowej — nie zmienisz układu kratek.",
  },
  obliques: {
    id: "obliques",
    name: "Mięśnie skośne brzucha",
    latin: "Musculi obliqui abdominis",
    group: "Brzuch / core",
    view: "front",
    heads: [
      { id: "external", name: "Skośny zewnętrzny", latin: "Musculus obliquus externus", role: "Skręca tułów w stronę PRZECIWNĄ i zgina w bok. Widoczny jako pas po bokach brzucha." },
      { id: "internal", name: "Skośny wewnętrzny", latin: "Musculus obliquus internus", role: "Leży głębiej, skręca tułów w tę SAMĄ stronę. Pracuje w parze ze skośnym zewnętrznym po drugiej stronie." },
    ],
    action: "Rotacja tułowia, zginanie boczne, wspólnie z poprzecznym — tłocznia brzuszna i stabilizacja odcinka lędźwiowego.",
    attach: "Od żeber i talerza biodrowego → do kresy białej i miednicy, włókna biegną skośnie.",
    training: "Najmocniej pracują ANTYROTACYJNIE — czyli gdy opierają się skręceniu (Pallof press, farmer walk jednorącz, deska boczna). Ciężka praca rotacyjna z dużym obciążeniem i dokładaniem zakresu to prosta droga do przeciążenia lędźwi.",
    fact: "Przy jednostronnym noszeniu ciężaru (walk farmera jedną ręką) skośne po przeciwnej stronie pracują na wysokich wartościach — bez ani jednego powtórzenia „skrętów”.",
  },
  core_deep: {
    id: "core_deep",
    name: "Mięsień poprzeczny brzucha",
    latin: "Musculus transversus abdominis",
    group: "Brzuch / core",
    view: "front",
    heads: [
      { id: "main", name: "Warstwa poprzeczna", latin: "Fibrae transversae", role: "Najgłębsza warstwa — działa jak naturalny pas. Napina się ODRUCHOWO przed ruchem kończyny." },
    ],
    action: "Zwiększa ciśnienie śródbrzuszne, usztywnia tułów i stabilizuje kręgosłup przed przeniesieniem siły.",
    attach: "Od powięzi piersiowo-lędźwiowej, żeber i talerza biodrowego → do kresy białej, włókna poziomo.",
    training: "Nie trenujesz go „na kształt” — trenujesz go na funkcję. Nauka oddechu przeponowego + bracing (napięcie jak przed ciosem w brzuch) przed każdą ciężką serią przysiadu i martwego ciągu daje więcej niż jakiekolwiek izolowane ćwiczenie.",
    fact: "U osób z przewlekłym bólem lędźwi opóźnia się jego odruchowa aktywacja przed ruchem — dlatego nauka bracingu jest jednym z filarów wracania do ciężkiego treningu.",
  },
  serratus: {
    id: "serratus",
    name: "Mięsień zębaty przedni",
    latin: "Musculus serratus anterior",
    group: "Klatka / obręcz barkowa",
    view: "front",
    heads: [
      { id: "main", name: "Zęby boczne", latin: "Digitationes", role: "Przesuwa łopatkę do przodu i obraca ją w górę — bez tego nie podniesiesz bezpiecznie ramienia nad głowę." },
    ],
    action: "Protrakcja i rotacja górna łopatki, dociska łopatkę do klatki piersiowej.",
    attach: "Od 1–9 żebra → do przyśrodkowego brzegu łopatki (od spodu).",
    training: "Pracuje w wyciskaniu z pełnym wysunięciem barków na końcu ruchu (push-up plus), w przenoszeniu ciężaru nad głową i w wyciskaniu nad głowę. Jego słabość = „skrzydlata łopatka” i ból barku przy pracy nad głową.",
    fact: "Nazywany „mięśniem boksera” — to on wypycha rękę do przodu przy ciosie prostym.",
  },
  quads: {
    id: "quads",
    name: "Mięsień czworogłowy uda",
    latin: "Musculus quadriceps femoris",
    group: "Nogi — przód",
    view: "front",
    heads: [
      { id: "rectus_femoris", name: "Prosty uda", latin: "Rectus femoris", role: "Jedyna głowa przechodząca przez BIODRO — prostuje kolano i zgina biodro. Pracuje najlepiej, gdy biodro jest wyprostowane (prostowanie nóg siedząc, przysiad przedni)." },
      { id: "vastus_lateralis", name: "Obszerny boczny", latin: "Vastus lateralis", role: "Największa głowa — buduje szerokość uda z zewnątrz. Dominuje przy dużych ciężarach i głębokim zgięciu kolana." },
      { id: "vastus_medialis", name: "Obszerny przyśrodkowy (VMO)", latin: "Vastus medialis", role: "„Kropla” nad kolanem od wewnątrz. Najmocniej w końcowej fazie prostowania i w głębokim przysiadzie." },
      { id: "vastus_intermedius", name: "Obszerny pośredni", latin: "Vastus intermedius", role: "Leży pod prostym uda — niewidoczny, ale mocno dokłada się do siły prostowania kolana." },
    ],
    action: "Prostuje staw kolanowy; głowa prosta dodatkowo zgina biodro.",
    attach: "Od kości udowej i kolca biodrowego → wspólnym ścięgnem przez rzepkę do guzowatości piszczeli.",
    training: "Głębokość przysiadu buduje uda bardziej niż sam ciężar — praca w rozciągnięciu (pełne zgięcie kolana) daje najsilniejszy bodziec. Prosty uda potrzebuje osobnej pracy z WYPROSTOWANYM biodrem (prostowanie nóg siedząc, przysiady przednie, sissy squat), bo w przysiadzie i wykrokach jest w niekorzystnej pozycji.",
    fact: "Prosty uda pracuje dwustawowo, więc w przysiadzie jednocześnie się skraca (kolano) i wydłuża (biodro) — jego długość prawie się nie zmienia. Dlatego przysiad sam w sobie rozwija go najsłabiej z całej czwórki.",
  },
  adductors: {
    id: "adductors",
    name: "Mięśnie przywodziciele uda",
    latin: "Musculi adductores",
    group: "Nogi — wewnętrzna",
    view: "front",
    heads: [
      { id: "magnus", name: "Przywodziciel wielki", latin: "Adductor magnus", role: "Ogromny mięsień — jego część tylna działa niemal jak czwarty hamstring, mocno prostuje biodro w przysiadzie i martwym ciągu." },
      { id: "longus_brevis", name: "Przywodziciel długi i krótki", latin: "Adductor longus et brevis", role: "Przywodzą udo i wspierają zginanie biodra. Pracują przy szerokiej postawie i wykrokach bocznych." },
    ],
    action: "Przywodzenie uda (przyciąganie do linii środkowej) oraz — szczególnie przywodziciel wielki — prostowanie biodra.",
    attach: "Od kości łonowej i kulszowej → wzdłuż wewnętrznej strony kości udowej.",
    training: "Rosną świetnie od przysiadów z szerszą postawą, wykroków bocznych i głębokiego zakresu w hip thruście. Częsta kontuzja piłkarska (naciągnięcie pachwiny) to zwykle słaby, nietrenowany w rozciągnięciu przywodziciel — warto go trenować, a nie tylko rozciągać.",
    fact: "Przywodziciel wielki generuje przy prostowaniu biodra moment porównywalny z pośladkiem wielkim — to jeden z najbardziej niedocenianych mięśni w przysiadzie.",
  },
  hip_flexors: {
    id: "hip_flexors",
    name: "Mięsień biodrowo-lędźwiowy",
    latin: "Musculus iliopsoas",
    group: "Biodra",
    view: "front",
    heads: [
      { id: "psoas", name: "Lędźwiowy większy", latin: "Musculus psoas major", role: "Biegnie od kręgosłupa lędźwiowego do uda — najsilniejszy zginacz biodra, wpływa też na ustawienie lędźwi." },
      { id: "iliacus", name: "Biodrowy", latin: "Musculus iliacus", role: "Wyściela talerz biodrowy, dokłada się do zginania biodra przy unoszeniu kolana." },
    ],
    action: "Zgina biodro (przybliża udo do brzucha), stabilizuje odcinek lędźwiowy.",
    attach: "Od kręgów lędźwiowych i talerza biodrowego → do krętarza mniejszego kości udowej.",
    training: "Mocno pracuje przy unoszeniu nóg w zwisie i wszystkim, co unosi kolano wysoko. Uwaga: przy słabym brzuchu przejmuje pracę w „ćwiczeniach na brzuch” i ciągnie miednicę w przód — dlatego unoszenie nóg robimy z miednicą podwiniętą do tyłu.",
    fact: "To jedyny mięsień łączący bezpośrednio kręgosłup z nogą — dlatego długie siedzenie (biodro w zgięciu) potrafi realnie zmienić ustawienie lędźwi.",
  },
  tibialis: {
    id: "tibialis",
    name: "Mięsień piszczelowy przedni",
    latin: "Musculus tibialis anterior",
    group: "Podudzie",
    view: "front",
    heads: [
      { id: "main", name: "Brzusiec główny", latin: "Corpus musculi", role: "Unosi stopę (zgięcie grzbietowe) i podtrzymuje łuk podłużny stopy." },
    ],
    action: "Zgięcie grzbietowe stopy (przyciąganie palców do goleni), supinacja stopy.",
    attach: "Od kłykcia bocznego i trzonu piszczeli → do kości klinowatej i I kości śródstopia.",
    training: "Niemal nigdy nietrenowany, a odpowiada za stabilność kostki i amortyzację w biegu. Wystarczą unoszenia palców (tibialis raise) o ścianę — kilka serii tygodniowo realnie zmniejsza ryzyko „shin splints”.",
    fact: "Jego siła jest jednym z lepszych predyktorów utrzymania równowagi i braku upadków z wiekiem.",
  },

  // ─────────────────────────────── TYŁ ───────────────────────────────
  traps: {
    id: "traps",
    name: "Mięsień czworoboczny grzbietu",
    latin: "Musculus trapezius",
    group: "Plecy — góra",
    view: "back",
    heads: [
      { id: "upper", name: "Część zstępująca (górna)", latin: "Pars descendens", role: "Unosi obojczyk i łopatkę — pracuje w szrugsach, spacerach farmera i wszystkim, co ciągnie w dół z rąk." },
      { id: "middle", name: "Część poprzeczna (środkowa)", latin: "Pars transversa", role: "Ściąga łopatki do kręgosłupa (retrakcja). Główny gracz w wiosłowaniu z łokciami szeroko i face pullach." },
      { id: "lower", name: "Część wstępująca (dolna)", latin: "Pars ascendens", role: "Ściąga łopatkę w DÓŁ i obraca ją w górę. Kluczowa dla zdrowego barku przy pracy nad głową — u większości najsłabsza." },
    ],
    action: "Steruje łopatką: unosi (góra), ściąga do kręgosłupa (środek), obniża i rotuje w górę (dół).",
    attach: "Od potylicy i wyrostków kolczystych C1–Th12 → do obojczyka, wyrostka barkowego i grzebienia łopatki.",
    training: "To trzy różne mięśnie w jednej płachcie — potrzebują trzech różnych ruchów. Góra: szrugsy i noszenie ciężaru. Środek: wiosłowanie z łokciami na zewnątrz, face pull. Dół: ściąganie drążka, przyciąganie łopatek w dół w zwisie, Y-raise. Dolna część jest antagonistą górnej i to ona najczęściej brakuje w treningu.",
    fact: "Klasyczna „zaokrąglona postawa” to rzadko za mocna góra czworobocznego — częściej za słaba jego część dolna i środkowa. Trenuj brakujące, zamiast rozciągać na siłę.",
  },
  lats: {
    id: "lats",
    name: "Mięsień najszerszy grzbietu",
    latin: "Musculus latissimus dorsi",
    group: "Plecy — szerokość",
    view: "back",
    heads: [
      { id: "upper", name: "Włókna górne (poprzeczne)", latin: "Fibrae superiores", role: "Biegną bardziej poziomo — mocniej pracują przy przyciąganiu POZIOMYM (wiosłowanie) i budują szerokość pod pachą." },
      { id: "lower", name: "Włókna dolne (skośne / lędźwiowe)", latin: "Fibrae inferiores", role: "Biegną pionowo od miednicy — dominują przy ciągnięciu PIONOWYM (podciąganie, ściąganie drążka), budują „stożek” talii." },
    ],
    action: "Przywodzi, prostuje i rotuje ramię do wewnątrz — czyli ciągnie łokieć w dół i do tyłu. Pomaga też w wydechu i stabilizacji tułowia.",
    attach: "Od wyrostków kolczystych Th7–L5, kości krzyżowej i talerza biodrowego → do grzebienia guzka mniejszego kości ramiennej.",
    training: "Najszerszy nie ciągnie „dłonią” tylko ŁOKCIEM — myśl o prowadzeniu łokcia do kieszeni. Ciągnięcie pionowe (podciąganie, ściąganie drążka) buduje szerokość, poziome (wiosłowanie) grubość. Pełen zwis na górze i świadome rozciągnięcie robi ogromną różnicę — to najdłuższy mięsień pleców i kocha zakres.",
    fact: "To największy mięsień górnej połowy ciała pod względem powierzchni. Przyczepia się do miednicy — dlatego przy podciąganiu napięty brzuch i lekko podwinięta miednica realnie zwiększają jego napięcie.",
  },
  rhomboids: {
    id: "rhomboids",
    name: "Mięśnie równoległoboczne",
    latin: "Musculi rhomboidei",
    group: "Plecy — środek",
    view: "back",
    heads: [
      { id: "major_minor", name: "Równoległoboczny większy i mniejszy", latin: "Rhomboideus major et minor", role: "Ściągają łopatkę do kręgosłupa i lekko obracają ją w dół. Leżą pod czworobocznym." },
    ],
    action: "Retrakcja (ściąganie) łopatek do kręgosłupa i ich stabilizacja przy każdym ciągnięciu.",
    attach: "Od wyrostków kolczystych C7–Th5 → do przyśrodkowego brzegu łopatki.",
    training: "Nie da się ich odizolować od czworobocznego środkowego i nie ma potrzeby — rosną od każdego wiosłowania, w którym faktycznie ŚCIĄGASZ łopatki, a nie tylko szarpiesz rękami. Pauza 1 s w skurczu robi tu więcej niż dokładanie ciężaru.",
    fact: "Ich osłabienie to jedna z częstszych przyczyn „przeskakiwania” i trzeszczenia łopatki przy ruchu ramienia nad głową.",
  },
  teres_major: {
    id: "teres_major",
    name: "Mięsień obły większy",
    latin: "Musculus teres major",
    group: "Plecy — szerokość",
    view: "back",
    heads: [
      { id: "main", name: "Brzusiec główny", latin: "Corpus musculi", role: "Działa jak „mały najszerszy” — przywodzi i prostuje ramię, buduje szerokość tuż pod pachą." },
    ],
    action: "Przywodzenie, prostowanie i rotacja wewnętrzna ramienia — praktycznie zawsze razem z najszerszym.",
    attach: "Od dolnego kąta łopatki → do grzebienia guzka mniejszego kości ramiennej.",
    training: "Pracuje w każdym ciągnięciu pionowym. Nachwyt szeroki i ciągnięcie łokciem szeroko od ciała akcentuje go najmocniej — to on w dużej mierze tworzy wrażenie „szerokich pleców” od góry.",
    fact: "Nazywany „małym pomocnikiem najszerszego” (lat's little helper) — anatomicznie odrębny, ale funkcjonalnie prawie nierozłączny.",
  },
  rotator_cuff: {
    id: "rotator_cuff",
    name: "Stożek rotatorów",
    latin: "Rotatores cuff (musculi)",
    group: "Bark — stabilizacja",
    view: "back",
    heads: [
      { id: "supraspinatus", name: "Nadgrzebieniowy", latin: "Supraspinatus", role: "Inicjuje pierwsze ~15° odwodzenia ramienia i dociska głowę kości ramiennej do panewki. Najczęściej uszkadzany z całej czwórki." },
      { id: "infraspinatus", name: "Podgrzebieniowy", latin: "Infraspinatus", role: "Główny rotator ZEWNĘTRZNY — hamuje rotację wewnętrzną przy wyciskaniu. Kluczowy dla zdrowia barku." },
      { id: "teres_minor", name: "Obły mniejszy", latin: "Teres minor", role: "Wspiera rotację zewnętrzną i stabilizuje tylną część stawu." },
      { id: "subscapularis", name: "Podłopatkowy", latin: "Subscapularis", role: "Jedyny rotator WEWNĘTRZNY stożka, leży od przodu łopatki. Najsilniejszy z czwórki." },
    ],
    action: "Centrują głowę kości ramiennej w panewce podczas każdego ruchu ramienia — bez nich bark „ucieka” w górę.",
    attach: "Od różnych powierzchni łopatki → do guzka większego i mniejszego kości ramiennej.",
    training: "Nie potrzebują ciężaru — potrzebują regularności. 2–3 serie rotacji zewnętrznych z gumą lub lekkim wyciągiem, 12–20 powtórzeń, przed wyciskaniem. To najtańsza polisa ubezpieczeniowa dla barków, jaką możesz sobie kupić.",
    fact: "Przy wyciskaniu z dużym ciężarem to nie mięsień naramienny jest wąskim gardłem bezpieczeństwa, tylko stożek — jeśli nie utrzyma głowy kości w panewce, dochodzi do konfliktu podbarkowego.",
  },
  erectors: {
    id: "erectors",
    name: "Prostownik grzbietu",
    latin: "Musculus erector spinae",
    group: "Plecy — dół",
    view: "back",
    heads: [
      { id: "iliocostalis", name: "Biodrowo-żebrowy", latin: "Iliocostalis", role: "Najbardziej boczna kolumna — prostuje i zgina tułów w bok." },
      { id: "longissimus", name: "Najdłuższy", latin: "Longissimus", role: "Środkowa, największa kolumna — główna siła prostowania tułowia w martwym ciągu i good morningach." },
      { id: "spinalis", name: "Kolcowy", latin: "Spinalis", role: "Najbliżej kręgosłupa — prostuje odcinek piersiowy, utrzymuje klatkę „otwartą” przy ciężkich bojach." },
    ],
    action: "Prostuje kręgosłup i — co ważniejsze w siłowni — ANTY-zgięciowo opiera się jego zaokrąglaniu pod obciążeniem.",
    attach: "Od kości krzyżowej i talerza biodrowego → wzdłuż kręgosłupa do żeber i kręgów szyjnych.",
    training: "Największą pracę wykonuje IZOMETRYCZNIE — trzymając neutralny kręgosłup w martwym ciągu, przysiadzie i wiosłowaniu. Dodatkowo świetnie reagują na good morningi, hiperwyprosty i martwy ciąg rumuński. Nie potrzebują codziennej pracy — potrzebują regeneracji, bo dostają bodziec z każdego ciężkiego boju.",
    fact: "Ból lędźwi dzień po ciężkim martwym ciągu to najczęściej zwykłe DOMS prostowników, a nie „uszkodzenie kręgosłupa” — ale różnicę musi ocenić specjalista, jeśli ból promieniuje do nogi.",
  },
  glutes: {
    id: "glutes",
    name: "Mięśnie pośladkowe",
    latin: "Musculi glutei",
    group: "Pośladki",
    view: "back",
    heads: [
      { id: "maximus", name: "Pośladkowy wielki", latin: "Gluteus maximus", role: "Najsilniejszy prostownik biodra w ciele. Maksymalne napięcie w KOŃCOWEJ fazie wyprostu — hip thrust, wyprost bioder w martwym ciągu." },
      { id: "medius", name: "Pośladkowy średni", latin: "Gluteus medius", role: "Odwodzi udo i stabilizuje miednicę w staniu na jednej nodze. Jego słabość = kolano „ucieka” do środka." },
      { id: "minimus", name: "Pośladkowy mały", latin: "Gluteus minimus", role: "Leży pod średnim, wspiera odwodzenie i rotację wewnętrzną uda, dokłada się do stabilizacji miednicy." },
    ],
    action: "Prostowanie biodra, odwodzenie uda, rotacja zewnętrzna, stabilizacja miednicy w każdym kroku.",
    attach: "Od talerza biodrowego i kości krzyżowej → do pasma biodrowo-piszczelowego i krętarza większego.",
    training: "Pośladek wielki dostaje najwięcej z ruchów, gdzie opór jest największy przy WYPROSTOWANYM biodrze (hip thrust, wyprosty) — przysiad obciąża go głównie w rozciągnięciu, dlatego oba typy mają sens. Średni i mały rosną od pracy jednonóż i odwodzenia (walking lunge, side plank z uniesieniem, odwodzenie na wyciągu).",
    fact: "Pośladek wielki ma największy przekrój poprzeczny ze wszystkich mięśni ciała — i unikalnie dla człowieka jest tak rozwinięty, bo umożliwia bieg na dwóch nogach.",
  },
  hamstrings: {
    id: "hamstrings",
    name: "Grupa kulszowo-goleniowa",
    latin: "Musculi ischiocrurales",
    group: "Nogi — tył",
    view: "back",
    heads: [
      { id: "bf_long", name: "Dwugłowy uda — głowa długa", latin: "Biceps femoris caput longum", role: "Dwustawowa: prostuje biodro i zgina kolano. Najczęściej naciągana głowa przy sprincie." },
      { id: "bf_short", name: "Dwugłowy uda — głowa krótka", latin: "Biceps femoris caput breve", role: "Jednostawowa — tylko zgina kolano. Dlatego trafiasz w nią wyłącznie uginaniem nóg, nie martwym ciągiem." },
      { id: "semitendinosus", name: "Półścięgnisty", latin: "Semitendinosus", role: "Przyśrodkowa strona uda — prostuje biodro, zgina i rotuje kolano do wewnątrz." },
      { id: "semimembranosus", name: "Półbłoniasty", latin: "Semimembranosus", role: "Leży pod półścięgnistym, gruby i silny — mocno dokłada się do prostowania biodra." },
    ],
    action: "Prostowanie biodra + zginanie kolana. Hamują wyprost kolana przy biegu — to tam najczęściej się rwą.",
    attach: "Od guza kulszowego (poza głową krótką) → do kości piszczelowej i strzałkowej poniżej kolana.",
    training: "Potrzebują DWÓCH rodzajów pracy, bo mają dwie funkcje: ruch biodrowy w rozciągnięciu (martwy ciąg rumuński, good morning) ORAZ zginanie kolana (uginanie nóg, nordic curl). Sam martwy ciąg rumuński nigdy nie zaadresuje głowy krótkiej dwugłowego. Praca ekscentryczna (nordic) najmocniej obniża ryzyko naderwania.",
    fact: "Nordic hamstring curl to jedno z najlepiej udokumentowanych ćwiczeń prewencyjnych w sporcie — w badaniach na piłkarzach obniżał częstość urazów dwugłowego nawet o ponad połowę.",
  },
  calves: {
    id: "calves",
    name: "Mięsień trójgłowy łydki",
    latin: "Musculus triceps surae",
    group: "Łydki",
    view: "back",
    heads: [
      { id: "gastro_medial", name: "Brzuchaty — głowa przyśrodkowa", latin: "Gastrocnemius caput mediale", role: "Większa, wewnętrzna „bania” łydki. Pracuje najmocniej przy WYPROSTOWANYM kolanie (wspięcia stojąc)." },
      { id: "gastro_lateral", name: "Brzuchaty — głowa boczna", latin: "Gastrocnemius caput laterale", role: "Zewnętrzna głowa, buduje szerokość łydki z boku. Też wymaga wyprostowanego kolana." },
      { id: "soleus", name: "Płaszczkowaty", latin: "Soleus", role: "Leży pod brzuchatym, ogromny i wytrzymały. Dominuje przy ZGIĘTYM kolanie (wspięcia siedząc) — jedyny sposób, by go porządnie trafić." },
    ],
    action: "Zgięcie podeszwowe stopy (wspięcie na palce) — napęd w każdym kroku, skoku i sprincie.",
    attach: "Brzuchaty od kłykci kości udowej, płaszczkowaty od piszczeli i strzałki → wspólnym ścięgnem Achillesa do guza piętowego.",
    training: "Zasada kolana rozstrzyga wszystko: kolano PROSTE → brzuchaty, kolano ZGIĘTE → płaszczkowaty. Jeśli robisz tylko wspięcia stojąc, połowa łydki nie dostaje bodźca. Pełen zakres z pauzą w rozciągnięciu (pięta nisko, 2 s) bije szarpanie dużym ciężarem.",
    fact: "Płaszczkowaty ma ogromną przewagę włókien wolnokurczliwych i potrafi pracować godzinami — dlatego reaguje na wysokie zakresy powtórzeń i częstotliwość lepiej niż większość mięśni.",
  },
  triceps: {
    id: "triceps",
    name: "Mięsień trójgłowy ramienia",
    latin: "Musculus triceps brachii",
    group: "Ramiona",
    view: "back",
    heads: [
      { id: "long", name: "Głowa długa", latin: "Caput longum", role: "Największa głowa, jedyna przechodząca przez BARK. Trafisz w nią tylko przy ramieniu UNIESIONYM nad głowę lub cofniętym (wyciskanie francuskie, overhead extension)." },
      { id: "lateral", name: "Głowa boczna", latin: "Caput laterale", role: "Tworzy widoczną „podkowę” z zewnątrz. Dominuje przy prostowaniu z ramieniem przy tułowiu i dużym ciężarze (pushdown, dipy)." },
      { id: "medial", name: "Głowa przyśrodkowa", latin: "Caput mediale", role: "Leży najgłębiej, pracuje w KAŻDYM prostowaniu łokcia niezależnie od kąta — koń roboczy tricepsa." },
    ],
    action: "Prostuje staw łokciowy; głowa długa dodatkowo prostuje i przywodzi ramię w barku.",
    attach: "Głowa długa od guzka podpanewkowego łopatki, boczna i przyśrodkowa od kości ramiennej → do wyrostka łokciowego.",
    training: "Triceps to ~2/3 masy ramienia — jeśli chcesz obwodu, tu jest największa dźwignia. Kluczowa zasada: bez pracy z ramieniem NAD GŁOWĄ nie rozwiniesz głowy długiej, a to ona jest największa. Połącz jedno ćwiczenie overhead (francuskie / wyciąg zza głowy) z jednym przy tułowiu (pushdown / dipy) i masz komplet.",
    fact: "Głowa długa jest w pełnym rozciągnięciu dopiero przy ramieniu nad głową — badania nad treningiem w rozciągnięciu pokazują tam wyraźnie większy przyrost niż przy samych pushdownach.",
  },
};

/** Kolejność wyświetlania w rankingu / legendzie. */
export const MUSCLE_ORDER: MuscleId[] = [
  "chest", "lats", "traps", "delts", "biceps", "triceps", "brachialis", "forearms",
  "quads", "hamstrings", "glutes", "calves", "adductors",
  "abs", "obliques", "core_deep", "erectors",
  "rhomboids", "teres_major", "rotator_cuff", "serratus", "hip_flexors", "tibialis",
];

export function getMuscle(id: MuscleId): Muscle {
  return MUSCLES[id];
}
