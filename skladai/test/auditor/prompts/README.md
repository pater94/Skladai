# Audit prompts

Audit prompty są versioned (v1, v2, ...) żeby móc porównać:
- jakość audytów między wersjami promptów
- shadow-deploy nowego promptu vs stary

## Konwencje

- **Filename**: `audit-prompt-v<N>.md` (markdown z `{{PLACEHOLDERS}}`)
- **Placeholders**: 2 obowiązkowe:
  - `{{PROMPT_VERSION}}` — wersja produkcyjnego prompta (np. "v6")
  - `{{PRODUCTION_RESULT}}` — pełen JSON wyniku produkcyjnej apki
- **Output format**: czysty JSON (bez ```json fence) — parsowany w
  `analyze-with-claude.ts` przez `JSON.parse(text.replace(/```/g, ""))`.
- **Schema response**: `AuditorResult` z `analyze-with-claude.ts`.

## Aktywny prompt

`audit-prompt-v1.md` — używany przez run-audit.ts (hardcoded w
`analyze-with-claude.ts`). Przed switchem na v2: update import path
i optionally A/B test (env `AUDITOR_PROMPT_VERSION`).
