/**
 * Reusable scan result fixtures dla testów Playwright.
 * Wzorowane na produkcyjnym schemacie z `app/api/analyze/route.ts`.
 */

export const SCAN_WITH_LACTOSE = {
  type: "food",
  name: "Mleko UHT 3,2%",
  brand: "Łaciate",
  weight: "1L",
  score: 8,
  verdict_short: "OK dla większości",
  verdict: "Mleko pełnotłuste UHT.",
  ingredients: [
    { name: "mleko pełnotłuste 3,2%", original: "mleko pełnotłuste (3,2% tłuszczu)", harmful: false },
  ],
  nutrition: [
    { label: "Wartość energetyczna", value: "60 kcal" },
    { label: "Tłuszcz", value: "3.2g" },
    { label: "Cukry", value: "4.8g" },
    { label: "Białko", value: "3.2g" },
  ],
  allergens: ["mleko"],
  pros: ["Źródło białka i wapnia"],
  cons: ["Zawiera laktozę"],
  tip: "",
};

export const SCAN_WITH_NUTS = {
  type: "food",
  name: "Batonik orzechowy",
  brand: "Generic",
  weight: "40g",
  score: 6,
  verdict_short: "OK z umiarem",
  verdict: "Batonik z orzechami.",
  ingredients: [
    { name: "orzechy laskowe", original: "orzechy laskowe (35%)", harmful: false },
    { name: "cukier", original: "cukier", harmful: false },
  ],
  nutrition: [
    { label: "Wartość energetyczna", value: "520 kcal" },
    { label: "Tłuszcz", value: "32g" },
    { label: "Cukry", value: "28g" },
    { label: "Białko", value: "8g" },
  ],
  allergens: ["orzechy"],
  pros: ["Zdrowe tłuszcze"],
  cons: ["Wysoka kaloryczność", "Cukier dodany"],
  tip: "",
};

export const SCAN_COSMETIC = {
  type: "cosmetics",
  name: "Krem nawilżający",
  brand: "Test Cosmetics",
  volume: "50ml",
  category: "Krem do twarzy",
  score: 7,
  verdict_short: "Dobry skład",
  verdict: "Krem o standardowym składzie.",
  ingredients: [
    { name: "Aqua", original: "Aqua", harmful: false },
    { name: "Glycerin", original: "Glycerin", harmful: false },
  ],
};
