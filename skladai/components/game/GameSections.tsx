"use client";

/**
 * FORMA RPG — sekcje ekranu gry: cele, liga, sezon, odznaki.
 *
 * Wydzielone z ekranu postaci, bo każda z nich odpowiada za inny napęd
 * motywacyjny i każda ma inny cykl życia:
 *   • cele    — dziś i ten tydzień, natychmiastowe sprzężenie zwrotne
 *   • liga    — ten tydzień, rywalizacja z ~30 osobami na Twoim poziomie
 *   • sezon   — osiem tygodni, nagroda, która przepada
 *   • odznaki — na zawsze, jedyna rzecz nie do stracenia
 */

import { leagueById, SEASON_TRACK, hoursToWeekEnd, COHORT_SIZE, LEAGUES } from "@/lib/game/season";
import type { BoardRow, SyncResult } from "@/lib/game/client";
import { achievementsFor, type AchievementStats } from "@/lib/game/achievements";
import Character from "./Character";

const dim = (a: number) => `rgba(var(--fg-rgb, 255,255,255),${a})`;
const CARD: React.CSSProperties = {
  padding: 14, borderRadius: 16, marginTop: 14,
  background: dim(0.03), border: `1px solid ${dim(0.07)}`,
};
const HEAD: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
  color: dim(0.6), marginBottom: 10,
};

function Bar({ v, max, color, h = 5 }: { v: number; max: number; color: string; h?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  return (
    <div style={{ height: h, borderRadius: 99, background: dim(0.08), overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color, transition: "width .4s ease" }} />
    </div>
  );
}

// ── CELE ─────────────────────────────────────────────────────────────────

type Q = SyncResult["quests"]["daily"][number];

function QuestRow({ q }: { q: Q }) {
  const unit = q.target >= 1000 ? 1000 : 1;
  const fmt = (v: number) => (unit === 1000 ? `${(v / 1000).toFixed(1)} tys.` : String(v));
  return (
    <div style={{ marginBottom: 10 }} data-testid="quest-row">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: q.done ? "#5fd39a" : "var(--fg, #fff)", fontWeight: q.done ? 700 : 500 }}>
          {q.done ? "✓ " : ""}{q.text}
        </span>
        <span style={{ fontSize: 10.5, color: dim(0.5), flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {fmt(Math.min(q.have, q.target))}/{fmt(q.target)}
        </span>
      </div>
      <Bar v={q.have} max={q.target} color={q.done ? "#5fd39a" : "var(--c-orange, #f97316)"} h={4} />
    </div>
  );
}

export function QuestsSection({ quests, required }: { quests: SyncResult["quests"]; required: number }) {
  const doneCount = quests.daily.filter((q) => q.done).length;
  return (
    <div style={CARD} data-testid="quests-section">
      <div style={{ ...HEAD, marginBottom: 6 }}>Cele na dziś</div>
      <div style={{ fontSize: 11, color: dim(0.55), marginBottom: 10 }}>
        Domknij {required} z {quests.daily.length} — który odpuścisz, zależy od Ciebie.
        {doneCount >= required && <span style={{ color: "#5fd39a", fontWeight: 700 }}> Premia zebrana.</span>}
      </div>
      {quests.daily.map((q) => <QuestRow key={q.id} q={q} />)}

      <div style={{ ...HEAD, marginTop: 16 }}>Cele tygodnia</div>
      {quests.weekly.map((q) => <QuestRow key={q.id} q={q} />)}
    </div>
  );
}

// ── LIGA ─────────────────────────────────────────────────────────────────

export function LeagueSection({ league, board, myNick }: {
  league: number; board: BoardRow[]; myNick: string | null;
}) {
  const lg = leagueById(league);
  const hours = hoursToWeekEnd();
  const promoteAt = lg.promote;
  const relegateFrom = COHORT_SIZE - lg.relegate;

  return (
    <div style={CARD} data-testid="league-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ ...HEAD, marginBottom: 0, color: lg.color }}>Liga {lg.name}</div>
        <div style={{ fontSize: 10.5, color: dim(0.5) }}>
          {hours > 24 ? `${Math.round(hours / 24)} dni do rozliczenia` : `${hours} h do rozliczenia`}
        </div>
      </div>
      <div style={{ fontSize: 11, color: dim(0.55), marginBottom: 10 }}>
        {lg.promote > 0 ? `Pierwsza ${lg.promote} awansuje` : "Najwyższa liga — wyżej nie ma"}
        {lg.relegate > 0 ? `, ostatnia ${lg.relegate} spada.` : "."}
        {" "}Bez punktów nie spadasz.
      </div>

      {board.length === 0 && (
        <div style={{ fontSize: 12, color: dim(0.5), padding: "8px 0" }}>
          Nikt jeszcze nie wystartował w tej kohorcie. Ustaw nick i zdobądź pierwsze punkty.
        </div>
      )}

      {board.map((row, i) => {
        const rank = i + 1;
        const me = !!myNick && row.nick === myNick;
        const zone = rank <= promoteAt ? "#5fd39a" : rank > relegateFrom ? "#f87171" : dim(0.35);
        return (
          <div key={row.nick} data-testid="board-row" style={{
            display: "flex", alignItems: "center", gap: 9, padding: "6px 8px", borderRadius: 10,
            background: me ? "rgba(var(--c-orange-rgb, 249,115,22),0.12)" : "transparent",
            border: me ? "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.3)" : "1px solid transparent",
          }}>
            <span style={{ width: 18, textAlign: "right", fontSize: 12, fontWeight: 800, color: zone, fontVariantNumeric: "tabular-nums" }}>{rank}</span>
            <Character muscle={row.muscle ?? 30} leanness={row.leanness ?? 50} gender={row.gender}
              level={row.level} condition={row.condition} height={34} still />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: me ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.nick}
            </span>
            <span style={{ fontSize: 10.5, color: dim(0.45) }}>poz. {row.level}</span>
            <span style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: me ? "var(--c-orange, #f97316)" : "var(--fg, #fff)" }}>
              {row.week_points}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── SEZON ────────────────────────────────────────────────────────────────

export function SeasonSection({ season }: { season: SyncResult["season"] }) {
  const top = SEASON_TRACK[SEASON_TRACK.length - 1].atPoints;
  return (
    <div style={CARD} data-testid="season-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ ...HEAD, marginBottom: 0 }}>Sezon {season.index}: {season.name}</div>
        <div style={{ fontSize: 10.5, color: dim(0.5) }}>
          tydzień {season.weekOfSeason} · {season.daysLeft} dni
        </div>
      </div>
      <Bar v={season.points} max={top} color="var(--c-orange, #f97316)" h={7} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {SEASON_TRACK.map((r) => {
          const got = season.points >= r.atPoints;
          return (
            <div key={r.label} style={{ textAlign: "center", flex: 1 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 8, margin: "0 auto 4px",
                background: got ? "var(--c-orange, #f97316)" : dim(0.08),
                border: got ? "none" : `1px solid ${dim(0.14)}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: got ? "#fff" : dim(0.4), fontWeight: 800,
              }}>{got ? "✓" : ""}</div>
              <div style={{ fontSize: 8.5, color: got ? dim(0.75) : dim(0.4), lineHeight: 1.25 }}>{r.label}</div>
              <div style={{ fontSize: 8.5, color: dim(0.35), fontVariantNumeric: "tabular-nums" }}>{r.atPoints}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: dim(0.5), marginTop: 10 }}>
        Masz {season.points} pkt. Po sezonie licznik wraca do zera — poziom i odznaki zostają na zawsze.
      </div>
    </div>
  );
}

// ── ODZNAKI ──────────────────────────────────────────────────────────────

export function AchievementsSection({ stats, owned }: { stats: AchievementStats; owned: string[] }) {
  const all = achievementsFor(stats);
  const has = new Set(owned);
  const unlocked = all.filter((a) => has.has(a.id) || a.unlocked);
  const upcoming = all
    .filter((a) => !has.has(a.id) && !a.unlocked && !a.hidden && a.need > 0)
    .sort((x, y) => y.have / y.need - x.have / x.need)
    .slice(0, 4);

  return (
    <div style={CARD} data-testid="achievements-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={HEAD}>Odznaki</div>
        <div style={{ fontSize: 10.5, color: dim(0.5) }}>{unlocked.length} / {all.length}</div>
      </div>

      {unlocked.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {unlocked.map((a) => (
            <span key={a.id} data-testid="badge-owned" title={a.how} style={{
              fontSize: 10.5, fontWeight: 700, padding: "4px 8px", borderRadius: 8,
              background: "rgba(var(--c-orange-rgb, 249,115,22),0.14)",
              border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.28)",
              color: "var(--c-orange, #f97316)",
            }}>{a.name}</span>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div style={{ fontSize: 10.5, color: dim(0.5), marginBottom: 7 }}>Najbliżej:</div>
          {upcoming.map((a) => (
            <div key={a.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                <span style={{ color: dim(0.8) }}>{a.name}</span>
                <span style={{ color: dim(0.45), fontVariantNumeric: "tabular-nums" }}>{Math.min(a.have, a.need)}/{a.need}</span>
              </div>
              <Bar v={a.have} max={a.need} color={dim(0.35)} h={3} />
            </div>
          ))}
        </>
      )}

      <div style={{ fontSize: 10, color: dim(0.4), marginTop: 8 }}>
        Kilku odznak nie ma na liście — wyskoczą same.
      </div>
    </div>
  );
}

/** Drabinka lig do pokazania, dokąd można dojść. */
export function LeagueLadder({ current, best }: { current: number; best: number }) {
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
      {LEAGUES.map((lg) => {
        const reached = lg.id <= best;
        const now = lg.id === current;
        return (
          <div key={lg.id} style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              height: 4, borderRadius: 99, marginBottom: 4,
              background: now ? lg.color : reached ? `${lg.color}66` : dim(0.08),
            }} />
            <div style={{ fontSize: 8, color: now ? lg.color : reached ? dim(0.5) : dim(0.28), fontWeight: now ? 800 : 500 }}>
              {lg.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
