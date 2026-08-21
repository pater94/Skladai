"use client";

/**
 * Podgląd deweloperski postaci — siatka całej przestrzeni parametrów.
 *
 * Nie jest linkowany z aplikacji. Służy do jednego: zobaczyć na własne oczy,
 * czy sylwetka czyta się poprawnie w KAŻDEJ kombinacji umięśnienia i
 * wysmuklenia, a nie tylko w tej jednej, którą się akurat testowało.
 */

import Character from "@/components/game/Character";

const STEPS = [5, 30, 55, 80, 100];

export default function DevCharacter() {
  return (
    <div style={{ background: "#0a0f0d", minHeight: "100vh", padding: 20, color: "#fff", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Postać — siatka parametrów</h1>
      <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 16 }}>
        wiersze: umięśnienie ↓ &nbsp;|&nbsp; kolumny: wysmuklenie →
      </p>

      {(["male", "female"] as const).map((g) => (
        <div key={g} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#f97316" }}>
            {g === "male" ? "Mężczyzna" : "Kobieta"}
          </div>
          <table style={{ borderCollapse: "collapse" }}>
            <tbody>
              {STEPS.slice().reverse().map((m) => (
                <tr key={m}>
                  <td style={{ fontSize: 10, opacity: 0.5, paddingRight: 6 }}>m{m}</td>
                  {STEPS.map((l) => (
                    <td key={l} style={{ padding: 2, textAlign: "center" }} data-testid={`cell-${g}-${m}-${l}`}>
                      <Character muscle={m} leanness={l} gender={g} level={1} condition={100} height={116} still />
                      <div style={{ fontSize: 9, opacity: 0.45 }}>{l}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 8px", color: "#f97316" }}>
        Wyposażenie i forma
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        {[
          { lvl: 1, cond: 100, aura: null, label: "poz. 1" },
          { lvl: 5, cond: 100, aura: null, label: "poz. 5 — opaski" },
          { lvl: 10, cond: 100, aura: null, label: "poz. 10 — czoło" },
          { lvl: 20, cond: 100, aura: "#c084fc", label: "poz. 20 — pas" },
          { lvl: 35, cond: 100, aura: "#22d3ee", label: "poz. 35 — aura" },
          { lvl: 35, cond: 20, aura: "#22d3ee", label: "forma 20 — przygaszona" },
          { lvl: 35, cond: 0, aura: "#22d3ee", label: "forma 0" },
        ].map((v) => (
          <div key={v.label} style={{ textAlign: "center" }} data-testid={`gear-${v.lvl}-${v.cond}`}>
            <Character muscle={78} leanness={72} gender="male" level={v.lvl} condition={v.cond} auraColor={v.aura} height={150} still />
            <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>{v.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
