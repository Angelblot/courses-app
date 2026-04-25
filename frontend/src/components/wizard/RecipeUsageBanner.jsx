function formatQuantity(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return String(qty);
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function RecipeUsageBanner({ recipeUsage }) {
  if (!recipeUsage || recipeUsage.totalQuantity <= 0) return null;
  const { totalQuantity, breakdown } = recipeUsage;
  if (!breakdown.length) return null;

  const unit = breakdown[0].unit || 'unité';
  const qty = formatQuantity(totalQuantity);
  const label =
    breakdown.length === 1
      ? `Déjà prévu : ${qty} ${unit} · ${breakdown[0].recipeName}`
      : `Déjà prévu : ${qty} ${unit} · ${breakdown.length} recettes`;

  return (
    <div className="recipe-usage-banner" role="note" title={label}>
      {label}
    </div>
  );
}
