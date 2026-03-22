import { Ingredient } from "@/lib/types";

const riskIcons: Record<string, string> = {
  safe: "✅",
  caution: "⚠️",
  warning: "🔴",
};

const categoryLabels: Record<string, { label: string; className: string }> = {
  natural: { label: "Naturalny", className: "bg-green-100 text-green-800" },
  processed: { label: "Przetworzony", className: "bg-orange-100 text-orange-800" },
  controversial: { label: "Kontrowersyjny", className: "bg-red-100 text-red-700" },
  harmful: { label: "Szkodliwy", className: "bg-red-200 text-red-900" },
};

export default function IngredientCard({ ingredient }: { ingredient: Ingredient }) {
  const cat = categoryLabels[ingredient.category] || categoryLabels.natural;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{riskIcons[ingredient.risk] || "✅"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800">{ingredient.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.className}`}>
              {cat.label}
            </span>
          </div>
          {ingredient.original !== ingredient.name && (
            <p className="text-xs text-gray-400 mt-0.5">{ingredient.original}</p>
          )}
          <p className="text-sm text-gray-600 mt-1">{ingredient.explanation}</p>
        </div>
      </div>
    </div>
  );
}
