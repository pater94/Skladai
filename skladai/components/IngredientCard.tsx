import { Ingredient } from "@/lib/types";

interface Props {
  ingredient: Ingredient;
  onIngredientClick?: (name: string) => void;
}

const categoryConfig = {
  natural: { label: "Naturalny", bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400" },
  processed: { label: "Przetworzony", bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-400" },
  controversial: { label: "Kontrowersyjny", bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400" },
  harmful: { label: "Szkodliwy", bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" },
};

const riskConfig = {
  safe: { icon: "✅", glow: "" },
  caution: { icon: "⚠️", glow: "" },
  warning: { icon: "🔴", glow: "" },
};

export default function IngredientCard({ ingredient, onIngredientClick }: Props) {
  const cat = categoryConfig[ingredient.category] || categoryConfig.natural;
  const risk = riskConfig[ingredient.risk] || riskConfig.safe;

  return (
    <div className="card-elevated rounded-[18px] p-4 active:scale-[0.98] transition-transform cursor-pointer" onClick={() => onIngredientClick?.(ingredient.name)}>
      <div className="flex items-start gap-3">
        {/* Risk dot with color glow */}
        <div className="relative mt-1 flex-shrink-0">
          <div className={`w-3 h-3 rounded-full ${cat.dot}`} />
          <div className={`absolute inset-0 w-3 h-3 rounded-full ${cat.dot} opacity-30 blur-sm`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-[13px]">{ingredient.name}</p>
            <span className="text-[13px]">{risk.icon}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${cat.bg} ${cat.text}`}>
              {cat.label}
            </span>
          </div>
          {ingredient.original && ingredient.original !== ingredient.name && (
            <p className="text-[11px] text-gray-400 mt-1.5 italic font-medium">{ingredient.original}</p>
          )}
          <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">{ingredient.explanation}</p>
          {onIngredientClick && <p className="text-[10px] text-blue-400 mt-1.5 font-medium">Kliknij aby dowiedzieć się więcej →</p>}
        </div>
      </div>
    </div>
  );
}
