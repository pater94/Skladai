# SkładAI — AUDIT.md

> **Wygenerowano:** 2026-05-18 przez Claude Code dla Patryka
> **Cel:** kontekst projektu dla Claude.ai (web) który planuje zmiany,
> potem przekazuje implementację tutaj. **Single source of truth o stanie
> kodu na dzień generacji.**
>
> **Następna zmiana:** system 3 trybów aplikacji (mode picker po Sign In
> + sekcja w Profilu + pole `user.mode` w bazie + konsekwencje w UI).

---

## 0. STACK & KONWENCJE

- **Next.js 16.2.1** (App Router, Turbopack) — NIE Pages Router, NIE Next 13/14 patterns
- **Capacitor 8.3.x** (iOS + Android shell), `server.url = https://www.skladai.com` w `capacitor.config.ts`
- **Tailwind CSS 4** — **bez `tailwind.config.js`** (Tailwind 4 = CSS-based config). Klasy używamy, ale **przeważa inline `style={{}}`** w wielu komponentach (zwłaszcza `app/profil/page.tsx`)
- **TypeScript** + **React 19**
- **Supabase** — baza + Auth + Storage. `lib/supabase.ts` (klient), `lib/native-storage.ts` (adapter Preferences + localStorage)
- **RevenueCat** dla IAP (iOS + Android premium subskrypcje)
- **NIE używamy** `@anthropic-ai/sdk` — wszystkie calls do Claude API przez raw `fetch()` w `app/api/analyze/route.ts`, helper `callClaude()`
- **NIE używamy framer-motion** — wszystkie animacje to CSS `@keyframes` w `app/globals.css`
- **Ikony**: `lucide-react ^1.7.0` (np. BottomNav) + SVG inline (scanner logo) + emoji
- **Deploy**: Vercel auto-deploy z `main` branch. Pro plan aktywny. `maxDuration = 120s` dla `/api/analyze`

---

## 1. ONBOARDING & AUTH FLOW

### Pliki
- **`components/OnboardingWrapper.tsx`** — state machine (`"checking" | "hidden" | "full" | "login"`)
- **`components/OnboardingLogin.tsx`** — UI slide deck (3 slidy + slide loginu) + Apple/Google sign-in + "Pomiń" button
- **`lib/native-oauth.ts`** — Capacitor OAuth flow (custom URL scheme `com.skladai.app://oauth-callback` → SFSafariViewController via `@capacitor/browser`)
- **`lib/native-storage.ts`** — `nsGet`/`nsSet`/`nsRemove` (Capacitor Preferences + localStorage backup)
- **`lib/supabase.ts`** — klient Supabase z custom `storage` adapter (`supabaseAuthStorage`) który używa Preferences

### Pełna ścieżka cold start → home

1. **App boots** → `app/layout.tsx` renderuje `<OnboardingWrapper />` na root
2. `OnboardingWrapper` w `useEffect` wywołuje:
   - `nsSelfTest()` — verify Preferences plugin działa
   - `isOnboarded()` — sprawdza Preferences / localStorage / cookie `skladai_onboarded=1`
   - `supabase.auth.getSession()` — sprawdza istniejącą sesję
   - **STEP 2 (bulletproof path)**: jeśli brak sesji, próbuje restore z manual backup w `skladai_session_backup_v1` (Preferences). Ten backup jest pisany przy każdym `onAuthStateChange` z aktywną sesją — chroni przed WKWebView wipe'em localStorage
3. **Jeśli session istnieje** → `pullFromCloud()`, `markOnboarded()`, `setState("hidden")` → wrapper return null → user widzi main app (root `/` = Skanuj)
4. **Jeśli brak session ale onboarded flag** → `setState("login")` (od slide 0, user może swipe do slide 3 z loginem)
5. **Brak obu** → `setState("full")` (od slide 0, pełne onboarding)
6. `registerOAuthCallbackListener` zarejestrowany od początku — łapie `appUrlOpen` z `com.skladai.app://oauth-callback?code=...`, robi `exchangeCodeForSession()`, dispatches "cloud-sync-done"

### Apple/Google Sign-In flow

`OnboardingLogin.handleAppleSignIn` / `handleGoogleSignIn`:
1. `signInWithProviderNative(supabase, "apple" | "google")` z `lib/native-oauth.ts`
2. Generuje OAuth URL z `skipBrowserRedirect: true`
3. Otwiera URL w `@capacitor/browser` (SFSafariViewController)
4. User loguje się → Apple/Google redirect na `com.skladai.app://oauth-callback?code=...`
5. iOS dismissuje SFSafariViewController automatycznie (custom URL scheme)
6. `appUrlOpen` listener fires → `exchangeCodeForSession()` → session w main WebView
7. `onAuthStateChange` w `OnboardingWrapper` widzi `SIGNED_IN` → `markOnboarded()` + `pullFromCloud()` + `identifyUser(rcUserId)` dla RevenueCat + `setState("hidden")`

**Krytyczne**: Supabase Dashboard musi mieć `com.skladai.app://oauth-callback` w Redirect URLs.

### "Pomiń" button

Linia 284 `OnboardingLogin.tsx`:
```tsx
<button onClick={onSkip}>Pomiń — korzystaj bez konta</button>
```

`onSkip` prop = `OnboardingWrapper` linia 328:
```tsx
onSkip={() => {
  markOnboarded();
  setState("hidden");
  window.scrollTo(0, 0);
}}
```

**Skutek**: `onboardingCompleted` flag ustawiony w Preferences/localStorage/cookie, user trafia na home. **Bez sesji Supabase** — działa w "guest mode" (localStorage only, brak cloud sync).

### Status buga "po Pomiń nie da się zalogować"

**NIE NAPRAWIONY** w 100%. Status:

- Po Pomiń: `state="hidden"`, `OnboardingWrapper` zwraca `null` przy każdym mount. User nie zobaczy ekranu logowania z poziomu apki.
- W `app/profil/page.tsx` linia 64: `const [authEmail, setAuthEmail] = useState<string | null>(null);` — jest read sesji, pokazuje email jeśli zalogowany
- **BRAK CTA "Zaloguj się"** w Profilu dla użytkownika który wszedł przez Pomiń. Aby zalogować się musi:
  - Wylogować się (ale nie jest zalogowany — N/A)
  - **ALBO** ręcznie wymuszić powrót do onboardingu (brak takiej akcji w UI)
- Workaround obecny: `OnboardingWrapper` reaguje na `SIGNED_OUT` event z `setState("login")` — ale to działa tylko jeśli user był wcześniej zalogowany, NIE dla skip-flow

**Co trzeba dodać** (do zaplanowania w Claude.ai jeśli chcesz to zrobić przy okazji 3-trybów):
- W Profilu, gdy `authEmail === null`, pokazać kartę "Zaloguj się żeby synchronizować dane" z przyciskiem który ponownie pokazuje `OnboardingLogin` (lub redirectuje na dedykowany `/zaloguj` route)

---

## 2. USER PROFILE

### Schema TypeScript

**Plik**: `lib/types.ts` linia 317

```typescript
export interface UserProfile {
  // Basic
  name?: string;
  gender: "male" | "female";
  age: number;
  weight_kg: number;
  height_cm: number;
  bmi: number;
  // Activity & goals
  activity: "sedentary" | "light" | "moderate" | "active" | "extreme";
  goal: "maintain" | "lose" | "gain" | "healthy";
  // Calculated
  bmr: number;
  tdee: number;
  target_calories: number;
  // Health
  health: {
    diabetes: "type1" | "type2" | null;
    pregnancy: "t1" | "t2" | "t3" | "karmienie" | "planuje" | null;
    allergens: string[];
    diet: string;
  };
  // Daily norms
  daily_norms: {
    calories: number;
    protein_min: number;
    protein_max: number;
    fat_min: number;
    fat_max: number;
    carbs_min: number;
    carbs_max: number;
    salt_max: number;
    sugar_max: number;
    fiber_min: number;
    water_ml: number;
  };
  // Meta
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}
```

### Schema Supabase

**Tabela `user_data`** (definicja w `lib/sync.ts` jako komentarz SQL):
```sql
CREATE TABLE user_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own"  ON user_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON user_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON user_data FOR UPDATE USING (auth.uid() = user_id);
```

**Struktura jsonb `data`** — keyed by `SYNC_KEYS` z `lib/sync.ts` (lista localStorage keys które się synchronizują):
- `skladai_profile` — UserProfile (jak wyżej)
- `skladai_history` — historia skanów
- `skladai_diary` — wpisy diary
- `skladai_recent_foods` — recent foods quick-add
- `skladai_weight_history`
- `skladai_skin_profile`
- (pełna lista w `lib/sync.ts:23`)

### Jak user data są dostępne w komponentach

**NIE MA hooka `useProfile()` / `useUser()` / `useAuth()` kontekstu.**

Pattern dziś:
```tsx
const [profile, setProfile] = useState<UserProfile | null>(null);
useEffect(() => {
  setProfile(getProfile());
}, []);
```

`getProfile()` jest synchroniczne, czyta z localStorage `skladai_profile`.

Dla auth używamy bezpośrednio:
```tsx
const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
const email = user?.email ?? null;
```

### Jak update profilu

`saveProfile(profile)` z `lib/storage.ts:137` — pisze do localStorage + `notifyChange()` event. **NIE** auto-push do Supabase — push robi `CloudSync` komponent z layoutu (debounced).

**Brakuje**: globalnego hook'a typu:
```ts
const { profile, updateProfile } = useProfile();
```

który by ułatwił reactive updates. Aktualnie każdy komponent który pokazuje profile musi sam zarządzać state'em.

### Implikacje dla 3-trybów

Dla pola `user.mode`:
- **Opcja A** — dodać `mode` do `UserProfile` interface w `lib/types.ts`, leci automatycznie przez istniejący sync (CloudSync push'uje `skladai_profile`). **Zalecane** — zero new infra.
- **Opcja B** — osobna tabela / klucz. Wymaga rozszerzenia `SYNC_KEYS`. Niepotrzebnie skomplikowane.

---

## 3. PROFIL SCREEN

### Plik
**`app/profil/page.tsx`** (734 linie, jedna funkcja `ProfilPage`)

### Kolejność sekcji (od góry)

1. **Header** (linia 255) — avatar (literka z imienia w kółku z gradient mint→blue) + powitanie + streak + scan count + license badge ("FREE" / "PRO+")
2. **GlassCard: "Aktywność i cel"** (linia 287-301) — pokazuje current goal + activity level + target_calories
3. **Apple Health / Health Connect** (linia 303+, conditional `health.isNative`) — toggle "Połączono" / "Połącz" + 3 metrics (kroki, kalorie, sen)
4. **GlassCard: "Profil zdrowotny"** (linia 467-502) — alergeny, dieta, cukrzyca, ciąża badges
5. **GlassCard: "Progres do celu"** (linia 506-575) — weight history + wykres + button "Dodaj wagę"
6. **GlassCard: "Twoje dzienne normy"** (linia 578-631) — collapsible (`normsOpen` state): calories, protein, fat, carbs, salt, sugar, fiber, water
7. **GlassCard: "Konto"** (linia 634-672) — email, "Wyloguj się" button (jeśli zalogowany), "Usuń konto" link
8. **GlassCard: "Narzędzia DEMO"** (linia 673+, conditional `IS_DEMO`) — "Resetuj Premium DEMO", "Resetuj limity czatu DEMO"

### Komponent vs inline

**`GlassCard`** jest **inline** w pliku Profilu (linia 43-49):
```tsx
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      padding: "14px 16px",
      marginBottom: 12,
      ...style
    }}>
      {children}
    </div>
  );
}
```

Każda sekcja to **inline JSX wewnątrz `<GlassCard>`** — NIE są osobne komponenty. Jeśli planujesz dodać sekcję "Tryb aplikacji" — wystarczy nowy `<GlassCard>...</GlassCard>` block w odpowiednim miejscu, np. między "Aktywność i cel" a "Apple Health" (semantyka: ważne że pierwszorzędne).

### Stylowanie

**Inline `style={{}}`** dominuje. Tailwind classes używane tylko sporadycznie (np. `className="text-white/80"`). **Konsystencja: trzymać się inline style** w nowych sekcjach żeby nie wprowadzać mieszanki.

Kolory używane w Profilu (powtarzające się patterns):
- BG card: `rgba(255,255,255,0.03)`
- Border card: `rgba(255,255,255,0.06)`
- Label dim: `rgba(255,255,255,0.5)`
- Value bright: `rgba(255,255,255,0.8)`
- Section title: `fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.8)"`
- Mint accent: `#6efcb4` (bg fill rgba 0.06-0.1)
- Blue accent: `#3b82f6` (bg fill rgba 0.06)
- Gradient CTA: `linear-gradient(135deg, #6efcb4, #3dd990)`

---

## 4. CONDITIONAL UI (Premium / Free)

### Hook

**`lib/hooks/usePremium.ts`** — jedyny istniejący hook poza `useHealthData` i `useSpeechToText`.

```ts
const { isPremium, loading, refresh } = usePremium();
```

Pattern:
1. Próbuje `checkPremium()` z RevenueCat (native only — web zwraca false)
2. Fallback do `isLocalPremium()` z `lib/storage.ts` (localStorage `skladai_premium`)
3. **Słucha window event `premium-changed`** — każda zmiana stanu premium (DEMO activate, RC purchase, logout) dispatchuje ten event, hook re-checkuje. Naprawione w commit `e1fbed0`.

### Komponenty używające `usePremium`

- `components/AgentFAB.tsx` — gating dostępu do Agent AI
- `components/ScanLimitBanner.tsx` — pokazuje counter scanów
- (Profil i inne pages odczytują `isPremium` przez prop drilling z głównych komponentów lub direct call)

### Pattern dla "mode" (Twój następny ruch)

**Polecam ten sam wzorzec** dla `useUserMode()`:

```ts
// lib/hooks/useUserMode.ts
export type UserMode = "standard" | "expert" | "minimal";

export function useUserMode() {
  const [mode, setMode] = useState<UserMode>("standard");
  useEffect(() => {
    const profile = getProfile();
    setMode(profile?.mode ?? "standard");
    const handler = () => {
      const p = getProfile();
      setMode(p?.mode ?? "standard");
    };
    window.addEventListener("user-mode-changed", handler);
    return () => window.removeEventListener("user-mode-changed", handler);
  }, []);
  return mode;
}
```

Wtedy `saveProfile({ ...profile, mode: "expert" })` + `dispatchEvent(new Event("user-mode-changed"))` propaguje wszędzie.

---

## 5. BOTTOM NAV + ROUTING

### Plik
**`components/BottomNav.tsx`**

### Definicja
```tsx
const TABS = [
  { href: "/",          icon: Scan,      label: "Skanuj"    },
  { href: "/forma",     icon: Dumbbell,  label: "Forma"     },
  { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { href: "/profil",    icon: User,      label: "Profil"    },
];
```

Stała tabela. **4 taby**, kolejność hardcoded. Brak customizacji per-user.

### Default tab logic

Brak explicit "default tab" — Next.js App Router obsługuje routing przez URL. **`/` jest entry pointem** (po onboardingu user trafia na Skanuj). Po reopens apki, ostatni URL może być przywrócony przez Capacitor (zależy od config).

### Ukrywanie nav

`HIDDEN_PREFIXES` (komitowane razem z PUBLIC_ROUTES w OnboardingWrapper):
- `/wyniki`, `/admin`, `/privacy`, `/polityka-prywatnosci`, `/support`, `/kontakt`, `/terms`, `/regulamin`, `/delete-account`

### Theme color per route

```ts
function getThemeColors(pathname: string) {
  if (pathname === "/forma" || pathname === "/biegacz") return { active: "#f97316", ... };
  if (pathname === "/promile") return { active: "#818CF8", ... };
  return { active: "#6efcb4", ... };  // default
}
```

### Łatwość zmiany kolejności per użytkownik

**Niełatwo dziś** — `TABS` to module-level const. Aby zrobić per-user kolejność:
1. Czytać `userMode` z hook'a wewnątrz `BottomNav`
2. Reorder `TABS` based na mode (np. `if (mode === "expert") moveTabFirst("dashboard")`)
3. Albo zmienić `TABS` na funkcję `getTabsForMode(mode)` zwracającą array

Zalecam #3 — czystszy refactor.

---

## 6. DESIGN TOKENS

### Brak osobnego pliku tokens

Nie ma `lib/tokens.ts` ani `design-system.ts`. Wartości są **scattered** w `globals.css` + inline styles + tailwind utilities.

### Kolory (z kodu)

**Brand & mode accents:**
| Kontekst | Hex | RGBA tuple |
|---|---|---|
| Brand (mint) | `#6efcb4` | `110, 252, 180` |
| Mint deep | `#3dd990` | — |
| Food mode | `#6efcb4` | `110, 252, 180` |
| Cosmetics mode | `#C084FC` | `192, 132, 252` |
| Suplement mode | `#3b82f6` | `59, 130, 246` |
| Meal mode | `#FBBF24` | `251, 191, 36` |
| Forma mode | `#f97316` | `249, 115, 22` |
| Promile mode | `#818CF8` | `129, 140, 248` |

**Backgrounds (dark theme):**
| Use | Value |
|---|---|
| App background | `#0a0e0c` (też `#0a0f0d` w niektórych miejscach — niespójność, brand musi wybrać) |
| Glass card BG | `rgba(255,255,255,0.03)` |
| Glass card border | `rgba(255,255,255,0.06)` |
| Glass card hover | `rgba(255,255,255,0.05)` |
| Subtle elevated | `rgba(255,255,255,0.04)` |
| Input bg | `rgba(255,255,255,0.05)` |

**Text:**
| Use | Value |
|---|---|
| Primary | `#ffffff` |
| Secondary | `rgba(255,255,255,0.8)` |
| Tertiary | `rgba(255,255,255,0.55)` |
| Muted | `rgba(255,255,255,0.4)` |
| Disabled | `rgba(255,255,255,0.3)` |

**Status:**
| Use | Value |
|---|---|
| Success | `#6efcb4` (mint) lub `#16a34a` (forest) |
| Warning | `#FBBF24` (amber) |
| Danger | `#ef4444` (red) lub `#dc2626` |
| Info | `#3b82f6` (blue) |

### Typography

System font stack (`app/layout.tsx`):
```css
fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif"
```

Sizes (najczęstsze, z inline styles):
- `28-32px` — page titles (hero h1)
- `20-22px` — section heroes (h2)
- `17-18px` — card titles (h3)
- `14-15px` — body
- `13px` — secondary body / labels
- `12px` — meta
- `11px` — uppercase labels (letterSpacing 1, fontWeight 700-800)
- `10-9px` — tiny (badges)

Weights używane: `500, 600, 700, 800, 900` (head-tier `900` dla page titles, `800` dla section titles).

### Spacing scale

Brak formalnego skali. Inline `padding`/`margin` używa wartości: `4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32`. **Multipla 4.**

### Border radius

`10, 12, 14, 16, 18, 22` — najczęściej **16** dla glass cards, **18-22** dla hero cards, **999** dla pills/chips.

### Animation framework

**TYLKO CSS keyframes** w `app/globals.css`. **Nie mamy framer-motion.**

Dostępne animacje (z `globals.css`):
- `fadeInUp` + utility classes: `.anim-fade-up`, `.anim-fade-up-1`, `.anim-fade-up-2`, `.anim-fade-up-3`, `.anim-fade-up-4` (z `0.5s cubic-bezier(0.22,1,0.36,1)` + sequencing delays 0/0.08/0.16/0.24/0.32s)
- `fadeInScale`, `slideInRight`, `float`, `shimmer`, `pulseGlow`, `spinSlow`, `scanLine`
- `float1`, `float2`, `float3` — ambient blob movements
- `micPulse`, `foodMicPulse`, `foodMicRing`, `foodInputPulseBorder` — voice input
- `breathe`, `gradientShift`, `scanPulse`
- `feedbackSlideIn`

Jak coś animujemy, używamy istniejących klas. Nowe animacje dodajemy do `globals.css`.

### SVG icons as components

- `lucide-react` używane dla `BottomNav` (Scan, Dumbbell, BarChart3, User) i kilku miejsc
- **Custom SVG inline** dla brand iconów (np. ScannerLogo w `OnboardingLogin.tsx`, `AgentChat.tsx` — scanner brackets + S literka)
- Emoji używane szeroko jako mode indicators (📷, 💄, 💊, 🍳, 🏋️)

---

## 7. CO PLANUJEMY (system 3 trybów)

> Ten dział jest "kontekst dla Claude.ai" — informacja o tym co Patryk chce dodać.

### Etap 1 — MVP trybów

1. **Ekran wyboru trybu po Sign In**
   - Po pomyślnym Apple/Google login + ewentualnie po Pomiń
   - 3 karty wyboru + opcja "Pomiń"
   - Wybór zapisuje `mode` do `UserProfile`
   - Pierwszy raz pokazuje się po sign-in. Później user zmienia w Profilu

2. **Sekcja "Tryb aplikacji" w Profilu**
   - Kompaktowe karty (mniejsze niż onboarding carousel)
   - Wybór bieżącego trybu z visual indicator (active state)
   - Zmiana = update profile.mode + dispatch `user-mode-changed` event

3. **Pole `user.mode` w bazie**
   - Dodać `mode?: UserMode` do `UserProfile` interface
   - Type: `"standard" | "expert" | "minimal"` (nazwy do uzgodnienia)
   - Sync przez istniejący `skladai_profile` blob (CloudSync auto-push)

### Etap 2+ (po podstawce)

4. **Konsekwencje trybu** — różne UI, default taby, persona AI
   - `BottomNav` mode-aware tabs reorder
   - `AgentChat` system prompt różny per tryb
   - Onboarding tipów/edukacji per tryb
   - Może też: różne progi free-tier per tryb

---

## 8. LISTA "NIE RUSZAĆ" (stabilne, ryzykowne do zmian)

Te pliki mają złożoną historię iteracji + edge cases z iOS 26.3 / Capacitor / Vercel. **Nie zmieniać bez bardzo dobrej przyczyny:**

| Plik / katalog | Dlaczego nie ruszać |
|---|---|
| `components/OnboardingWrapper.tsx` | Auth state machine, 3-step session restore + manual Preferences backup + native OAuth callback — naprawiane wielokrotnie pod iOS 26.3 |
| `lib/native-oauth.ts` | Capacitor OAuth flow z custom URL scheme. iOS forcing SFSafariViewController + scheme dismiss — działa, łatwo zepsuć |
| `lib/native-storage.ts` | Adapter dla supabase auth (Preferences + localStorage), znajdziesz tu `nsGet`/`nsSet`/`nsRemove`/`supabaseAuthStorage`/`nsSelfTest` |
| `lib/revenuecat.ts` | RevenueCat IAP — `initRevenueCat`, `checkPremium`, `identifyUser`, `resetUser` |
| `lib/useHealthData.ts` | Apple Health + Health Connect (`@capgo/capacitor-health`) — wieleiteracji nad permissions, iOS revoke detection, x-apple-health:// deep link |
| `app/api/analyze/route.ts` | **Centrum AI scanning** (~2000+ linii). Można zmieniać **prompty** (FOOD_ANALYSIS, COSMETICS_ANALYSIS, supplementAnalysisPrompt, READ_FOOD_LABEL, READ_COSMETICS_LABEL) i bump PROMPT_VERSION. **NIE łamać flow** (Vision OCR → Claude OCR fallback → Claude analysis → enforceLabelReadabilityGuard → logScanToSupabase). Konstrukcja `void logScanToSupabase` jako fire-and-forget mutuje result sync przed pierwszym await — kluczowe dla scan_log_id flow |
| `components/AgentChat.tsx` | Czat Agent AI ~1000 linii. Limity wiadomości free/paid w localStorage, voice input + TTS integration, modal z body scroll lock |
| `app/api/chat/route.ts` | Backend Agent AI. Ma własną system prompt builder + context (profile, scan_logs, diary, recent foods) |
| `components/BottomNav.tsx` | **Można** rozbudować (dodać mode-aware ordering), ale NIE łamać hierarchii 4 stałych tabów ani hidden prefixes |
| `components/SafeBoundary.tsx`, `app/global-error.tsx`, `app/wyniki/[id]/error.tsx`, `app/wyniki/[id]/loading.tsx` | Error boundaries / loading — naprawione w `864f02f` po raporcie "WKWebView: This page couldn't load". Bez nich iOS pokazuje native error |
| `app/api/tts/route.ts` | OpenAI TTS endpoint z Supabase storage cache (`tts-cache` bucket). Wymaga `OPENAI_API_KEY` |
| `components/AppInit.tsx`, `components/CloudSync.tsx` | Boot-time side effects: RC init, cloud sync pull/push. Działają. Nie ruszać. |

---

## 9. KNOWN ISSUES / TECH DEBT

### Active terminologia projektu (Claude.ai nie zna)

- **`PROMPT_VERSION = "v6"`** — stała na początku `app/api/analyze/route.ts` która stempluje każdy `scan_logs` row. Bumpujemy gdy zmieniamy prompty (główne FOOD_ANALYSIS / COSMETICS_ANALYSIS / supplementAnalysisPrompt). Admin panel filtruje po tym polu żeby porównywać iteracje. **Bump przy każdej zmianie prompta**, dodaj changelog inline (już jest history v1→v6).

- **`scan_log_id` flow** — server `logScanToSupabase()` pre-generuje `randomUUID()` PRZED jakimkolwiek `await`, synchronicznie mutuje `result.__scan_log_id`. Klient (caller w `app/page.tsx`) wywołuje `void logScanToSupabase(...)` i NATYCHMIAST `return NextResponse.json(result)` — JS event loop semantyka gwarantuje że mutacja zdąży. Klient potem zapisuje `scan_log_id` do `ScanHistoryItem.scan_log_id` w localStorage. `/api/feedback` używa tego ID zamiast fuzzy match po `product_name`. Naprawione w commit `2892a89`.

- **`enforceLabelReadabilityGuard()` v4** — server-side helper w `app/api/analyze/route.ts`. Wywołany po `parseJsonResponse + validateNutrition`, przed `logScanToSupabase + NextResponse.json`. Gdy `mode ∈ {food, cosmetics, suplement}` AND `ocr_text < 30 chars`, **nadpisuje** odpowiedź AI: `partial_label=true`, `score=null`, czyści `ingredients/nutrition/dose`. Model nie widzi tej części kodu — nie ma jak ominąć. v5 dorzucił `missing_fields[]` + `retake_hint` żeby frontend mógł pokazać "Brak etykiety" UI w `wyniki/[id]/page.tsx`.

### Tech debt

- **Brak globalnego `useProfile()` / `useAuth()` hook'a** — każdy komponent który pokazuje profile robi `getProfile()` w useEffect lokalnie. Update profilu nie propaguje automatycznie do innych mounted komponentów (chyba że są od auto-sync przez `notifyChange()` event z `lib/storage.ts`).
- **Inline styles vs Tailwind 4** — mieszanka. Profil ma głównie inline, niektóre komponenty (np. ScanLimitBanner) używają Tailwind. **Nowe sekcje**: trzymać się konwencji pliku w którym pracujemy.
- **`#0a0e0c` vs `#0a0f0d`** — dwa lekko różne kolory tła używane wymiennie. Drobny inconsistency.
- **Brak `tokens.ts` / design system file** — design tokens scattered. Trzeba ręcznie wpisać hex za każdym razem.
- **"Pomiń" UX issue** — patrz Sekcja 1, brak path do logowania post-skip.
- **Suplement OCR success rate niski** — Google Vision OCR + Claude Haiku fallback nadal słabe dla cylindrycznych opakowań (etykieta zawija się). v4 enforce + v5 retake hints UI mitygują UX.
- **AI estimacja kalorii (VoiceLog)** — dokładność ±15-30% vs MFP/Fitatu ±2-5% (bo my parsujemy NLP, oni lookup z bazy). Świadoma decyzja produktowa.

---

## 10. GIT STATE

### Branch
```
main (jedyny aktywny, all commits land here)
```

### Uncommitted
**Brak** w momencie generowania AUDIT.md — `git status` clean.

### Workflow
- **Direct to main**, brak PR review (solo dev)
- **Vercel auto-deploy** z `main` do `https://www.skladai.com` (Capacitor `server.url`)
- Co ~2-3 min od `git push` deploy żyje
- **Brak staging environment** — production = main

### Ostatnie commity (kontekst aktualności)
```
b9879bf perf(scanner): v6 — Pro plan budget bump + Haiku OCR fallback
864f02f fix(scanner): kill WKWebView "This page couldn't load" on slow scans
c35a6d1 feat(home): "Powiedz co zjadłeś" heading + explainer above food input
49d0f15 feat(home): "Ostatnio dodane" quick-add strip — MFP-style 1-tap re-add
abdd392 feat(scanner): v5 — actionable "Brak etykiety" view + retake hints
7acf6ec feat(scanner): v4 — server-side enforcement vs OCR-empty hallucination
b8be4c1 docs: ASO plan — copy-paste metadata + screenshots + 30-day rollout
0d10fe2 feat(scanner): v3 prompts — dual Vision OCR + handling for cylindrical packaging
9422515 feat(scanner): make food text/voice input stand out
e1fbed0 fix(demo): Premium DEMO button actually activates Premium in place
```

### Remote
```
origin: https://github.com/pater94/Skladai.git
```

---

## 11. PRZYDATNE DLA CLAUDE.AI — ŚCIĄGAWKA

Jeśli Claude.ai potrzebuje skierować Patryka do konkretnego pliku przy planowaniu zmian:

| Co chcesz zmienić | Plik |
|---|---|
| Onboarding slides / Apple/Google sign-in / Pomiń button | `components/OnboardingLogin.tsx` |
| Auth state machine / session restore | `components/OnboardingWrapper.tsx` |
| Profil page (kolejność sekcji, GlassCardy) | `app/profil/page.tsx` |
| Bottom nav (taby, kolejność, theme) | `components/BottomNav.tsx` |
| Layout root (co się montuje globalnie) | `app/layout.tsx` |
| Skaner home screen (mode tabs, CTA, Lodówka, Galeria) | `app/page.tsx` |
| Wynik scan UI | `app/wyniki/[id]/page.tsx` |
| Agent AI chat (UI + voice + TTS) | `components/AgentChat.tsx` |
| Voice → diary entries flow | `components/VoiceLog.tsx` |
| Premium paywall (cena, features lista) | `app/premium/page.tsx` |
| Admin dashboard scanów | `app/admin/page.tsx` |
| Type `UserProfile` | `lib/types.ts:317` |
| Profile getter/setter | `lib/storage.ts:124-145` |
| Premium hook | `lib/hooks/usePremium.ts` |
| Health (Apple Health / Google Fit) hook | `lib/useHealthData.ts` |
| Speech-to-text hook | `lib/useSpeechToText.ts` |
| Anthropic / Vision / OpenAI keys + IS_DEMO flag | `.env.local` + `lib/config.ts` |

---

**Koniec AUDIT.md.** Wracaj tu zawsze gdy planujesz zmianę — to mapa terenu w jednym miejscu.
