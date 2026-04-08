"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScanMode, FavoriteItem, TextSearchItem } from "@/lib/types";
import VoiceLog, { VoiceMicButton } from "@/components/VoiceLog";

// === Diary entry shape passed to parent ===
export interface DiaryAddEntry {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar?: number;
  fiber?: number;
  score: number;
  meal_type: MealTypeKey;
}

// === Quick-add item shape ===
export interface QuickAddItem {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar?: number;
  fiber?: number;
  portion: string;
  emoji: string;
  score: number;
}

type MealTypeKey = "breakfast" | "lunch" | "dinner" | "snack";

interface FoodSearchProps {
  mode: ScanMode;
  onAddToDiary: (entry: DiaryAddEntry) => void;
}

// === Meal type options ===
const MEAL_TYPES: { key: MealTypeKey; label: string }[] = [
  { key: "breakfast", label: "Śniadanie" },
  { key: "lunch", label: "Obiad" },
  { key: "dinner", label: "Kolacja" },
  { key: "snack", label: "Przekąska" },
];

// === Tab type ===
type TabKey = "recent" | "favorites";

// === localStorage helpers ===
const RECENT_KEY = "skladai_recent_searches";
const FAVORITES_KEY = "skladai_favorites";
const SECTIONS_EXPANDED_KEY = "skladai_sections_expanded";

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentSearches().filter((q) => q !== query);
    const updated = [query, ...existing].slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch { /* noop */ }
}

export function getFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addFavorite(item: FavoriteItem): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getFavorites().filter((f) => f.id !== item.id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([item, ...existing]));
  } catch { /* noop */ }
}

export function removeFavorite(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const updated = getFavorites().filter((f) => f.id !== id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  } catch { /* noop */ }
}

export function isFavorite(name: string): boolean {
  return getFavorites().some((f) => f.name === name);
}

// === Section expanded state helpers ===
function getSectionsExpanded(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SECTIONS_EXPANDED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSectionExpanded(key: string, expanded: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const current = getSectionsExpanded();
    current[key] = expanded;
    localStorage.setItem(SECTIONS_EXPANDED_KEY, JSON.stringify(current));
  } catch { /* noop */ }
}

// === Inline search result shape ===
interface SearchResultDisplay {
  items: TextSearchItem[];
  verdict: string;
  tip: string;
}

// === Product-search suggestion shape (mirrors /api/product-search) ===
interface ProductSuggestion {
  name: string;
  brand: string;
  emoji: string;
  package_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  fat_per_100g: number;
  carbs_per_100g: number;
  sugar_per_100g?: number;
  fiber_per_100g?: number;
  score: number;
}

/** Convert a Claude product suggestion into the TextSearchItem shape used
 *  by the existing result-card UI, so we don't have to duplicate the card. */
function suggestionToItem(s: ProductSuggestion): TextSearchItem {
  const ratio = s.package_g / 100;
  return {
    name: s.brand ? `${s.name} — ${s.brand}` : s.name,
    portion: `${s.package_g}g (opakowanie)`,
    calories: Math.round(s.calories_per_100g * ratio),
    protein: Math.round(s.protein_per_100g * ratio * 10) / 10,
    fat: Math.round(s.fat_per_100g * ratio * 10) / 10,
    carbs: Math.round(s.carbs_per_100g * ratio * 10) / 10,
    sugar: s.sugar_per_100g !== undefined ? Math.round(s.sugar_per_100g * ratio * 10) / 10 : 0,
    fiber: s.fiber_per_100g !== undefined ? Math.round(s.fiber_per_100g * ratio * 10) / 10 : 0,
    score: s.score,
    emoji: s.emoji,
    verdict: "",
    fun_comparison: "",
    calories_per_100g: s.calories_per_100g,
    protein_per_100g: s.protein_per_100g,
    fat_per_100g: s.fat_per_100g,
    carbs_per_100g: s.carbs_per_100g,
    default_portion_g: s.package_g,
    min_portion_g: 1,
    // Slider hard cap: 500g for normal items, 1000g for heavy ones
    // (still capped — manual input below allows up to 2000g).
    max_portion_g: s.package_g > 500 ? 1000 : 500,
  };
}

// === Component ===
export default function FoodSearch({ mode, onAddToDiary }: FoodSearchProps) {
  const [mealType, setMealType] = useState<MealTypeKey>("breakfast");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("recent");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResultDisplay | null>(null);
  const [portions, setPortions] = useState<Record<number, number>>({});
  const [portionInputs, setPortionInputs] = useState<Record<number, string>>({});
  const [sectionExpanded, setSectionExpandedState] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsBoxRef = useRef<HTMLDivElement>(null);

  // Only render in food mode
  if (mode !== "food") return null;

  // Load recent & favorites on mount + section expanded state
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    setFavorites(getFavorites());
    const saved = getSectionsExpanded();
    setSectionExpandedState(saved["content"] === true);
  }, []);

  const refreshLists = useCallback(() => {
    setRecentSearches(getRecentSearches());
    setFavorites(getFavorites());
  }, []);

  const toggleSection = () => {
    const newVal = !sectionExpanded;
    setSectionExpandedState(newVal);
    setSectionExpanded("content", newVal);
  };

  // === Suggestions dropdown — debounced fetch from /api/product-search ===
  // Fires on every query change (≥2 chars) and shows the dropdown so the
  // user can pick a specific brand/gramatura instead of getting a single
  // auto-picked result.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const suggestSeqRef = useRef(0);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2 || searchResult) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    setShowSuggestions(true);
    const seq = ++suggestSeqRef.current;
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/product-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });
        const data = await res.json();
        // Drop the response if a newer query came in while we were waiting.
        if (seq !== suggestSeqRef.current) return;
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      } catch {
        if (seq !== suggestSeqRef.current) return;
        setSuggestions([]);
      } finally {
        if (seq === suggestSeqRef.current) setSuggestionsLoading(false);
      }
    }, 350);
    return () => { if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current); };
  }, [query, searchResult]);

  // Click-outside / Escape closes the suggestion dropdown.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!showSuggestions) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        suggestionsBoxRef.current &&
        !suggestionsBoxRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setShowSuggestions(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSuggestions]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pickSuggestion = useCallback(
    (s: ProductSuggestion) => {
      const item = suggestionToItem(s);
      addRecentSearch(query.trim() || s.name);
      refreshLists();
      setSearchResult({ items: [item], verdict: "", tip: "" });
      setPortions({ 0: item.default_portion_g });
      setPortionInputs({ 0: String(item.default_portion_g) });
      setShowSuggestions(false);
      setSuggestions([]);
    },
    [query, refreshLists]
  );

  // === Search handler (fallback when AI doesn't have a matching brand) ===
  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setSearchResult(null);
    setShowSuggestions(false);
    addRecentSearch(trimmed);
    refreshLists();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, mode: "text_search" }),
      });

      if (!res.ok) throw new Error("Wystąpił błąd podczas wyszukiwania");

      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setSearchResult({
          items: data.items,
          verdict: data.verdict || "",
          tip: data.tip || "",
        });
        // Initialize portions from default
        const initPortions: Record<number, number> = {};
        const initInputs: Record<number, string> = {};
        data.items.forEach((item: TextSearchItem, idx: number) => {
          const p = item.default_portion_g || 100;
          initPortions[idx] = p;
          initInputs[idx] = String(p);
        });
        setPortions(initPortions);
        setPortionInputs(initInputs);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [query, isLoading, refreshLists]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearQuery = () => {
    setQuery("");
    setSearchResult(null);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // Add favorite item to diary
  const handleFavoriteAdd = (fav: FavoriteItem) => {
    onAddToDiary({
      name: fav.name,
      emoji: fav.emoji,
      calories: fav.calories,
      protein: fav.protein,
      fat: fav.fat,
      carbs: fav.carbs,
      score: fav.score,
      meal_type: mealType,
    });
  };

  // Add search result item to diary
  const handleResultAdd = (item: TextSearchItem, portionG: number) => {
    const ratio = portionG / 100;
    onAddToDiary({
      name: item.name,
      emoji: item.emoji,
      calories: Math.round(item.calories_per_100g * ratio),
      protein: Math.round(item.protein_per_100g * ratio * 10) / 10,
      fat: Math.round(item.fat_per_100g * ratio * 10) / 10,
      carbs: Math.round(item.carbs_per_100g * ratio * 10) / 10,
      sugar: item.sugar ? Math.round(item.sugar * (portionG / (item.default_portion_g || 100)) * 10) / 10 : undefined,
      fiber: item.fiber ? Math.round(item.fiber * (portionG / (item.default_portion_g || 100)) * 10) / 10 : undefined,
      score: item.score,
      meal_type: mealType,
    });
  };

  // Add search result item to favorites
  const handleAddToFavorites = (item: TextSearchItem) => {
    const newFav: FavoriteItem = {
      id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: item.name,
      emoji: item.emoji,
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      portion: item.portion,
      default_portion_g: item.default_portion_g || 100,
      score: item.score,
      addedAt: new Date().toISOString(),
    };
    addFavorite(newFav);
    refreshLists();
  };

  const handleRemoveFavorite = (id: string) => {
    removeFavorite(id);
    refreshLists();
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    setSearchResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Compute macros for a result item at given portion
  const computeMacros = (item: TextSearchItem, portionG: number) => {
    const ratio = portionG / 100;
    return {
      calories: Math.round(item.calories_per_100g * ratio),
      protein: Math.round(item.protein_per_100g * ratio * 10) / 10,
      fat: Math.round(item.fat_per_100g * ratio * 10) / 10,
      carbs: Math.round(item.carbs_per_100g * ratio * 10) / 10,
    };
  };

  // Macro ring SVG helper
  const MacroRing = ({ value, max, color, label }: { value: number; max: number; color: string; label: string }) => {
    const pct = Math.min(value / max, 1);
    const r = 16;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct);
    return (
      <div className="flex flex-col items-center gap-0.5">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="none" stroke="#E8E4DC" strokeWidth="4" />
          <circle
            cx="20" cy="20" r={r} fill="none"
            stroke={color} strokeWidth="4"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 20 20)"
          />
          <text x="20" y="22" textAnchor="middle" fontSize="9" fontWeight="600" fill="#1A3A0A">
            {value}g
          </text>
        </svg>
        <span className="text-[10px] text-[#8B8574]">{label}</span>
      </div>
    );
  };

  // Score color helper
  const scoreColor = (score: number) => {
    if (score >= 75) return "#4A8C26";
    if (score >= 50) return "#C9A000";
    return "#C0392B";
  };

  return (
    <div className="pb-4">
      {/* === Elegant card with meal selector + search === */}
      <div className="bg-white rounded-[16px] p-3.5 shadow-sm">
        {/* Meal type icons */}
        <div className="flex justify-around mb-3">
          {([
            { key: "breakfast" as MealTypeKey, emoji: "🌅", label: "Śniadanie" },
            { key: "lunch" as MealTypeKey, emoji: "🌞", label: "Obiad" },
            { key: "dinner" as MealTypeKey, emoji: "🌙", label: "Kolacja" },
            { key: "snack" as MealTypeKey, emoji: "🍪", label: "Przekąska" },
          ]).map((mt) => (
            <button
              key={mt.key}
              onClick={() => setMealType(mt.key)}
              className="flex flex-col items-center gap-1 transition-all active:scale-90"
            >
              <span className={`text-xl transition-opacity ${mealType === mt.key ? "opacity-100" : "opacity-30"}`}>{mt.emoji}</span>
              <span className={`text-[10px] font-semibold transition-all ${mealType === mt.key ? "text-[#1A3A0A]" : "text-[#1A3A0A]/30"}`}>{mt.label}</span>
              <div className={`w-5 h-[2px] rounded-full transition-all ${mealType === mt.key ? "bg-[#84CC16]" : "bg-transparent"}`} />
            </button>
          ))}
        </div>

        {/* Search input with mic button */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] opacity-20 pointer-events-none">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="np. 2 jajka, kanapka z serem, kawa..."
            className="w-full pl-9 pr-16 py-[10px] rounded-[11px] text-[#1A3A0A] text-[14px] placeholder:opacity-30 placeholder:text-[13px] focus:outline-none focus:ring-2 focus:ring-[#84CC16]/30 transition-all"
            style={{ background: "rgba(26,58,10,0.04)" }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                onClick={clearQuery}
                className="w-6 h-6 flex items-center justify-center rounded-full text-[11px] text-[#8B8574] hover:bg-[#E8E4DC] transition-all"
              >
                ✕
              </button>
            )}
            <VoiceMicButton onClick={() => setShowVoice(true)} accent="green" />
          </div>

          {/* === Suggestions dropdown === */}
          {showSuggestions && !searchResult && !isLoading && (
            <div
              ref={suggestionsBoxRef}
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-[14px] bg-white border border-[#E8E4DC] shadow-lg overflow-hidden"
            >
              {suggestionsLoading && suggestions.length === 0 && (
                <div className="px-4 py-3 text-center text-[12px] text-[#8B8574]">
                  <span className="inline-block w-3 h-3 mr-2 align-middle rounded-full border-2 border-[#4A8C26] border-t-transparent animate-spin" />
                  Szukam propozycji...
                </div>
              )}

              {!suggestionsLoading && suggestions.length === 0 && query.trim().length >= 2 && (
                <div className="px-4 py-3 text-center text-[12px] text-[#8B8574]">
                  Brak gotowych propozycji dla &quot;{query.trim()}&quot;
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="max-h-[55vh] overflow-y-auto divide-y divide-[#E8E4DC]" data-scrollable="true">
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.name}-${s.brand}-${i}`}
                      onClick={() => pickSuggestion(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-[#F5F2EB] transition-colors"
                    >
                      <span className="text-xl flex-shrink-0">{s.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1A3A0A] truncate">
                          {s.name}
                        </p>
                        <p className="text-[11px] text-[#8B8574] truncate">
                          {s.brand && <span>{s.brand} · </span>}
                          {s.package_g}g · {s.calories_per_100g} kcal/100g
                        </p>
                      </div>
                      <span className="text-[18px] text-[#4A8C26] font-semibold flex-shrink-0">+</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Fallback: full text_search analyze when no AI match
                  or user wants to add a custom product. */}
              {!suggestionsLoading && (
                <button
                  onClick={() => handleSearch()}
                  className="w-full px-3 py-2.5 text-center text-[12px] font-semibold text-[#4A8C26] bg-[#4A8C26]/5 border-t border-[#E8E4DC] active:bg-[#4A8C26]/10 transition-colors"
                >
                  + Dodaj jako własny produkt
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* === Loading state === */}
      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-10 h-10 rounded-full border-[3px] border-[#4A8C26] border-t-transparent animate-spin" />
          <p className="text-sm text-[#4A8C26] font-medium animate-pulse">
            Szukam wartości odżywczych...
          </p>
          <div className="w-full space-y-3 mt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-2xl bg-gradient-to-r from-[#E8E4DC] via-[#F5F2EB] to-[#E8E4DC] animate-pulse"
              />
            ))}
          </div>
        </div>
      )}

      {/* === Search results (inline) === */}
      {searchResult && !isLoading && (
        <div className="mt-4 space-y-3">
          <h3 className="text-xs font-semibold text-[#8B8574] uppercase tracking-wider ml-1">
            Wyniki wyszukiwania
          </h3>

          {searchResult.items.map((item, idx) => {
            const portionG = portions[idx] ?? item.default_portion_g ?? 100;
            const macros = computeMacros(item, portionG);
            const alreadyFav = isFavorite(item.name);

            return (
              <div
                key={`${item.name}-${idx}`}
                className="rounded-2xl bg-white border border-[#E8E4DC] p-4 space-y-3"
              >
                {/* Header: emoji + name + score */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[#1A3A0A] truncate">{item.name}</p>
                      <p className="text-[12px] text-[#8B8574]">{item.portion}</p>
                    </div>
                  </div>
                  <div
                    className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: scoreColor(item.score) }}
                  >
                    {item.score}
                  </div>
                </div>

                {/* Calories + macro rings */}
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#1A3A0A]">{macros.calories}</p>
                    <p className="text-[10px] text-[#8B8574]">kcal</p>
                  </div>
                  <div className="flex gap-3">
                    <MacroRing value={macros.protein} max={50} color="#4A8C26" label="Białko" />
                    <MacroRing value={macros.fat} max={40} color="#C9A000" label="Tłuszcz" />
                    <MacroRing value={macros.carbs} max={80} color="#3B82F6" label="Węgle" />
                  </div>
                </div>

                {/* Verdict */}
                {item.verdict && (
                  <p className="text-[12px] text-[#8B8574] italic leading-snug">
                    {item.verdict}
                  </p>
                )}

                {/* Portion slider + manual input.
                    Slider hard cap = item.max_portion_g (defaults: 500g normal,
                    1000g for heavy items). Manual input allows up to 2000g
                    so e.g. catering trays / large packaging still fit. */}
                {(() => {
                  const sliderMin = Math.max(1, item.min_portion_g || 1);
                  const sliderMax = Math.max(sliderMin + 1, item.max_portion_g || 500);
                  const inputVal = portionInputs[idx] ?? String(portionG);
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-[#1A3A0A]">Porcja</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={2000}
                            value={inputVal}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setPortionInputs((prev) => ({ ...prev, [idx]: raw }));
                              if (raw === "") return;
                              const n = parseInt(raw, 10);
                              if (Number.isFinite(n) && n >= 1 && n <= 2000) {
                                setPortions((prev) => ({ ...prev, [idx]: n }));
                              }
                            }}
                            onBlur={() => {
                              const n = parseInt(portionInputs[idx] ?? "", 10);
                              const clamped = Number.isFinite(n)
                                ? Math.max(1, Math.min(2000, n))
                                : portionG;
                              setPortions((prev) => ({ ...prev, [idx]: clamped }));
                              setPortionInputs((prev) => ({ ...prev, [idx]: String(clamped) }));
                            }}
                            className="w-14 px-1.5 py-0.5 text-right text-[13px] font-semibold text-[#4A8C26] bg-[#4A8C26]/5 border border-[#4A8C26]/20 rounded-md focus:outline-none focus:border-[#4A8C26]"
                          />
                          <span className="text-[12px] font-semibold text-[#4A8C26]">g</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step={5}
                        value={Math.min(portionG, sliderMax)}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setPortions((prev) => ({ ...prev, [idx]: n }));
                          setPortionInputs((prev) => ({ ...prev, [idx]: String(n) }));
                        }}
                        className="w-full h-2 rounded-full appearance-none bg-[#E8E4DC] accent-[#4A8C26] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-[#8B8574]">
                        <span>{sliderMin}g</span>
                        <span>{sliderMax}g{portionG > sliderMax ? " (powyżej — wpisz ręcznie)" : ""}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResultAdd(item, portionG)}
                    className="flex-1 py-2.5 rounded-xl bg-[#4A8C26] text-white text-[13px] font-semibold active:scale-[0.97] transition-all"
                  >
                    Dodaj do dziennika
                  </button>
                  <button
                    onClick={() => {
                      if (alreadyFav) {
                        const fav = getFavorites().find((f) => f.name === item.name);
                        if (fav) handleRemoveFavorite(fav.id);
                      } else {
                        handleAddToFavorites(item);
                      }
                    }}
                    className={`px-3 py-2.5 rounded-xl text-[13px] font-semibold active:scale-95 transition-all ${
                      alreadyFav
                        ? "bg-[#C9A000]/15 text-[#C9A000]"
                        : "bg-[#C9A000]/10 text-[#C9A000]"
                    }`}
                  >
                    {alreadyFav ? "★" : "☆"} Ulubione
                  </button>
                </div>
              </div>
            );
          })}

          {/* Clear results button */}
          <button
            onClick={() => setSearchResult(null)}
            className="w-full py-2 text-[12px] text-[#8B8574] underline"
          >
            Zamknij wyniki
          </button>
        </div>
      )}

      {/* === Tabs: Ostatnie | Ulubione (collapsible content) === */}
      {!searchResult && !isLoading && (
        <>
          <div className="flex gap-1 mt-4 mb-3 bg-white/50 rounded-xl p-1">
            {([
              { key: "recent" as TabKey, label: "Ostatnie" },
              { key: "favorites" as TabKey, label: "Ulubione" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-[#4A8C26] shadow-sm"
                    : "text-[#8B8574]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Collapsible header */}
          <button
            onClick={toggleSection}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/60 mb-2 active:bg-white/80 transition-colors"
          >
            <span className="text-[12px] font-semibold text-[#8B8574] uppercase tracking-wider">
              {activeTab === "recent" ? "Ostatnie wyszukiwania" : "Ulubione produkty"}
            </span>
            <span
              className="text-[14px] text-[#8B8574] transition-transform duration-300"
              style={{ display: "inline-block", transform: sectionExpanded ? "rotate(0deg)" : "rotate(0deg)" }}
            >
              {sectionExpanded ? "▾" : "▸"}
            </span>
          </button>

          {/* Collapsible content with smooth animation */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: sectionExpanded ? "2000px" : "0px",
              opacity: sectionExpanded ? 1 : 0,
            }}
          >
            {/* === Tab: Ostatnie === */}
            {activeTab === "recent" && (
              <div className="space-y-2">
                {recentSearches.length === 0 ? (
                  <p className="text-[13px] text-[#8B8574] text-center py-8">
                    Brak ostatnich wyszukiwań
                  </p>
                ) : (
                  recentSearches.map((term) => (
                    <div
                      key={term}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/70 border border-[#E8E4DC]"
                    >
                      <span className="text-[#8B8574]">🕐</span>
                      <span className="flex-1 text-[13px] text-[#1A3A0A] truncate">{term}</span>
                      <button
                        onClick={() => handleRecentClick(term)}
                        className="px-3 py-1.5 rounded-xl bg-[#4A8C26]/10 text-[#4A8C26] text-[11px] font-semibold active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* === Tab: Ulubione === */}
            {activeTab === "favorites" && (
              <div className="space-y-2">
                {favorites.length === 0 ? (
                  <p className="text-[13px] text-[#8B8574] text-center py-8">
                    Brak ulubionych produktów
                  </p>
                ) : (
                  favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/70 border border-[#E8E4DC]"
                    >
                      <span className="text-xl">{fav.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#1A3A0A] truncate">{fav.name}</p>
                        <p className="text-[11px] text-[#8B8574]">
                          {fav.calories}kcal · B:{fav.protein}g · T:{fav.fat}g · W:{fav.carbs}g
                        </p>
                      </div>
                      <button
                        onClick={() => handleFavoriteAdd(fav)}
                        className="px-3 py-1.5 rounded-xl bg-[#4A8C26]/10 text-[#4A8C26] text-[11px] font-semibold active:scale-95 transition-all"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleRemoveFavorite(fav.id)}
                        className="text-[#C9A000] text-lg active:scale-90 transition-all"
                        title="Usuń z ulubionych"
                      >
                        ★
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
      {/* Voice Log Modal */}
      {showVoice && (
        <VoiceLog
          mode="food"
          initialOpen={true}
          hideButton={true}
          onComplete={() => {
            setShowVoice(false);
            refreshLists();
          }}
          onClose={() => setShowVoice(false)}
        />
      )}
    </div>
  );
}
