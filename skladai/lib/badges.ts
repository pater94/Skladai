// === New Achievement System — 6 categories × 4 levels ===

import { getHistory, getStreak, getDiary } from "./storage";

export type AchievementTier = "bronze" | "silver" | "gold" | "diamond";
export type AchievementCategory = "scanner" | "healthy" | "streak" | "forma";

export interface Achievement {
  id: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  name: string;
  description: string;
  target: number;
  current: number;
  earned: boolean;
  earnedAt?: string;
}

const TIER_ICONS: Record<AchievementTier, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  diamond: "💎",
};

const TIER_COLORS: Record<AchievementTier, { bg: string; text: string; border: string }> = {
  bronze: { bg: "bg-amber-900/20", text: "text-amber-600", border: "border-amber-700/30" },
  silver: { bg: "bg-gray-300/20", text: "text-gray-400", border: "border-gray-400/30" },
  gold: { bg: "bg-yellow-500/20", text: "text-yellow-500", border: "border-yellow-500/30" },
  diamond: { bg: "bg-cyan-400/20", text: "text-cyan-400", border: "border-cyan-400/30" },
};

export { TIER_ICONS, TIER_COLORS };

// Achievement definitions
const ACHIEVEMENTS_DEF: {
  id: string; category: AchievementCategory; tier: AchievementTier;
  icon: string; name: string; description: string; target: number;
  getValue: () => number;
}[] = [
  // 📱 SCANNER
  { id: "scanner_1", category: "scanner", tier: "bronze", icon: "📱", name: "Ciekawy", description: "5 skanów — Zaczynasz przygodę!", target: 5, getValue: () => getHistory().length },
  { id: "scanner_2", category: "scanner", tier: "silver", icon: "🔍", name: "Detektyw", description: "25 skanów — Etykiety nie mają przed Tobą tajemnic", target: 25, getValue: () => getHistory().length },
  { id: "scanner_3", category: "scanner", tier: "gold", icon: "🕵️", name: "Inspektor", description: "100 skanów — Producenci się Ciebie boją", target: 100, getValue: () => getHistory().length },
  { id: "scanner_4", category: "scanner", tier: "diamond", icon: "🔬", name: "Rentgen", description: "500 skanów — Widzisz skład przez opakowanie", target: 500, getValue: () => getHistory().length },

  // 🥗 HEALTHY CHOICES
  { id: "healthy_1", category: "healthy", tier: "bronze", icon: "🥗", name: "Świadomy", description: "10 zdrowych wyborów (≥7/10)", target: 10, getValue: () => getDiary().filter(e => e.score >= 7).length },
  { id: "healthy_2", category: "healthy", tier: "silver", icon: "🥬", name: "Selekcjoner", description: "50 zdrowych wyborów", target: 50, getValue: () => getDiary().filter(e => e.score >= 7).length },
  { id: "healthy_3", category: "healthy", tier: "gold", icon: "🌿", name: "Purista", description: "200 zdrowych wyborów", target: 200, getValue: () => getDiary().filter(e => e.score >= 7).length },
  { id: "healthy_4", category: "healthy", tier: "diamond", icon: "💚", name: "Maszyna", description: "500 — Twoja lodówka to wzór do naśladowania", target: 500, getValue: () => getDiary().filter(e => e.score >= 7).length },

  // 🔥 STREAK
  { id: "streak_1", category: "streak", tier: "bronze", icon: "✨", name: "Iskra", description: "3 dni z rzędu", target: 3, getValue: () => getMaxStreak() },
  { id: "streak_2", category: "streak", tier: "silver", icon: "🔥", name: "Płomień", description: "7 dni z rzędu", target: 7, getValue: () => getMaxStreak() },
  { id: "streak_3", category: "streak", tier: "gold", icon: "🌋", name: "Pożar", description: "30 dni z rzędu", target: 30, getValue: () => getMaxStreak() },
  { id: "streak_4", category: "streak", tier: "diamond", icon: "☄️", name: "Wulkan", description: "100 dni — Nie do zatrzymania!", target: 100, getValue: () => getMaxStreak() },

  // 💪 FORMA
  { id: "forma_1", category: "forma", tier: "bronze", icon: "💪", name: "Odważny", description: "Pierwszy CheckForm", target: 1, getValue: () => getCheckFormCount() },
  { id: "forma_2", category: "forma", tier: "silver", icon: "🏋️", name: "W ruchu", description: "3 CheckFormy", target: 3, getValue: () => getCheckFormCount() },
  { id: "forma_3", category: "forma", tier: "gold", icon: "📈", name: "Transformacja", description: "Score wzrósł o 2+ punkty", target: 2, getValue: () => getCheckFormImprovement() },
  { id: "forma_4", category: "forma", tier: "diamond", icon: "🏆", name: "Rzeźbiarz", description: "Score 8+ — Twoje ciało to dzieło sztuki", target: 8, getValue: () => getCheckFormBest() },

];

// Helper functions
function getMaxStreak(): number {
  const current = getStreak();
  if (typeof window === "undefined") return current;
  const max = parseInt(localStorage.getItem("skladai_max_streak") || "0", 10);
  return Math.max(current, max);
}

export function updateMaxStreak(current: number): void {
  if (typeof window === "undefined") return;
  const max = parseInt(localStorage.getItem("skladai_max_streak") || "0", 10);
  if (current > max) localStorage.setItem("skladai_max_streak", current.toString());
}

function getCheckFormCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem("skladai_checkforms") || "[]");
    return data.length;
  } catch { return 0; }
}

function getCheckFormBest(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem("skladai_checkforms") || "[]");
    if (data.length === 0) return 0;
    return Math.max(...data.map((cf: { score?: number }) => cf.score || 0));
  } catch { return 0; }
}

function getCheckFormImprovement(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem("skladai_checkforms") || "[]");
    if (data.length < 2) return 0;
    const first = data[0]?.score || 0;
    const last = data[data.length - 1]?.score || 0;
    return Math.max(0, last - first);
  } catch { return 0; }
}


// Main function — get all achievements with current progress
const EARNED_KEY = "skladai_achievements_earned";

function getEarnedMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(EARNED_KEY) || "{}"); }
  catch { return {}; }
}

export function getAllAchievements(): Achievement[] {
  const earned = getEarnedMap();

  return ACHIEVEMENTS_DEF.map((def) => {
    const current = def.getValue();
    const isEarned = current >= def.target;

    // Auto-earn
    if (isEarned && !earned[def.id]) {
      earned[def.id] = new Date().toISOString();
      if (typeof window !== "undefined") {
        localStorage.setItem(EARNED_KEY, JSON.stringify(earned));
      }
    }

    return {
      id: def.id,
      category: def.category,
      tier: def.tier,
      icon: def.icon,
      name: def.name,
      description: def.description,
      target: def.target,
      current: Math.min(current, def.target),
      earned: isEarned,
      earnedAt: earned[def.id],
    };
  });
}

export function getEarnedCount(): { earned: number; total: number } {
  const all = getAllAchievements();
  return { earned: all.filter(a => a.earned).length, total: all.length };
}

export function getAchievementsByCategory(): Record<AchievementCategory, Achievement[]> {
  const all = getAllAchievements();
  const byCategory: Record<AchievementCategory, Achievement[]> = {
    scanner: [], healthy: [], streak: [], forma: [],
  };
  for (const a of all) {
    byCategory[a.category].push(a);
  }
  return byCategory;
}

export const CATEGORY_LABELS: Record<AchievementCategory, { icon: string; name: string }> = {
  scanner: { icon: "📱", name: "Skaner" },
  healthy: { icon: "🥗", name: "Zdrowe wybory" },
  streak: { icon: "🔥", name: "Streak" },
  forma: { icon: "💪", name: "Forma" },
};
