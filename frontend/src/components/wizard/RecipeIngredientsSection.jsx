import { useMemo } from 'react';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Icon } from '../ui/Icon.jsx';
import { Button } from '../ui/Button.jsx';
import { AsyncImage } from '../ui/AsyncImage.jsx';
import { ProductSubstitutionSheet } from './ProductSubstitutionSheet.jsx';
import { useProductsStore } from '../../stores/productsStore.js';
import { getRecipeUsage } from '../../stores/wizardStore.js';
import { formatIngredientQty } from '../../lib/unitConverter.js';

const PRODUCT_ICONS = ['package', 'bag', 'shopping-bag', 'box'];

function iconForProduct(p) {
  const key = String(p.id ?? p.name ?? '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return PRODUCT_ICONS[key % PRODUCT_ICONS.length];
}

export function RecipeIngredientsSection({
  selectedRecipes,
  recipes,
  quotidienQty,
  setQuotidienQty,
  markProduct,
  substitutionSheet,
  setSubstitutionSheet,
  onOpenSubstitution,
}) {
  const allProducts = useProductsStore((s) => s.items);
  const loaded = useProductsStore((s) => s.loaded);

  // Build a deduplicated list of ingredient → product mappings from selected recipes
  const recipeItems = useMemo(() => {
    if (!recipes || !selectedRecipes || !loaded) return [];
    const results = [];

    recipes.forEach((recipe) => {
      const servings = selectedRecipes[recipe.id];
      if (servings == null) return;

      (recipe.ingredients || []).forEach((ing) => {
        // Skip ingredients without a product_id — can't resolve them here
        if (ing.product_id == null) return;

        const linkedProduct = allProducts.find(
          (p) => String(p.id) === String(ing.product_id)
        );
        if (!linkedProduct) return;

        const baseQty = (ing.quantity_per_serving || 0) * servings;

        // See if this product is also used by other recipes
        const usage = getRecipeUsage({
          productId: linkedProduct.id,
          productName: linkedProduct.name,
          productUnit: linkedProduct.unit,
          product: linkedProduct,
          selectedRecipes,
          recipes,
        });

        results.push({
          key: `${recipe.id}-${ing.id || ing.name}`,
          ingredient: {
            name: ing.name,
            qty: baseQty,
            unit: ing.unit,
            category_hint: ing.category_hint || ing.category || null,
          },
          recipeName: recipe.name,
          product: linkedProduct,
          usage,
        });
      });
    });

    // Consolidate by product_id (same product used in multiple recipes)
    const byProduct = new Map();
    results.forEach((item) => {
      const pid = item.product.id;
      if (byProduct.has(pid)) {
        const existing = byProduct.get(pid);
        // Merge usage breakdowns
        existing.usage.totalQuantity += item.usage.totalQuantity;
        existing.usage.breakdown = [
          ...existing.usage.breakdown,
          ...item.usage.breakdown,
        ];
        // Keep first ingredient info
        existing.recipeName = existing.recipeName + ', ' + item.recipeName;
      } else {
        byProduct.set(pid, { ...item });
      }
    });

    return Array.from(byProduct.values());
  }, [recipes, selectedRecipes, allProducts, loaded]);

  if (!loaded) return null;

  const hasItems = recipeItems.length > 0;
  if (!hasItems) return null;

  const hasSubstitutions = recipeItems.some(
    (item) => item.usage && item.usage.hasSubstitutions
  );

  return (
    <section className="stack stack--lg">
      <div className="recipe-ingredients-header">
        <h2 className="recipe-ingredients-header__title">
          Pour ta recette
        </h2>
        <p className="recipe-ingredients-header__subtitle">
          {recipeItems.length} ingredient
          {recipeItems.length > 1 ? 's' : ''} lies a
          {hasSubstitutions ? ' — alternatives disponibles' : ''}
        </p>
      </div>

      <div className="stack stack--sm">
        {recipeItems.map((item) => {
          const product = item.product;
          const qty = quotidienQty[product.id] ?? 1;
          const keyword = [product.name, product.category, product.rayon]
            .filter(Boolean)
            .join(' ');
          const hasSubs =
            item.usage?.hasSubstitutions &&
            item.usage?.substitutionCount > 0;
          const subCount = item.usage?.substitutionCount || 0;
          const formattedQty = formatIngredientQty(
            item.ingredient.qty,
            item.ingredient.unit
          );

          return (
            <Card key={item.key} className="recipe-ingredient-card">
              <div className="recipe-ingredient-card__row">
                {/* Product image */}
                <div className="recipe-ingredient-card__image-wrap">
                  <AsyncImage
                    src={product.image_url || undefined}
                    keyword={keyword}
                    alt={product.name}
                    className="recipe-ingredient-card__image"
                    fallbackIcon={iconForProduct(product)}
                    fallbackIconSize={40}
                  />
                </div>

                {/* Info */}
                <div className="recipe-ingredient-card__body">
                  <div className="recipe-ingredient-card__name-row">
                    <span className="recipe-ingredient-card__name">
                      {product.name}
                    </span>
                    {product.brand && (
                      <span className="recipe-ingredient-card__brand">
                        {product.brand}
                      </span>
                    )}
                  </div>

                  <div className="recipe-ingredient-card__meta-row">
                    <Badge variant="primary" style={{ fontSize: 11 }}>
                      {item.ingredient.name}
                    </Badge>
                    {formattedQty && (
                      <span className="recipe-ingredient-card__qty-badge">
                        {formattedQty}
                      </span>
                    )}
                    <span className="recipe-ingredient-card__recipe-name">
                      {item.recipeName}
                    </span>
                  </div>

                  {product.grammage_g && (
                    <div className="recipe-ingredient-card__grammage">
                      {qty} x {product.grammage_g}g
                    </div>
                  )}

                  {hasSubs && (
                    <button
                      type="button"
                      className="recipe-ingredient-card__sub-btn"
                      onClick={() => onOpenSubstitution(item)}
                    >
                      <Icon name="sparkles" size={12} strokeWidth={2.5} />
                      {subCount} alternative
                      {subCount > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                {/* Quantity control */}
                <div className="recipe-ingredient-card__qty">
                  <div className="recipe-ingredient-card__qty-value">
                    {qty}
                  </div>
                  <div className="recipe-ingredient-card__qty-label">
                    {product.unit || 'unite'}
                  </div>
                  <div className="recipe-ingredient-card__qty-btns">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const next = Math.max(0, qty - 1);
                        if (next === 0) {
                          markProduct(product.id, null);
                        }
                        setQuotidienQty(product.id, next);
                      }}
                      aria-label="Diminuer"
                    >
                      <Icon name="minus" size={14} strokeWidth={2.5} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setQuotidienQty(product.id, qty + 1)
                      }
                      aria-label="Augmenter"
                    >
                      <Icon name="plus" size={14} strokeWidth={2.5} />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
