#!/usr/bin/env tsx
/**
 * Daily Ground Truth Auditor for SkładAI scan quality.
 *
 * NIE MA już crona — decyzja Patryka 2026-08-20: codzienny audyt zużywał
 * kredyty Anthropic, choć aplikacji jeszcze nikt nie używał. Uruchamiany
 * wyłącznie na żądanie: workflow „Daily Quality" z zaznaczonym `run_audit`,
 * albo lokalnie `npm run audit:run` (wymaga env vars).
 *
 * Env vars (wszystkie WYMAGANE):
 *   AUDITOR_USER_IDS              — comma-separated UUID(s) z Supabase Auth.
 *                                    Privacy guard: WYŁĄCZNIE te user_ids
 *                                    będą zaudytowane (anti-leak protection).
 *   ANTHROPIC_API_KEY             — klucz do Claude API
 *   NEXT_PUBLIC_SUPABASE_URL      — URL Supabase projektu
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key (bypass RLS, server-only!)
 *   TELEGRAM_BOT_TOKEN            — opcjonalnie (audyt działa bez Telegrama)
 *   TELEGRAM_CHAT_ID              — opcjonalnie
 *
 * Optional env:
 *   AUDITOR_MODEL                 — default "claude-sonnet-4-5"
 *   AUDITOR_DAILY_BUDGET_USD      — default 0.70 ($20/mc / 30 dni)
 *   AUDITOR_MAX_PER_DAY           — default 10
 *   AUDITOR_MIN_PER_DAY           — default 3 (skip dzień gdy mniej)
 *   AUDITOR_SINCE_HOURS           — default 24
 *
 * Output:
 *   - `test/auditor/reports/audit-YYYY-MM-DD.json` (gitignored)
 *   - Telegram report (jeśli token + chat_id set)
 *   - Console log
 */

import { fetchScansToAudit } from "./fetch-scans";
import { analyzeWithClaude } from "./analyze-with-claude";
import { compareResults } from "./compare-results";
import { CostTracker } from "./cost-tracker";
import { sendTelegramReport, type AuditEntry } from "./telegram";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPORTS_DIR = resolve(__dirname, "reports");

const DAILY_BUDGET_USD = parseFloat(process.env.AUDITOR_DAILY_BUDGET_USD || "0.70");
const MAX_PER_DAY = parseInt(process.env.AUDITOR_MAX_PER_DAY || "10", 10);
const MIN_PER_DAY = parseInt(process.env.AUDITOR_MIN_PER_DAY || "3", 10);
const SINCE_HOURS = parseInt(process.env.AUDITOR_SINCE_HOURS || "24", 10);

async function main(): Promise<void> {
  console.log("🔬 Daily Ground Truth Audit — starting");
  console.log(`   budget: $${DAILY_BUDGET_USD.toFixed(2)} / max ${MAX_PER_DAY} skans / since ${SINCE_HOURS}h`);

  // === Privacy guard ===
  const allowedUsers = (process.env.AUDITOR_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedUsers.length === 0) {
    console.error("❌ AUDITOR_USER_IDS not set — refusing to run (privacy guard)");
    process.exit(1);
  }
  console.log(`✅ Auditing scans from ${allowedUsers.length} authorized user(s)`);

  const costTracker = new CostTracker(DAILY_BUDGET_USD);

  // === 1. Fetch scans ===
  let scans;
  try {
    scans = await fetchScansToAudit({
      userIds: allowedUsers,
      sinceHours: SINCE_HOURS,
      limit: MAX_PER_DAY,
    });
  } catch (err) {
    console.error("❌ Fetch scans failed:", err);
    await sendTelegramReport({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      costToday: 0,
    });
    process.exit(1);
  }

  console.log(`📦 Found ${scans.length} scans from last ${SINCE_HOURS}h`);

  if (scans.length < MIN_PER_DAY) {
    console.log(`ℹ️  Below MIN_PER_DAY (${MIN_PER_DAY}) — skipping today`);
    await sendTelegramReport({
      status: "skipped",
      reason: `Tylko ${scans.length} skanów w ostatnich ${SINCE_HOURS}h (próg: ${MIN_PER_DAY})`,
      costToday: 0,
    });
    return;
  }

  // === 2. Audit per scan ===
  const auditResults: Array<{
    scanId: string;
    productName: string | null;
    productionResult: Record<string, unknown>;
    auditorResult: Awaited<ReturnType<typeof analyzeWithClaude>>;
    comparison: ReturnType<typeof compareResults>;
    scannedAt: string;
  }> = [];

  for (const scan of scans) {
    if (costTracker.wouldExceed()) {
      console.warn(`⚠️  Budget cap reached at ${auditResults.length}/${scans.length} — stopping`);
      break;
    }

    try {
      const auditorResult = await analyzeWithClaude({
        imageUrl: scan.image_url,
        productionResult: scan.ai_result ?? {},
        productionPromptVersion: scan.prompt_version ?? "unknown",
        costTracker,
      });

      const comparison = compareResults({
        production: scan.ai_result ?? {},
        auditor: auditorResult,
      });

      auditResults.push({
        scanId: scan.id,
        productName: scan.product_name,
        productionResult: scan.ai_result ?? {},
        auditorResult,
        comparison,
        scannedAt: scan.created_at,
      });

      const tag = comparison.verdict === "match" ? "✓" : "⚠";
      console.log(`  ${tag} ${scan.product_name ?? "(no name)"} — ${comparison.verdict} (${comparison.severity})`);
    } catch (err) {
      console.error(`  ✗ Audit failed for ${scan.id}:`, err);
    }
  }

  // === 3. Save report (local JSON) ===
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = resolve(REPORTS_DIR, `audit-${today}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        date: today,
        totalAudits: auditResults.length,
        matches: auditResults.filter((r) => r.comparison.verdict === "match").length,
        differences: auditResults.filter((r) => r.comparison.verdict === "difference").length,
        errors: auditResults.filter((r) => r.comparison.verdict === "error").length,
        cost: costTracker.totalCost,
        budgetCap: DAILY_BUDGET_USD,
        results: auditResults,
      },
      null,
      2
    ),
    "utf-8"
  );
  console.log(`\n📝 Report saved: ${reportPath}`);

  // === 4. Telegram report ===
  const entries: AuditEntry[] = auditResults.map((r) => ({
    scanId: r.scanId,
    productName: r.productName,
    comparison: r.comparison,
  }));

  await sendTelegramReport({
    status: "completed",
    audits: entries,
    costToday: costTracker.totalCost,
    budgetCap: DAILY_BUDGET_USD,
    reportPath,
  });

  console.log(`\n✅ Audit complete. Cost: ${costTracker.summary()}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
