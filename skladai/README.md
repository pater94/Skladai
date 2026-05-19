This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 🤖 AI Quality Workflow

### Komendy dla Claude Code

| Komenda | Co robi |
|---|---|
| `claude "sprawdź apkę"` | Odpala lokalnie `npm run qa` (Playwright), analizuje wyniki, raportuje pass/fail + proponuje fixy |
| `claude "fix failing tests from last daily run"` | Pobiera ostatni GitHub Action artifact (`gh run download`), analizuje failed tests + screenshoty, fixuje kod, commit + push |
| `claude "review last audit"` | `tsx test/auditor/review-results.ts` — czyta najnowszy `test/auditor/reports/audit-YYYY-MM-DD.json`, wyświetla matches/differences + suggestions audytora |
| `claude "propose prompt improvements based on last audit"` | Analizuje ostatnie 7 dni audytów, wykrywa wzorce, generuje propozycję v7 prompta z DIFF v6 vs v7. Patryk decyduje (👍/👎). Po 👍 → shadow deploy |

### Daily schedule (GitHub Action `daily-quality.yml`)

- **06:00 UTC** (08:00 PL): Playwright E2E suite na `https://www.skladai.com`
- **06:30 UTC** (08:30 PL): Ground Truth Audit (Patryk's skanów z ostatnich 24h)
- **Po każdym push do main**: Playwright QA (silent on success, alert on fail)

### Lokalne testy

```bash
npm run qa                 # Playwright (potrzebuje TEST_URL albo prod)
TEST_URL=http://localhost:3737 npm run qa   # lokalny smoke (uruchom `npm start` na :3737)
npm run test:smoke         # tylko @smoke testy
npm run test:critical      # tylko @critical testy
npm run audit:run          # ground truth audit (wymaga env vars)
npm run audit:review       # podgląd ostatniego raportu audytu
```

### Kosztorys

- **Playwright QA**: $0 (GitHub Actions free tier ~2000 min/mc; my zużywamy ~600)
- **Ground Truth Audit**: ~$0.70/dzień × 30 = ~$21/mc (Claude Sonnet 4.5 API)
- **Hard cap**: env `AUDITOR_DAILY_BUDGET_USD` default 0.70, gateway w `test/auditor/run-audit.ts`
- **Telegram**: $0

### Privacy

Auditor analizuje **WYŁĄCZNIE** `scan_logs.user_id ∈ AUDITOR_USER_IDS` (GitHub Secret).
Żaden inny user nigdy nie jest re-analizowany bez explicit consent. Privacy guard
(fail-safe) odmawia uruchomienia gdy `AUDITOR_USER_IDS` jest puste.

`test/auditor/reports/*.json` jest gitignored (zawiera PII).



## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
