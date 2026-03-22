import { NutritionItem } from "@/lib/types";

export default function NutritionTable({ items }: { items: NutritionItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100"
        >
          <span className="text-2xl w-8 text-center">{item.icon}</span>
          <div className="flex-1">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-sm font-semibold text-gray-900">{item.value}</span>
            </div>
            {item.sub && (
              <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
