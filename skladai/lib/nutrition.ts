// === Harris-Benedict BMR ===
export function calculateBMR(gender: "male" | "female", weight: number, height: number, age: number): number {
  if (gender === "male") {
    return Math.round(88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age));
  }
  return Math.round(447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age));
}

// === Activity multipliers ===
export const ACTIVITY_LEVELS = {
  sedentary: { label: "Siedzący", description: "Praca biurowa, brak ćwiczeń", multiplier: 1.2 },
  light: { label: "Lekko aktywny", description: "Lekkie ćwiczenia 1-3x/tydz.", multiplier: 1.375 },
  moderate: { label: "Umiarkowanie", description: "Ćwiczenia 3-5x/tydz.", multiplier: 1.55 },
  active: { label: "Bardzo aktywny", description: "Ciężki trening 6-7x/tydz.", multiplier: 1.725 },
  extreme: { label: "Ekstremalnie", description: "2x dziennie / praca fizyczna", multiplier: 1.9 },
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;

// === Goals ===
export const GOALS = {
  maintain: { label: "Utrzymanie wagi", modifier: 0 },
  lose: { label: "Odchudzanie", modifier: -500 },
  gain: { label: "Budowa masy", modifier: 300 },
  healthy: { label: "Chcę jeść zdrowiej", modifier: 0 },
} as const;

export type Goal = keyof typeof GOALS;

// === BMI ===
export function calculateBMI(weight: number, height: number): number {
  const h = height / 100;
  return Math.round((weight / (h * h)) * 10) / 10;
}

// === TDEE ===
export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_LEVELS[activity].multiplier);
}

// === Target calories ===
export function calculateTargetCalories(tdee: number, goal: Goal): number {
  return Math.round(tdee + GOALS[goal].modifier);
}

// === Daily norms based on target calories ===
export interface DailyNorms {
  calories: number;
  protein_min: number;
  protein_max: number;
  fat_min: number;
  fat_max: number;
  carbs_min: number;
  carbs_max: number;
  salt_max: number;
  sugar_max: number;
  fiber_min: number;
  water_ml: number;
}

export function calculateDailyNorms(targetCalories: number, weight: number, goal: Goal): DailyNorms {
  // Protein: 1.6-2.2g/kg for muscle, 1.2-1.6 for general
  const isGain = goal === "gain";
  const proteinMultMin = isGain ? 1.6 : 1.2;
  const proteinMultMax = isGain ? 2.2 : 1.6;

  const protein_min = Math.round(weight * proteinMultMin);
  const protein_max = Math.round(weight * proteinMultMax);

  // Fat: 25-30% of calories
  const fat_min = Math.round((targetCalories * 0.25) / 9);
  const fat_max = Math.round((targetCalories * 0.30) / 9);

  // Carbs: remaining calories
  const proteinCals = ((protein_min + protein_max) / 2) * 4;
  const fatCals = ((fat_min + fat_max) / 2) * 9;
  const carbsCals = targetCalories - proteinCals - fatCals;
  const carbs_min = Math.round((carbsCals * 0.85) / 4);
  const carbs_max = Math.round((carbsCals * 1.15) / 4);

  return {
    calories: targetCalories,
    protein_min,
    protein_max,
    fat_min,
    fat_max,
    carbs_min: Math.max(carbs_min, 100),
    carbs_max: Math.max(carbs_max, 150),
    salt_max: 5,       // WHO recommendation
    sugar_max: 25,      // WHO: 6 teaspoons = 24g
    fiber_min: 25,      // WHO recommendation
    water_ml: Math.round(weight * 30), // ~30ml/kg
  };
}

// === Allergen list ===
export const COMMON_ALLERGENS = [
  { id: "gluten", label: "Gluten", icon: "🌾" },
  { id: "lactose", label: "Laktoza", icon: "🥛" },
  { id: "milk", label: "Białka mleka", icon: "🧀" },
  { id: "eggs", label: "Jaja", icon: "🥚" },
  { id: "nuts", label: "Orzechy", icon: "🥜" },
  { id: "peanuts", label: "Orzeszki ziemne", icon: "🥜" },
  { id: "soy", label: "Soja", icon: "🫘" },
  { id: "fish", label: "Ryby", icon: "🐟" },
  { id: "shellfish", label: "Skorupiaki", icon: "🦐" },
  { id: "celery", label: "Seler", icon: "🥬" },
  { id: "mustard", label: "Gorczyca", icon: "🟡" },
  { id: "sesame", label: "Sezam", icon: "⚪" },
  { id: "sulfites", label: "Siarczyny", icon: "🍷" },
  { id: "lupin", label: "Łubin", icon: "🌸" },
] as const;

// === Diets ===
export const DIETS = {
  none: { label: "Brak", description: "Jem wszystko" },
  vegetarian: { label: "Wegetariańska", description: "Bez mięsa" },
  vegan: { label: "Wegańska", description: "Bez produktów odzwierzęcych" },
  keto: { label: "Keto", description: "Nisko-węglowodanowa, wysoko-tłuszczowa" },
  gluten_free: { label: "Bezglutenowa", description: "Bez glutenu" },
  lactose_free: { label: "Bez laktozy", description: "Bez laktozy" },
} as const;

export type Diet = keyof typeof DIETS;

// === Diabetes types ===
export const DIABETES_TYPES = {
  type1: { label: "Typ 1", description: "Insulinozależna" },
  type2: { label: "Typ 2", description: "Insulinooporna" },
} as const;

export type DiabetesType = keyof typeof DIABETES_TYPES;

// === Pregnancy trimesters ===
export const TRIMESTERS = {
  t1: { label: "I trymestr", weeks: "1-12 tydzień", extraCalories: 0 },
  t2: { label: "II trymestr", weeks: "13-26 tydzień", extraCalories: 340 },
  t3: { label: "III trymestr", weeks: "27-40 tydzień", extraCalories: 450 },
  karmienie: { label: "Karmienie", weeks: "po porodzie", extraCalories: 500 },
  planuje: { label: "Planuję ciążę", weeks: "przed ciążą", extraCalories: 0 },
} as const;

export type Trimester = keyof typeof TRIMESTERS;
