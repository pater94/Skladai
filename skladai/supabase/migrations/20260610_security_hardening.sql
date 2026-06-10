-- ════════════════════════════════════════════════════════════════════════
-- Migracja: hardening RLS przed publikacją w sklepach (2026-06-10)
-- Uruchom w Supabase → SQL Editor.
--
-- KONTEKST: zapisy do scan_logs i uploady do bucketu 'scans' robi WYŁĄCZNIE
-- serwer (/api/analyze) kluczem service_role, który OMIJA RLS. Dlatego otwarte
-- polityki "Anyone can insert/upload" są zbędne i stanowią wektor nadużycia
-- (każdy z anon key mógł zaśmiecać tabelę/bucket). Usuwamy je. Dodajemy też
-- brakujące polityki DELETE potrzebne przy usuwaniu konta.
-- ════════════════════════════════════════════════════════════════════════

-- 1) scan_logs: usuń otwarty anonimowy INSERT (serwer i tak używa service_role)
DROP POLICY IF EXISTS "Anyone can insert anonymous scans" ON public.scan_logs;

-- 2) scan_logs: pozwól userowi usunąć własne skany (usuwanie konta / historii)
DROP POLICY IF EXISTS "Users can delete own scans" ON public.scan_logs;
CREATE POLICY "Users can delete own scans"
  ON public.scan_logs FOR DELETE
  USING (auth.uid() = user_id);

-- 3) profiles: brakująca polityka DELETE (usuwanie konta)
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- 4) storage 'scans': usuń OTWARTY upload — uploady robi serwer (service_role).
--    Zostawiamy publiczny ODCZYT (apka wyświetla zeskanowane zdjęcie po URL).
--    TODO (P2): rozważyć prywatny bucket + signed URLs, szczególnie dla zdjęć
--    sylwetki (CheckForm) — wtedy zmienić też odczyt.
DROP POLICY IF EXISTS "Anyone can upload scan images" ON storage.objects;

-- (Świadomie NIE ruszamy "Anyone can view scan images" — apka renderuje obrazy
--  z publicznych URL-i. Zmiana wymagałaby signed URLs po stronie klienta.)
