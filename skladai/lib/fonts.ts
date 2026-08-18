/**
 * Kroje pisma ładowane przez next/font (self-hosting, bez zapytań do Google
 * w przeglądarce użytkownika).
 *
 * Inter jest podpięty punktowo — na razie używa go ekran podsumowania treningu,
 * bo tam liczby muszą stać równo w kolumnach. Reszta aplikacji zostaje na
 * systemowym kroju; podmiana globalna to osobna decyzja projektowa.
 */
import { Inter } from "next/font/google";

export const inter = Inter({
  subsets: ["latin", "latin-ext"], // latin-ext = polskie znaki diakrytyczne
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
