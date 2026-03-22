import { ScanHistoryItem, AnalysisResult } from "./types";

const HISTORY_KEY = "skladai_history";
const SCAN_COUNT_KEY = "skladai_scan_count";
const SCAN_DATE_KEY = "skladai_scan_date";
const MAX_HISTORY = 10;
const MAX_DAILY_SCANS = 30;

export function getHistory(): ScanHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToHistory(
  result: AnalysisResult,
  thumbnail: string
): ScanHistoryItem {
  const item: ScanHistoryItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: result.name,
    brand: result.brand,
    score: result.score,
    date: new Date().toISOString(),
    thumbnail,
    result,
  };

  const history = getHistory();
  history.unshift(item);
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return item;
}

export function getHistoryItem(id: string): ScanHistoryItem | null {
  const history = getHistory();
  return history.find((item) => item.id === id) || null;
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
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
