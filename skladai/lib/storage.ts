import { ScanHistoryItem, AnalysisResult, ScanMode, UserProfile, DiaryEntry, DailyTotals, MealType } from "./types";
import { schedulePush } from "./sync";

/** Notify CloudSync that localStorage changed */
function notifyChange(): void {
  schedulePush();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("local-data-changed"));
  }
}

const HISTORY_KEY = "skladai_history";
const SCAN_COUNT_KEY = "skladai_scan_count";
const SCAN_DATE_KEY = "skladai_scan_date";
const MODE_KEY = "skladai_mode";
const MAX_HISTORY = 50;
const MAX_DAILY_SCANS = 30;

export function getHistory(): ScanHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    if (!data) return [];
    return JSON.parse(data) as ScanHistoryItem[];
  } catch {
    return [];
  }
}

export function addToHistory(
  result: AnalysisResult,
  thumbnail: string,
  scanType: ScanMode = "food",
  customDate?: string
): ScanHistoryItem {
  const item: ScanHistoryItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    scanType,
    name: result.name || "Nieznany",
    brand: result.brand || "",
    score: result.score || 5,
    date: customDate || new Date().toISOString(),
    thumbnail,
    result,
  };

  const history = getHistory();
  history.unshift(item);
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  notifyChange();
  return item;
}

export function getHistoryItem(id: string): ScanHistoryItem | null {
  const history = getHistory();
  return history.find((item) => item.id === id) || null;
}

export function removeHistoryItem(id: string): void {
  const history = getHistory().filter((item) => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  notifyChange();
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  notifyChange();
}

export function getSavedMode(): ScanMode {
  if (typeof window === "undefined") return "food";
  return (localStorage.getItem(MODE_KEY) as ScanMode) || "food";
}

export function saveMode(mode: ScanMode): void {
  localStorage.setItem(MODE_KEY, mode);
}

export function checkRateLimit(): { allowed: boolean; remaining: number } {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(SCAN_DATE_KEY);

  if (savedDate !== today) {
    localStorage.setItem(SCAN_DATE_KEY, today);
    localStorage.setItem(SCAN_COUNT_KEY, "0");
    return { allowed: true, remaining: MAX_DAILY_SCANS };
  }

  const count = parseInt(localStorage.getItem(SCAN_COUNT_KEY) || "0", 10);
  return { allowed: count < MAX_DAILY_SCANS, remaining: MAX_DAILY_SCANS - count };
}

export function incrementScanCount(): void {
  const count = parseInt(localStorage.getItem(SCAN_COUNT_KEY) || "0", 10);
  localStorage.setItem(SCAN_COUNT_KEY, (count + 1).toString());
}

// === PROFIL ===
const PROFILE_KEY = "skladai_profile";

export function getProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    if (!data) return null;
    return JSON.parse(data) as UserProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  profile.updated_at = new Date().toISOString();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  notifyChange();
}

export function hasProfile(): boolean {
  if (typeof window === "undefined") return false;
  const p = getProfile();
  return p !== null && p.onboarding_complete === true;
}

// === DZIENNIK JEDZENIA ===
const DIARY_KEY = "skladai_diary";

export function getDiary(): DiaryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(DIARY_KEY);
    if (!data) return [];
    return JSON.parse(data) as DiaryEntry[];
  } catch {
    return [];
  }
}

export function addDiaryEntry(entry: Omit<DiaryEntry, "id" | "timestamp">): DiaryEntry {
  const full: DiaryEntry = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
  };
  const diary = getDiary();
  diary.push(full);
  // Keep max 500 entries
  if (diary.length > 500) diary.splice(0, diary.length - 500);
  localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
  notifyChange();
  return full;
}

export function removeDiaryEntry(id: string): void {
  const diary = getDiary().filter((e) => e.id !== id);
  localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
  notifyChange();
}

export function getDiaryForDate(date: string): DiaryEntry[] {
  return getDiary().filter((e) => e.date === date);
}

export function getDailyTotals(date: string): DailyTotals {
  const entries = getDiaryForDate(date);
  const totals: DailyTotals = {
    date,
    calories: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, salt: 0, fiber: 0,
    entries,
    avgScore: 0,
  };

  for (const e of entries) {
    totals.calories += e.calories;
    totals.protein += e.protein;
    totals.fat += e.fat;
    totals.carbs += e.carbs;
    totals.sugar += e.sugar;
    totals.salt += e.salt;
    totals.fiber += e.fiber;
  }

  // Round
  totals.calories = Math.round(totals.calories);
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.fat = Math.round(totals.fat * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.sugar = Math.round(totals.sugar * 10) / 10;
  totals.salt = Math.round(totals.salt * 10) / 10;
  totals.fiber = Math.round(totals.fiber * 10) / 10;

  if (entries.length > 0) {
    totals.avgScore = Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length * 10) / 10;
  }

  return totals;
}

export function getWeekTotals(): DailyTotals[] {
  const days: DailyTotals[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push(getDailyTotals(dateStr));
  }
  return days;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// === PREMIUM ===
const PREMIUM_KEY = "skladai_premium";

export interface PremiumStatus {
  active: boolean;
  plan: "free" | "premium";
  activatedAt: string | null;
  expiresAt: string | null;
}

export function getPremiumStatus(): PremiumStatus {
  if (typeof window === "undefined") return { active: false, plan: "free", activatedAt: null, expiresAt: null };
  try {
    const data = localStorage.getItem(PREMIUM_KEY);
    if (!data) return { active: false, plan: "free", activatedAt: null, expiresAt: null };
    const status = JSON.parse(data) as PremiumStatus;
    // Check expiry
    if (status.expiresAt && new Date(status.expiresAt) < new Date()) {
      status.active = false;
      status.plan = "free";
      localStorage.setItem(PREMIUM_KEY, JSON.stringify(status));
    }
    return status;
  } catch {
    return { active: false, plan: "free", activatedAt: null, expiresAt: null };
  }
}

export function isPremium(): boolean {
  return getPremiumStatus().active;
}

export function activatePremium(days: number = 30): void {
  const now = new Date();
  const expires = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const status: PremiumStatus = {
    active: true,
    plan: "premium",
    activatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  localStorage.setItem(PREMIUM_KEY, JSON.stringify(status));
}

export function deactivatePremium(): void {
  localStorage.removeItem(PREMIUM_KEY);
}

// Free tier limits
const FREE_DAILY_SCANS = 5;

export function checkFreeTierLimit(): { allowed: boolean; remaining: number; isPremium: boolean } {
  if (isPremium()) return { allowed: true, remaining: 999, isPremium: true };
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(SCAN_DATE_KEY);
  if (savedDate !== today) {
    return { allowed: true, remaining: FREE_DAILY_SCANS, isPremium: false };
  }
  const count = parseInt(localStorage.getItem(SCAN_COUNT_KEY) || "0", 10);
  return { allowed: count < FREE_DAILY_SCANS, remaining: FREE_DAILY_SCANS - count, isPremium: false };
}

// === STREAK ===
const STREAK_KEY = "skladai_streak";
const LAST_SCAN_DATE_KEY = "skladai_last_scan_date";

export function getStreak(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);
}

export function updateStreak(): number {
  const today = todayStr();
  const lastDate = localStorage.getItem(LAST_SCAN_DATE_KEY);

  if (lastDate === today) {
    return getStreak(); // Already counted today
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let streak = getStreak();
  if (lastDate === yesterdayStr) {
    streak += 1; // Consecutive day
  } else {
    streak = 1; // Reset
  }

  localStorage.setItem(STREAK_KEY, streak.toString());
  localStorage.setItem(LAST_SCAN_DATE_KEY, today);
  notifyChange();
  return streak;
}

// === WEIGHT HISTORY ===
const WEIGHT_HISTORY_KEY = "skladai_weight_history";

export interface WeightEntry {
  date: string;
  weight: number;
  source: "manual" | "checkform";
}

export function getWeightHistory(): WeightEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WEIGHT_HISTORY_KEY) || "[]") as WeightEntry[];
  } catch { return []; }
}

export function addWeightEntry(weight: number, source: "manual" | "checkform" = "manual", date?: string): void {
  const history = getWeightHistory();
  const entryDate = date || todayStr();
  // Update if same date+source exists
  const existing = history.findIndex(e => e.date === entryDate && e.source === source);
  if (existing >= 0) {
    history[existing].weight = weight;
  } else {
    history.push({ date: entryDate, weight, source });
  }
  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(history));
  notifyChange();
  // Also update profile weight
  const p = getProfile();
  if (p) { p.weight_kg = weight; saveProfile(p); }
}

export function getLatestWeight(): number | null {
  const history = getWeightHistory();
  if (history.length === 0) {
    const p = getProfile();
    return p?.weight_kg || null;
  }
  return history[history.length - 1].weight;
}
