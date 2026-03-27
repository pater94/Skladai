import { CosmeticIngredient } from "@/lib/types";

interface Props {
  ingredient: CosmeticIngredient;
  isCosmetics?: boolean;
}

const categoryConfig = {
  safe: { label: "Bezpieczny", bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400", darkBg: "bg-emerald-500/10", darkText: "text-emerald-400" },
  caution: { label: "Ostrożnie", bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-400", darkBg: "bg-amber-500/10", darkText: "text-amber-400" },
  controversial: { label: "Kontrowersyjny", bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400", darkBg: "bg-orange-500/10", darkText: "text-orange-400" },
  harmful: { label: "Ryzykowny", bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400", darkBg: "bg-red-500/10", darkText: "text-red-400" },
};

export default function CosmeticIngredientCard({ ingredient, isCosmetics = false }: Props) {
  const cat = categoryConfig[ingredient.category] || categoryConfig.safe;

  return (
    <div className={`rounded-[18px] p-4 ${isCosmetics ? "velvet-card" : "card-elevated"}`}>
      <div className="flex items-start gap-3">
        <div className="relative mt-1.5 flex-shrink-0">
          <div className={`w-3 h-3 rounded-full ${cat.dot}`} />
          <div className={`absolute inset-0 w-3 h-3 rounded-full ${cat.dot} opacity-30 blur-sm`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-[13px] ${isCosmetics ? "text-white" : "text-gray-900"}`}>{ingredient.name}</p>
          {ingredient.polish_name && (
            <p className={`text-[11px] mt-0.5 font-medium ${isCosmetics ? "text-white/35" : "text-gray-400"}`}>{ingredient.polish_name}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isCosmetics ? `${cat.darkBg} ${cat.darkText}` : `${cat.bg} ${cat.text}`}`}>
              {cat.label}
            </span>
            {ingredient.function && (
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${isCosmetics ? "bg-purple-500/10 text-purple-400" : "bg-purple-50 text-purple-500"}`}>
                {ingredient.function}
              </span>
            )}
          </div>
          {ingredient.concerns && ingredient.concerns.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ingredient.concerns.map((c, i) => (
                <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${isCosmetics ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-400"}`}>
                  ⚠ {c}
                </span>
              ))}
            </div>
          )}
          <p className={`text-[12px] mt-2 leading-relaxed ${isCosmetics ? "text-white/50" : "text-gray-500"}`}>{ingredient.explanation}</p>
        </div>
      </div>
    </div>
  );
}
