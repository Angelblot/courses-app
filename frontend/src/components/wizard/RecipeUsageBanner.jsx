import { formatIngredientQty } from '../../lib/unitConverter.js';

export function RecipeUsageBanner({ recipeUsage }) {
  if (!recipeUsage || recipeUsage.totalQuantity <= 0) return null;
  const { totalQuantity, breakdown, approximate, missingGrammage } = recipeUsage;
  if (!breakdown.length) return null;

  const first = breakdown[0];
  const prefix = approximate ? '~' : '';

  // Cas special: grammage manquant — on ne peut pas calculer la quantite
  if (missingGrammage) {
    // 1 recette
    if (breakdown.length === 1) {
      return (
        <div className="recipe-usage-banner recipe-usage-banner--missing" role="note">
          Dans la recette {first.recipeName}
          <span className="recipe-usage-banner__hint">
            {' '}· Indique le poids pour le calcul
          </span>
        </div>
      );
    }
    // Plusieurs recettes
    return (
      <div className="recipe-usage-banner recipe-usage-banner--missing" role="note">
        Dans {breakdown.length} recettes
        <span className="recipe-usage-banner__hint">
          {' '}· Indique le poids pour le calcul
        </span>
      </div>
    );
  }

  // Cas 1 recette : "Deja prevu : ~200g de lardons · Carbonara"
  if (breakdown.length === 1) {
    const qty = first.ingredientQty || totalQuantity;
    const unit = first.ingredientUnit || first.unit || 'unité';
    const formatted = formatIngredientQty(qty, unit);
    if (!formatted) {
      // Conversion impossible — on peut quand même mentionner la recette
      return (
        <div className="recipe-usage-banner" role="note">
          Deja prevu dans la recette {first.recipeName}
        </div>
      );
    }
    const label = `Deja prevu : ${prefix}${formatted} de ${first.recipeName}`;
    return (
      <div className="recipe-usage-banner" role="note" title={label}>
        {label}
      </div>
    );
  }

  // Cas plusieurs recettes : "Deja prevu : ~200g · 3 recettes"
  const qty = totalQuantity;
  const unit = first.ingredientUnit || first.unit || 'unité';
  const formatted = formatIngredientQty(qty, unit);
  if (!formatted) {
    return (
      <div className="recipe-usage-banner" role="note">
        Deja prevu dans {breakdown.length} recettes
      </div>
    );
  }
  const label = `Deja prevu : ${prefix}${formatted} · ${breakdown.length} recettes`;
  return (
    <div className="recipe-usage-banner" role="note" title={label}>
      {label}
    </div>
  );
}
