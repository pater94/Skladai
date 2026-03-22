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

export interface AnalysisResult {
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
}

export interface ScanHistoryItem {
  id: string;
  name: string;
  brand: string;
  score: number;
  date: string;
  thumbnail: string;
  result: AnalysisResult;
}
