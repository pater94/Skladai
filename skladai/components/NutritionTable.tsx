import { NutritionItem } from "@/lib/types";

export default function NutritionTable({ items }: { items: NutritionItem[] }) {
  return (
    <div className="card-elevated rounded-[20px] overflow-hidden">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-center px-5 py-4 ${
            i !== items.length - 1 ? "border-b border-gray-50" : ""
          }`}
        >
          <span className="text-xl w-9 flex-shrink-0">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-800">{item.label}</p>
            {item.sub && (
              <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{item.sub}</p>
            )}
          </div>
          <span className="text-[14px] font-bold text-gray-700 tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
