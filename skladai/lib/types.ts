// === Tryb skanowania ===
export type ScanMode = "food" | "cosmetics" | "meal" | "forma" | "text_search" | "alkomat" | "suplement";

// === Żywność ===
export interface Ingredient {
  name: string;
  original: string;
  category: "natural" | "processed" | "controversial" | "harmful";
  risk: "safe" | "caution" | "warning";
  explanation: string;
}

export interface NutritionItem {
  label: string;
  value: string;
  icon: string;
  sub?: string;
}

export interface DiabetesInfo {
  ww_per_100g: number;
  ww_per_package: number | null;
  glycemic_index: "niski" | "średni" | "wysoki";
  diabetes_badge: "friendly" | "caution" | "warning";
  diabetes_tip: string;
}

export interface PregnancyInfo {
  alerts: string[];
  safe_nutrients: string[];
  caffeine_mg: number | null;
}

export interface AllergyInfo {
  detected_allergens: string[];
  may_contain: string[];
  is_safe: boolean;
}

export interface FoodAnalysisResult {
  type: "food";
  name: string;
  brand: string;
  weight: string;
  score: number;
  verdict_short: string;
  verdict: string;
  ingredients: Ingredient[];
  allergens: string[];
  pros: string[];
  cons: string[];
  tip: string;
  nutrition: NutritionItem[];
  sugar_teaspoons: number;
  fun_comparisons: string[];
  diabetes_info: DiabetesInfo | null;
  pregnancy_info: PregnancyInfo | null;
  allergy_info: AllergyInfo | null;
}

// === Kosmetyki ===
export interface CosmeticIngredient {
  name: string;
  polish_name: string;
  function: string;
  category: "safe" | "caution" | "controversial" | "harmful";
  risk: "safe" | "caution" | "warning";
  explanation: string;
  concerns?: string[];
}

export interface CosmeticWarning {
  text: string;
  level: "info" | "caution" | "alarm";
  pregnancy_risk: boolean;
}

export interface PriceComparison {
  verdict: string;
  similar_products: { name: string; price_range: string; why_similar: string }[];
  better_option?: { name: string; price_range: string; why_better: string };
  savings_tip?: string;
}

export interface Compatibility {
  works_well_with: string[];
  avoid_with: string[];
  best_time: "rano" | "wieczór" | "oba";
}

export interface CosmeticsAnalysisResult {
  type: "cosmetics";
  name: string;
  brand: string;
  volume: string;
  category: string;
  score: number;
  risk_level: "LOW" | "MED" | "HIGH";
  verdict_short: string;
  verdict: string;
  ingredients: CosmeticIngredient[];
  warnings: (CosmeticWarning | string)[];
  good_for: string[];
  bad_for: string[];
  allergens: string[];
  pros: string[];
  cons: string[];
  tip: string;
  is_vegan: boolean | string | null;
  ingredient_count: number;
  safe_count: number;
  caution_count: number;
  harmful_count: number;
  fun_comparisons: string[];
  price_comparison?: PriceComparison;
  compatibility?: Compatibility;
  pao_months?: number | null;
}

// === Danie ===
export interface MealItem {
  name: string;
  estimated_weight_g: number;
  min_reasonable_g: number;
  max_reasonable_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface MealAnalysisResult {
  type: "meal";
  meal_name: string;
  name: string; // alias for meal_name (compatibility)
  brand: string; // empty for meals
  score: number;
  verdict_short: string;
  verdict: string;
  items: MealItem[];
  total: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  sugar_teaspoons: number;
  fun_comparisons: string[];
  tip: string;
  pros: string[];
  cons: string[];
  allergens: string[];
}

// === Text search (AI food database) ===
export interface TextSearchItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar: number;
  fiber: number;
  score: number;
  emoji: string;
  verdict: string;
  fun_comparison: string;
  // Per 100g for slider
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  default_portion_g: number;
  min_portion_g: number;
  max_portion_g: number;
}

export interface TextSearchResult {
  type: "text_search";
  name: string;
  brand: string;
  score: number;
  verdict_short: string;
  verdict: string;
  items: TextSearchItem[];
  total: { calories: number; protein: number; fat: number; carbs: number };
  sugar_teaspoons: number;
  fun_comparisons: string[];
  tip: string;
  pros: string[];
  cons: string[];
  allergens: string[];
}

// === CheckForm (body analysis) ===
export interface CheckFormResult {
  type: "forma";
  name: string;
  brand: string;
  score: number;
  body_fat_range: string;
  body_fat_category: "essential" | "athletic" | "fit" | "average" | "above_average" | "high";
  muscle_mass: "above_average" | "average" | "below_average";
  overall_score: number;
  score_label: string;
  visible_strengths: string[];
  areas_to_improve: string[];
  verdict_short: string;
  verdict: string;
  tip: string;
  bmi: number;
  bmi_category: string;
  photo_warnings: string[];
  pros: string[];
  cons: string[];
  allergens: string[];
  fun_comparisons: string[];
}

// === Favorites & Recent searches ===
export interface FavoriteItem {
  id: string;
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portion: string;
  default_portion_g: number;
  score: number;
  addedAt: string;
}

// === CheckForm history ===
export interface CheckFormEntry {
  id: string;
  date: string;
  score: number;
  body_fat_range: string;
  body_fat_category: string;
  muscle_mass: string;
  bmi: number;
  weight_kg: number;
  thumbnail: string; // base64 compressed
  result: CheckFormResult;
}

// === Suplement ===
export interface SupplementIngredient {
  name: string;
  dose: string;
  daily_value_percent: number | null;
  category: "essential" | "beneficial" | "neutral" | "unnecessary" | "risky";
  risk: "safe" | "caution" | "warning";
  explanation: string;
}

export interface SupplementAnalysisResult {
  type: "suplement";
  name: string;
  brand: string;
  form: string; // tabletki / kapsułki / proszek / żel / płyn
  score: number;
  verdict_short: string;
  verdict: string;
  ingredients: SupplementIngredient[];
  daily_dose: string;
  dose_warning: string | null;
  pros: string[];
  cons: string[];
  tip: string;
  allergens: string[];
  is_vegan: boolean | null;
  interactions: string[];
  who_for: string[];
  who_avoid: string[];
  fun_comparisons: string[];
}

// === Union type ===
export type AnalysisResult = FoodAnalysisResult | CosmeticsAnalysisResult | MealAnalysisResult | TextSearchResult | CheckFormResult | SupplementAnalysisResult;

// === Profil użytkownika ===
export interface UserProfile {
  // Basic
  name?: string;
  gender: "male" | "female";
  age: number;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  // Activity & goals
  activity: "sedentary" | "light" | "moderate" | "active" | "extreme";
  goal: "maintain" | "lose" | "gain" | "healthy";
  // Calculated
  bmr: number;
  tdee: number;
  target_calories: number;
  // Health
  health: {
    diabetes: "type1" | "type2" | null;
    pregnancy: "t1" | "t2" | "t3" | "karmienie" | null;
    allergens: string[];
    diet: string;
  };
  // Daily norms
  daily_norms: {
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
  };
  // Meta
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

// === Dziennik jedzenia ===
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  productName: string;
  brand: string;
  score: number;
  portion_g: number; // how much user ate
  package_g: number; // total package weight
  // Nutrition per portion
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar: number;
  salt: number;
  fiber: number;
  // Reference
  scanId: string; // link to ScanHistoryItem
  timestamp: string; // ISO
}

export interface DailyTotals {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar: number;
  salt: number;
  fiber: number;
  entries: DiaryEntry[];
  avgScore: number;
}

// === Historia ===
export interface ScanHistoryItem {
  id: string;
  scanType: ScanMode;
  name: string;
  brand: string;
  score: number;
  date: string;
  thumbnail: string;
  result: AnalysisResult;
}
