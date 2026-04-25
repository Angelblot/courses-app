import { formatIngredientQty } from '../../lib/unitConverter.js';

export function RecipeUsageBanner({ recipeUsage }) {
  if (!recipeUsage || recipeUsage.totalQuantity <= 0) return null;
  const { totalQuantity, breakdown, approximate } = recipeUsage;
  if (!breakdown.length) return null;

  const first = breakdown[0];
  const prefix = approximate ? '~' : '';

  // Cas 1 recette : "Déjà prévu : ~200g de lardons · Carbonara"
  if (breakdown.length === 1) {
    const qty = first.ingredientQty || totalQuantity;
    const unit = first.ingredientUnit || first.unit || 'unité';
    const formatted = formatIngredientQty(qty, unit);
    if (!formatted) {
      // Conversion impossible — on peut quand même mentionner la recette
      return (
        <div className="recipe-usage-banner" role="note">
          Déjà prévu dans la recette {first.recipeName}
        </div>
      );
    }
    const label = `Déjà prévu : ${prefix}${formatted} de ${first.recipeName}`;
    return (
      <div className="recipe-usage-banner" role="note" title={label}>
        {label}
      </div>
    );
  }

  // Cas plusieurs recettes : "Déjà prévu : ~200g · 3 recettes"
  const qty = totalQuantity;
  const unit = first.ingredientUnit || first.unit || 'unité';
  const formatted = formatIngredientQty(qty, unit);
  if (!formatted) {
    return (
      <div className="recipe-usage-banner" role="note">
        Déjà prévu dans {breakdown.length} recettes
      </div>
    );
  }
  const label = `Déjà prévu : ${prefix}${formatted} · ${breakdown.length} recettes`;
  return (
    <div className="recipe-usage-banner" role="note" title={label}>
      {label}
    </div>
  );
}
