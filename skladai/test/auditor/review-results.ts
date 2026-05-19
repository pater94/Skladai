#!/usr/bin/env tsx
/**
 * Orchestrator helper dla `claude "review last audit"`.
 *
 * Czyta najnowszy `test/auditor/reports/audit-YYYY-MM-DD.json`,
 * podsumowuje matches/differences/cost, wyświetla każdą difference
 * z severity + suggestions. Następne kroki dla Patryka.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPORTS_DIR = resolve(__dirname, "reports");

interface ReportFile {
  date: string;
  totalAudits: number;
  matches: number;
  differences: number;
  errors?: number;
  cost: number;
  budgetCap?: number;
  results: Array<{
    scanId: string;
    productName: string | null;
    productionResult: Record<string, unknown>;
    auditorResult: {
      prompt_improvement_suggestions?: string[];
      comparison?: {
        differences?: Array<{
          field: string;
          production_says: string;
          auditor_says: string;
          severity: "minor" | "moderate" | "major";
          explanation: string;
        }>;
      };
    };
    comparison: {
      verdict: "match" | "difference" | "error";
      severity: "minor" | "moderate" | "major";
      qualityRating: string;
      differences: Array<{
        field: string;
        production_says: string;
        auditor_says: string;
        severity: "minor" | "moderate" | "major";
        explanation: string;
      }>;
      suggestions: string[];
    };
  }>;
}

function findLatestReport(): string | null {
  if (!existsSync(REPORTS_DIR)) return null;
  const files = readdirSync(REPORTS_DIR)
    .filter((f) => f.startsWith("audit-") && f.endsWith(".json"))
    .sort()
    .reverse();
  return files[0] ? resolve(REPORTS_DIR, files[0]) : null;
}

function main(): void {
  const path = findLatestReport();
  if (!path) {
    console.log("ℹ️  No audit reports found in test/auditor/reports/");
    console.log("    Run `npm run audit:run` first (wymaga env vars).");
    process.exit(0);
  }

  const report = JSON.parse(readFileSync(path, "utf-8")) as ReportFile;

  console.log(`\n📊 Audit Report — ${report.date}`);
  console.log(`   File: ${path}\n`);
  console.log(`Total audits:  ${report.totalAudits}`);
  console.log(`✅ Matches:     ${report.matches}`);
  console.log(`⚠️  Differences: ${report.differences}`);
  if (report.errors && report.errors > 0) {
    console.log(`🛑 Errors:      ${report.errors}`);
  }
  console.log(`💰 Cost:        $${report.cost.toFixed(3)}${report.budgetCap ? ` / $${report.budgetCap.toFixed(2)}` : ""}\n`);

  const diffs = report.results.filter((r) => r.comparison.verdict === "difference");

  if (diffs.length === 0) {
    console.log("✅ All scans matched — żadne propozycje zmian potrzebne.");
    return;
  }

  console.log("⚠️  DIFFERENCES:\n");
  for (const r of diffs) {
    console.log(`─── ${r.productName ?? "(no name)"} [${r.scanId}] ───`);
    console.log(`Severity: ${r.comparison.severity.toUpperCase()}`);
    console.log(`Production quality: ${r.comparison.qualityRating}`);
    for (const d of r.comparison.differences) {
      console.log(`  • [${d.field}] ${d.severity}: ${d.explanation}`);
      if (d.production_says && d.auditor_says) {
        console.log(`      prod: ${truncate(d.production_says, 100)}`);
        console.log(`      audyt: ${truncate(d.auditor_says, 100)}`);
      }
    }
    if (r.auditorResult.prompt_improvement_suggestions?.length) {
      console.log(`Suggestions od auditora:`);
      for (const s of r.auditorResult.prompt_improvement_suggestions) {
        console.log(`  💡 ${s}`);
      }
    }
    console.log("");
  }

  console.log("\n📝 Następne kroki:");
  console.log("   - Wyrzucić systematic patterns? → `claude \"propose prompt improvements based on last audit\"`");
  console.log("   - Zignorować edge cases? → nic, jutrzejszy daily znów zaaudituje\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

main();
