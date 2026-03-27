// === Scan Battle Logic ===

export type BattleMode = "solo" | "vs";

export interface BattleProduct {
  name: string;
  brand: string;
  score: number;
  thumbnail: string;
  scanId: string;
}

export interface BattleRound {
  player1: BattleProduct | null;
  player2: BattleProduct | null;
  winner: 1 | 2 | 0; // 0 = tie
}

export interface BattleState {
  mode: BattleMode;
  player1Name: string;
  player2Name: string;
  rounds: BattleRound[];
  currentRound: number;
  totalRounds: number;
  currentPlayer: 1 | 2;
  status: "setup" | "scanning" | "reveal" | "finished";
}

export function createBattle(mode: BattleMode, p1: string, p2: string, rounds = 5): BattleState {
  return {
    mode,
    player1Name: p1,
    player2Name: p2 || (mode === "solo" ? "Lodówka" : "Gracz 2"),
    rounds: Array.from({ length: rounds }, () => ({ player1: null, player2: null, winner: 0 })),
    currentRound: 0,
    totalRounds: rounds,
    currentPlayer: 1,
    status: "scanning",
  };
}

export function getScores(battle: BattleState): { p1: number; p2: number } {
  let p1 = 0, p2 = 0;
  for (const r of battle.rounds) {
    if (r.winner === 1) p1++;
    else if (r.winner === 2) p2++;
  }
  return { p1, p2 };
}

// AI komentarze do battle
const CRUSHING = [
  "To nie był battle — to była egzekucja. {winner}, szacun! 💀",
  "{loser}, następnym razem weź coś z działu warzyw... 😅",
  "Taki wynik to jak wystawić kanapkę z Biedronki przeciwko obiadowi u babci.",
];

const CLOSE = [
  "O włos! Obaj macie dobre instynkty zakupowe.",
  "Remis w duszy — oba produkty są ok. Ale wygrana to wygrana! 🏆",
  "Blisko! Jeden składnik mógł zmienić wynik.",
];

const BOTH_BAD = [
  "Obaj przegraliście... z własnymi żołądkami. 😂",
  "Tu nie ma zwycięzcy. Jedyne co wygrało to przemysł spożywczy. 🏭",
  "Proponuję rematch w dziale z warzywami.",
];

const BOTH_GOOD = [
  "Wow — dwóch mistrzów zdrowego jedzenia! 💚 Respekt.",
  "Ciężko wybrać — oba produkty są świetne. To battle marzeń.",
  "Kiedy battle wygrywa zdrowie. Brawo obaj! 🥇🥈",
];

export function getBattleComment(p1Score: number, p2Score: number, p1Name: string, p2Name: string): string {
  const diff = Math.abs(p1Score - p2Score);
  const winner = p1Score >= p2Score ? p1Name : p2Name;
  const loser = p1Score >= p2Score ? p2Name : p1Name;

  let pool: string[];
  if (p1Score < 4 && p2Score < 4) pool = BOTH_BAD;
  else if (p1Score >= 8 && p2Score >= 8) pool = BOTH_GOOD;
  else if (diff > 4) pool = CRUSHING;
  else pool = CLOSE;

  const comment = pool[Math.floor(Math.random() * pool.length)];
  return comment.replace("{winner}", winner).replace("{loser}", loser);
}

// Battle stats storage
const BATTLE_STATS_KEY = "skladai_battle_stats";

export interface BattleStats {
  played: number;
  won: number;
  lost: number;
  tied: number;
  bestScore: number;
  longestStreak: number;
  currentStreak: number;
}

export function getBattleStats(): BattleStats {
  if (typeof window === "undefined") return { played: 0, won: 0, lost: 0, tied: 0, bestScore: 0, longestStreak: 0, currentStreak: 0 };
  try {
    const data = localStorage.getItem(BATTLE_STATS_KEY);
    if (!data) return { played: 0, won: 0, lost: 0, tied: 0, bestScore: 0, longestStreak: 0, currentStreak: 0 };
    return JSON.parse(data);
  } catch {
    return { played: 0, won: 0, lost: 0, tied: 0, bestScore: 0, longestStreak: 0, currentStreak: 0 };
  }
}

export function updateBattleStats(won: boolean, tied: boolean, bestProductScore: number): void {
  const stats = getBattleStats();
  stats.played++;
  if (tied) stats.tied++;
  else if (won) {
    stats.won++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.longestStreak) stats.longestStreak = stats.currentStreak;
  } else {
    stats.lost++;
    stats.currentStreak = 0;
  }
  if (bestProductScore > stats.bestScore) stats.bestScore = bestProductScore;
  localStorage.setItem(BATTLE_STATS_KEY, JSON.stringify(stats));
}
