/**
 * Wywołuje Claude (Anthropic API) z `audit-prompt-v1.md` na obrazku
 * scanu + JSON produkcyjny → zwraca structured JSON audytu.
 *
 * Model: env `AUDITOR_MODEL` (default "claude-sonnet-4-5") — celowo
 * **inny model niż prod** (`claude-sonnet-4-20250514` w app/api/analyze)
 * żeby comparison był jakościowy, nie tylko re-roll tego samego modelu.
 *
 * Cost tracking:
 *   - input tokens × $3/1M (Sonnet 4.5 pricing as of 2026-05)
 *   - output tokens × $15/1M
 *   - dodawane przez `costTracker.add()`
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CostTracker } from "./cost-tracker";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pricing per 1M tokens (Sonnet 4.5 — adjust gdy Anthropic zmieni)
const INPUT_COST_PER_MTOKEN = 3.0;
const OUTPUT_COST_PER_MTOKEN = 15.0;

const PROMPT_PATH = resolve(__dirname, "prompts", "audit-prompt-v1.md");

let cachedPrompt: string | null = null;
function loadAuditPrompt(): string {
  if (cachedPrompt === null) {
    cachedPrompt = readFileSync(PROMPT_PATH, "utf-8");
  }
  return cachedPrompt;
}

export interface AnalyzeOptions {
  imageUrl: string;
  productionResult: Record<string, unknown>;
  productionPromptVersion: string;
  costTracker: CostTracker;
}

export interface AuditorComparison {
  verdict: "match" | "difference";
  differences?: Array<{
    field: string;
    production_says: string;
    auditor_says: string;
    severity: "minor" | "moderate" | "major";
    explanation: string;
  }>;
  production_quality?: "good" | "acceptable" | "poor";
  confidence_in_your_analysis?: "high" | "medium" | "low";
}

export interface AuditorResult {
  your_analysis?: {
    product_name?: string;
    ingredients_visible?: string[];
    nutrition_values?: Record<string, number>;
    your_score?: number;
    score_reasoning?: string;
  };
  comparison?: AuditorComparison;
  prompt_improvement_suggestions?: string[];
  error?: string;
  raw?: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mediaType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Fetch image failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mediaType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { base64: buffer.toString("base64"), mediaType };
}

export async function analyzeWithClaude(options: AnalyzeOptions): Promise<AuditorResult> {
  const { imageUrl, productionResult, productionPromptVersion, costTracker } = options;
  const model = process.env.AUDITOR_MODEL || "claude-sonnet-4-5";

  const { base64, mediaType } = await fetchImageAsBase64(imageUrl);

  const promptText = loadAuditPrompt()
    .replace("{{PRODUCTION_RESULT}}", JSON.stringify(productionResult, null, 2))
    .replace("{{PROMPT_VERSION}}", productionPromptVersion);

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              media_type: mediaType as any,
              data: base64,
            },
          },
          { type: "text", text: promptText },
        ],
      },
    ],
  });

  const inputCost = (response.usage.input_tokens / 1_000_000) * INPUT_COST_PER_MTOKEN;
  const outputCost = (response.usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_MTOKEN;
  costTracker.add(inputCost + outputCost);

  const block = response.content[0];
  const text = block?.type === "text" ? block.text : "";

  // Strip ```json fences jeśli Claude je dodał
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned) as AuditorResult;
  } catch {
    return { error: "Failed to parse auditor JSON response", raw: text };
  }
}
