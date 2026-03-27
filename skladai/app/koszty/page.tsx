"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ExpenseEntry {
  id: string;
  name: string;
  price: number;
  date: string; // ISO
}

const STORAGE_KEY = "skladai_expenses";

function getExpenses(): ExpenseEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpenses(entries: ExpenseEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function KosztyPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setExpenses(getExpenses());
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.price, 0);
  const monthName = now.toLocaleDateString("pl-PL", { month: "long" });

  // Group by month for history
  const monthGroups = new Map<string, { label: string; total: number; entries: ExpenseEntry[] }>();
  for (const e of expenses) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
    if (!monthGroups.has(key)) {
      monthGroups.set(key, { label, total: 0, entries: [] });
    }
    const group = monthGroups.get(key)!;
    group.total += e.price;
    group.entries.push(e);
  }

  const handleAdd = () => {
    const trimmed = name.trim();
    const priceNum = parseFloat(price.replace(",", "."));
    if (!trimmed || isNaN(priceNum) || priceNum <= 0) return;

    const entry: ExpenseEntry = {
      id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      price: Math.round(priceNum * 100) / 100,
      date: new Date().toISOString(),
    };

    const updated = [entry, ...expenses];
    setExpenses(updated);
    saveExpenses(updated);
    setName("");
    setPrice("");
  };

  const handleDelete = (id: string) => {
    const updated = expenses.filter((e) => e.id !== id);
    setExpenses(updated);
    saveExpenses(updated);
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F2EB]">
      <div className="matcha-hero relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-[60px]" />
        <div className="max-w-md mx-auto px-5 pt-6 pb-24 relative z-10">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[13px] text-white/80 font-semibold px-4 py-2 rounded-full bg-white/10 border border-white/20 active:scale-95 transition-all mb-6"
          >
            &#8592; Powrót
          </button>
          <div className="text-center">
            <h1 className="text-[24px] font-black text-white">Wydatki na jedzenie</h1>
            <p className="text-white/50 text-[13px] mt-1">Proste sumowanie zakupów</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 -mt-14 pb-24 relative z-20">
        {/* Monthly total */}
        <div className="card-elevated rounded-[24px] p-6 mb-4 text-center">
          <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">
            {monthName} {currentYear}
          </p>
          <p className="text-[36px] font-black text-[#1A3A0A] mt-2">
            {monthlyTotal.toFixed(2)} zł
          </p>
          <p className="text-[12px] text-gray-400 mt-1">
            {monthlyExpenses.length} {monthlyExpenses.length === 1 ? "pozycja" : monthlyExpenses.length < 5 ? "pozycje" : "pozycji"}
          </p>
        </div>

        {/* Add new expense */}
        <div className="card-elevated rounded-[20px] p-4 mb-4">
          <p className="text-[13px] font-bold text-[#1A3A0A] mb-3">Dodaj wydatek</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa produktu"
              className="flex-1 px-3 py-2.5 rounded-[12px] bg-gray-50 text-[13px] font-medium outline-none focus:ring-2 focus:ring-[#84CC16]/30"
            />
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Cena"
              className="w-20 px-3 py-2.5 rounded-[12px] bg-gray-50 text-[13px] font-medium outline-none focus:ring-2 focus:ring-[#84CC16]/30 text-right"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2.5 rounded-[12px] bg-[#1A3A0A] text-white text-[13px] font-bold active:scale-95 transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Current month entries */}
        {monthlyExpenses.length > 0 && (
          <div className="card-elevated rounded-[20px] p-4 mb-4">
            <p className="text-[13px] font-bold text-[#1A3A0A] mb-3">
              Wydatki w {monthName}
            </p>
            <div className="space-y-2">
              {monthlyExpenses.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-[14px] p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-gray-700 truncate">
                      {e.name}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(e.date).toLocaleDateString("pl-PL")}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-[#1A3A0A]">
                    {e.price.toFixed(2)} zł
                  </span>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="text-[11px] text-gray-300 hover:text-red-400 transition-colors ml-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly history */}
        {monthGroups.size > 1 && (
          <div className="card-elevated rounded-[20px] p-4">
            <p className="text-[13px] font-bold text-[#1A3A0A] mb-3">
              Historia miesięczna
            </p>
            <div className="space-y-2">
              {Array.from(monthGroups.entries()).map(([key, group]) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-gray-50 rounded-[14px] p-3"
                >
                  <span className="text-[12px] font-medium text-gray-600 capitalize">
                    {group.label}
                  </span>
                  <span className="text-[13px] font-bold text-[#1A3A0A]">
                    {group.total.toFixed(2)} zł
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
