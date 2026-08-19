"use client";

/**
 * FORMA RPG — karta postaci na ekranie głównym.
 *
 * Ma robić jedno: pokazać, że coś rośnie. Poziom, pasek do następnego,
 * trzy statystyki i „forma", która spada, gdy przestajesz trenować.
 * Klikalna — prowadzi do pełnego ekranu postaci i rankingu.
 *
 * Nie renderuje się dla gościa ani gdy nie ma jeszcze żadnego dorobku, żeby
 * nie straszyć nowego użytkownika pustym widżetem.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyProfile, syncCharacter, type GameProfile } from "@/lib/game/client";
import { levelFromXp, titleForLevel } from "@/lib/game/rules";

const ORANGE = "var(--c-orange, #f97316)";
const GREEN = "#5fd39a";

function Bar({ value, max, color, height = 6 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ height, borderRadius: 99, background: "rgba(var(--fg-rgb, 255,255,255),0.08)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color, transition: "width .5s ease" }} />
    </div>
  );
}

export default function CharacterCard() {
  const router = useRouter();
  const [p, setP] = useState<GameProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    // Najpierw to, co już wiemy (natychmiastowy render), potem przeliczenie.
    const cached = await getMyProfile();
    if (cached) setP(cached);
    setLoaded(true);
    const fresh = await syncCharacter();
    if (fresh) setP(fresh);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => { void load(); });
    return () => cancelAnimationFrame(raf);
  }, [load]);

  // Gość albo zero dorobku → nie zaśmiecamy ekranu
  if (!loaded || !p || (p.xp === 0 && !p.nick)) return null;

  const lvl = levelFromXp(p.xp);
  const stats: Array<[string, number, string]> = [
    ["Siła", p.stat_sila, ORANGE],
    ["Wytrzymałość", p.stat_wytrz, "#3b82f6"],
    ["Dyscyplina", p.stat_dyscyp, GREEN],
  ];

  return (
    <button
      onClick={() => router.push("/postac")}
      data-testid="character-card"
      className="w-full text-left active:scale-[0.99] transition-transform"
      style={{
        display: "block", marginBottom: 18, padding: "14px 15px", borderRadius: 18, cursor: "pointer",
        background: "linear-gradient(135deg, rgba(var(--c-orange-rgb, 249,115,22),0.13), rgba(var(--fg-rgb, 255,255,255),0.03))",
        border: "1px solid rgba(var(--c-orange-rgb, 249,115,22),0.28)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Poziom */}
        <div style={{
          width: 52, height: 52, borderRadius: 15, flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: `linear-gradient(135deg, ${ORANGE}, var(--c-orange-3, #ea580c))`,
          boxShadow: "0 4px 16px rgba(var(--c-orange-rgb, 249,115,22),0.32)",
        }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{lvl.level}</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: 0.5 }}>POZIOM</div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--fg, #fff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.nick ?? titleForLevel(lvl.level)}
            </span>
            {p.nick && (
              <span style={{ fontSize: 10.5, color: "rgba(var(--fg-rgb, 255,255,255),0.55)", flexShrink: 0 }}>
                {titleForLevel(lvl.level)}
              </span>
            )}
          </div>
          <div style={{ marginTop: 6 }}>
            <Bar value={lvl.xpInLevel} max={lvl.xpToNext} color={ORANGE} />
          </div>
          <div style={{ fontSize: 10, color: "rgba(var(--fg-rgb, 255,255,255),0.6)", marginTop: 4 }}>
            {lvl.xpInLevel} / {lvl.xpToNext} XP do {lvl.level + 1}. poziomu
            {p.week_xp > 0 && <span style={{ color: GREEN, fontWeight: 700 }}> · +{p.week_xp} w tym tygodniu</span>}
          </div>
        </div>

        <span style={{ color: ORANGE, fontSize: 20, flexShrink: 0 }}>›</span>
      </div>

      {/* Statystyki + forma */}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {stats.map(([label, val, color]) => (
          <div key={label} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, marginBottom: 3 }}>
              <span style={{ color: "rgba(var(--fg-rgb, 255,255,255),0.62)" }}>{label}</span>
              <span style={{ color: "var(--fg, #fff)", fontWeight: 700 }}>{val}</span>
            </div>
            <Bar value={val} max={100} color={color} height={4} />
          </div>
        ))}
      </div>

      {p.condition < 100 && (
        <div style={{ fontSize: 10.5, color: p.condition < 50 ? "#f87171" : "rgba(var(--fg-rgb, 255,255,255),0.62)", marginTop: 9 }}>
          Forma {p.condition}/100 —{" "}
          {p.condition === 0 ? "postać całkiem wypadła z rytmu. Jeden trening ją odbuduje."
            : "wróć na trening, żeby ją odbudować."}
        </div>
      )}
    </button>
  );
}
