// === Kalkulator promili — Wzór Widmarka ===

export interface DrinkType {
  id: string;
  name: string;
  icon: string;
  ml: number;
  abv: number; // % alkoholu
  calories: number;
}

export const DRINK_TYPES: DrinkType[] = [
  { id: "beer_small", name: "Piwo 330ml", icon: "🍺", ml: 330, abv: 5.0, calories: 140 },
  { id: "beer_large", name: "Piwo 500ml", icon: "🍺", ml: 500, abv: 5.0, calories: 215 },
  { id: "beer_strong", name: "Piwo mocne", icon: "🍺", ml: 500, abv: 7.0, calories: 300 },
  { id: "wine", name: "Wino 150ml", icon: "🍷", ml: 150, abv: 12.0, calories: 120 },
  { id: "vodka", name: "Wódka 50ml", icon: "🥃", ml: 50, abv: 40.0, calories: 110 },
  { id: "whisky", name: "Whisky 50ml", icon: "🥃", ml: 50, abv: 40.0, calories: 110 },
  { id: "drink", name: "Drink 250ml", icon: "🍹", ml: 250, abv: 8.0, calories: 180 },
  { id: "shot", name: "Shot 40ml", icon: "🥂", ml: 40, abv: 40.0, calories: 90 },
];

export interface ConsumedDrink {
  id: string;
  drinkType: DrinkType;
  time: string; // ISO timestamp
  customMl?: number;
  customAbv?: number;
}

// Gramy alkoholu = ml × (ABV/100) × 0.789
export function alcoholGrams(ml: number, abv: number): number {
  return ml * (abv / 100) * 0.789;
}

// BAC (‰) = (alkohol_g / (masa_kg × r)) - (eliminacja × godziny)
// r: mężczyzna = 0.7, kobieta = 0.6
// Eliminacja: 0.15‰/godz
// Body build affects Widmark r factor
// 0=lean, 1=average, 2=athletic, 3=very muscular
const R_TABLE_MALE = [0.55, 0.68, 0.73, 0.78];
const R_TABLE_FEMALE = [0.45, 0.55, 0.60, 0.65];
// Food absorption: 0=empty stomach(100%), 1=snack(85%), 2=meal(70%), 3=heavy meal(55%)
const ABSORPTION = [1.0, 0.85, 0.70, 0.55];

export function calculateBAC(
  drinks: ConsumedDrink[],
  weightKg: number,
  gender: "male" | "female",
  now?: Date,
  bodyBuild: number = 1,
  foodLevel: number = 0
): number {
  if (drinks.length === 0 || weightKg <= 0) return 0;

  const currentTime = now || new Date();
  const rTable = gender === "male" ? R_TABLE_MALE : R_TABLE_FEMALE;
  const r = rTable[Math.min(bodyBuild, 3)] || rTable[1];
  const absorption = ABSORPTION[Math.min(foodLevel, 3)] || 1.0;
  const eliminationRate = 0.15; // ‰ per hour

  let totalBAC = 0;

  for (const drink of drinks) {
    const drinkTime = new Date(drink.time);
    const hoursAgo = (currentTime.getTime() - drinkTime.getTime()) / (1000 * 60 * 60);

    if (hoursAgo < 0) continue; // Future drink?

    const ml = drink.customMl || drink.drinkType.ml;
    const abv = drink.customAbv || drink.drinkType.abv;
    const grams = alcoholGrams(ml, abv) * absorption;

    const peakBAC = grams / (weightKg * r);
    const currentBAC = peakBAC - (eliminationRate * hoursAgo);

    if (currentBAC > 0) {
      totalBAC += currentBAC;
    }
  }

  return Math.round(totalBAC * 100) / 100;
}

// Kiedy trzeźwy (BAC = 0)
export function timeToSober(bac: number): number {
  if (bac <= 0) return 0;
  return Math.ceil((bac / 0.15) * 60); // minutes
}

// Kiedy może prowadzić (BAC < 0.2‰ w Polsce)
export function timeToDrive(bac: number): number {
  if (bac <= 0.2) return 0;
  return Math.ceil(((bac - 0.2) / 0.15) * 60); // minutes
}

// Formatuj minuty na "Xh Ymin"
export function formatMinutes(mins: number): string {
  if (mins <= 0) return "teraz";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// Kolor progu
export function bacColor(bac: number): { color: string; bg: string; label: string; emoji: string } {
  if (bac < 0.2) return { color: "#16A34A", bg: "#DCFCE7", label: "Trzeźwy", emoji: "🟢" };
  if (bac < 0.5) return { color: "#CA8A04", bg: "#FEF9C3", label: "Stan po użyciu", emoji: "🟡" };
  return { color: "#DC2626", bg: "#FEE2E2", label: "Nietrzeźwość", emoji: "🔴" };
}

// Suma kalorii z drinków
export function totalDrinkCalories(drinks: ConsumedDrink[]): number {
  return drinks.reduce((sum, d) => sum + d.drinkType.calories, 0);
}

// Porównania kaloryczne alkoholu
export function alcoholCalorieComparisons(calories: number): string[] {
  if (calories <= 0) return [];
  const comparisons: string[] = [];

  const bigMacs = Math.round(calories / 563 * 10) / 10;
  if (bigMacs >= 0.5) comparisons.push(`🍔 ${bigMacs} Big Mac${bigMacs !== 1 ? "ów" : ""} (a daje białko)`);

  const pizzas = Math.round(calories / 270 * 10) / 10;
  if (pizzas >= 1) comparisons.push(`🍕 ${pizzas} kawałk${pizzas >= 2 ? "ów" : ""} pizzy (i byłbyś najedzony)`);

  const runMin = Math.round(calories / 6);
  comparisons.push(`🏃 ${runMin} min biegania żeby spalić`);

  if (calories > 400) {
    comparisons.push(`🥗 Cały obiad: kurczak + ryż + sałatka`);
  }

  return comparisons;
}

// Storage dla sesji picia
const BAC_SESSION_KEY = "skladai_bac_session";

export interface BACSession {
  drinks: ConsumedDrink[];
  startTime: string;
  date: string;
}

export function getBACSession(): BACSession | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(BAC_SESSION_KEY);
    if (!data) return null;
    const session = JSON.parse(data) as BACSession;
    // Auto-clear sessions older than 24h
    const start = new Date(session.startTime);
    if (Date.now() - start.getTime() > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(BAC_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveBACSession(session: BACSession): void {
  localStorage.setItem(BAC_SESSION_KEY, JSON.stringify(session));
}

export function clearBACSession(): void {
  localStorage.removeItem(BAC_SESSION_KEY);
}
