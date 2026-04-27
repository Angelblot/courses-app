/**
 * RecipeUsageBanner – affiché DANS la carte swipe du produit.
 * Montre le besoin de la recette pour ce produit spécifique,
 * en utilisant les vraies valeurs de grammage de la DB.
 *
 * Affichages :
 * - "Pour ta recette : 200g · Pâtes Carbonara" (avec bouton alternative si substitution dispo)
 * - "Pour ta recette : 200g · Pâtes Carbonara, Gratin Dauphinois" (multi-recettes)
 * - Petit texte complémentaire : "200g · 1 barquette" pour le grammage produit
 */
export function RecipeUsageBanner({ recipeUsage }) {
  if (!recipeUsage || !recipeUsage.breakdown || recipeUsage.breakdown.length === 0) return null;

  const { breakdown, approximate, missingGrammage } = recipeUsage;
  const prefix = approximate ? '~' : '';

  if (missingGrammage) {
    return (
      <div className="recipe-usage-banner recipe-usage-banner--missing" role="note">
        Indique le poids pour le calcul de la recette
      </div>
    );
  }

  // Afficher la quantité nécessaire de l'ingrédient (en g/ml ou unités)
  // Les quantities dans breakdown sont déjà converties via convertToProductQty
  // On veut montrer la quantité brute de l'ingrédient dans la recette
  const first = breakdown[0];
  const qty = first.ingredientQty || 0;
  const unit = first.ingredientUnit || first.unit || '';

  // Formater la quantité d'ingrédient (ex: "200g", "50ml", "2 unités")
  let qtyDisplay = '';
  if (qty > 0) {
    if (unit === 'g' || unit === 'gramme' || unit === 'grammes') {
      qtyDisplay = `${prefix}${qty}g`;
    } else if (unit === 'ml' || unit === 'millilitre' || unit === 'millilitres') {
      qtyDisplay = `${prefix}${qty}ml`;
    } else if (unit === 'kg' || unit === 'kilo' || unit === 'kilos') {
      qtyDisplay = `${prefix}${qty * 1000}g`;
    } else if (unit === 'l' || unit === 'litre' || unit === 'litres') {
      qtyDisplay = `${prefix}${qty * 1000}ml`;
    } else {
      qtyDisplay = `${prefix}${qty} ${unit}`;
    }
  }

  // Noms des recettes
  const recipeNames = [...new Set(breakdown.map(b => b.recipeName))];

  if (recipeNames.length === 1) {
    const label = qtyDisplay
      ? `Pour ta recette : ${qtyDisplay} · ${recipeNames[0]}`
      : `Pour ta recette : ${recipeNames[0]}`;
    return (
      <div className="recipe-usage-banner" role="note" title={label}>
        {label}
      </div>
    );
  }

  // Plusieurs recettes
  if (recipeNames.length > 1) {
    const label = qtyDisplay
      ? `Pour ta recette : ${qtyDisplay} · ${recipeNames.join(', ')}`
      : `Pour ta recette : ${recipeNames.join(', ')}`;
    return (
      <div className="recipe-usage-banner" role="note" title={label}>
        {label}
      </div>
    );
  }

  return null;
}
