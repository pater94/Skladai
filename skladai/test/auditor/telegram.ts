/**
 * Telegram bot reporter — wysyła Markdown wiadomość do Patryka.
 *
 * Bot setup: t.me/BotFather → /newbot → TOKEN.
 * Chat ID: t.me/userinfobot lub /getUpdates po napisaniu do bota.
 *
 * Hard limit: Telegram messages max 4096 znaków. Długie raporty
 * trimmingujemy do top-5 major + summary.
 */

import type { Comparison } from "./compare-results";

const TELEGRAM_MAX = 4000; // safety margin pod 4096

export interface AuditEntry {
  scanId: string;
  productName: string | null | undefined;
  comparison: Comparison;
}

export type ReportPayload =
  | { status: "skipped"; reason: string; costToday: number }
  | {
      status: "completed";
      audits: AuditEntry[];
      costToday: number;
      budgetCap: number;
      reportPath?: string;
    }
  | { status: "error"; error: string; costToday: number };

export async function sendTelegramReport(payload: ReportPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping send");
    return;
  }

  const text = formatMessage(payload).slice(0, TELEGRAM_MAX);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        parse_mode: "Markdown",
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.warn(`[telegram] send failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.warn("[telegram] send error:", err);
  }
}

function formatMessage(payload: ReportPayload): string {
  if (payload.status === "skipped") {
    return `🔬 *Daily Audit Skipped*\n${payload.reason}\n\n💰 Cost today: $${payload.costToday.toFixed(3)}`;
  }
  if (payload.status === "error") {
    return `🚨 *Daily Audit ERROR*\n\n\`${payload.error}\`\n\n💰 Cost today: $${payload.costToday.toFixed(3)}`;
  }

  const { audits, costToday, budgetCap } = payload;
  const matches = audits.filter((a) => a.comparison.verdict === "match").length;
  const differences = audits.filter((a) => a.comparison.verdict === "difference").length;
  const errors = audits.filter((a) => a.comparison.verdict === "error").length;
  const majorDiffs = audits.filter((a) => a.comparison.severity === "major");

  let msg = `🔬 *Daily Ground Truth Audit*\n\n`;
  msg += `📊 ${audits.length} skanów zaudytowanych\n`;
  msg += `✅ ${matches} match\n`;
  msg += `⚠️ ${differences} differences\n`;
  if (errors > 0) msg += `🛑 ${errors} errors\n`;
  msg += `\n`;

  if (majorDiffs.length > 0) {
    msg += `🚨 *MAJOR DIFFERENCES:*\n`;
    for (const d of majorDiffs.slice(0, 5)) {
      const first = d.comparison.differences?.[0];
      const explanation = first?.explanation ?? "(brak szczegółów)";
      msg += `• *${d.productName ?? "Bez nazwy"}*: ${explanation}\n`;
    }
    msg += `\n`;
  }

  msg += `💰 Cost today: $${costToday.toFixed(3)} / $${budgetCap.toFixed(2)}\n\n`;
  msg += `💡 Przejrzeć: \`claude "review last audit"\``;

  return msg;
}
