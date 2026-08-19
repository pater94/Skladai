"use client";

/**
 * FORMA RPG — ekran postaci i rankingu.
 *
 * Trzy rzeczy: kim jest Twoja postać, skąd wzięło się jej XP i jak wypada na
 * tle innych. Ranking ma dwie zakładki, bo sam ranking „na zawsze" zniechęca
 * każdego, kto dołącza później — liga tygodniowa startuje co poniedziałek
 * od zera i każdy ma w niej równe szanse.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import {
  getMyProfile, syncCharacter, getRanking, setNick, validateNick,
  type GameProfile, type RankRow, type RankMode,
} from "@/lib/game/client";
import { levelFromXp, titleForLevel, totalXpForLevel, XP, XP_BACKDATE_DAYS, DAILY_XP_CAP } from "@/lib/game/rules";

const ORANGE = "var(--c-orange, #f97316)";
const GREEN = "#5fd39a";

export default function PostacPage() {
  const router = useRouter();
  const [p, setP] = useState<GameProfile | null>(null);
  const [rank, setRank] = useState<RankRow[]>([]);
  const [mode, setMode] = useState<RankMode>("week");
  const [loading, setLoading] = useState(true);
  const [nick, setNickInput] = useState("");
  const [nickErr, setNickErr] = useState<string | null>(null);
  const [savingNick, setSavingNick] = useState(false);

  const load = useCallback(async () => {
    const cached = await getMyProfile();
    if (cached) { setP(cached); setNickInput(cached.nick ?? ""); }
    setLoading(false);
    const fresh = await syncCharacter();
    if (fresh) setP(fresh);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(raf);
  }, [load]);

  useEffect(() => {
    let off = false;
    void getRanking(mode).then((r) => { if (!off) setRank(r); });
    return () => { off = true; };
  }, [mode, p?.xp]);

  const saveNick = async () => {
    if (savingNick) return;
    const err = validateNick(nick);
    if (err) { setNickErr(err); return; }
    setSavingNick(true);
    const res = await setNick(nick);
    setSavingNick(false);
    setNickErr(res);
    if (!res) {
      const fresh = await getMyProfile();
      if (fresh) setP(fresh);
      setRank(await getRanking(mode));
    }
  };

  const lvl = p ? levelFromXp(p.xp) : levelFromXp(0);
  const myRow = p?.nick ? rank.findIndex((r) => r.nick === p.nick) : -1;

  return (
    <div className="min-h-full relative overflow-hidden" style={{ background: "var(--bg, #0a0e0c)", color: "var(--fg, #fff)" }}>
      <div className="max-w-md mx-auto px-4 pt-6" style={{ paddingBottom: 120 }}>
        {/* Pasek */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} aria-label="Wróć" style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0, cursor: "pointer",
            background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.1)",
            color: "var(--fg, #fff)", fontSize: 18,
          }}>‹</button>
          <h1 style={{ flex: 1, fontSize: 20, fontWeight: 900 }}>Twoja postać</h1>
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>Wczytuję…</div>}

        {!loading && (
          <>
            {/* ── Postać ── */}
            <div data-testid="character-panel" style={{
              padding: 18, borderRadius: 20, marginBottom: 16,
              background: "linear-gradient(150deg, rgba(var(--c-orange-rgb, 249,115,22),0.15), rgba(var(--fg-rgb, 255,255,255),0.03))",
              border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 20, flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`,
                  boxShadow: "0 6px 22px rgba(var(--c-orange-rgb, 249,115,22),0.35)",
                }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{lvl.level}</div>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>POZIOM</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{p?.nick ?? "Bez nicku"}</div>
                  <div style={{ fontSize: 12, color: ORANGE, fontWeight: 700, marginTop: 1 }}>{titleForLevel(lvl.level)}</div>
                  <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.6)", marginTop: 4 }}>
                    {p?.xp ?? 0} XP łącznie{myRow >= 0 ? ` · ${myRow + 1}. miejsce` : ""}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ height: 9, borderRadius: 99, background: "rgba(var(--fg-rgb, 255,255,255),0.09)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(lvl.progress * 100)}%`, height: "100%", background: ORANGE, transition: "width .5s ease" }} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.62)", marginTop: 5 }}>
                  {lvl.xpInLevel} / {lvl.xpToNext} XP do {lvl.level + 1}. poziomu
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {([["Siła", p?.stat_sila ?? 0, ORANGE], ["Wytrzymałość", p?.stat_wytrz ?? 0, "#3b82f6"], ["Dyscyplina", p?.stat_dyscyp ?? 0, GREEN]] as Array<[string, number, string]>).map(([l, v, c]) => (
                  <div key={l} style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRadius: 13, background: "rgba(var(--fg-rgb, 255,255,255),0.05)" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</div>
                    <div style={{ fontSize: 9.5, color: "rgba(var(--fg-rgb, 255,255,255),0.6)", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, fontSize: 11.5, color: "rgba(var(--fg-rgb, 255,255,255),0.66)" }}>
                Forma <strong style={{ color: (p?.condition ?? 0) < 50 ? "#f87171" : GREEN }}>{p?.condition ?? 0}/100</strong>
                {" — "}spada po dwóch dniach bez treningu, ale poziomu nigdy nie odbiera.
              </div>
            </div>

            {/* ── Nick ── */}
            <div style={{ padding: 14, borderRadius: 16, marginBottom: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.09)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.6)", marginBottom: 8 }}>
                {p?.nick ? "Twój nick w rankingu" : "Dołącz do rankingu"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={nick} onChange={(e) => { setNickInput(e.target.value); setNickErr(null); }}
                  placeholder="np. Patryk94" maxLength={16} data-testid="nick-input"
                  style={{
                    flex: 1, padding: "10px 13px", borderRadius: 11, fontSize: 14, fontWeight: 600, outline: "none",
                    background: "rgba(var(--fg-rgb, 255,255,255),0.06)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.12)", color: "var(--fg, #fff)",
                  }}
                />
                <button onClick={() => void saveNick()} disabled={savingNick || !nick.trim()} data-testid="nick-save"
                  style={{
                    padding: "0 16px", borderRadius: 11, border: "none", fontSize: 13, fontWeight: 800, color: "#fff",
                    cursor: "pointer", background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`,
                    opacity: savingNick || !nick.trim() ? 0.5 : 1,
                  }}>{savingNick ? "…" : p?.nick ? "Zmień" : "Dołącz"}</button>
              </div>
              {nickErr && <div style={{ fontSize: 11.5, color: "#f87171", marginTop: 6 }}>{nickErr}</div>}
              {!p?.nick && !nickErr && (
                <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.55)", marginTop: 6 }}>
                  Bez nicku jesteś w rankingu niewidoczny. Nie pokazujemy nikomu Twoich treningów — tylko nick, poziom i statystyki.
                </div>
              )}
            </div>

            {/* ── Ranking ── */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {([["week", "Liga tygodnia"], ["level", "Wszech czasów"]] as Array<[RankMode, string]>).map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} data-testid={`rank-${m}`}
                  style={{
                    flex: 1, padding: "9px", borderRadius: 12, cursor: "pointer", fontSize: 12.5, fontWeight: 800,
                    background: mode === m ? `rgba(var(--c-orange-rgb, 249,115,22),0.18)` : "rgba(var(--fg-rgb, 255,255,255),0.05)",
                    border: `1px solid ${mode === m ? "rgba(var(--c-orange-rgb, 249,115,22),0.45)" : "rgba(var(--fg-rgb, 255,255,255),0.1)"}`,
                    color: mode === m ? ORANGE : "rgba(var(--fg-rgb, 255,255,255),0.7)",
                  }}>{label}</button>
              ))}
            </div>

            <div data-testid="ranking" className="flex flex-col gap-1.5">
              {rank.length === 0 && (
                <div style={{ padding: "22px 16px", borderRadius: 14, textAlign: "center", fontSize: 12.5, color: "rgba(var(--fg-rgb, 255,255,255),0.6)", background: "rgba(var(--fg-rgb, 255,255,255),0.04)", border: "1px dashed rgba(var(--fg-rgb, 255,255,255),0.12)" }}>
                  Ranking jest jeszcze pusty. Wybierz nick i bądź pierwszy.
                </div>
              )}
              {rank.map((r, i) => {
                const me = !!p?.nick && r.nick === p.nick;
                return (
                  <div key={r.nick} data-testid="rank-row" style={{
                    display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderRadius: 13,
                    background: me ? `rgba(var(--c-orange-rgb, 249,115,22),0.12)` : "rgba(var(--fg-rgb, 255,255,255),0.04)",
                    border: `1px solid ${me ? "rgba(var(--c-orange-rgb, 249,115,22),0.35)" : "rgba(var(--fg-rgb, 255,255,255),0.07)"}`,
                  }}>
                    <span style={{ width: 22, fontSize: 13, fontWeight: 900, color: i < 3 ? ORANGE : "rgba(var(--fg-rgb, 255,255,255),0.5)" }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nick}</span>
                    <span style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.55)" }}>{titleForLevel(r.level)}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "var(--fg, #fff)", minWidth: 30, textAlign: "right" }}>
                      {mode === "week" ? `+${r.week_xp}` : r.level}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Zasady, bez ściemy ── */}
            <div style={{ marginTop: 18, padding: 14, borderRadius: 16, background: "rgba(var(--fg-rgb, 255,255,255),0.03)", border: "1px solid rgba(var(--fg-rgb, 255,255,255),0.07)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "rgba(var(--fg-rgb, 255,255,255),0.6)", marginBottom: 8 }}>Skąd bierze się XP</div>
              <ul style={{ fontSize: 11.5, lineHeight: 1.65, color: "rgba(var(--fg-rgb, 255,255,255),0.72)", paddingLeft: 16, margin: 0 }}>
                {/* Liczby brane WPROST z reguł — opis nie może się rozjechać z punktacją. */}
                <li><strong>{XP.sessionDay} XP</strong> za każdy dzień z treningiem — najwięcej, bo rytmu nie da się podrobić</li>
                <li><strong>do {XP.volumeCap} XP</strong> za objętość, ale pierwiastkiem: podwojenie ciężarów nie podwaja nagrody</li>
                <li><strong>{XP.perRecord} XP</strong> za rekord życiowy (maks. {XP.maxRecordsPerDay} dziennie, to samo ćwiczenie raz na {XP.recordCooldownDays} dni)</li>
                <li><strong>do {XP.stepsCap} XP</strong> za kroki i <strong>do {XP.streakCap} XP</strong> za serię dni pod rząd</li>
                <li>dziennie maksymalnie <strong>{DAILY_XP_CAP} XP</strong> — nikt nie wyskoczy w górę jednym wieczorem</li>
                <li>trening wpisany wstecz liczy się do historii, ale XP daje tylko za ostatnie <strong>{XP_BACKDATE_DAYS} dni</strong></li>
              </ul>
              <div style={{ fontSize: 11, color: "rgba(var(--fg-rgb, 255,255,255),0.55)", marginTop: 8 }}>
                Wszystko liczy serwer na podstawie zapisanych serii — nie da się wysłać sobie punktów.
                Do {lvl.level + 1}. poziomu brakuje {lvl.xpToNext - lvl.xpInLevel} XP, a do 50. — {Math.max(0, totalXpForLevel(50) - (p?.xp ?? 0)).toLocaleString("pl-PL")} XP.
              </div>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
