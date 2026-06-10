/**
 * Definicje 3 trybów aplikacji (etap 1: mode picker po sign in).
 *
 * Używane przez:
 *   - components/ModePickerScreen.tsx (full-screen onboarding)
 *   - app/profil/page.tsx (sekcja "Tryb aplikacji")
 *   - lib/hooks/useUserMode.ts (state + setter)
 *
 * Etap 1: wybór tryby zapisuje się do UserProfile.mode + dispatch
 * "user-mode-changed" event. Konsekwencje (różne UI per mode, persona
 * AI, kolejność tabów) przychodzą w etapie 2+.
 */

import type { UserMode, UserProfile } from "@/lib/types";

/**
 * Czy user ma KONTEKST ZDROWOTNY w profilu (cukrzyca / ciąża / alergie
 * pokarmowe / schorzenia przewlekłe). Zastępuje dawny `mode === "health"`:
 * po zwinięciu do 2 trybów funkcje zdrowotne (MedicalDisclaimer + alerty
 * alergenowe/schorzeniowe na /wyniki) włączają się gdy user MA wpisane
 * schorzenia — niezależnie od trybu. `diet` celowo pominięta (to preferencja,
 * nie schorzenie wymagające ostrzeżeń).
 */
export function profileHasHealthContext(profile: UserProfile | null | undefined): boolean {
  const h = profile?.health;
  if (!h) return false;
  return !!(h.diabetes || h.pregnancy || (h.allergens && h.allergens.length > 0) || (h.conditions && h.conditions.length > 0));
}

export interface ModeDef {
  id: UserMode;
  label: string;
  desc: string;
  color: string;        // hex z #
  colorRgb: string;     // "r,g,b" tuple do rgba(...)
  emoji: string;        // floating emoji nad ikoną (dla mode picker)
  /** SVG paths-only (bez <svg> wrappera) — wrapper dodaje komponent renderujący */
  iconPaths: React.ReactNode;
  /** Speed orbital ring rotacji w sekundach */
  ringSpeed: number;
  /** Direction orbital ring rotacji */
  ringDir: "normal" | "reverse";
  /** Float delay dla emoji (s) */
  floatDelay: number;
}

import React from "react";

export const MODES: ModeDef[] = [
  {
    id: "fitness",
    label: "Forma & Zdrowie",
    desc: "Kalorie, makro, sen, kroki i skan składu ciała ze zdjęcia",
    color: "#6efcb4",
    colorRgb: "110,252,180",
    emoji: "📈",
    ringSpeed: 8,
    ringDir: "normal",
    floatDelay: 0,
    iconPaths: (
      <>
        <path d="M5 24L11 18L15 22L21 14L27 18" />
        <path d="M22 14H27V19" strokeWidth="1.8" />
        <path d="M5 28H27" opacity="0.4" strokeWidth="1.2" />
        <circle cx="11" cy="18" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="15" cy="22" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="21" cy="14" r="1.5" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    id: "cosmetics",
    label: "Świat kosmetyków",
    desc: "INCI, składy, typ skóry",
    color: "#C084FC",
    colorRgb: "192,132,252",
    emoji: "✨",
    ringSpeed: 7,
    ringDir: "normal",
    floatDelay: 2.4,
    iconPaths: (
      <>
        <path d="M16 4V14M16 18V28M4 16H14M18 16H28" />
        <path d="M16 14C16 14 14 16 14 16C14 16 16 18 16 18C16 18 18 16 18 16C18 16 16 14 16 14Z" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
        <path d="M9 9L11 11M21 21L23 23M23 9L21 11M9 23L11 21" strokeWidth="1.2" />
      </>
    ),
  },
];

export const MODE_LABELS: Record<UserMode, string> = {
  fitness: "Forma & Zdrowie",
  cosmetics: "Świat kosmetyków",
};

export function getModeDef(mode: UserMode): ModeDef {
  return MODES.find((m) => m.id === mode) ?? MODES[0];
}

// ────────────────────────────────────────────────────────────────────
// AGENT AI PERSONAS (Etap 2 Krok A)
// ────────────────────────────────────────────────────────────────────
// Każdy tryb ma swoją personę Agent AI — system prompt fragment +
// welcome message. Wstrzyknięcie do main system prompt w
// app/api/chat/route.ts:buildSystemPrompt() PO bazowym intro, PRZED
// kontekstem usera (profile, scans, diary). Persona definiuje:
//   - rolę (trener / asystent zdrowotny / ekspert kosmetyków)
//   - granice (co AI robi i czego NIE robi w danym trybie)
//   - styl rozmowy (motywujący / spokojny / ekspercki)
// Welcome message pokazuje user'owi czego oczekiwać w chacie.

export const MODE_PERSONAS: Record<UserMode, {
  role: string;
  systemPromptAddition: string;
  introMessage: string;
}> = {
  fitness: {
    role: "trener fitness i dietetyk",
    systemPromptAddition: `TWÓJ TRYB: FORMA & ZDROWIE
Jesteś trenerem fitness i dietetykiem. Twoje obszary kompetencji:
- Kalorie, makroskładniki, bilans energetyczny
- Skład ciała (masa mięśniowa, tkanka tłuszczowa)
- Trening siłowy, cardio, mobility
- Sen i regeneracja
- Suplementacja sportowa (białko, kreatyna, BCAA)

STYL: motywujący, konkretny, nawet techniczny gdy user wie o czym mówi. Możesz używać żargonu (deficyt, surplus, RIR, drop sety) gdy user jest zaawansowany. Bądź uczciwy — jeśli user pyta o coś nierealnego (utrata 10kg w miesiąc) powiedz że to niezdrowe.

ŚWIADOMOŚĆ ZDROWOTNA: jeśli profil usera zawiera schorzenia/alergie (cukrzyca, gluten, laktoza, Hashimoto, IBS itp.) — ZAWSZE je uwzględniaj analizując produkty: ostrzegaj o jego alergenach, wysokim indeksie glikemicznym przy cukrzycy, składnikach przeciwwskazanych w jego stanie. Bądź konkretny (np. "IG=75 — wysoko, zjedz z białkiem").

GRANICE: nie dawaj porad medycznych. NIE diagnozujesz, NIE leczysz, NIE zastępujesz lekarza — przy poważniejszych kwestiach kieruj do lekarza/dietetyka. Możesz INFORMOWAĆ o ogólnych zasadach żywienia w danym stanie i tłumaczyć etykiety.`,
    introMessage: "Cześć! Jestem Twoim trenerem AI. Pomogę z kaloriami, treningiem, snem, a jeśli masz schorzenia czy alergie w profilu — przypilnuję ich przy skanach. O co chcesz spytać? 💪",
  },

  cosmetics: {
    role: "ekspert kosmetyków i pielęgnacji",
    systemPromptAddition: `TWÓJ TRYB: ŚWIAT KOSMETYKÓW
Jesteś ekspertem składu kosmetyków i pielęgnacji skóry. Twoje obszary kompetencji:
- INCI (International Nomenclature of Cosmetic Ingredients)
- Typy skóry: sucha, tłusta, mieszana, wrażliwa, dojrzała, problematyczna
- Problemy skóry: trądzik, AZS, łuszczyca, rozszerzone naczynka, przebarwienia, zmarszczki, wypryski
- Komedogenność, drażniące składniki, alergeny kosmetyczne
- Składniki aktywne: retinol, niacynamid, witamina C, kwasy AHA/BHA/PHA, peptydy, ceramidy, hialuron
- Pielęgnacja w ciąży/karmieniu (jakie składniki przeciwwskazane)
- Pielęgnacja włosów, skóry głowy, ciała

STYL: konkretny, ekspercki, ale przyjazny. Nie strasz — pokaż alternatywy. Zamiast "ten krem jest okropny" napisz "ten krem zawiera X który może drażnić wrażliwą skórę — w tej kategorii cenowej lepsze alternatywy to Y i Z".

KIEDY ANALIZUJESZ KOSMETYK:
- Sprawdź INCI pod kątem typu skóry usera z PROFIL SKÓRY
- Wyłap składniki komedogenne (jeśli skóra trądzikowa)
- Wyłap potencjalne drażniące (jeśli skóra wrażliwa)
- Sprawdź przeciwwskazania ciążowe jeśli user jest w ciąży/karmi

NIE pisz o niczym poza kosmetykami, pielęgnacją i włosami. Jeśli user pyta o jedzenie/zdrowie/trening, powiedz że może przełączyć tryb w Profilu (Profil → "⚡ Tryb aplikacji").`,
    introMessage: "Cześć! Jestem Twoim ekspertem od składu kosmetyków i pielęgnacji skóry. Pokażę Ci jak czytać INCI i znajdę produkty pod Twój typ skóry. O co chcesz spytać? ✨",
  },
};

/**
 * Server-side helper (chat/route.ts buildSystemPrompt).
 * Zwraca persona prompt fragment do wklejenia w system prompt.
 */
export function getAgentPersonaForMode(mode: UserMode | null | undefined): string {
  const effective = (mode ?? "fitness") as UserMode;
  return MODE_PERSONAS[effective].systemPromptAddition;
}

/**
 * Client-side helper (AgentChat welcome message).
 */
export function getIntroMessageForMode(mode: UserMode | null | undefined): string {
  const effective = (mode ?? "fitness") as UserMode;
  return MODE_PERSONAS[effective].introMessage;
}

// ────────────────────────────────────────────────────────────────────
// BOTTOM NAV CONFIG (Etap 2 Krok B)
// ────────────────────────────────────────────────────────────────────
// Per-tryb: kolejność tabów + default tab (gdzie user trafia po
// wyborze trybu) + accent color (fallback gdy route nie ma własnego
// per-route koloru typu /forma orange, /promile indigo).

export type NavRoute = "/" | "/forma" | "/dashboard" | "/profil";

export interface ModeNavConfig {
  /** Kolejność wyświetlania tabów w bottom nav */
  tabs: NavRoute[];
  /** Default tab po pomyślnym wyborze trybu (router.push) */
  defaultTab: NavRoute;
  /** Mode-specific accent — fallback gdy current route nie ma override */
  navAccentColor: string;
}

export const MODE_NAV_CONFIG: Record<UserMode, ModeNavConfig> = {
  fitness: {
    // /forma TYLKO w fitness (Patryk decision post-merge hotfix): CheckForm
    // to narzędzie typowo fitness (sylwetka, postura). Dla zdrowotnych i
    // kosmetycznych nie ma kontekstu.
    tabs: ["/", "/forma", "/dashboard", "/profil"],
    defaultTab: "/",
    navAccentColor: "#6efcb4",
  },
  cosmetics: {
    // Brak /forma w nav — patrz komentarz fitness.
    tabs: ["/", "/dashboard", "/profil"],
    defaultTab: "/",
    navAccentColor: "#C084FC",
  },
};

export function getNavConfigForMode(mode: UserMode | null | undefined): ModeNavConfig {
  return MODE_NAV_CONFIG[(mode ?? "fitness") as UserMode];
}

// ────────────────────────────────────────────────────────────────────
// DEFAULT SCAN CATEGORY (Etap 2 Krok C)
// ────────────────────────────────────────────────────────────────────
// Mapuje tryb aplikacji na domyślną kategorię w Skaner home. UWAGA:
// "ScanMode" to OSOBNY typ od UserMode — ScanMode = "food"|"meal"|
// "cosmetics"|"suplement"|"forma" itd. UserMode = "fitness"|"health"|
// "cosmetics". Tutaj mapowanie 1-do-1 ale nazwy się przypadkowo
// pokrywają tylko dla "cosmetics".

// food_macro / food_sklad — rozdzielony skan żywności (patrz lib/types.ts ScanMode).
export type ScanCategory = "food_macro" | "food_sklad" | "meal" | "cosmetics" | "suplement";

export const MODE_DEFAULT_SCAN_CATEGORY: Record<UserMode, ScanCategory> = {
  fitness: "food_macro",  // fitness liczy kalorie → domyślnie Makro
  cosmetics: "cosmetics", // Skanuj INCI od razu
};

export function getDefaultScanCategoryForMode(mode: UserMode | null | undefined): ScanCategory {
  return MODE_DEFAULT_SCAN_CATEGORY[(mode ?? "fitness") as UserMode];
}

// ────────────────────────────────────────────────────────────────────
// ALLOWED SCAN CATEGORIES PER MODE (Patryk hotfix post-merge)
// ────────────────────────────────────────────────────────────────────
// Decyzja: w Skanerze home pokazujemy TYLKO kategorie pasujące do trybu
// usera — bez "wszystko dla wszystkich" zatłoczenia tabami.
//
//   fitness: Żywność + Danie + Suplement (drop Kosmetyk — nie ma kontekstu)
//   health:  Żywność + Danie + Suplement (drop Kosmetyk — j.w.)
//   cosmetics: Kosmetyk only (focus na INCI, suplement w przyszłości jeśli
//              wpadnie "skin care from inside" feature)
//
// Caller: app/page.tsx filtruje tabs przed render oraz auto-correctuje
// `mode` w state'cie jeśli zapisany w localStorage `skladai_mode` jest
// niedozwolony dla bieżącego userMode.

// Dozwolone tryby skanu per UserMode. Pierwszy = domyślny.
// Patryk decision (struktura zakładek): Żywność (Makro/Skład) + Danie +
// Suplement jako osobne ZAKŁADKI na ekranie Skanuj. Modal po SKANUJ pokazuje
// TYLKO Makro/Skład (chooser filtruje tę listę do food_*). meal/suplement są
// tu po to, by wybór zakładki przetrwał reload (init mode nie resetuje go).
export const MODE_ALLOWED_SCAN_CATEGORIES: Record<UserMode, ScanCategory[]> = {
  fitness:   ["food_macro", "food_sklad", "meal", "suplement"], // Makro domyślny
  cosmetics: ["cosmetics"],
};

export function getAllowedScanCategoriesForMode(
  mode: UserMode | null | undefined
): ScanCategory[] {
  return MODE_ALLOWED_SCAN_CATEGORIES[(mode ?? "fitness") as UserMode];
}
