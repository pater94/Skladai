/**
 * Wyciąga summary z `AuditorResult.comparison` w stable shape do raportu.
 *
 * Severity ordering: minor < moderate < major. Zwracamy MAX severity ze
 * wszystkich differences (najgorszy przypadek wyznacza color w Telegramie).
 */

import type { AuditorResult } from "./analyze-with-claude";

export type Verdict = "match" | "difference" | "error";
export type Severity = "minor" | "moderate" | "major";

export interface Comparison {
  verdict: Verdict;
  differences: NonNullable<AuditorResult["comparison"]>["differences"];
  severity: Severity;
  qualityRating: "good" | "acceptable" | "poor" | "unknown";
  suggestions: string[];
  error?: string;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  major: 3,
};

export function compareResults(options: {
  production: Record<string, unknown>;
  auditor: AuditorResult;
}): Comparison {
  const { auditor } = options;

  if (auditor.error) {
    return {
      verdict: "error",
      differences: [],
      severity: "minor",
      qualityRating: "unknown",
      suggestions: [],
      error: auditor.error,
    };
  }

  const cmp = auditor.comparison;
  const verdict: Verdict = cmp?.verdict === "difference" ? "difference" : "match";

  const differences = cmp?.differences ?? [];
  const severity: Severity =
    differences.length === 0
      ? "minor"
      : differences.reduce<Severity>((max, d) => {
          return SEVERITY_ORDER[d.severity] > SEVERITY_ORDER[max] ? d.severity : max;
        }, "minor");

  return {
    verdict,
    differences,
    severity,
    qualityRating: cmp?.production_quality ?? "unknown",
    suggestions: auditor.prompt_improvement_suggestions ?? [],
  };
}
