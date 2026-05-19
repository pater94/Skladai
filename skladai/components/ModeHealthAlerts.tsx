"use client";

/**
 * ModeHealthAlerts (Etap 2 Krok G) — pokazuje alerty zdrowotne wygenerowane
 * przez lib/healthAlerts.ts gdy user jest w trybie "health" i scan zawiera
 * składniki/wartości które trafiają w jego profil zdrowotny (alergie pokarmowe,
 * schorzenia, cukrzyca, ciąża).
 *
 * Renderowany w app/wyniki/[id]/page.tsx PRZED standardowym layoutem wyniku.
 *
 * NIE myl z istniejącym components/HealthAlerts.tsx — tamten to bogaty
 * komponent z pregnancy/diabetes/allergen slider który pokazuje się ZAWSZE
 * dla food scanów. ModeHealthAlerts jest INNA warstwa — tylko mode=health,
 * tylko gdy są realne dopasowania do profilu, wyświetlana wyżej.
 */

import { useState } from "react";
import type { HealthAlert } from "@/lib/healthAlerts";

interface Props {
  alerts: HealthAlert[];
}

export default function ModeHealthAlerts({ alerts }: Props) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div data-testid="mode-health-alerts" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((alert, i) => (
        <AlertCard key={`${alert.severity}-${i}`} alert={alert} />
      ))}
    </div>
  );
}

function AlertCard({ alert }: { alert: HealthAlert }) {
  const [expanded, setExpanded] = useState(false);

  // Severity → kolory
  const colors = {
    danger: {
      border: "rgba(239,68,68,0.35)",
      bg: "rgba(239,68,68,0.08)",
      title: "#fca5a5",
      ingredient: "rgba(252,165,165,0.18)",
    },
    warning: {
      border: "rgba(251,191,36,0.32)",
      bg: "rgba(251,191,36,0.06)",
      title: "#fbbf24",
      ingredient: "rgba(251,191,36,0.15)",
    },
    info: {
      border: "rgba(34,211,238,0.32)",
      bg: "rgba(34,211,238,0.06)",
      title: "#22d3ee",
      ingredient: "rgba(34,211,238,0.15)",
    },
  }[alert.severity];

  const hasIngredients = alert.ingredients && alert.ingredients.length > 0;

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: colors.title,
              marginBottom: 4,
              lineHeight: 1.25,
            }}
          >
            {alert.title}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.45,
            }}
          >
            {alert.message}
          </div>
          {hasIngredients && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                marginTop: 8,
                background: "transparent",
                border: "none",
                color: colors.title,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
                opacity: 0.85,
              }}
            >
              {expanded ? "Ukryj" : "Zobacz składniki"}
            </button>
          )}
          {expanded && hasIngredients && (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {alert.ingredients!.map((ing, i) => (
                <span
                  key={i}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 8,
                    background: colors.ingredient,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 600,
                  }}
                >
                  {ing}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
